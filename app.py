from flask import Flask, request, jsonify, render_template, redirect, url_for
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from flask_cors import CORS

from route_engine import find_route, generate_travel_instructions

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

# =========================================================
# NORMALIZE STATION NAME FOR MODEL ENCODER
# =========================================================

def encode_station_name(station_name):

    encoder = label_encoders["station_name"]

    # Normal case
    if station_name in encoder.classes_:
        return int(
            encoder.transform([station_name])[0]
        )

    # Handle old station names containing tabs / escaped tabs
    cleaned_name = str(station_name).replace("\\t", "").strip()

    for class_name in encoder.classes_:

        cleaned_class = (
            str(class_name)
            .replace("\\t", "")
            .replace("\t", "")
            .strip()
        )

        if cleaned_class == cleaned_name:

            print(
                f"Station name normalized: "
                f"{station_name} -> {class_name}"
            )

            return int(
                encoder.transform([class_name])[0]
            )

    raise ValueError(
        f"Station name not found in model encoder: {station_name}"
    )



# ADD THIS FUNCTION HERE

def get_crowd_level(predicted_passengers, base_capacity):

    utilization = (predicted_passengers / base_capacity) * 100

    if utilization < 40:
        return "Low"

    elif utilization < 70:
        return "Moderate"

    elif utilization < 90:
        return "High"

    else:
        return "Very High"
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

# =====================================
# STATION DROPDOWN API
# =====================================

@app.route("/api/station-options", methods=["GET"])
def station_options():

    try:
        # Read station names from the existing dataset
        station_names = (
            stations["station_name"]
            .dropna()
            .astype(str)
            .str.strip()
        )

        # Remove empty names and duplicates
        station_names = station_names[
            station_names != ""
        ].drop_duplicates()

        # Sort alphabetically for passenger convenience
        station_names = sorted(
            station_names.tolist(),
            key=str.casefold
        )

        return jsonify({
            "success": True,
            "stations": station_names
        })

    except Exception:
        app.logger.exception(
            "Unable to load station options"
        )

        return jsonify({
            "success": False,
            "error": "Unable to load station list."
        }), 500

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
# AI Route Finding API
# ===============================

