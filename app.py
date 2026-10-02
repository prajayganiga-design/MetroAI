from flask import Flask, request, jsonify, render_template, redirect, url_for
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}})

print("Loading AI Model...")

# ===============================
# Load AI Model & Data
# ===============================

model = joblib.load("models/model.pkl")
label_encoders = joblib.load("models/label_encoders.pkl")
stations = pd.read_csv("data/station_master.csv")

print("Model Loaded Successfully!")

# ===============================
# Home Route
# ===============================

@app.route("/")
def home():
    return redirect(url_for("dashboard"))
@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/planner")
def planner():
    return render_template("planner.html")


@app.route("/stations")
def stations_page():
    return render_template("stations.html")

@app.route("/api/events")
def get_events():

    query = request.args.get("q", "").lower()

    events_df = pd.read_csv("data/special_events.csv")

    # Get unique event names
    event_names = (
        events_df["event_name"]
        .dropna()
        .unique()
    )

    # Filter matching events
    filtered_events = [
        event
        for event in event_names
        if query in event.lower()
    ]

    return jsonify(filtered_events[:10])


@app.route("/network")
def network():
    return render_template("network.html")


@app.route("/assistant")
def assistant():
    return render_template("assistant.html")


@app.route("/analytics")
def analytics():
    return render_template("analytics.html")


@app.route("/prediction")
def prediction_page():
    return render_template("prediction.html")

@app.route("/health")
def health():
    return jsonify({
        "status": "running",
        "message": "MetroAI Backend is Running Successfully!"
    })


@app.route("/about")
def about():
    return render_template("about.html")

# ===============================
# Fetch All Stations
# ===============================

# ===============================
# Fetch All Stations
# ===============================

@app.route("/api/stations", methods=["GET"])
def get_stations():

    station_columns = [
        "station_id",
        "station_name",
        "metro_line",
        "station_type",
        "is_interchange",
        "is_terminal",
        "station_category",
        "behavior_profile",
        "zone",
        "latitude",
        "longitude",
        "opening_year",
        "parking",
        "platform_count",
        "importance_level",
        "base_capacity",
        "status",
        "base_arrivals_15min",
        "peak_multiplier",
        "weekend_multiplier"
    ]

    station_list = stations[
        station_columns
    ].to_dict(orient="records")

    return jsonify(station_list)
# ===============================
# AI Journey Prediction
# ===============================

@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json()

    # -----------------------------
    # User Inputs
    # -----------------------------

    source_station = data["source_station"]
    destination_station = data["destination_station"]
    date = data["date"]
    time = data["time"]

    # -----------------------------
    # Temporary Default Values
    # -----------------------------

    weather = "Sunny"
    holiday = "No"
    special_event = "No Event"

    # -----------------------------
    # Find Destination Station
    # -----------------------------

    station = stations[
        stations["station_name"] == destination_station
    ]

    if station.empty:
        return jsonify({
            "error": "Destination station not found."
        }), 404

    station_id = station.iloc[0]["station_id"]
    station_name = station.iloc[0]["station_name"]
    metro_line = station.iloc[0]["metro_line"]

    # -----------------------------
    # Date Processing
    # -----------------------------

    date_obj = datetime.strptime(date, "%Y-%m-%d")

    year = date_obj.year
    month = date_obj.month
    day = date_obj.day

    day_of_week = date_obj.strftime("%A")

    # -----------------------------
    # Time Processing
    # -----------------------------

    time_obj = datetime.strptime(time, "%H:%M")

    hour = time_obj.hour
    minute = time_obj.minute

    minute = (minute // 15) * 15

    # -----------------------------
    # Encode Features
    # -----------------------------

    day_of_week_encoded = int(
        label_encoders["day_of_week"].transform([day_of_week])[0]
    )

    station_id_encoded = int(
        label_encoders["station_id"].transform([station_id])[0]
    )

    station_name_encoded = int(
        label_encoders["station_name"].transform([station_name])[0]
    )

    metro_line_encoded = int(
        label_encoders["metro_line"].transform([metro_line])[0]
    )

    weather_encoded = int(
        label_encoders["weather"].transform([weather])[0]
    )

    holiday_encoded = int(
        label_encoders["holiday"].transform([holiday])[0]
    )

    special_event_encoded = int(
        label_encoders["special_event"].transform([special_event])[0]
    )

    # -----------------------------
    # Prepare AI Input
    # -----------------------------

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

    # -----------------------------
    # Predict Passenger Arrivals
    # -----------------------------

    prediction = model.predict(input_data)[0]

    # Every tree predicts separately
    tree_predictions = np.array([
        tree.predict(input_data)[0]
        for tree in model.estimators_
    ])

    # Calculate standard deviation
    std_dev = np.std(tree_predictions)

    # Convert into confidence percentage
    confidence = max(
        50,
        min(99, 100 - (std_dev / prediction) * 100)
    )

    confidence = round(confidence, 2)

    prediction = int(round(prediction))

    # -----------------------------
    # Crowd Level
    # -----------------------------

    if prediction <= 2500:

        crowd_level = "Low"

    elif prediction <= 5000:

        crowd_level = "Moderate"

    elif prediction <= 8000:

        crowd_level = "High"

    else:

        crowd_level = "Very High"

    # -----------------------------
    # AI Recommendation
    # -----------------------------

    if crowd_level == "Low":

        recommended_time = time

        travel_advice = (
            "Excellent time to travel. "
            "Minimal crowd is expected."
        )

    elif crowd_level == "Moderate":

        recommended_time = time

        travel_advice = (
            "Moderate crowd expected. "
            "Travel comfortably with normal waiting time."
        )

    elif crowd_level == "High":

        recommended_time = "30 minutes earlier"

        travel_advice = (
            "Heavy crowd expected. "
            "Travelling a little earlier is recommended."
        )

    else:

        recommended_time = "1 hour earlier"

        travel_advice = (
            "Very high crowd expected. "
            "Avoid this time if possible."
        )

    # -----------------------------
    # Response
    # -----------------------------

    return jsonify({

        "journey": {

            "source_station": source_station,

            "destination_station": destination_station

        },

    "prediction": {

        "station_name": station_name,

        "metro_line": metro_line,

        "predicted_passenger_arrivals": prediction,

        "crowd_level": crowd_level,

        "confidence": confidence

    },

        "ai_recommendation": {

            "recommended_time": recommended_time,

            "travel_advice": travel_advice

        }

    })


# ===============================
# Run Application
# ===============================

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5008, debug=True)