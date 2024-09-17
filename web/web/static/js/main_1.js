async function fetchUsageData() {
    try {
      // Fetch data dari API endpoint /get_usage_data
      const response = await fetch('/get_usage_data');
      const result = await response.json();

      if (result.status === 'success') {
        const data = result.data;

        // Dapatkan referensi ke elemen tabel head dan body
        const tableHead = document.getElementById('table-head');
        const tableBody = document.getElementById('table-body');

        // Kosongkan tabel sebelum memuat data
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        // Membuat header tabel
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
          <th>Wilayah</th>
          <th>Kategori</th>
          ${Array.from({ length: 52 }, (_, i) => `<th>Week ${i + 1}</th>`).join('')}
        `;
        tableHead.appendChild(headerRow);

        // Iterasi setiap data dan tambahkan baris ke tabel body
        data.forEach((row) => {
          const tr = document.createElement('tr');

          // Tambahkan kolom Wilayah, Kategori, dan week_1 hingga week_52 ke dalam baris
          tr.innerHTML = `
            <td>${row.Wilayah}</td>
            <td>${row.Kategori}</td>
            ${Object.keys(row)
              .filter(key => key.startsWith('week'))
              .map(key => `<td>${row[key]}</td>`)
              .join('')}
          `;
          
          // Tambahkan baris ke body tabel
          tableBody.appendChild(tr);
        });
      } else {
        console.error('Error fetching data:', result.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  async function fetchPredictionData(tableId) {
    try {
      // Fetch data dari API endpoint /get_predictions_data
      const response = await fetch('/get_predictions_data');
      const result = await response.json();

      if (result.status === 'success') {
        const data = result.data;

        // Grupkan data berdasarkan Wilayah dan Kategori
        const groupedData = data.reduce((acc, row) => {
          const key = `${row.Wilayah}-${row.Kategori}`;
          if (!acc[key]) {
            acc[key] = {
              Wilayah: row.Wilayah,
              Kategori: row.Kategori,
              predictions: {}
            };
          }
          acc[key].predictions[`week_${row.week_pred}`] = row.prediction_result;
          return acc;
        }, {});

        // Dapatkan referensi ke elemen tabel dengan ID yang diberikan
        const table = document.getElementById(tableId);
        const tableHead = table.querySelector('thead');
        const tableBody = table.querySelector('tbody');

        // Kosongkan tabel sebelum memuat data
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        // Membuat header tabel
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
          <th>Wilayah</th>
          <th>Kategori</th>
          ${Array.from({ length: 10 }, (_, i) => `<th>Week ${53 + i}</th>`).join('')}
        `;
        tableHead.appendChild(headerRow);

        // Iterasi setiap grup wilayah dan kategori untuk menampilkan baris data
        Object.values(groupedData).forEach(group => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${group.Wilayah}</td>
            <td>${group.Kategori}</td>
            ${Array.from({ length: 10 }, (_, i) => {
              const week = `week_${53 + i}`;
              return `<td>${group.predictions[week] || '-'}</td>`;
            }).join('')}
          `;
          tableBody.appendChild(tr);
        });
      } else {
        console.error('Error fetching data:', result.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  async function fetchAndRenderCharts() {
    try {
      // Ambil data prediksi berdasarkan kategori dan wilayah dari /get_predictions_data
      const predictionResponse = await fetch('/get_predictions_data');
      const predictionResult = await predictionResponse.json();

      // Struktur data dari respon
      if (predictionResult.status === 'success') {
        const data = predictionResult.data;

        // Data Prediksi: Hitung prediksi berdasarkan kategori dan minggu
        const categoryTotals = {};
        const regionTotals = {};

        data.forEach(row => {
          // Kategori Totals (Data diambil berdasarkan kategori dan minggu prediksi)
          if (!categoryTotals[row.Kategori]) {
            categoryTotals[row.Kategori] = {};
          }
          if (!categoryTotals[row.Kategori][row.week_pred]) {
            categoryTotals[row.Kategori][row.week_pred] = 0;
          }
          categoryTotals[row.Kategori][row.week_pred] += row.prediction_result;

          // Region Totals (Data diambil berdasarkan wilayah dan minggu prediksi)
          if (!regionTotals[row.Wilayah]) {
            regionTotals[row.Wilayah] = {};
          }
          if (!regionTotals[row.Wilayah][row.week_pred]) {
            regionTotals[row.Wilayah][row.week_pred] = 0;
          }
          regionTotals[row.Wilayah][row.week_pred] += row.prediction_result;
        });

        // Siapkan minggu untuk sumbu X (misal prediksi diambil untuk minggu 53 - 63)
        const weeks = Array.from({ length: 10 }, (_, i) => `Week ${53 + i}`);

        // Render grafik kategori (line chart)
        const categoryNames = Object.keys(categoryTotals);
        const categorySeries = categoryNames.map(name => ({
          name,
          type: 'line',
          data: weeks.map(week => categoryTotals[name][week.replace('Week ', '')] || 0)
        }));

        const categoryChart = echarts.init(document.getElementById('category_chart'));
        const categoryOption = {
          title: {
            text: 'Prediksi Berdasarkan Kategori',
            left: 'center'
          },
          tooltip: {
            trigger: 'axis'
          },
          legend: {
            data: categoryNames,
            top: 'bottom'
          },
          xAxis: {
            type: 'category',
            data: weeks
          },
          yAxis: {
            type: 'value'
          },
          series: categorySeries
        };
        categoryChart.setOption(categoryOption);

        // Render grafik wilayah (line chart)
        const regionNames = Object.keys(regionTotals);
        const regionSeries = regionNames.map(name => ({
          name,
          type: 'line',
          data: weeks.map(week => regionTotals[name][week.replace('Week ', '')] || 0)
        }));

        const regionChart = echarts.init(document.getElementById('region_chart'));
        const regionOption = {
          title: {
            text: 'Penggunaan Berdasarkan Wilayah',
            left: 'center'
          },
          tooltip: {
            trigger: 'axis'
          },
          legend: {
            data: regionNames,
            top: 'bottom'
          },
          xAxis: {
            type: 'category',
            data: weeks
          },
          yAxis: {
            type: 'value'
          },
          series: regionSeries
        };
        regionChart.setOption(regionOption);
      } else {
        console.error('Error fetching data:', predictionResult.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }


  // Panggil fungsi fetchAndRenderCharts saat halaman dimuat
  document.addEventListener('DOMContentLoaded', fetchAndRenderCharts);
  // Panggil fungsi fetchPredictionData secara eksplisit dengan ID tabel tertentu
  document.addEventListener('DOMContentLoaded', () => {
    fetchPredictionData('prediction_table'); // Menargetkan tabel dengan ID "prediction_table"
  });
  fetchUsageData()