@app.route("/api/route", methods=["POST"])
def api_route():

    try:
        # Get source and destination from the request
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Please provide valid JSON data."
            }), 400

        source = data.get("source")
        destination = data.get("destination")

        # Validate inputs
        if not source or not destination:
            return jsonify({
                "success": False,
                "error": "Source and destination are required."
            }), 400

        source = str(source).strip()
        destination = str(destination).strip()

        if not source or not destination:
            return jsonify({
                "success": False,
                "error": "Source and destination cannot be empty."
            }), 400

        # Calculate the route
        result = find_route(source, destination)

        # Handle route errors
        if "error" in result:
            return jsonify({
                "success": False,
                "error": result["error"]
            }), 404

        # Generate travel instructions
        instructions = generate_travel_instructions(result)

        # =====================================
        # INTERCHANGE PASSENGER GUIDANCE
        # =====================================

        interchange_guidance = []

        try:
            interchange_file = "data/interchange_details.csv"

            interchange_data = pd.read_csv(
                interchange_file,
                keep_default_na=False
            )

            route = result.get("route", [])

            # Find where the route changes from one line to another
            for i in range(1, len(route)):

                previous = route[i - 1]
                current = route[i]

                previous_station = str(previous["station"]).strip()
                current_station = str(current["station"]).strip()

                previous_line = str(previous["line"]).strip()
                current_line = str(current["line"]).strip()

                # Detect a line change at the same station
                if (
                    previous_station.casefold() == current_station.casefold()
                    and previous_line.casefold() != current_line.casefold()
                ):

                    station_name = current_station
                    from_line = previous_line
                    to_line = current_line

                    matching = interchange_data[
                        (
                            interchange_data["station_name"]
                            .astype(str).str.strip().str.casefold()
                            == station_name.casefold()
                        )
                        &
                        (
                            interchange_data["from_line"]
                            .astype(str).str.strip().str.casefold()
                            == from_line.casefold()
                        )
                        &
                        (
                            interchange_data["to_line"]
                            .astype(str).str.strip().str.casefold()
                            == to_line.casefold()
                        )
                    ]
                                        # Default interchange guidance
                    verified = False
                    floor = "Not available"
                    platform = "Not available"

                    passenger_guidance = (
                        f"Change from the {from_line} Line to the "
                        f"{to_line} Line. Follow official interchange "
                        "signs or ask station staff for assistance."
                    )

                    source_info = "Not specified"

                    # Load station-specific interchange details
                    if not matching.empty:
                        candidate = matching.iloc[0]

                        floor = str(
                            candidate.get(
                                "transfer_floor",
                                "Not available"
                            )
                        ).strip() or "Not available"

                        platform = str(
                            candidate.get(
                                "platform_guidance",
                                "Not available"
                            )
                        ).strip() or "Not available"

                        passenger_guidance = str(
                            candidate.get(
                                "passenger_guidance",
                                passenger_guidance
                            )
                        ).strip() or passenger_guidance

                        source_info = str(
                            candidate.get("source", "")
                        ).strip() or "Not specified"
                    
                    interchange_guidance.append({
                        "station": station_name,
                        "from_line": from_line,
                        "to_line": to_line,
                        "transfer_floor": floor,
                        "platform_guidance": platform,
                        "passenger_guidance": passenger_guidance,
                        "source": source_info,
                        "verified": verified
                    })

        except FileNotFoundError:
            app.logger.warning(
                "data/interchange_details.csv was not found. "
                "Using an empty interchange guidance list."
            )

        except (KeyError, pd.errors.ParserError):
            app.logger.exception(
                "The interchange details CSV has missing columns "
                "or invalid formatting."
            )

        except Exception:
            app.logger.exception(
                "Unable to generate interchange guidance."
            )

        # =====================================
        # RETURN ROUTE DETAILS
        # =====================================

        return jsonify({
            "success": True,
            "source": result["source"],
            "destination": result["destination"],
            "route": result["route"],
            "lines": result["lines"],
            "interchanges": result["interchanges"],
            "station_connections": result["station_connections"],
            "line_transfers": result["line_transfers"],
            "approximate_distance_km": (
                result["approximate_distance_km"]
            ),
            "distance_note": result["distance_note"],
            "instructions": instructions,
            "interchange_guidance": interchange_guidance
        }), 200

    except Exception:
        app.logger.exception("Route calculation failed")

        return jsonify({
            "success": False,
            "error": (
                "Unable to calculate the route. "
                "Check the Flask terminal."
            )
        }), 500




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

    station_name_encoded = encode_station_name(
        station_name
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

    # Determine crowd level based on station capacity

    base_capacity = float(
        station.iloc[0]["base_capacity"]
    )

    crowd_level = get_crowd_level(
        prediction,
        base_capacity
    )

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


# =========================================================
# CROWD MODE API
# =========================================================

@app.route("/api/crowd", methods=["GET"])
def get_crowd_data():

    try:

        now = datetime.now()

        date = now.strftime("%Y-%m-%d")
        time = now.strftime("%H:%M")

        date_obj = datetime.strptime(date, "%Y-%m-%d")

        year = date_obj.year
        month = date_obj.month
        day = date_obj.day
        day_of_week = date_obj.strftime("%A")

        time_obj = datetime.strptime(time, "%H:%M")

        hour = time_obj.hour
        minute = time_obj.minute

        # Model uses 15-minute intervals
        minute = (minute // 15) * 15


        # Current version uses default conditions
        weather = "Sunny"
        holiday = "No"
        special_event = "No Event"


        # Encode common values
        day_of_week_encoded = int(
            label_encoders["day_of_week"]
            .transform([day_of_week])[0]
        )

        weather_encoded = int(
            label_encoders["weather"]
            .transform([weather])[0]
        )

        holiday_encoded = int(
            label_encoders["holiday"]
            .transform([holiday])[0]
        )

        special_event_encoded = int(
            label_encoders["special_event"]
            .transform([special_event])[0]
        )


        crowd_data = []


        # Predict every station
        for _, station in stations.iterrows():

            station_id = station["station_id"]
            station_name = station["station_name"]
            metro_line = station["metro_line"]


            station_id_encoded = int(
                label_encoders["station_id"]
                .transform([station_id])[0]
            )

            station_name_encoded = encode_station_name(
                station_name
            )

            metro_line_encoded = int(
                label_encoders["metro_line"]
                .transform([metro_line])[0]
            )


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


            prediction = model.predict(input_data)[0]

            prediction = max(0, int(round(prediction)))


            # Determine crowd level
            base_capacity = float(
                station["base_capacity"]
            )

            crowd_level = get_crowd_level(
                prediction,
                base_capacity
            )


            crowd_data.append({

                "station_id": station_id,
                "station_name": station_name,
                "metro_line": metro_line,
                "predicted_passengers": prediction,
                "crowd_level": crowd_level

            })


        return jsonify({

            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "stations": crowd_data

        })


    except Exception as error:

        print("Crowd prediction error:", error)

        return jsonify({
            "error": str(error)
        }), 500


    
# ===============================
# Run Application
# ===============================

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5008, debug=True)