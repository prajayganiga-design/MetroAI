/* =========================================================
   METROAI NETWORK MAP
   ========================================================= */

let metroMap;
let stationMarkers = [];
let routeLayers = {};

let crowdMode = false;
let crowdData = {};

// =========================================================
// INITIALIZE MAP
// =========================================================

function initializeMap() {

    const mapContainer = document.getElementById("metro-map");

    if (!mapContainer) {
        console.error("Metro map container not found.");
        return;
    }

    metroMap = L.map("metro-map", {
        zoomControl: true
    }).setView(
        [12.9716, 77.5946],
        11
    );


    // OpenStreetMap base map
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(metroMap);


    loadStations();
}


// =========================================================
// LOAD STATIONS FROM FLASK API
// =========================================================

async function loadStations() {

    try {

        const response = await fetch("/api/stations");

        if (!response.ok) {
            throw new Error("Failed to load station data.");
        }

        const stations = await response.json();

        console.log(
            "MetroAI: Loaded",
            stations.length,
            "stations."
        );

        displayStations(stations);

        // Draw metro routes
        drawRoutes(stations);

    } catch (error) {

        console.error(
            "Error loading stations:",
            error
        );

    }
}


// =========================================================
// DISPLAY STATIONS
// =========================================================

function displayStations(stations) {

    // Remove existing markers
    stationMarkers.forEach(marker => {
        metroMap.removeLayer(marker);
    });

    stationMarkers = [];


    stations.forEach(station => {

        const latitude = Number(station.latitude);
        const longitude = Number(station.longitude);

        if (
            Number.isNaN(latitude) ||
            Number.isNaN(longitude)
        ) {
            return;
        }


        // Determine line color
        const lineColor =
            getLineColor(station.metro_line);


        // Create custom station marker
        const markerIcon = L.divIcon({

            className: "metro-station-marker",

            html: `
                <div
                    style="
                        width: 16px;
                        height: 16px;
                        border-radius: 50%;
                        background: ${lineColor};
                        border: 3px solid white;
                        box-shadow:
                            0 0 10px ${lineColor},
                            0 2px 6px rgba(0,0,0,0.45);
                    "
                ></div>
            `,

            iconSize: [16, 16],

            iconAnchor: [8, 8]

        });


        const marker = L.marker(
            [latitude, longitude],
            {
                icon: markerIcon
            }
        );

        // Store the metro line with the marker
        marker.metroLine = station.metro_line;
        marker.stationId = station.station_id;
        marker.stationData = station;


        // Station popup
        marker.bindPopup(`

            <div style="
                min-width: 190px;
                font-family: Arial, sans-serif;
            ">

                <h3 style="
                    margin: 0 0 8px;
                    color: #111827;
                    font-size: 16px;
                ">
                    ${station.station_name}
                </h3>

                <div style="
                    color: #4b5563;
                    font-size: 13px;
                    line-height: 1.7;
                ">

                    <div>
                        <strong>Station ID:</strong>
                        ${station.station_id}
                    </div>

                    <div>
                        <strong>Line:</strong>
                        ${station.metro_line}
                    </div>

                    <div>
                        <strong>Type:</strong>
                        ${station.station_type}
                    </div>

                    <div>
                        <strong>Interchange:</strong>
                        ${station.is_interchange ? "Yes" : "No"}
                    </div>

                    <div>
                        <strong>Terminal:</strong>
                        ${station.is_terminal ? "Yes" : "No"}
                    </div>

                </div>

            </div>

        `);


        marker.addTo(metroMap);

        stationMarkers.push(marker);

    });
}


// =========================================================
// DRAW METRO ROUTES
// =========================================================

function drawRoutes(stations) {

    // Remove existing route lines
    Object.values(routeLayers).forEach(layer => {
        metroMap.removeLayer(layer);
    });

    routeLayers = {};


    // Group stations by metro line
    const lines = {};

    stations.forEach(station => {

        const line = station.metro_line;

        if (!line) {
            return;
        }

        if (!lines[line]) {
            lines[line] = [];
        }

        lines[line].push(station);

    });


    // Draw each metro line
    Object.keys(lines).forEach(line => {

        // Sort using station ID
        // Example: P001, P002, P003...
        lines[line].sort((a, b) => {

            const numberA =
                parseInt(a.station_id.replace(/\D/g, ""));

            const numberB =
                parseInt(b.station_id.replace(/\D/g, ""));

            return numberA - numberB;

        });


        // Create coordinate list
        const coordinates = lines[line]
            .map(station => [
                Number(station.latitude),
                Number(station.longitude)
            ])
            .filter(point =>
                !Number.isNaN(point[0]) &&
                !Number.isNaN(point[1])
            );


        if (coordinates.length < 2) {
            return;
        }


        // Create route
        const route = L.polyline(
            coordinates,
            {
                color: getLineColor(line),
                weight: 6,
                opacity: 0.9,
                lineJoin: "round",
                lineCap: "round"
            }
        );


        route.addTo(metroMap);

        routeLayers[line] = route;

    });


    console.log(
        "MetroAI: Metro routes drawn.",
        Object.keys(routeLayers)
    );
}


