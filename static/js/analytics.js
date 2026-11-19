/**
 * MetroAI Analytics Engine
 * Interactive charts, congestion rankings, Leaflet density map & AI insights
 */

let trafficChart = null;
let peakHourChart = null;
let lineChart = null;
let leafletMap = null;
let mapMarkersLayer = null;
let mapRoutesLayer = null;

let allStationsList = [];

// DOM Elements
const dateRangeSelect = document.getElementById("dateRange");
const lineFilterSelect = document.getElementById("lineFilter");
const stationFilterSelect = document.getElementById("stationFilter");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const loadingIndicator = document.getElementById("loadingIndicator");

const kpiTotalPax = document.getElementById("kpiTotalPax");
const kpiPeakHour = document.getElementById("kpiPeakHour");
const kpiTopStation = document.getElementById("kpiTopStation");
const kpiStationCount = document.getElementById("kpiStationCount");
const congestionContainer = document.getElementById("congestionAnalysis");
const insightsContainer = document.getElementById("aiInsights");
const trafficSubtitle = document.getElementById("trafficSubtitle");

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
    await initStationDropdown();
    initMap();
    await fetchAnalyticsData();

    // Event Listeners
    applyFiltersBtn.addEventListener("click", () => fetchAnalyticsData());
    resetFiltersBtn.addEventListener("click", resetFilters);
    lineFilterSelect.addEventListener("change", updateStationDropdownForLine);
});

// Format large numbers with commas or compact notation (M, K)
function formatCompactNumber(num) {
    if (!num || isNaN(num)) return "0";
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return num.toLocaleString();
}

// ----------------------------------------------------
// 1. Station Options Dropdown
// ----------------------------------------------------
async function initStationDropdown() {
    try {
        const res = await fetch("/api/stations");
        if (!res.ok) throw new Error("Failed to load stations");
        allStationsList = await res.json();

        populateStationOptions(allStationsList);
    } catch (err) {
        console.warn("Could not load stations list:", err);
    }
}

function populateStationOptions(stations) {
    stationFilterSelect.innerHTML = '<option value="all">All Stations</option>';
    
    // Sort unique names alphabetically
    const uniqueStations = [...new Map(stations.map(item => [item.station_name, item])).values()]
        .sort((a, b) => a.station_name.localeCompare(b.station_name));

    uniqueStations.forEach(st => {
        const opt = document.createElement("option");
        opt.value = st.station_name;
        opt.textContent = `${st.station_name} (${st.metro_line} Line)`;
        stationFilterSelect.appendChild(opt);
    });
}

function updateStationDropdownForLine() {
    const selectedLine = lineFilterSelect.value;
    if (selectedLine === "all") {
        populateStationOptions(allStationsList);
    } else {
        const filtered = allStationsList.filter(s => s.metro_line === selectedLine);
        populateStationOptions(filtered);
    }
}

function resetFilters() {
    dateRangeSelect.value = "monthly";
    lineFilterSelect.value = "all";
    populateStationOptions(allStationsList);
    stationFilterSelect.value = "all";
    fetchAnalyticsData();
}

// ----------------------------------------------------
// 2. Fetch Analytics Payload
// ----------------------------------------------------
async function fetchAnalyticsData() {
    setLoadingState(true);

    const period = dateRangeSelect.value;
    const line = lineFilterSelect.value;
    const station = stationFilterSelect.value;

    const url = `/api/analytics/data?period=${encodeURIComponent(period)}&line=${encodeURIComponent(line)}&station=${encodeURIComponent(station)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
            console.error("API error:", data.error);
            showErrorState(data.error || "Unable to retrieve analytics.");
            return;
        }

        renderKPICards(data);
        renderTrafficChart(data.traffic, period);
        renderPeakHourChart(data.peak_hours);
        renderLineComparisonChart(data.line_comparison);
        renderCongestionRankings(data.congestion);
        renderHeatmapMarkers(data.heatmap);
        renderAIInsights(data.insights);

    } catch (error) {
        console.error("Fetch analytics error:", error);
        showErrorState("Network error while connecting to MetroAI Analytics server.");
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? "flex" : "none";
    }
    if (applyFiltersBtn) {
        applyFiltersBtn.disabled = isLoading;
        applyFiltersBtn.innerHTML = isLoading 
            ? '<i class="fa-solid fa-spinner fa-spin"></i> Filtering...'
            : '<i class="fa-solid fa-filter"></i> Apply Filters';
    }
}

function showErrorState(msg) {
    congestionContainer.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-exclamation" style="color:#ef4444;"></i><p>${msg}</p></div>`;
    insightsContainer.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-exclamation" style="color:#ef4444;"></i><p>${msg}</p></div>`;
}

