// static/scripts.js

document.addEventListener('DOMContentLoaded', function() {
    // Customize the parameters as needed
    const numUsers = 100; // Number of users
    const numWeeks = 52; // Number of weeks
    const numPredWeeks = 10; // Number of prediction weeks

    populateDummyData(numUsers, numWeeks, numPredWeeks);

    document.getElementById('uploadForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(this);
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            $('#uploadModal').modal('hide');
            fetchPredictionData();
        })
        .catch(error => console.error('Error:', error));
    });
});




function fetchDataAndUpdateTable() {
    fetch('/get_data')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.querySelector('#dataUsage');
            tableBody.innerHTML = '';

            // Determine the maximum week number from the data
            let maxWeek = 0;
            data.data.forEach(row => {
                if (row.minggu > maxWeek) {
                    maxWeek = row.minggu;
                }
            });

            // Create table headers dynamically based on maxWeek
            const tableHead = document.querySelector('#predictionTable thead tr');
            tableHead.innerHTML = '<th>User</th><th>Location</th><th>Category</th><th>Connected Power</th>';
            for (let i = 1; i <= maxWeek; i++) {
                tableHead.innerHTML += `<th>Week ${i}</th>`;
            }

            // Create table rows
            const userRows = {};
            const categoryData = {};
            const locationData = {};

            data.data.forEach(row => {
                if (!userRows[row.nama_pemakai]) {
                    userRows[row.nama_pemakai] = {
                        nama_pemakai: row.nama_pemakai,
                        lokasi: row.lokasi,
                        kategori: row.kategori,
                        daya_tersambung: row.daya_tersambung,
                        weeks: {}
                    };
                }
                userRows[row.nama_pemakai].weeks[row.minggu] = row.usage_data;

                // Aggregate data by category
                if (!categoryData[row.kategori]) {
                    categoryData[row.kategori] = Array(maxWeek).fill(0);
                }
                categoryData[row.kategori][row.minggu - 1] += row.usage_data;

                // Aggregate data by location
                if (!locationData[row.lokasi]) {
                    locationData[row.lokasi] = Array(maxWeek).fill(0);
                }
                locationData[row.lokasi][row.minggu - 1] += row.usage_data;
            });

            // Append table rows and add click event for modal
            Object.values(userRows).forEach(user => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${user.nama_pemakai}</td>
                    <td>${user.lokasi}</td>
                    <td>${user.kategori}</td>
                    <td>${user.daya_tersambung}</td>
                `;
                for (let i = 1; i <= maxWeek; i++) {
                    tr.innerHTML += `<td>${user.weeks[i] || ''}</td>`;
                }
                tr.addEventListener('click', () => showChartModal(user));
                tableBody.appendChild(tr);
            });

            // Generate charts
            generateCategoryCharts(categoryData, maxWeek);
            generateLocationCharts(locationData, maxWeek);
        })
        .catch(error => console.error('Error:', error));
}
function generateCategoryCharts(categoryData, maxWeek) {
    const chartContainer = document.querySelector('#categoryCharts');
    chartContainer.innerHTML = '';

    const chartDiv = document.createElement('div');
    chartDiv.style.height = '400px';
    chartDiv.style.marginBottom = '20px';
    chartContainer.appendChild(chartDiv);

    const weeks = Array.from({ length: maxWeek }, (_, i) => `Week ${i + 1}`);
    const seriesData = [];
    Object.keys(categoryData).forEach(category => {
        seriesData.push({
            name: category,
            type: 'line',
            data: categoryData[category]
        });
    });

    const chart = echarts.init(chartDiv);
    const option = {
        
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: Object.keys(categoryData)
        },
        xAxis: {
            type: 'category',
            data: weeks
        },
        yAxis: {
            type: 'value'
        },
        series: seriesData
    };
    chart.setOption(option);
}

function generateLocationCharts(locationData, maxWeek) {
    const chartContainer = document.querySelector('#locationCharts');
    chartContainer.innerHTML = '';

    const chartDiv = document.createElement('div');
    chartDiv.style.height = '400px';
    chartDiv.style.marginBottom = '20px';
    chartContainer.appendChild(chartDiv);

    const weeks = Array.from({ length: maxWeek }, (_, i) => `Week ${i + 1}`);
    const seriesData = [];
    Object.keys(locationData).forEach(location => {
        seriesData.push({
            name: location,
            type: 'line',
            data: locationData[location]
        });
    });

    const chart = echarts.init(chartDiv);
    const option = {
        
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: Object.keys(locationData)
        },
        xAxis: {
            type: 'category',
            data: weeks
        },
        yAxis: {
            type: 'value'
        },
        series: seriesData
    };
    chart.setOption(option);
}
function showChartModal(user) {
    $('#chartModal').modal('show');

    // Wait for the modal to be fully shown before initializing the chart
    $('#chartModal').on('shown.bs.modal', function () {
        const weeks = [];
        const usageData = [];
        for (let i = 1; i <= 52; i++) {
            weeks.push(`Week ${i}`);
            usageData.push(user.weeks[i] || 0);
        }

        const chartContainer = document.getElementById('chartContainer');
        const chart = echarts.init(chartContainer);
        const option = {
            title: {
                text: `Usage Data for ${user.nama_pemakai}`
            },
            tooltip: {
                trigger: 'axis'
            },
            xAxis: {
                type: 'category',
                data: weeks
            },
            yAxis: {
                type: 'value'
            },
            series: [{
                name: 'Usage',
                type: 'line',
                data: usageData
            }]
        };
        chart.setOption(option);
    });

    // Clean up the chart when the modal is hidden
    $('#chartModal').on('hidden.bs.modal', function () {
        echarts.dispose(document.getElementById('chartContainer'));
    });
}

function toFixedDecimal(numStr) {
    // Extract first 6 characters after converting to string
    const shortStr = numStr.toString().substring(0, 6);
    const num = parseFloat(shortStr);
    return num.toFixed(4);
}
function fetchPredictionDataAndUpdateTable() {
    fetch('/predict')
        .then(response => response.json())
        .then(data => {
            const tableContainer = document.querySelector('#tabel_prediksi');
            tableContainer.innerHTML = '';

            // Create table element
            const table = document.createElement('table');
            table.className = 'table table-striped';
            table.id = 'predictionTable';

            // Create table headers dynamically for predicted weeks
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = '<th>User</th><th>Category</th><th>Location</th><th>Connected Power</th>';
            for (let i = 1; i <= 10; i++) {
                headerRow.innerHTML += `<th>Pred Week ${i}</th>`;
            }
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Create table body
            const tbody = document.createElement('tbody');
            tbody.id = 'dataUsage';
            
            // Function to convert scientific notation to fixed decimal with 4 decimal places
            

            // Create table rows for predicted data
            data.data.forEach(row => {
                const tr = document.createElement('tr');
                const userInfo = row.User;

                tr.innerHTML = `
                    <td>${userInfo[0]}</td>
                    <td>${userInfo[1]}</td>
                    <td>${userInfo[2]}</td>
                    <td>${userInfo[3]}</td>
                `;
                
                for (let i = 1; i <= 10; i++) {
                    let predValue = row[`Pred_Week_${i}`];
                    // Convert scientific notation to fixed decimal
                    predValue = toFixedDecimal(predValue);
                    let actualValue = row[`Week_${42 + i - 1}`] || 0; // Ensure the week value exists, default to 0 if not
                    tr.innerHTML += `<td>${(parseFloat(predValue) + parseFloat(actualValue)).toFixed(4)}</td>`;
                }

                tr.addEventListener('click', () => showPredictionChartModal(userInfo, row));
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            tableContainer.appendChild(table);
        })
        .catch(error => console.error('Error:', error));
}

function showPredictionChartModal(userInfo, rowData) {
    $('#predictionChartModal').modal('show');

    // Wait for the modal to be fully shown before initializing the chart
    $('#predictionChartModal').on('shown.bs.modal', function () {
        const weeks = [];
        const usageData = [];
        const predictedData = [];
        const combinedData = [];

        for (let i = 1; i <= 42; i++) {
            weeks.push(`Week ${i}`);
            usageData.push(rowData[`Week_${i}`] || 0);
            predictedData.push(null);  // No predicted data for these weeks
            combinedData.push(null);   // No combined data for these weeks
        }

        for (let i = 43; i <= 52; i++) {
            weeks.push(`Week ${i}`);
            let actualValue = rowData[`Week_${i}`] || 0;
            usageData.push(actualValue);
            let predValue = toFixedDecimal(rowData[`Pred_Week_${i - 42}`]);
            predValue = parseFloat(predValue);
            predictedData.push(predValue);
            combinedData.push((predValue + actualValue).toFixed(4));
        }

        const chartContainer = document.getElementById('predictionChartContainer');
        const chart = echarts.init(chartContainer);
        const option = {
            title: {
                text: `Usage Data for ${userInfo[0]}`
            },
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                data: ['Actual Usage',  'Predicted Usage']
            },
            xAxis: {
                type: 'category',
                data: weeks
            },
            yAxis: {
                type: 'value'
            },
            series: [
                {
                    name: 'Actual Usage',
                    type: 'line',
                    data: usageData
                },
                
                {
                    name: 'Predicted Usage',
                    type: 'line',
                    data: combinedData,
                    itemStyle: {
                        color: 'orange'
                    }
                }
            ]
        };
        chart.setOption(option);
    });

    // Clean up the chart when the modal is hidden
    $('#predictionChartModal').on('hidden.bs.modal', function () {
        echarts.dispose(document.getElementById('predictionChartContainer'));
    });
}

function uploadFile(event) {
    event.preventDefault(); // Mencegah form submit secara default

    let formData = new FormData();
    let fileInput = document.getElementById('fileInput');
    let clearData = document.getElementById('clearData').checked;

    formData.append('file', fileInput.files[0]);
    formData.append('clear_data', clearData);

    fetch('/uploader', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(data => {
        alert('File uploaded successfully!');
        console.log(data);
        $('#uploadModal').modal('hide'); // Tutup modal setelah sukses upload
    })
    .catch(error => {
        console.error('Error:', error);
        alert('File upload failed!');
    });
}

// Event listener untuk form submit
document.getElementById('uploadForm').addEventListener('submit', uploadFile);

fetchDataAndUpdateTable()

fetchPredictionDataAndUpdateTable()