// =========================================================
// GET LINE COLOR
// =========================================================

function getLineColor(line) {

    if (!line) {
        return "#38bdf8";
    }

    const normalizedLine =
        line.toLowerCase();


    if (normalizedLine.includes("purple")) {
        return "#8b5cf6";
    }


    if (normalizedLine.includes("green")) {
        return "#22c55e";
    }


    if (normalizedLine.includes("yellow")) {
        return "#facc15";
    }


    return "#38bdf8";
}


// =========================================================
// LINE FILTERS
// =========================================================

function filterMetroLine(selectedLine) {

    // Show / hide station markers
    stationMarkers.forEach(marker => {

        const markerLine =
            marker.metroLine;

        if (
            selectedLine === "All" ||
            markerLine === selectedLine
        ) {

            if (!metroMap.hasLayer(marker)) {
                marker.addTo(metroMap);
            }

        } else {

            if (metroMap.hasLayer(marker)) {
                metroMap.removeLayer(marker);
            }

        }

    });


    // Show / hide route lines
    Object.keys(routeLayers).forEach(line => {

        const route =
            routeLayers[line];

        if (
            selectedLine === "All" ||
            line === selectedLine
        ) {

            if (!metroMap.hasLayer(route)) {
                route.addTo(metroMap);
            }

        } else {

            if (metroMap.hasLayer(route)) {
                metroMap.removeLayer(route);
            }

        }

    });

}


// =========================================================
// CONNECT FILTER BUTTONS
// =========================================================

function initializeLineFilters() {

    const filterButtons =
        document.querySelectorAll(".line-filter");

    filterButtons.forEach(button => {

        button.addEventListener("click", () => {

            const buttonText =
                button.textContent.trim();


            let selectedLine = "All";


            if (buttonText.includes("Purple")) {
                selectedLine = "Purple";
            }

            else if (buttonText.includes("Green")) {
                selectedLine = "Green";
            }

            else if (buttonText.includes("Yellow")) {
                selectedLine = "Yellow";
            }


            // Apply filter
            filterMetroLine(selectedLine);


            // Update active button
            filterButtons.forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");


            console.log(
                "MetroAI: Selected line:",
                selectedLine
            );

        });

    });

}

// =========================================================
// CROWD MODE
// =========================================================

async function loadCrowdData() {

    try {

        console.log("MetroAI: Loading crowd predictions...");

        const response = await fetch("/api/crowd");

        if (!response.ok) {
            throw new Error("Failed to load crowd data.");
        }

        const data = await response.json();

        crowdData = {};

        data.stations.forEach(station => {

            crowdData[station.station_id] = station;

        });

        console.log(
            "MetroAI: Crowd predictions loaded for",
            data.stations.length,
            "stations."
        );

        updateCrowdMarkers();

    } catch (error) {

        console.error(
            "MetroAI: Crowd data error:",
            error
        );

    }
}


// =========================================================
// UPDATE CROWD MARKERS
// =========================================================

