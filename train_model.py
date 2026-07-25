import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

import joblib

# -----------------------------
# Load Dataset
# -----------------------------

print("Loading Passenger Flow Dataset...")

df = pd.read_csv(
    "data/passenger_flow.csv",
    low_memory=False
)

# Replace missing event names
df["special_event"] = df["special_event"].fillna("No Event")

print("Dataset Loaded Successfully!")

# -----------------------------
# Dataset Overview
# -----------------------------

print("\nDataset Shape:")
print(df.shape)

print("\nFirst 5 Rows:")
print(df.head())

print("\nDataset Information:")
df.info()

print("\nSpecial Event Categories:")
print(df["special_event"].unique())

print("\nMissing values in Special Event:")
print(df["special_event"].isnull().sum())

# -----------------------------
# Data Preprocessing
# -----------------------------

print("\nRemoving unnecessary columns...")

df.drop(columns=["record_id"], inplace=True)

print("Remaining Columns:")
print(df.columns)

# -----------------------------
# Process Date Column
# -----------------------------

print("\nProcessing date column...")

# Convert string to datetime
df["date"] = pd.to_datetime(df["date"])

# Extract useful features
df["year"] = df["date"].dt.year
df["day"] = df["date"].dt.day

# Remove original date column
df.drop(columns=["date"], inplace=True)

print("Date processed successfully!")

print("\nRemaining Columns:")
print(df.columns)

# -----------------------------
# Sample Dataset
# -----------------------------

print("\nCreating random sample...")

df = df.sample(
    n=500000,
    random_state=42
)

print("Sample created successfully!")

print("Sample Shape:")
print(df.shape)

# -----------------------------
# Label Encoding
# -----------------------------

print("\nEncoding categorical columns...")

label_encoders = {}

categorical_columns = [
    "day_of_week",
    "station_id",
    "station_name",
    "metro_line",
    "weather",
    "holiday",
    "special_event"
]

for column in categorical_columns:
    le = LabelEncoder()
    df[column] = le.fit_transform(df[column])
    label_encoders[column] = le

print("Encoding completed successfully!")

print("\nFirst 5 Rows After Encoding:")
print(df.head())

# -----------------------------
# Feature Selection
# -----------------------------

print("\nPreparing Features and Target...")

X = df.drop(columns=["passenger_arrivals"])

y = df["passenger_arrivals"]

print(X.columns.tolist())

print("Features Shape:", X.shape)
print("Target Shape:", y.shape)

print("\nFeature Columns:")
print(X.columns)

# -----------------------------
# Train-Test Split
# -----------------------------

print("\nSplitting Dataset into Training and Testing Sets...")

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

print("Dataset Split Successfully!")

print("\nTraining Features :", X_train.shape)
print("Testing Features  :", X_test.shape)

print("\nTraining Target   :", y_train.shape)
print("Testing Target    :", y_test.shape)

# -----------------------------
# Train Random Forest Model
# -----------------------------

print("\nTraining Random Forest Model...")

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

print("Model Trained Successfully!")

# -----------------------------
# Model Evaluation
# -----------------------------

print("\nEvaluating Model...")

# Make predictions
y_pred = model.predict(X_test)

# Calculate evaluation metrics
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print("\nModel Performance")
print("---------------------------")
print(f"Mean Absolute Error (MAE): {mae:.2f}")
print(f"Root Mean Squared Error (RMSE): {rmse:.2f}")
print(f"R² Score: {r2:.4f}")

# -----------------------------
# Save Model and Encoders
# -----------------------------

print("\nSaving Model...")

joblib.dump(model, "models/model.pkl")
joblib.dump(label_encoders, "models/label_encoders.pkl")

print("Model Saved Successfully!")
print("Files Created:")
print("- model.pkl")
print("- label_encoders.pkl")