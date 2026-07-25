import joblib
import pandas as pd
from datetime import datetime

# -----------------------------
# Load Model and Label Encoders
# -----------------------------
print("Loading AI Model...")

model = joblib.load("models/model.pkl")
label_encoders = joblib.load("models/label_encoders.pkl")

print("Model Loaded Successfully!")

# -----------------------------
# Load Station Master
# -----------------------------
stations = pd.read_csv("data/station_master.csv")

# -----------------------------
# Get User Input
# -----------------------------
print("\n===== Smart Metro Passenger Prediction =====")

date_input = input("Enter Date (YYYY-MM-DD): ")
time_input = input("Enter Time (HH:MM): ")

station_id = input("Enter Station ID (Example: P015): ").strip().upper()

weather = input("Enter Weather (Sunny/Rainy/Cloudy): ").strip().title()
holiday = input("Holiday? (Yes/No): ").strip().title()
special_event = input("Special Event (or No Event): ").strip().title()

# -----------------------------
# Find Station Details
# -----------------------------
station = stations[stations["station_id"] == station_id]

if station.empty:
    print("❌ Invalid Station ID!")
    exit()

station_name = station.iloc[0]["station_name"]
metro_line = station.iloc[0]["metro_line"]

print(f"\nStation : {station_name}")
print(f"Metro Line : {metro_line}")

# -----------------------------
# Extract Date Information
# -----------------------------
date_obj = datetime.strptime(date_input, "%Y-%m-%d")

year = date_obj.year
month = date_obj.month
day = date_obj.day
day_of_week = date_obj.strftime("%A")

# -----------------------------
# Extract Time Information
# -----------------------------
hour, minute = map(int, time_input.split(":"))

# -----------------------------
# Create Input DataFrame
# -----------------------------
input_data = pd.DataFrame([{
    "day_of_week": day_of_week,
    "month": month,
    "hour": hour,
    "minute": minute,
    "station_id": station_id,
    "station_name": station_name,
    "metro_line": metro_line,
    "weather": weather,
    "holiday": holiday,
    "special_event": special_event,
    "year": year,
    "day": day
}])

# -----------------------------
# Encode Categorical Columns
# -----------------------------
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
    input_data[column] = label_encoders[column].transform(input_data[column])

# -----------------------------
# Predict
# -----------------------------
prediction = model.predict(input_data)

print("\n========================================")
print("Predicted Passenger Arrivals (15 Minutes)")
print("========================================")
print(f"Estimated Passengers : {round(prediction[0])}")