function updateCrowdMarkers() {

    stationMarkers.forEach(marker => {

        const station =
            crowdData[marker.stationId];

        if (!station) {
            return;
        }

        const crowdColor =
            getCrowdColor(station.crowd_level);


        const crowdIcon = L.divIcon({

            className: "metro-station-marker",

            html: `
                <div
                    style="
                        width: 18px;
                        height: 18px;
                        border-radius: 50%;
                        background: ${crowdColor};
                        border: 3px solid white;
                        box-shadow:
                            0 0 12px ${crowdColor},
                            0 2px 6px rgba(0,0,0,0.45);
                    "
                ></div>
            `,

            iconSize: [18, 18],

            iconAnchor: [9, 9]

        });


        marker.setIcon(crowdIcon);


        // Update popup
        marker.bindPopup(`

            <div style="
                min-width: 210px;
                font-family: Arial, sans-serif;
            ">

                <h3 style="
                    margin: 0 0 8px;
                    color: #111827;
                    font-size: 16px;
                ">
                    ${station.station_name}
                </h3>

                <div style="
                    color: #4b5563;
                    font-size: 13px;
                    line-height: 1.8;
                ">

                    <div>
                        <strong>Station ID:</strong>
                        ${station.station_id}
                    </div>

                    <div>
                        <strong>Line:</strong>
                        ${station.metro_line}
                    </div>

                    <div>
                        <strong>Predicted Passengers:</strong>
                        ${station.predicted_passengers}
                    </div>

                    <div>
                        <strong>Crowd Level:</strong>
                        <span style="
                            color: ${crowdColor};
                            font-weight: bold;
                        ">
                            ${station.crowd_level}
                        </span>
                    </div>

                </div>

            </div>

        `);

    });

}


// =========================================================
// CROWD COLORS
// =========================================================

function getCrowdColor(level) {

    switch (level) {

        case "Low":
            return "#22c55e";

        case "Moderate":
            return "#facc15";

        case "High":
            return "#f97316";

        case "Very High":
            return "#ef4444";

        default:
            return "#38bdf8";
    }

}


// =========================================================
// SWITCH BETWEEN NETWORK AND CROWD MODE
// =========================================================

function setCrowdMode(enabled) {

    crowdMode = enabled;

    if (crowdMode) {

        console.log("MetroAI: Crowd Mode ON");

        loadCrowdData();

    } else {

        console.log("MetroAI: Network Mode ON");

        // Restore normal line-colored station markers
        stationMarkers.forEach(marker => {

            const station =
                marker.stationData;

            const lineColor =
                getLineColor(station.metro_line);


            const markerIcon = L.divIcon({

                className: "metro-station-marker",

                html: `
                    <div
                        style="
                            width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            background: ${lineColor};
                            border: 3px solid white;
                            box-shadow:
                                0 0 10px ${lineColor},
                                0 2px 6px rgba(0,0,0,0.45);
                        "
                    ></div>
                `,

                iconSize: [16, 16],

                iconAnchor: [8, 8]

            });


            marker.setIcon(markerIcon);


            // Restore normal station popup
            marker.bindPopup(`

                <div style="
                    min-width: 190px;
                    font-family: Arial, sans-serif;
                ">

                    <h3 style="
                        margin: 0 0 8px;
                        color: #111827;
                        font-size: 16px;
                    ">
                        ${station.station_name}
                    </h3>

                    <div style="
                        color: #4b5563;
                        font-size: 13px;
                        line-height: 1.7;
                    ">

                        <div>
                            <strong>Station ID:</strong>
                            ${station.station_id}
                        </div>

                        <div>
                            <strong>Line:</strong>
                            ${station.metro_line}
                        </div>

                        <div>
                            <strong>Type:</strong>
                            ${station.station_type}
                        </div>

                        <div>
                            <strong>Interchange:</strong>
                            ${station.is_interchange ? "Yes" : "No"}
                        </div>

                        <div>
                            <strong>Terminal:</strong>
                            ${station.is_terminal ? "Yes" : "No"}
                        </div>

                    </div>

                </div>

            `);

        });

    }

}


// =========================================================
// NETWORK / CROWD BUTTONS
// =========================================================

function initializeViewButtons() {

    const buttons =
        document.querySelectorAll("button");

    buttons.forEach(button => {

        const text =
            button.textContent.trim().toLowerCase();


        if (text.includes("crowd")) {

            button.addEventListener("click", () => {

                setCrowdMode(true);

                buttons.forEach(btn => {

                    const btnText =
                        btn.textContent.trim().toLowerCase();

                    if (
                        btnText.includes("network") ||
                        btnText.includes("crowd")
                    ) {
                        btn.classList.remove("active");
                    }

                });

                button.classList.add("active");

            });

        }


        if (
            text.includes("network") &&
            !text.includes("metro network")
        ) {

            button.addEventListener("click", () => {

                setCrowdMode(false);

                buttons.forEach(btn => {

                    const btnText =
                        btn.textContent.trim().toLowerCase();

                    if (
                        btnText.includes("network") ||
                        btnText.includes("crowd")
                    ) {
                        btn.classList.remove("active");
                    }

                });

                button.classList.add("active");

            });

        }

    });

}

// =========================================================
// START APPLICATION
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeMap();

        initializeLineFilters();

        initializeViewButtons();

    }
);