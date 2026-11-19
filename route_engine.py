import heapq
import pandas as pd
from math import radians, sin, cos, sqrt, atan2

# ==========================================
# LOAD STATION DATA
# ==========================================

STATION_FILE = "data/station_master.csv"

stations_df = pd.read_csv(STATION_FILE)

# Clean column names and station names
stations_df.columns = stations_df.columns.str.strip()

stations_df["station_name"] = (
    stations_df["station_name"]
    .astype(str)
    .str.strip()
)

stations_df["metro_line"] = (
    stations_df["metro_line"]
    .astype(str)
    .str.strip()
)

stations_df["sequence"] = (
    stations_df.groupby("metro_line").cumcount() + 1
)

stations_df["is_interchange"] = (
    stations_df["is_interchange"]
    .astype(str)
    .str.strip()
    .str.lower()
    .isin(["yes", "true", "1"])
)

# ==========================================
# HAVERSINE DISTANCE
# ==========================================

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate approximate straight-line distance in km."""

    earth_radius = 6371

    lat1, lon1, lat2, lon2 = map(
        radians, [lat1, lon1, lat2, lon2]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1)
        * cos(lat2)
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return earth_radius * c


# ==========================================
# BUILD METRO NETWORK
# ==========================================

graph = {}
station_lookup = {}

for _, row in stations_df.iterrows():
    station_name = row["station_name"]
    line = row["metro_line"]

    # Separate graph nodes allow the same interchange
    # station to exist on multiple lines.
    node = (station_name, line)

    graph.setdefault(node, [])
    station_lookup.setdefault(station_name, []).append(node)


# Connect consecutive stations on each line
for line, line_df in stations_df.groupby("metro_line"):
    line_df = line_df.reset_index(drop=True)

    for i in range(len(line_df) - 1):
        current = line_df.iloc[i]
        following = line_df.iloc[i + 1]

        node_a = (current["station_name"], line)
        node_b = (following["station_name"], line)

        distance = calculate_distance(
            float(current["latitude"]),
            float(current["longitude"]),
            float(following["latitude"]),
            float(following["longitude"])
        )

        # Every station-to-station connection costs 1.
        graph[node_a].append((node_b, 1, distance))
        graph[node_b].append((node_a, 1, distance))


# Connect stations sharing an interchange name
for station_name, nodes in station_lookup.items():
    if len(nodes) > 1:
        for node_a in nodes:
            for node_b in nodes:
                if node_a != node_b:
                    graph[node_a].append((node_b, 0, 0))


def find_station_name(user_input):
    """
    Match user input to a station name in the dataset,
    supporting exact matches, known aliases, abbreviations,
    and substring/parenthetical searches.
    """
    if not user_input:
        return None

    raw_input = str(user_input).strip()
    search_name = " ".join(raw_input.split()).casefold()

    # 1. Exact match (case-insensitive)
    matches = stations_df[
        stations_df["station_name"]
        .astype(str)
        .apply(lambda name: " ".join(name.split()).casefold() == search_name)
    ]
    if not matches.empty:
        return matches.iloc[0]["station_name"]

    # 2. Known Transit & Interchange Aliases
    ALIASES = {
        "rv road": "Rashtreeya Vidyalaya Road",
        "r.v. road": "Rashtreeya Vidyalaya Road",
        "r v road": "Rashtreeya Vidyalaya Road",
        "rv": "Rashtreeya Vidyalaya Road",
        "rv road interchange": "Rashtreeya Vidyalaya Road",
        "majestic": "Nadaprabhu Kempegowda Station (Majestic)",
        "majestic interchange": "Nadaprabhu Kempegowda Station (Majestic)",
        "majestic station": "Nadaprabhu Kempegowda Station (Majestic)",
        "kempegowda": "Nadaprabhu Kempegowda Station (Majestic)",
        "kempegowda station": "Nadaprabhu Kempegowda Station (Majestic)",
        "kempegowda majestic": "Nadaprabhu Kempegowda Station (Majestic)",
        "whitefield": "Whitefield (Kadugodi)",
        "kadugodi": "Whitefield (Kadugodi)",
        "jayadeva": "Jayadeva Hospital",
        "jayadeva interchange": "Jayadeva Hospital",
        "silk board": "Central Silk Board",
        "central silk board": "Central Silk Board",
        "kr puram": "Krishnarajapura (KR Puram)",
        "k.r. puram": "Krishnarajapura (KR Puram)",
        "k r puram": "Krishnarajapura (KR Puram)",
        "kengeri bus stand": "Kengeri Bus Terminal",
        "kengeri bus stop": "Kengeri Bus Terminal",
        "chikpet": "Chickpete",
        "chickpet": "Chickpete",
        "electronic city": "Electronic City",
        "electronics city": "Electronic City",
        "electronic city 1": "Electronic City",
        "electronic city 2": "Electronic City",
        "konappana agrahara": "Infosys Foundation Konappana Agrahara",
        "infosys": "Infosys Foundation Konappana Agrahara",
        "hebbagodi": "Biocon Hebbagodi",
        "biocon": "Biocon Hebbagodi",
        "bommasandra": "Delta Electronics Bommasandra"
    }

    if search_name in ALIASES:
        return ALIASES[search_name]

    # Clean punctuation for soft matching
    cleaned_input = search_name.replace(".", "").replace("-", " ").replace("(", "").replace(")", "").strip()
    if cleaned_input in ALIASES:
        return ALIASES[cleaned_input]

    # 3. Substring / Parenthesis matching
    unique_names = stations_df["station_name"].dropna().unique()
    for name in unique_names:
        name_str = str(name).strip()
        name_clean = " ".join(name_str.split()).casefold()

        # If user input matches inside parentheses e.g. "Majestic" matches "...(Majestic)"
        if "(" in name_clean and ")" in name_clean:
            inside_paren = name_clean[name_clean.find("(") + 1 : name_clean.find(")")].strip()
            if search_name == inside_paren or cleaned_input == inside_paren:
                return name_str

        # If search query is a substantial substring of the station name
        if len(search_name) >= 3 and (search_name in name_clean or name_clean in search_name):
            return name_str

    return None

# ==========================================
# FIND ROUTE USING DIJKSTRA
# ==========================================

def find_route(source, destination):
    original_source = source
    original_destination = destination

    source = find_station_name(source)
    destination = find_station_name(destination)

    if source is None:
        return {
            "error": f"Starting station '{original_source}' not found."
        }

    if destination is None:
        return {
            "error": f"Destination station '{original_destination}' not found."
        }
    source = source.strip()
    destination = destination.strip()

    if source not in station_lookup:
        return {"error": f"Starting station '{source}' not found."}

    if destination not in station_lookup:
        return {"error": f"Destination station '{destination}' not found."}

    if source == destination:
        start_line = station_lookup[source][0][1] if (source in station_lookup and station_lookup[source]) else "Purple"
        return {
            "source": source,
            "destination": destination,
            "route": [{"station": source, "line": start_line}],
            "lines": [start_line],
            "interchanges": [],
            "station_connections": 0,
            "line_transfers": 0,
            "approximate_distance_km": 0.0,
            "distance_note": "Origin and destination are the same station."
        }

    # State: connection count, current node, path, distance
    priority_queue = []

    for node in station_lookup[source]:
        heapq.heappush(
            priority_queue,
            (0, 0.0, node, [node])
        )

    best_cost = {}

    while priority_queue:
        connections, distance, current, path = heapq.heappop(
            priority_queue
        )

        if current in best_cost:
            continue

        best_cost[current] = connections

        if current[0] == destination:
            route_nodes = path

            station_sequence = []
            lines_used = []
            interchanges = []

            for node in route_nodes:
                name, line = node

                station_sequence.append({
                    "station": name,
                    "line": line
                })

                if not lines_used or lines_used[-1] != line:
                    lines_used.append(line)

                if len(station_sequence) > 1:
                    previous_line = station_sequence[-2]["line"]

                    if previous_line != line:
                        interchanges.append(name)

            # Count actual movements between physical stations.
            station_connections = 0

            # Count transfers between metro lines.
            line_transfers = 0

            for i in range(1, len(route_nodes)):
                previous_station, previous_line = route_nodes[i - 1]
                current_station, current_line = route_nodes[i]

                if previous_station == current_station:
                    # Same physical station, different metro line.
                    if previous_line != current_line:
                        line_transfers += 1
                else:
                    # Movement between two different stations.
                    station_connections += 1

            return {
                "source": source,
                "destination": destination,
                "route": station_sequence,
                "lines": lines_used,
                "interchanges": list(dict.fromkeys(interchanges)),
                "station_connections": station_connections,
                "line_transfers": line_transfers,
                "approximate_distance_km": round(distance, 2),
                "distance_note": (
                    "Approximate geographical distance, "
                    "not verified railway track distance."
                )
            }

        for neighbor, cost, edge_distance in graph[current]:
            if neighbor in best_cost:
                continue

            heapq.heappush(
                priority_queue,
                (
                    connections + cost,
                    distance + edge_distance,
                    neighbor,
                    path + [neighbor]
                )
            )

    return {"error": "No connected route was found."}


def generate_travel_instructions(route_result):
    """
    Generate passenger-friendly travel instructions
    using the route returned by find_route().
    """

    # Handle invalid routes
    if "error" in route_result:
        return [{"step": 1, "instruction": route_result["error"]}]

    route = route_result.get("route", [])

    # Handle source and destination being the same
    if len(route) <= 1:
        return [{
            "step": 1,
            "instruction": "You are already at your destination."
        }]

    instructions = []

    # Group consecutive stations belonging to the same line
    segments = []
    current_segment = {
        "line": route[0]["line"],
        "start": route[0]["station"],
        "end": route[0]["station"]
    }

    for i in range(1, len(route)):
        previous_station = route[i - 1]
        current_station = route[i]

        if current_station["line"] == current_segment["line"]:
            current_segment["end"] = current_station["station"]

        else:
            # Finish the previous line segment
            segments.append(current_segment)

            # Begin the next line segment
            current_segment = {
                "line": current_station["line"],
                "start": current_station["station"],
                "end": current_station["station"]
            }

    # Add the final segment
    segments.append(current_segment)

    # Generate instructions for each line segment
    for index, segment in enumerate(segments):

        line = segment["line"]
        start = segment["start"]
        end = segment["end"]

        if index == 0:
            instruction = (
                f"Start at {start}. Board the {line} "
                f"and travel towards {end}. "
                f"Get off at {end}."
            )

        else:
            instruction = (
                f"At {start}, change to the {line}. "
                f"Travel towards {end} and get off at {end}."
            )

        instructions.append({
            "step": index + 1,
            "instruction": instruction,
            "line": line,
            "start_station": start,
            "end_station": end
        })

    # Add the final destination message
    destination = route[-1]["station"]

    instructions.append({
        "step": len(instructions) + 1,
        "instruction": (
            f"You have arrived at your destination: {destination}."
        )
    })

    return instructions
# ==========================================
# TEST ROUTE ENGINE
# ==========================================

if __name__ == "__main__":

    source = "Madavara"
    destination = "BTM Layout"

    result = find_route(source, destination)

    print("\n========== ROUTE DETAILS ==========")
    print(result)

    print("\n========== TRAVEL INSTRUCTIONS ==========")

    instructions = generate_travel_instructions(result)

    for item in instructions:
        print(f"Step {item['step']}: {item['instruction']}")