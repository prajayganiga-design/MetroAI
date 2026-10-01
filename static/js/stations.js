// =========================================================
// MetroAI - Stations Page
// =========================================================


// =========================================================
// DOM ELEMENTS
// =========================================================

const stationSearch = document.getElementById("stationSearch");
const lineFilter = document.getElementById("lineFilter");

const stationGrid = document.getElementById("stationGrid");
const emptyState = document.getElementById("emptyState");

const totalStations = document.getElementById("totalStations");
const totalLines = document.getElementById("totalLines");
const interchangeStations = document.getElementById("interchangeStations");
const operationalStations = document.getElementById("operationalStations");

const resultsCount = document.getElementById("resultsCount");


// =========================================================
// VARIABLES
// =========================================================

let stations = [];
let filteredStations = [];


// =========================================================
// PAGE LOAD
// =========================================================

window.addEventListener("DOMContentLoaded", () => {
    loadStations();
});


// =========================================================
// LOAD STATIONS FROM FLASK API
// =========================================================

async function loadStations() {

    try {

        const response = await fetch(
            "/api/stations"
        );

        if (!response.ok) {
            throw new Error("Failed to load stations");
        }

        stations = await response.json();

        console.log(
            "Stations Loaded:",
            stations.length
        );

        filteredStations = [...stations];

        updateStatistics();

        renderStations();

    }
    catch (error) {

        console.error(
            "Station loading error:",
            error
        );

        stationGrid.innerHTML = "";

        resultsCount.textContent =
            "Unable to load station data.";

    }

}


// =========================================================
// UPDATE STATISTICS
// =========================================================

function updateStatistics() {

    // Total stations
    totalStations.textContent =
        stations.length;


    // Unique metro lines
    const lines = new Set(
        stations.map(
            station => station.metro_line
        )
    );

    totalLines.textContent =
        lines.size;


    // Interchange stations
    const interchangeCount =
        stations.filter(
            station =>
                String(station.is_interchange)
                    .toLowerCase() === "yes" ||
                String(station.is_interchange)
                    .toLowerCase() === "true" ||
                station.is_interchange === 1
        ).length;

    interchangeStations.textContent =
        interchangeCount;


    // Operational stations
    const operationalCount =
        stations.filter(
            station =>
                String(station.status)
                    .toLowerCase() === "operational"
        ).length;

    operationalStations.textContent =
        operationalCount;

}


// =========================================================
// FILTER STATIONS
// =========================================================

function filterStations() {

    const searchText =
        stationSearch.value
            .trim()
            .toLowerCase();

    const selectedLine =
        lineFilter.value;


    filteredStations =
        stations.filter(station => {

            // -----------------------------
            // Search filter
            // -----------------------------

            const matchesSearch =
                station.station_name
                    .toLowerCase()
                    .includes(searchText);


            // -----------------------------
            // Line filter
            // -----------------------------

            const matchesLine =
                selectedLine === "all" ||
                station.metro_line === selectedLine;


            return matchesSearch &&
                   matchesLine;

        });


    renderStations();

}


// =========================================================
// RENDER STATION CARDS
// =========================================================

function renderStations() {

    stationGrid.innerHTML = "";


    // No results
    if (filteredStations.length === 0) {

        emptyState.style.display = "block";

        resultsCount.textContent =
            "0 stations found.";

        return;
    }


    emptyState.style.display = "none";


    resultsCount.textContent =
        `Showing ${filteredStations.length} station${
            filteredStations.length === 1 ? "" : "s"
        }`;


    // Create cards
    filteredStations.forEach(
        station => {

            const card =
                createStationCard(station);

            stationGrid.appendChild(card);

        }
    );

}


// =========================================================
// CREATE STATION CARD
// =========================================================