// ----------------------------------------------------
// 3. Render KPIs
// ----------------------------------------------------
function renderKPICards(data) {
    const summary = data.summary || {};
    kpiTotalPax.textContent = formatCompactNumber(summary.total_passengers);
    kpiPeakHour.textContent = summary.peak_hour || "18:00";
    kpiTopStation.textContent = summary.top_station ? summary.top_station.replace(" Station (Majestic)", "") : "Majestic";
    kpiStationCount.textContent = summary.active_stations || "85";

    if (trafficSubtitle) {
        const gran = dateRangeSelect.value;
        trafficSubtitle.textContent = gran === "daily" 
            ? "Recent 60 days daily aggregate" 
            : gran === "weekly" ? "Aggregated by calendar week" : "Monthly historical trajectory";
    }
}

// ----------------------------------------------------
// 4. Chart: Traffic Trends (Line Chart with Gradient)
// ----------------------------------------------------
function renderTrafficChart(trafficData, period) {
    const ctx = document.getElementById("trafficCanvas").getContext("2d");
    if (!ctx) return;

    if (trafficChart) {
        trafficChart.destroy();
    }

    const labels = (trafficData || []).map(d => d.period);
    const values = (trafficData || []).map(d => d.passengers);

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(124, 58, 237, 0.45)");
    gradient.addColorStop(1, "rgba(124, 58, 237, 0.01)");

    trafficChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Passenger Arrivals",
                data: values,
                borderColor: "#a855f7",
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#c084fc",
                pointBorderColor: "#0f172a",
                pointBorderWidth: 1.5,
                pointRadius: labels.length > 30 ? 0 : 3.5,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e293b",
                    titleColor: "#f8fafc",
                    bodyColor: "#cbd5e1",
                    borderColor: "rgba(168, 85, 247, 0.4)",
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: (ctx) => ` Arrivals: ${ctx.parsed.y.toLocaleString()} passengers`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(255, 255, 255, 0.04)" },
                    ticks: {
                        color: "#94a3b8",
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 14,
                        font: { size: 11 }
                    }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.04)" },
                    ticks: {
                        color: "#94a3b8",
                        font: { size: 11 },
                        callback: (v) => formatCompactNumber(v)
                    }
                }
            }
        }
    });
}

