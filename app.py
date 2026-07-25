from flask import Flask, request, jsonify
import joblib
import pandas as pd
from datetime import datetime

app = Flask(__name__)

print("Loading AI Model...")

model = joblib.load("models/model.pkl")
label_encoders = joblib.load("models/label_encoders.pkl")
stations = pd.read_csv("data/station_master.csv")

print("Model Loaded Successfully!")

@app.route("/")
def home():
    return "MetroAI Backend is Running Successfully!"

@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json()

    date = data["date"]
    time = data["time"]
    station_id = data["station_id"]
    weather = data["weather"]
    holiday = data["holiday"]
    special_event = data["special_event"]

    # Find station details
    station = stations[stations["station_id"] == station_id]

    station_name = station.iloc[0]["station_name"]
    metro_line = station.iloc[0]["metro_line"]

    # Convert date
    date_obj = datetime.strptime(date, "%Y-%m-%d")

    year = date_obj.year
    month = date_obj.month
    day = date_obj.day
    day_of_week = date_obj.strftime("%A")

    # Convert time to 15-minute slot
    time_obj = datetime.strptime(time, "%H:%M")

    hour = time_obj.hour
    minute = time_obj.minute

    slot_minute = (minute // 15) * 15

    # Update minute to the nearest 15-minute slot
    minute = slot_minute

    # Encode categorical features
    day_of_week_encoded = int(label_encoders["day_of_week"].transform([day_of_week])[0])
    station_id_encoded = int(label_encoders["station_id"].transform([station_id])[0])
    station_name_encoded = int(label_encoders["station_name"].transform([station_name])[0])
    metro_line_encoded = int(label_encoders["metro_line"].transform([metro_line])[0])
    weather_encoded = int(label_encoders["weather"].transform([weather])[0])
    holiday_encoded = int(label_encoders["holiday"].transform([holiday])[0])
    special_event_encoded = int(label_encoders["special_event"].transform([special_event])[0])

    input_data = pd.DataFrame([{
        "day_of_week": day_of_week_encoded,
        "month": month,
        "hour": hour,
        "minute": minute,
        "station_id": station_id_encoded,
        "station_name": station_name_encoded,
        "metro_line": metro_line_encoded,
        "weather": weather_encoded,
        "holiday": holiday_encoded,
        "special_event": special_event_encoded,
        "year": year,
        "day": day
    }])

    # Predict passenger arrivals
    prediction = model.predict(input_data)[0]

    # Convert NumPy value to Python int
    prediction = int(round(prediction))

    return jsonify({
        "station_name": station_name,
        "metro_line": metro_line,
        "predicted_passenger_arrivals": prediction
    })
if __name__ == "__main__":
    app.run(debug=True)