function createStationCard(station) {

    const card =
        document.createElement("article");

    card.className =
        "station-card";


    // =====================================================
    // BASIC DATA
    // =====================================================

    const stationName =
        station.station_name || "Unknown Station";

    const stationId =
        station.station_id || "--";

    const metroLine =
        station.metro_line || "--";

    const stationType =
        station.station_type || "--";

    const category =
        station.station_category || "--";

    const status =
        station.status || "--";

    const capacity =
        station.base_capacity ?? "--";

    const platforms =
        station.platform_count ?? "--";

    const parking =
        station.parking || "--";

    const importance =
        station.importance_level ?? "--";


    // =====================================================
    // SPECIAL FLAGS
    // =====================================================

    const isInterchange =
        String(station.is_interchange)
            .toLowerCase() === "yes" ||
        String(station.is_interchange)
            .toLowerCase() === "true" ||
        station.is_interchange === 1;


    const isTerminal =
        String(station.is_terminal)
            .toLowerCase() === "yes" ||
        String(station.is_terminal)
            .toLowerCase() === "true" ||
        station.is_terminal === 1;


    // =====================================================
    // STATUS BADGE
    // =====================================================

    let statusBadge = "";

    if (
        String(status).toLowerCase()
            === "operational"
    ) {

        statusBadge = `
            <span class="station-badge badge-operational">
                <i class="fa-solid fa-circle-check"></i>
                Operational
            </span>
        `;

    }
    else {

        statusBadge = `
            <span class="station-badge">
                ${status}
            </span>
        `;

    }


    // =====================================================
    // OPTIONAL BADGES
    // =====================================================

    let specialBadges = "";


    if (isInterchange) {

        specialBadges += `
            <span class="station-badge badge-interchange">
                <i class="fa-solid fa-arrows-turn-to-dots"></i>
                Interchange
            </span>
        `;

    }


    if (isTerminal) {

        specialBadges += `
            <span class="station-badge badge-terminal">
                <i class="fa-solid fa-train"></i>
                Terminal
            </span>
        `;

    }


    // =====================================================
    // CARD HTML
    // =====================================================

    card.innerHTML = `

        <!-- Card Top -->

        <div class="station-card-top">

            <div class="station-card-icon">
                <i class="fa-solid fa-train-subway"></i>
            </div>

            <span class="station-id">
                ${stationId}
            </span>

        </div>


        <!-- Station Name -->

        <h3>
            ${stationName}
        </h3>


        <!-- Description -->

        <p class="station-card-description">
            ${category} station • ${stationType}
        </p>


        <!-- Badges -->

        <div class="station-badges">

            <span class="station-badge badge-line">
                <i class="fa-solid fa-route"></i>
                ${metroLine}
            </span>

            ${statusBadge}

            ${specialBadges}

        </div>


        <!-- Station Information -->

        <div class="station-info">

            <div class="station-info-item">

                <span>
                    Base Capacity
                </span>

                <strong>
                    ${formatNumber(capacity)}
                </strong>

            </div>


            <div class="station-info-item">

                <span>
                    Platforms
                </span>

                <strong>
                    ${platforms}
                </strong>

            </div>


            <div class="station-info-item">

                <span>
                    Parking
                </span>

                <strong>
                    ${parking}
                </strong>

            </div>


            <div class="station-info-item">

                <span>
                    Importance
                </span>

                <strong>
                    ${importance}
                </strong>

            </div>

        </div>

    `;


    return card;

}


// =========================================================
// FORMAT NUMBERS
// =========================================================

function formatNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === "--"
    ) {
        return "--";
    }


    const number =
        Number(value);


    if (Number.isNaN(number)) {
        return value;
    }


    return number.toLocaleString("en-IN");

}


// =========================================================
// SEARCH EVENT
// =========================================================

stationSearch.addEventListener(
    "input",
    () => {

        filterStations();

    }
);


// =========================================================
// LINE FILTER EVENT
// =========================================================

lineFilter.addEventListener(
    "change",
    () => {

        filterStations();

    }
);