// ----------------------------------------------------
// 5. Chart: Peak Hour Analysis (Bar Chart)
// ----------------------------------------------------
function renderPeakHourChart(peakData) {
    const ctx = document.getElementById("peakHourCanvas").getContext("2d");
    if (!ctx) return;

    if (peakHourChart) {
        peakHourChart.destroy();
    }

    const labels = (peakData || []).map(d => `${d.hour.toString().padStart(2, "0")}:00`);
    const values = (peakData || []).map(d => d.passengers);

    // Color bars: highlight rush hours (8-10 AM and 17-19 PM) in bright colors
    const backgroundColors = (peakData || []).map(d => {
        if ((d.hour >= 8 && d.hour <= 10) || (d.hour >= 17 && d.hour <= 19)) {
            return "rgba(244, 63, 94, 0.85)"; // Morning/Evening rush
        }
        if (d.hour >= 11 && d.hour <= 16) {
            return "rgba(59, 130, 246, 0.75)"; // Daytime normal
        }
        return "rgba(100, 116, 139, 0.45)"; // Off-peak / late night
    });

    peakHourChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Passenger Volume",
                data: values,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e293b",
                    titleColor: "#f8fafc",
                    bodyColor: "#cbd5e1",
                    borderColor: "rgba(244, 63, 94, 0.4)",
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: (ctx) => ` Arrivals: ${ctx.parsed.y.toLocaleString()}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#94a3b8",
                        font: { size: 10 },
                        autoSkip: true,
                        maxTicksLimit: 12
                    }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.04)" },
                    ticks: {
                        color: "#94a3b8",
                        font: { size: 11 },
                        callback: (v) => formatCompactNumber(v)
                    }
                }
            }
        }
    });
}

// ----------------------------------------------------
// 6. Chart: Line Comparison (Doughnut Chart)
// ----------------------------------------------------
function renderLineComparisonChart(lineData) {
    const ctx = document.getElementById("lineComparisonCanvas").getContext("2d");
    if (!ctx) return;

    if (lineChart) {
        lineChart.destroy();
    }

    const colorMap = {
        "Purple": "#a855f7",
        "Green": "#22c55e",
        "Yellow": "#eab308"
    };

    const labels = (lineData || []).map(d => `${d.line} Line`);
    const values = (lineData || []).map(d => d.passengers);
    const bgColors = (lineData || []).map(d => colorMap[d.line] || "#3b82f6");

    lineChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderColor: "#162032",
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "68%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#cbd5e1",
                        font: { size: 12 },
                        padding: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: "#1e293b",
                    titleColor: "#f8fafc",
                    bodyColor: "#cbd5e1",
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed;
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${ctx.label}: ${formatCompactNumber(val)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ----------------------------------------------------
// 7. Congestion Ranking List
// ----------------------------------------------------
function renderCongestionRankings(congestionList) {
    if (!congestionContainer) return;

    if (!congestionList || congestionList.length === 0) {
        congestionContainer.innerHTML = '<div class="loading-state"><p>No congestion data available for this filter.</p></div>';
        return;
    }

    const maxPax = congestionList[0]?.passengers || 1;

    let html = "";
    congestionList.forEach((item, index) => {
        const pct = Math.min(100, Math.round((item.passengers / maxPax) * 100));
        const lineBadgeClass = `badge-${(item.line || "purple").toLowerCase()}`;
        const levelBadgeClass = item.congestion_level === "Critical" 
            ? "badge-critical" 
            : item.congestion_level === "High" ? "badge-high" : "badge-moderate";

        html += `
            <div class="congestion-item">
                <div class="congestion-top">
                    <div class="congestion-name">
                        <span class="station-rank">${index + 1}</span>
                        <span>${item.station}</span>
                        <span class="line-badge ${lineBadgeClass}">${item.line} Line</span>
                    </div>
                    <div class="congestion-stats">
                        <span class="congestion-val">${item.passengers.toLocaleString()} arrivals</span>
                        <span class="congestion-badge ${levelBadgeClass}">${item.congestion_level || "High"}</span>
                    </div>
                </div>
                <div class="congestion-progress-track">
                    <div class="congestion-progress-fill" style="width: ${pct}%;"></div>
                </div>
            </div>
        `;
    });

    congestionContainer.innerHTML = html;
}

// ----------------------------------------------------
// 8. Leaflet Density Heatmap
// ----------------------------------------------------
function initMap() {
    const mapEl = document.getElementById("heatmapMap");
    if (!mapEl || leafletMap) return;

    // Bengaluru center coordinates matching Metro Network Map
    leafletMap = L.map("heatmapMap", {
        zoomControl: true
    }).setView([12.9716, 77.5946], 11);

    // OpenStreetMap base map (same as Metro Network page)
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }
    ).addTo(leafletMap);

    mapRoutesLayer = L.layerGroup().addTo(leafletMap);
    mapMarkersLayer = L.layerGroup().addTo(leafletMap);
}

function getLineColor(line) {
    if (!line) return "#38bdf8";
    const normalizedLine = line.toLowerCase();
    if (normalizedLine.includes("purple")) return "#7c3aed";
    if (normalizedLine.includes("green")) return "#10b981";
    if (normalizedLine.includes("yellow")) return "#eab308";
    return "#38bdf8";
}

function drawMetroLines(stations) {
    if (!mapRoutesLayer) return;
    mapRoutesLayer.clearLayers();

    // Group stations by line
    const lines = {};
    stations.forEach(station => {
        const line = station.metro_line;
        if (!line) return;
        if (!lines[line]) lines[line] = [];
        lines[line].push(station);
    });

    Object.keys(lines).forEach(line => {
        // Sort using station ID if available or by position
        lines[line].sort((a, b) => {
            const numA = parseInt((a.station_id || "").replace(/\D/g, "")) || 0;
            const numB = parseInt((b.station_id || "").replace(/\D/g, "")) || 0;
            return numA - numB;
        });

        const coordinates = lines[line]
            .map(s => [Number(s.latitude), Number(s.longitude)])
            .filter(pt => !Number.isNaN(pt[0]) && !Number.isNaN(pt[1]));

        if (coordinates.length >= 2) {
            const route = L.polyline(coordinates, {
                color: getLineColor(line),
                weight: 5,
                opacity: 0.85,
                lineJoin: "round",
                lineCap: "round"
            });
            mapRoutesLayer.addLayer(route);
        }
    });
}

function renderHeatmapMarkers(stations) {
    if (!leafletMap || !mapMarkersLayer) return;

    // Draw metro line connecting tracks first
    drawMetroLines(allStationsList.length > 0 ? allStationsList : stations);

    mapMarkersLayer.clearLayers();

    if (!stations || stations.length === 0) return;

    const bounds = [];

    stations.forEach(st => {
        if (!st.latitude || !st.longitude) return;

        bounds.push([st.latitude, st.longitude]);

        // Color based on crowd level
        let color = "#10b981"; // Low (Emerald)
        let radius = 7;
        if (st.crowd_level === "High") {
            color = "#ef4444"; // High (Red)
            radius = 12;
        } else if (st.crowd_level === "Moderate") {
            color = "#f59e0b"; // Moderate (Amber)
            radius = 9.5;
        }

        const marker = L.circleMarker([st.latitude, st.longitude], {
            radius: radius,
            fillColor: color,
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85
        });

        // Popup content
        const popupContent = `
            <div style="font-family:'Inter',sans-serif; color:#0f172a; padding:6px 4px; min-width: 170px;">
                <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700;">${st.station_name}</h4>
                <p style="margin:0 0 6px 0; font-size:12px; color:#64748b;">
                    <strong style="color:${getLineColor(st.metro_line)};">${st.metro_line} Line</strong> · Capacity: ${st.capacity?.toLocaleString()}
                </p>
                <div style="font-size:12px; margin-bottom: 6px;">
                    <strong>Arrivals Volume:</strong> ${st.passengers?.toLocaleString()}
                </div>
                <div>
                    <span style="background:${color}; color:#fff; font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; display:inline-block;">
                        ${st.crowd_level} Demand
                    </span>
                </div>
            </div>
        `;
        marker.bindPopup(popupContent);
        marker.bindTooltip(st.station_name, { permanent: false, direction: "top", offset: [0, -6] });

        mapMarkersLayer.addLayer(marker);
    });

    if (bounds.length > 0 && stations.length <= 10) {
        leafletMap.fitBounds(bounds, { padding: [30, 30] });
    }
}

// ----------------------------------------------------
// 9. AI Insights Cards
// ----------------------------------------------------
function renderAIInsights(insights) {
    if (!insightsContainer) return;

    if (!insights || insights.length === 0) {
        insightsContainer.innerHTML = '<div class="loading-state"><p>No specific insights detected.</p></div>';
        return;
    }

    const icons = [
        "fa-solid fa-chart-line",
        "fa-solid fa-clock-rotate-left",
        "fa-solid fa-triangle-exclamation",
        "fa-solid fa-route",
        "fa-solid fa-lightbulb"
    ];

    let html = "";
    insights.forEach((text, i) => {
        const icon = icons[i % icons.length];
        html += `
            <div class="insight-card">
                <div class="insight-icon"><i class="${icon}"></i></div>
                <div class="insight-text">${text}</div>
            </div>
        `;
    });

    insightsContainer.innerHTML = html;
}
