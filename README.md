# Stunting Detection using SVM (RBF Kernel)

## Overview
This project classifies **children at risk of stunting** using **Support Vector Machine (SVM)** with **RBF kernel**.  
The SVM-RBF kernel is effective for **non-linear classification**, capturing complex relationships in health and demographic data.

## Features
- Input features: age, weight, height, nutritional intake, and other relevant health indicators.  
- Output: **Stunting risk classification** (Yes/No).  
- Evaluation metrics: accuracy, precision, recall, F1-score.  

## Steps
1. **Data Collection**: Health and demographic data of children.  
2. **Data Preprocessing**: Normalize numeric features, handle missing data, encode categorical variables.  
3. **SVM-RBF Modeling**: Fit SVM classifier using **RBF kernel**.  
4. **Prediction & Evaluation**: Classify stunting risk and assess performance.  

## Python Example

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.metrics import classification_report, confusion_matrix

# Load dataset
data = pd.read_csv("stunting_data.csv")

# Features and target
X = data[['age', 'weight', 'height', 'nutrition_score']]
y = data['stunting']  # 0 = Not stunted, 1 = Stunted

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train SVM with RBF kernel
svm_rbf = SVC(kernel='rbf', C=1.0, gamma='scale', random_state=42)
svm_rbf.fit(X_train_scaled, y_train)

# Predict
y_pred = svm_rbf.predict(X_test_scaled)

# Evaluate
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))
print("\nClassification Report:\n", classification_report(y_test, y_pred))
