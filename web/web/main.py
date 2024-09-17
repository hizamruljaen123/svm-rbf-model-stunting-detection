from flask import Flask, jsonify, render_template, request, url_for
import pandas as pd
import numpy as np
import mysql.connector
import os


app = Flask(__name__)

app.config['UPLOAD_FOLDER'] = 'uploads/'


class VARMA:
    def __init__(self, p, q):
        self.p = p
        self.q = q
        self.phi = None
        self.theta = None
        self.mu = None
    
    def fit(self, Y):
        T, k = Y.shape
        self.mu = Y.mean(axis=0)
        Y = Y - self.mu
        
        self.phi = np.zeros((self.p, k, k))
        self.theta = np.zeros((self.q, k, k))
        
        residuals = np.zeros((T, k))
        
        for t in range(max(self.p, self.q), T):
            y_t = Y[t]
            y_past = [Y[t-i-1] for i in range(self.p)]
            residuals_t = [residuals[t-i-1] for i in range(self.q)]
            
            y_hat = np.zeros(k)
            
            for i in range(self.p):
                y_hat += np.dot(self.phi[i], y_past[i])
            
            for i in range(self.q):
                y_hat += np.dot(self.theta[i], residuals_t[i])
            
            residuals[t] = y_t - y_hat
        
        for i in range(self.p):
            X = np.vstack([Y[t-i-1] for t in range(max(self.p, self.q), T)])
            self.phi[i] = np.linalg.lstsq(X, Y[max(self.p, self.q):], rcond=None)[0].T
        
        for i in range(self.q):
            X = np.vstack([residuals[t-i-1] for t in range(max(self.p, self.q), T)])
            self.theta[i] = np.linalg.lstsq(X, residuals[max(self.p, self.q):], rcond=None)[0].T
    
    def predict(self, Y, steps):
        T, k = Y.shape
        Y = Y - self.mu
        predictions = np.zeros((steps, k))
        residuals = np.zeros((T, k))
        
        for t in range(max(self.p, self.q), T):
            y_t = Y[t]
            y_past = [Y[t-i-1] for i in range(self.p)]
            residuals_t = [residuals[t-i-1] for i in range(self.q)]
            
            y_hat = np.zeros(k)
            
            for i in range(self.p):
                y_hat += np.dot(self.phi[i], y_past[i])
            
            for i in range(self.q):
                y_hat += np.dot(self.theta[i], residuals_t[i])
            
            residuals[t] = y_t - y_hat
        
        for s in range(steps):
            y_past = [Y[-i-1] for i in range(self.p)]
            residuals_t = [residuals[-i-1] for i in range(self.q)]
            
            y_hat = np.zeros(k)
            
            for i in range(self.p):
                y_hat += np.dot(self.phi[i], y_past[i])
            
            for i in range(self.q):
                y_hat += np.dot(self.theta[i], residuals_t[i])
            
            predictions[s] = y_hat
            Y = np.vstack([Y, y_hat])
        
        return predictions + self.mu

def get_data_from_db():
    connection = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='data_listrik'
    )
    
    query = """
    SELECT nama_pemakai, kategori, lokasi, daya_tersambung, minggu, usage_data 
    FROM predictions
    """
    
    data = pd.read_sql(query, connection)
    connection.close()
    return data

@app.route('/predict', methods=['GET'])
def predict():
    data = get_data_from_db()
    data_pivot = data.pivot(index='minggu', columns=['nama_pemakai', 'kategori', 'lokasi', 'daya_tersambung'], values='usage_data')
    data_pivot = data_pivot.fillna(0)  # Replace missing values with 0

    # Fit the VARMA model
    varma_model = VARMA(p=1, q=1)
    varma_model.fit(data_pivot.values)

    # Predict the next 10 weeks
    future_steps = 10
    predictions = varma_model.predict(data_pivot.values, steps=future_steps)

    # Create a DataFrame for predictions and round to four decimal places
    predicted_df = pd.DataFrame(predictions, columns=data_pivot.columns).round(4)

    # Combine actual usage and predictions in a single DataFrame
    combined_df = pd.DataFrame()

    for user in data_pivot.columns:
        user_data = data_pivot[user]
        user_predictions = predicted_df[user]

        # Combine actual usage and predictions in a single row
        user_row = pd.Series([user], index=['User'])
        usage_weeks = [f'Week_{i+1}' for i in range(len(user_data))]
        prediction_weeks = [f'Pred_Week_{i+1}' for i in range(future_steps)]

        for week, usage in zip(usage_weeks, user_data):
            user_row[week] = round(usage, 4)

        for week, prediction in zip(prediction_weeks, user_predictions):
            user_row[week] = round(prediction, 4)

        # Append to combined DataFrame
        combined_df = pd.concat([combined_df, user_row.to_frame().T], ignore_index=True)

    # Convert combined DataFrame to JSON
    combined_json = combined_df.to_dict(orient='records')

    return jsonify({"status": "success", "data": combined_json})

