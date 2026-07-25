# ==========================================
# Smart Metro AI Passenger Flow Generator
# ==========================================

import pandas as pd
import numpy as np
from tqdm import tqdm

# ------------------------------------------
# Load Datasets
# ------------------------------------------

stations = pd.read_csv("data/station_master.csv")
weather = pd.read_csv("data/weather.csv")
holidays = pd.read_csv("data/holidays.csv")
events = pd.read_csv("data/special_events.csv")

print("Datasets Loaded Successfully\n")

print("Stations :", len(stations))
print("Weather  :", len(weather))
print("Holidays :", len(holidays))
print("Events   :", len(events))

# ------------------------------------------
# Generate Date Range
# ------------------------------------------
dates = pd.date_range(
    start="2024-01-01",
    end="2025-12-31",
    freq="D"
)

# ------------------------------------------
# Hour Factors
# ------------------------------------------

hour_factor = {

    0:0.05,
    1:0.03,
    2:0.02,
    3:0.02,
    4:0.05,
    5:0.15,

    6:0.40,
    7:0.80,
    8:1.30,
    9:1.20,

    10:0.95,
    11:0.90,
    12:1.00,
    13:0.95,
    14:0.90,
    15:0.95,

    16:1.10,
    17:1.40,
    18:1.60,
    19:1.45,

    20:1.10,
    21:0.75,
    22:0.35,
    23:0.15
}

# ------------------------------------------
# Weekend Factor
# ------------------------------------------

weekend_factor = {

    True:0.90,
    False:1.00
}

# ------------------------------------------
# Weather Factor
# ------------------------------------------

weather_factor = {

    "Sunny":1.00,
    "Cloudy":0.98,
    "Rain":0.90,
    "Heavy Rain":0.75
}

# ------------------------------------------
# Holiday Factor
# ------------------------------------------

holiday_factor = {

    "No":1.00,
    "Yes":0.80
}

# ------------------------------------------
# Random Noise
# ------------------------------------------

def random_noise():

    return np.random.uniform(0.95,1.05)

# ------------------------------------------
# Behavior Multiplier
# ------------------------------------------

def get_behavior_multiplier(profile, hour, is_weekend):

    multiplier = 1.0

    if profile == "IT_COMMUTER":

        if 7 <= hour <= 10:
            multiplier = 1.25

        elif 17 <= hour <= 20:
            multiplier = 1.20

    elif profile == "RESIDENTIAL":

        if 6 <= hour <= 9:
            multiplier = 1.15

        elif 17 <= hour <= 21:
            multiplier = 1.25

    elif profile == "COMMERCIAL":

        if 10 <= hour <= 20:
            multiplier = 1.15

    elif profile == "TRANSPORT_HUB":

        multiplier = 1.20

    elif profile == "EDUCATIONAL":

        if 7 <= hour <= 10:
            multiplier = 1.20

        elif 15 <= hour <= 18:
            multiplier = 1.10

    elif profile == "INDUSTRIAL":

        if 6 <= hour <= 9:
            multiplier = 1.20

        elif 16 <= hour <= 19:
            multiplier = 1.15

    elif profile == "GOVERNMENT":

        if 9 <= hour <= 17:
            multiplier = 1.10

    elif profile == "TOURIST":

        if is_weekend:
            multiplier = 1.30
        else:
            multiplier = 1.10

    elif profile == "HOSPITAL":

        multiplier = 1.05

    return multiplier


# ------------------------------------------
# Passenger Arrival Calculation
# ------------------------------------------

# ------------------------------------------
# Passenger Arrival Calculation
# ------------------------------------------

def calculate_passenger_arrivals(station,
                                 weather_row,
                                 holiday_row,
                                 event_row,
                                 hour):

    base_arrivals = station["base_arrivals_15min"]
    peak_multiplier = station["peak_multiplier"]
    station_weekend_multiplier = station["weekend_multiplier"]
    profile = station["behavior_profile"]

    is_weekend = weather_row["day_of_week"] in ["Saturday", "Sunday"]

    hour_multiplier = hour_factor[hour]

    # Apply station-specific peak multiplier
    if hour in [7, 8, 9, 17, 18, 19]:
        hour_multiplier *= peak_multiplier

    arrivals = (

        base_arrivals

        * hour_multiplier

        * weekend_factor[is_weekend]

        * station_weekend_multiplier

        * weather_factor.get(
            weather_row["weather_type"], 1.0
        )

        * holiday_factor.get(
            holiday_row["is_holiday"], 1.0
        )

        * float(
            event_row["event_impact"]
        )

        * get_behavior_multiplier(
            profile,
            hour,
            is_weekend
        )

        * random_noise()

    )

    return int(arrivals)

# ------------------------------------------
# Get Weather Row
# ------------------------------------------

def get_weather(date):

    row = weather[weather["date"] == str(date.date())]

    if row.empty:
        return {
            "weather_type": "Sunny",
            "day_of_week": date.day_name()
        }

    return row.iloc[0]


# ------------------------------------------
# Get Holiday Row
# ------------------------------------------

def get_holiday(date):

    row = holidays[holidays["date"] == str(date.date())]

    if row.empty:
        return {
            "is_holiday": "No"
        }

    return row.iloc[0]


# ------------------------------------------
# Get Event Row
# ------------------------------------------

def get_event(date):

    row = events[events["date"] == str(date.date())]

    if row.empty:
        return {
            "event_name": None,
            "event_impact": 1.0
        }

    return row.iloc[0]

# ==========================================
# Generate Passenger Flow Dataset
# ==========================================

output_file = "data/passenger_flow.csv"

record_id = 1

print("\nGenerating Passenger Flow Dataset...\n")

with open(output_file, "w") as file:

    # CSV Header
    file.write(
        "record_id,date,day_of_week,month,hour,minute,"
        "station_id,station_name,metro_line,"
        "weather,holiday,special_event,"
        "passenger_arrivals\n"
    )

    # Loop through every day
    for date in tqdm(dates):

        weather_row = get_weather(date)
        holiday_row = get_holiday(date)
        event_row = get_event(date)

        # Every 15 minutes
        for hour in range(24):

            for minute in [0, 15, 30, 45]:

                # Every station
                for _, station in stations.iterrows():

                    arrivals = calculate_passenger_arrivals(
                        station,
                        weather_row,
                        holiday_row,
                        event_row,
                        hour
                    )

                    file.write(
                        f"{record_id},"
                        f"{date.date()},"
                        f"{date.day_name()},"
                        f"{date.month},"
                        f"{hour},"
                        f"{minute},"
                        f"{station['station_id']},"
                        f"{station['station_name']},"
                        f"{station['metro_line']},"
                        f"{weather_row['weather_type']},"
                        f"{holiday_row['is_holiday']},"
                        f"{event_row['event_name']},"
                        f"{arrivals}\n"
                    )

                    record_id += 1

print("\nPassenger Flow Dataset Generated Successfully!")
print("Saved to :", output_file)
print("Total Records :", record_id - 1)

