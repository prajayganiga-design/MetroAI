import os
import sqlite3
from datetime import datetime, timedelta
import random
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "metro_history.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_history_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prediction_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            source_station TEXT NOT NULL,
            destination_station TEXT NOT NULL,
            metro_line TEXT NOT NULL,
            travel_date TEXT NOT NULL,
            travel_time TEXT NOT NULL,
            predicted_passengers INTEGER NOT NULL,
            crowd_level TEXT NOT NULL,
            confidence REAL NOT NULL,
            weather TEXT DEFAULT 'Sunny',
            holiday TEXT DEFAULT 'No',
            special_event TEXT DEFAULT 'No Event',
            travel_advice TEXT,
            recommended_time TEXT
        );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hist_time ON prediction_history(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hist_line ON prediction_history(metro_line);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_hist_crowd ON prediction_history(crowd_level);")
    
    # Check if empty, and seed initial records if needed
    cursor.execute("SELECT COUNT(*) FROM prediction_history")
    count = cursor.fetchone()[0]
    
    if count == 0:
        seed_samples = [
            {
                "timestamp": (datetime.now() - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Indiranagar",
                "destination_station": "Nadaprabhu Kempegowda Station (Majestic)",
                "metro_line": "Purple",
                "travel_date": datetime.now().strftime("%Y-%m-%d"),
                "travel_time": "18:30",
                "predicted_passengers": 2840,
                "crowd_level": "High",
                "confidence": 96.5,
                "weather": "Sunny",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Heavy crowd expected. Travelling a little earlier is recommended.",
                "recommended_time": "30 minutes earlier"
            },
            {
                "timestamp": (datetime.now() - timedelta(hours=1, minutes=20)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Whitefield (Kadugodi)",
                "destination_station": "MG Road",
                "metro_line": "Purple",
                "travel_date": datetime.now().strftime("%Y-%m-%d"),
                "travel_time": "09:00",
                "predicted_passengers": 3120,
                "crowd_level": "Very High",
                "confidence": 98.2,
                "weather": "Cloudy",
                "holiday": "No",
                "special_event": "Tech Conference",
                "travel_advice": "Very high crowd expected. Avoid this peak hour if possible.",
                "recommended_time": "1 hour earlier"
            },
            {
                "timestamp": (datetime.now() - timedelta(hours=3, minutes=10)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Yeshwanthpur",
                "destination_station": "Central College",
                "metro_line": "Green",
                "travel_date": datetime.now().strftime("%Y-%m-%d"),
                "travel_time": "14:15",
                "predicted_passengers": 840,
                "crowd_level": "Low",
                "confidence": 94.0,
                "weather": "Sunny",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Excellent time to travel. Minimal crowd is expected.",
                "recommended_time": "14:15"
            },
            {
                "timestamp": (datetime.now() - timedelta(hours=5, minutes=45)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Jayanagar",
                "destination_station": "Silk Institute",
                "metro_line": "Green",
                "travel_date": datetime.now().strftime("%Y-%m-%d"),
                "travel_time": "16:00",
                "predicted_passengers": 1450,
                "crowd_level": "Moderate",
                "confidence": 92.8,
                "weather": "Sunny",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Moderate crowd expected. Travel comfortably with normal waiting time.",
                "recommended_time": "16:00"
            },
            {
                "timestamp": (datetime.now() - timedelta(days=1, hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Mysuru Road",
                "destination_station": "Baiyappanahalli",
                "metro_line": "Purple",
                "travel_date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                "travel_time": "19:15",
                "predicted_passengers": 2690,
                "crowd_level": "High",
                "confidence": 95.7,
                "weather": "Rainy",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Heavy crowd expected. Travelling a little earlier is recommended.",
                "recommended_time": "30 minutes earlier"
            },
            {
                "timestamp": (datetime.now() - timedelta(days=1, hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Peenya",
                "destination_station": "City Railway Station",
                "metro_line": "Green",
                "travel_date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                "travel_time": "11:30",
                "predicted_passengers": 1120,
                "crowd_level": "Moderate",
                "confidence": 93.4,
                "weather": "Cloudy",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Moderate crowd expected. Normal boarding conditions.",
                "recommended_time": "11:30"
            },
            {
                "timestamp": (datetime.now() - timedelta(days=2, hours=1)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Cubbon Park",
                "destination_station": "Trinity",
                "metro_line": "Purple",
                "travel_date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
                "travel_time": "15:45",
                "predicted_passengers": 780,
                "crowd_level": "Low",
                "confidence": 91.5,
                "weather": "Sunny",
                "holiday": "Yes",
                "special_event": "Flower Show",
                "travel_advice": "Excellent time to travel. Minimal crowd is expected.",
                "recommended_time": "15:45"
            },
            {
                "timestamp": (datetime.now() - timedelta(days=2, hours=4)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "RV Road",
                "destination_station": "Jayadeva Hospital",
                "metro_line": "Yellow",
                "travel_date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
                "travel_time": "08:45",
                "predicted_passengers": 2100,
                "crowd_level": "High",
                "confidence": 97.1,
                "weather": "Sunny",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Heavy commuter rush at interchange corridor.",
                "recommended_time": "30 minutes earlier"
            },
            {
                "timestamp": (datetime.now() - timedelta(days=3, hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Challaghatta",
                "destination_station": "Vijayanagara",
                "metro_line": "Purple",
                "travel_date": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
                "travel_time": "13:00",
                "predicted_passengers": 650,
                "crowd_level": "Low",
                "confidence": 95.0,
                "weather": "Sunny",
                "holiday": "No",
                "special_event": "No Event",
                "travel_advice": "Clear track and light passenger load.",
                "recommended_time": "13:00"
            },
            {
                "timestamp": (datetime.now() - timedelta(days=3, hours=7)).strftime("%Y-%m-%d %H:%M:%S"),
                "source_station": "Electronic City",
                "destination_station": "Silk Board",
                "metro_line": "Yellow",
                "travel_date": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
                "travel_time": "18:00",
                "predicted_passengers": 2980,
                "crowd_level": "Very High",
                "confidence": 98.6,
                "weather": "Cloudy",
                "holiday": "No",
                "special_event": "Peak Office Rush",
                "travel_advice": "Very heavy corridor congestion expected.",
                "recommended_time": "1 hour earlier"
            }
        ]

        for s in seed_samples:
            cursor.execute("""
                INSERT INTO prediction_history (
                    timestamp, source_station, destination_station, metro_line,
                    travel_date, travel_time, predicted_passengers, crowd_level,
                    confidence, weather, holiday, special_event, travel_advice, recommended_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                s["timestamp"], s["source_station"], s["destination_station"], s["metro_line"],
                s["travel_date"], s["travel_time"], s["predicted_passengers"], s["crowd_level"],
                s["confidence"], s["weather"], s["holiday"], s["special_event"],
                s["travel_advice"], s["recommended_time"]
            ))
        conn.commit()

    conn.close()

def add_prediction_log(data: Dict[str, Any]) -> int:
    init_history_db()
    conn = get_connection()
    cursor = conn.cursor()
    
    timestamp = data.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO prediction_history (
            timestamp, source_station, destination_station, metro_line,
            travel_date, travel_time, predicted_passengers, crowd_level,
            confidence, weather, holiday, special_event, travel_advice, recommended_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        timestamp,
        data.get("source_station", "Unknown"),
        data.get("destination_station", "Unknown"),
        data.get("metro_line", "Purple"),
        data.get("travel_date", datetime.now().strftime("%Y-%m-%d")),
        data.get("travel_time", "12:00"),
        int(data.get("predicted_passengers", 0)),
        data.get("crowd_level", "Moderate"),
        float(data.get("confidence", 90.0)),
        data.get("weather", "Sunny"),
        data.get("holiday", "No"),
        data.get("special_event", "No Event"),
        data.get("travel_advice", "Safe travels."),
        data.get("recommended_time", "On time")
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id

def get_prediction_history(
    search: Optional[str] = None,
    line: Optional[str] = None,
    crowd: Optional[str] = None,
    sort_by: Optional[str] = None,
    limit: int = 150
) -> Dict[str, Any]:
    init_history_db()
    conn = get_connection()
    cursor = conn.cursor()

    where_clauses = []
    params = []

    if search:
        search_term = f"%{search.strip().lower()}%"
        where_clauses.append("(LOWER(source_station) LIKE ? OR LOWER(destination_station) LIKE ? OR LOWER(metro_line) LIKE ?)")
        params.extend([search_term, search_term, search_term])

    if line and line != "all":
        where_clauses.append("metro_line = ?")
        params.append(line)

    if crowd and crowd != "all":
        where_clauses.append("crowd_level = ?")
        params.append(crowd)

    where_str = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # Sort
    order_clause = "ORDER BY timestamp DESC"
    if sort_by == "oldest":
        order_clause = "ORDER BY timestamp ASC"
    elif sort_by == "passengers_desc":
        order_clause = "ORDER BY predicted_passengers DESC"
    elif sort_by == "passengers_asc":
        order_clause = "ORDER BY predicted_passengers ASC"
    elif sort_by == "confidence":
        order_clause = "ORDER BY confidence DESC"

    query = f"""
        SELECT * FROM prediction_history
        {where_str}
        {order_clause}
        LIMIT ?
    """
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()

    items = []
    high_crowd_count = 0
    total_conf = 0.0
    dest_counts: Dict[str, int] = {}

    for r in rows:
        item = {
            "id": r["id"],
            "timestamp": r["timestamp"],
            "source_station": r["source_station"],
            "destination_station": r["destination_station"],
            "metro_line": r["metro_line"],
            "travel_date": r["travel_date"],
            "travel_time": r["travel_time"],
            "predicted_passengers": r["predicted_passengers"],
            "crowd_level": r["crowd_level"],
            "confidence": r["confidence"],
            "weather": r["weather"],
            "holiday": r["holiday"],
            "special_event": r["special_event"],
            "travel_advice": r["travel_advice"],
            "recommended_time": r["recommended_time"]
        }
        items.append(item)
        if r["crowd_level"] in ["High", "Very High"]:
            high_crowd_count += 1
        total_conf += r["confidence"]
        dest = r["destination_station"]
        dest_counts[dest] = dest_counts.get(dest, 0) + 1

    total_records = len(items)
    avg_conf = round(total_conf / total_records, 1) if total_records else 0
    high_crowd_pct = round((high_crowd_count / total_records) * 100, 1) if total_records else 0
    top_dest = max(dest_counts.items(), key=lambda x: x[1])[0] if dest_counts else "Majestic"

    conn.close()

    return {
        "success": True,
        "predictions": items,
        "metrics": {
            "total_count": total_records,
            "high_crowd_percentage": high_crowd_pct,
            "average_confidence": avg_conf,
            "top_destination": top_dest
        }
    }

def delete_prediction_entry(pred_id: int) -> bool:
    init_history_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM prediction_history WHERE id = ?", (pred_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()
    return deleted

def clear_all_predictions() -> bool:
    init_history_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM prediction_history")
    conn.commit()
    conn.close()
    return True