@app.route('/uploader', methods=['POST'])
def uploader_file():
    clear_data = request.form.get('clear_data') == 'true'

    if 'file' not in request.files:
        return 'No file part', 400
    
    file = request.files['file']
    
    if file.filename == '':
        return 'No selected file', 400
    
    if file:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        
        # Read the Excel file
        df = pd.read_excel(filepath)
        
        # Prepare the data to match the database schema
        records = []
        for _, row in df.iterrows():
            nama_pemakai = row['Nama Pemakai']
            kategori = row['Kategori']
            lokasi = row['Lokasi']
            daya_tersambung = row['Daya Tersambung (VA)']
            
            for minggu in range(1, 53):
                usage_data = row[f'Minggu_{minggu}']
                records.append((nama_pemakai, kategori, lokasi, daya_tersambung, minggu, usage_data))
        
        try:
            connection = mysql.connector.connect(
                host='localhost',
                user='root',
                password='',  # Replace with your MySQL password
                database='data_listrik'
            )
            cursor = connection.cursor()
            
            # If clear_data is True, truncate the table
            if clear_data:
                cursor.execute("TRUNCATE TABLE predictions")
            
            insert_query = """
            INSERT INTO predictions (nama_pemakai, kategori, lokasi, daya_tersambung, minggu, usage_data)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            cursor.executemany(insert_query, records)
            connection.commit()
            
            cursor.close()
            connection.close()
        
        except mysql.connector.Error as err:
            return f"Error: {err}", 500
        
        return 'File successfully uploaded and data inserted into the database', 200
    
@app.route('/get_usage_data', methods=['GET'])
def get_usage_data():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            user='root',  # Sesuaikan dengan username MySQL Anda
            password='',  # Sesuaikan dengan password MySQL Anda
            database='data_listrik'  # Sesuaikan dengan nama database Anda
        )
        cursor = connection.cursor(dictionary=True)
        
        # Query untuk mengambil data dari tabel usage_data
        query = "SELECT * FROM usage_data"
        cursor.execute(query)
        
        # Mengambil semua data dari hasil query
        data = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        # Mengembalikan data dalam format JSON
        return jsonify({"status": "success", "data": data})
    
    except mysql.connector.Error as err:
        return jsonify({"status": "error", "message": f"Error: {err}"}), 500

@app.route('/get_predictions_data', methods=['GET'])
def get_predictions_data():
    try:
        # Membuat koneksi ke database MySQL
        connection = mysql.connector.connect(
            host='localhost',
            user='root',  # Sesuaikan dengan username MySQL Anda
            password='',  # Sesuaikan dengan password MySQL Anda
            database='data_listrik'  # Sesuaikan dengan nama database Anda
        )
        cursor = connection.cursor(dictionary=True)

        # Query untuk mengambil data dari tabel predictions
        query = "SELECT Wilayah, Kategori, week_pred, prediction_result FROM predictions_data"
        cursor.execute(query)

        # Mengambil semua data dari hasil query
        data = cursor.fetchall()

        # Tutup koneksi
        cursor.close()
        connection.close()

        # Mengembalikan data dalam format JSON
        return jsonify({"status": "success", "data": data})

    except mysql.connector.Error as err:
        # Jika ada error, kembalikan pesan error dalam JSON
        return jsonify({"status": "error", "message": f"Error: {err}"}), 500
    
@app.route('/get_data', methods=['GET'])
def get_data():
    data = get_data_from_db()
    data_json = data.to_dict(orient='records')
    return jsonify({"status": "success", "data": data_json})

@app.route('/')
def index():
    return render_template('index_1.html')

if __name__ == '__main__':
    app.run(debug=True)
