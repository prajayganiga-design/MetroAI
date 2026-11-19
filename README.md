# MetroAI – Smart Metro Operations & Passenger Assistance System

An AI-powered metro operations and passenger assistance system featuring passenger demand prediction, intelligent route planning, station interchange guidance, geospatial network intelligence, deep passenger analytics, and persistent prediction history.

## Overview

MetroAI combines machine learning, metro station telemetry, and a Flask web application to support predictive crowd management, journey planning, and real-time operational insights.

The platform includes a 100-estimator Random Forest model for passenger demand forecasting, an indexed analytical database for sub-50ms traffic analysis, and an intelligent route-planning engine that navigates transfers and line interchanges.

## Core Features

### 1. Operations Dashboard
- Live overview of metropolitan transit health and active alerts.
- Live station counter synced with the station master repository.
- Quick operational metrics and active line status monitoring.

### 2. AI Journey Planner & Crowd Prediction
- Predicts passenger arrivals at 15-minute intervals using a Random Forest regression model.
- Analyzes weather conditions, holiday schedules, and special urban events.
- Evaluates crowd utilization based on station capacity thresholds (Low, Moderate, High, Very High).
- Calculates model variance across trees to output a statistical confidence percentage.
- Automatically archives predictions to the Prediction History log.

### 3. Passenger Flow & Congestion Analytics
- **Temporal Ridership Trends:** Interactive line chart tracking volume across Daily, Weekly, and Monthly aggregations.
- **24-Hour Peak Curve:** Hourly distribution bar chart highlighting commuter rush periods (08:00–10:00 and 17:00–19:00).
- **Corridor Comparison:** Line-by-line ridership share doughnut chart (Purple, Green, Yellow).
- **Congestion Ranking:** Top 10 congestion bottlenecks with capacity utilization bars and risk flags.
- **Geospatial Density Heatmap:** Interactive Leaflet GIS map displaying 85+ stations scaled and colored by passenger density.
- **AI-Generated Insights:** Automated operational recommendations for train dispatch scheduling.
- Powered by an indexed SQLite caching engine (`data/analytics.db`) querying 5.9M+ records in under 30 milliseconds.

### 4. Prediction History & Archive
- Persistent database of all AI-generated journey predictions (`data/metro_history.db`).
- Searchable by station, corridor, or destination.
- Filterable by metro line, crowd risk level, and sort order.
- In-depth diagnostics modal breaking down environmental factors and capacity utilization.
- One-click CSV export of historical prediction data.
- Direct "Re-Plan" integration returning to the Journey Planner.

### 5. Metro Travel Assistant & Routing Engine
- Multi-line graph-based shortest path routing with interchange identification.
- Step-by-step travel instructions and line transfer notifications.
- Station platform and transfer floor guidance (Concourse vs Ground level) from the interchange knowledge base.

### 6. Geospatial Metro Network Explorer
- Interactive Leaflet/OpenStreetMap network map.
- Complete station directory covering Purple, Green, and Yellow lines.
- Filter by corridor, station type, and operational status.

### 7. About Platform Page
- Comprehensive architectural documentation.
- Machine learning model specifications and training methodology.
- Bangalore Namma Metro network alignment breakdown.
- Application module index and diagnostics.

## Technology Stack

- **Frontend:** HTML5, CSS3 Grid, Vanilla JavaScript (ES6+), Chart.js, Leaflet.js GIS, Font Awesome 6
- **Backend:** Python 3.12, Flask, Flask-CORS
- **Machine Learning:** scikit-learn (RandomForestRegressor), Joblib, NumPy
- **Data & Storage:** SQLite3 (indexed pre-aggregated analytics & prediction history), pandas
- **Routing Engine:** Python graph traversal with interchange penalty minimization

## Project Structure

```text
MetroAI/
├── app.py                      # Flask backend entrypoint & RESTful API routes
├── analytics_service.py        # High-performance analytics query engine
├── history_service.py          # Prediction history persistence & management
├── route_engine.py             # Transit pathfinding & interchange navigator
├── train_model.py              # Random Forest model training pipeline
├── predict.py                  # CLI prediction utility
├── requirements.txt            # Python dependencies
├── data/
│   ├── analytics.db            # Pre-aggregated high-speed analytical SQLite database
│   ├── metro_history.db        # Persistent prediction history database
│   ├── station_master.csv      # 85+ station metadata, coordinates, and capacities
│   ├── interchange_details.csv # Line-change floors and platform guidance
│   ├── special_events.csv      # Event dates, venues, and transit impact factors
│   ├── passenger_flow.csv      # 5.96M record passenger arrival training data
│   └── weather.csv             # Meteorological records
├── models/
│   ├── model.pkl               # Trained Random Forest Regressor
│   └── label_encoders.pkl      # Categorical feature encoders
├── templates/
│   ├── dashboard.html          # Operations Control Center
│   ├── planner.html            # AI Journey Planner
│   ├── stations.html           # Stations Database & Directory
│   ├── network.html            # Interactive GIS Metro Network
│   ├── assistant.html          # Step-by-step Travel Assistant
│   ├── analytics.html          # Passenger Analytics & Congestion Heatmap
│   ├── prediction.html         # Prediction History & Forecast Archive
│   └── about.html              # System Architecture & Technical Specifications
└── static/
    ├── css/                    # Custom dark-theme responsive stylesheets
    ├── js/                     # Client-side controllers and chart/map handlers
    └── assets/                 # Brand assets and logos
```

## Running the Application

1. **Activate Environment & Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Flask Server:**
   ```bash
   python app.py
   ```

3. **Open in Browser:**
   Navigate to [http://127.0.0.1:5008](http://127.0.0.1:5008) in your web browser.
