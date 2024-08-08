import pandas as pd
from statsmodels.tsa.statespace.varmax import VARMAX
from statsmodels.tsa.arima.model import ARIMA

# Load the Excel file
file_path = 'data.xlsx'
data = pd.read_excel(file_path, sheet_name='Sheet1')

# Prepare the data for modeling
data.set_index('Nama Pemakai', inplace=True)
data = data.drop(columns=['Kategori', 'Lokasi', 'Daya Tersambung (VA)'])

# Transpose the data to have weeks as rows and users as columns
data = data.T

# Split the data into train and test sets
train = data.iloc[:-10]
test = data.iloc[-10:]

# Fit VARMA model
varma_model = VARMAX(train, order=(1,1))
varma_fit = varma_model.fit(disp=False)
varma_forecast = varma_fit.forecast(steps=len(test))

# Fit MA model for each series individually
ma_forecasts = {}
for column in train.columns:
    ma_model = ARIMA(train[column], order=(0, 0, 1))
    ma_fit = ma_model.fit()
    ma_forecast = ma_fit.forecast(steps=len(test))
    ma_forecasts[column] = ma_forecast

ma_forecasts = pd.DataFrame(ma_forecasts, index=test.index)

# Save results to Excel
with pd.ExcelWriter('predictions.xlsx') as writer:
    varma_forecast.to_excel(writer, sheet_name='VARMA Forecast')
    ma_forecasts.to_excel(writer, sheet_name='MA Forecast')

print("Predictions saved to predictions.xlsx")
