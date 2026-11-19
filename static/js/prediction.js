/**
 * MetroAI Prediction History Module
 * Interactive table, metric cards, filtering, CSV export & modal diagnostics
 */

let allPredictions = [];
let activeSelectedPrediction = null;

// DOM Elements
const searchInput = document.getElementById("searchInput");
const filterLine = document.getElementById("filterLine");
const filterCrowd = document.getElementById("filterCrowd");
const sortBy = document.getElementById("sortBy");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const metricTotal = document.getElementById("metricTotal");
const metricHighCrowd = document.getElementById("metricHighCrowd");
const metricAvgConf = document.getElementById("metricAvgConf");
const metricTopDest = document.getElementById("metricTopDest");

const tableBody = document.getElementById("predictionTableBody");
const recordCountInfo = document.getElementById("recordCountInfo");

const detailModal = document.getElementById("detailModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalCloseActionBtn = document.getElementById("modalCloseActionBtn");
const modalContent = document.getElementById("modalContent");
const modalPlanAgainBtn = document.getElementById("modalPlanAgainBtn");

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
    loadPredictionHistory();

    // Event Listeners
    let debounceTimer = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadPredictionHistory(), 300);
    });

    filterLine.addEventListener("change", () => loadPredictionHistory());
    filterCrowd.addEventListener("change", () => loadPredictionHistory());
    sortBy.addEventListener("change", () => loadPredictionHistory());

    exportCsvBtn.addEventListener("click", exportToCsv);
    clearHistoryBtn.addEventListener("click", handleClearAll);

    // Modal close listeners
    closeModalBtn.addEventListener("click", closeModal);
    modalCloseActionBtn.addEventListener("click", closeModal);
    detailModal.addEventListener("click", (e) => {
        if (e.target === detailModal) closeModal();
    });

    modalPlanAgainBtn.addEventListener("click", () => {
        if (activeSelectedPrediction) {
            window.location.href = `/planner`;
        }
    });
});

// ----------------------------------------------------
// 1. Fetch & Load History
// ----------------------------------------------------
async function loadPredictionHistory() {
    const search = searchInput.value.trim();
    const line = filterLine.value;
    const crowd = filterCrowd.value;
    const sort = sortBy.value;

    const url = `/api/predictions?search=${encodeURIComponent(search)}&line=${encodeURIComponent(line)}&crowd=${encodeURIComponent(crowd)}&sort=${encodeURIComponent(sort)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
            showTableError("Failed to fetch prediction history.");
            return;
        }

        allPredictions = data.predictions || [];
        updateMetrics(data.metrics || {});
        renderTable(allPredictions);

    } catch (err) {
        console.error("Error loading predictions:", err);
        showTableError("Error connecting to prediction history server.");
    }
}

// ----------------------------------------------------
// 2. Update KPI Metrics
// ----------------------------------------------------
function updateMetrics(metrics) {
    metricTotal.textContent = metrics.total_count ?? "--";
    metricHighCrowd.textContent = metrics.high_crowd_percentage != null ? `${metrics.high_crowd_percentage}%` : "--";
    metricAvgConf.textContent = metrics.average_confidence != null ? `${metrics.average_confidence}%` : "--";
    metricTopDest.textContent = metrics.top_destination ? metrics.top_destination.replace(" Station (Majestic)", "") : "--";
}

// ----------------------------------------------------
// 3. Render Table Rows
// ----------------------------------------------------
function renderTable(predictions) {
    recordCountInfo.textContent = `Showing ${predictions.length} recorded forecast${predictions.length === 1 ? "" : "s"}`;

    if (!predictions || predictions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #64748b;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 24px; margin-bottom: 8px; display: block; color: #475569;"></i>
                    No prediction history matches your search or filters.
                </td>
            </tr>
        `;
        return;
    }

    let rowsHtml = "";
    predictions.forEach(p => {
        const lineClass = `tag-${(p.metro_line || "purple").toLowerCase()}`;
        const crowdSlug = (p.crowd_level || "low").toLowerCase().replace(" ", "-");
        const crowdClass = `crowd-${crowdSlug}`;

        // Format relative or compact timestamp
        const timeDisplay = p.timestamp ? p.timestamp.slice(5, 16) : "--";

        rowsHtml += `
            <tr id="row-${p.id}">
                <td style="font-size: 12px; color: #94a3b8; white-space: nowrap;">${timeDisplay}</td>
                <td>
                    <div class="route-cell">
                        <span>${p.source_station}</span>
                        <i class="fa-solid fa-arrow-right route-arrow"></i>
                        <span>${p.destination_station}</span>
                    </div>
                </td>
                <td>
                    <span class="line-tag ${lineClass}">${p.metro_line}</span>
                </td>
                <td style="white-space: nowrap; font-size: 12px;">
                    <div>${p.travel_date}</div>
                    <div style="color: #94a3b8;"><i class="fa-regular fa-clock"></i> ${p.travel_time}</div>
                </td>
                <td>
                    <strong style="color: #ffffff;">${p.predicted_passengers.toLocaleString()}</strong>
                </td>
                <td>
                    <span class="crowd-badge ${crowdClass}">${p.crowd_level}</span>
                </td>
                <td>
                    <span class="confidence-pill">
                        <i class="fa-solid fa-check-circle" style="color: #10b981; font-size: 11px;"></i>
                        ${p.confidence}%
                    </span>
                </td>
                <td>
                    <div class="advice-snippet" title="${p.travel_advice || ''}">${p.travel_advice || 'Safe journey'}</div>
                </td>
                <td>
                    <div class="row-actions">
                        <button class="action-icon-btn" title="View Diagnostics" onclick="openDetailsModal(${p.id})">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="action-icon-btn" title="Re-Plan in Journey Planner" onclick="replanRoute('${p.source_station}', '${p.destination_station}')">
                            <i class="fa-solid fa-route"></i>
                        </button>
                        <button class="action-icon-btn delete" title="Delete Log" onclick="deletePrediction(${p.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = rowsHtml;
}

function showTableError(msg) {
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444; padding: 30px;">${msg}</td></tr>`;
}

// ----------------------------------------------------
// 4. Modal Diagnostics
// ----------------------------------------------------
window.openDetailsModal = function(predId) {
    const item = allPredictions.find(p => p.id === predId);
    if (!item) return;

    activeSelectedPrediction = item;

    const lineClass = `tag-${(item.metro_line || "purple").toLowerCase()}`;
    const crowdSlug = (item.crowd_level || "low").toLowerCase().replace(" ", "-");
    const crowdClass = `crowd-${crowdSlug}`;

    modalContent.innerHTML = `
        <div class="modal-route-banner">
            <div>
                <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Journey Corridor</span>
                <div style="font-size: 16px; font-weight: 700; color: #fff; margin-top: 4px;">
                    ${item.source_station} ➔ ${item.destination_station}
                </div>
            </div>
            <span class="line-tag ${lineClass}">${item.metro_line} Line</span>
        </div>

        <div class="modal-grid-details">
            <div class="detail-item">
                <span class="label">Travel Date & Time</span>
                <span class="value">${item.travel_date} at ${item.travel_time}</span>
            </div>
            <div class="detail-item">
                <span class="label">Predicted Arrivals (15-min)</span>
                <span class="value">${item.predicted_passengers.toLocaleString()} passengers</span>
            </div>
            <div class="detail-item">
                <span class="label">Estimated Crowd Level</span>
                <div><span class="crowd-badge ${crowdClass}">${item.crowd_level}</span></div>
            </div>
            <div class="detail-item">
                <span class="label">AI Confidence Score</span>
                <span class="value" style="color: #34d399;"><i class="fa-solid fa-shield-halved"></i> ${item.confidence}%</span>
            </div>
            <div class="detail-item">
                <span class="label">Weather Conditions</span>
                <span class="value">${item.weather || "Sunny"}</span>
            </div>
            <div class="detail-item">
                <span class="label">Holiday / Special Event</span>
                <span class="value">${item.holiday === "Yes" ? "Holiday" : "Non-Holiday"} · ${item.special_event || "No Event"}</span>
            </div>
            <div class="detail-item" style="grid-column: span 2;">
                <span class="label">Optimal Departure Window</span>
                <span class="value" style="color: #a78bfa;">${item.recommended_time || "On schedule"}</span>
            </div>
        </div>

        <div class="modal-advice-box">
            <strong style="color: #fff; display: block; margin-bottom: 4px;"><i class="fa-solid fa-robot"></i> AI Travel Recommendation:</strong>
            ${item.travel_advice || "Standard travel conditions apply."}
        </div>
    `;

    detailModal.style.display = "flex";
};

function closeModal() {
    detailModal.style.display = "none";
    activeSelectedPrediction = null;
}

// ----------------------------------------------------
// 5. Actions: Re-plan, Delete, Clear, Export
// ----------------------------------------------------
window.replanRoute = function(src, dest) {
    window.location.href = `/planner`;
};

window.deletePrediction = async function(id) {
    if (!confirm("Delete this prediction record?")) return;

    try {
        const res = await fetch(`/api/predictions/${id}`, { method: "DELETE" });
        const json = await res.json();
        if (json.success) {
            allPredictions = allPredictions.filter(p => p.id !== id);
            renderTable(allPredictions);
        } else {
            alert("Unable to delete prediction.");
        }
    } catch (e) {
        console.error("Delete error:", e);
        alert("Failed to delete prediction record.");
    }
};

async function handleClearAll() {
    if (!confirm("Are you sure you want to clear all prediction history? This action cannot be undone.")) {
        return;
    }

    try {
        const res = await fetch("/api/predictions/clear", { method: "POST" });
        const json = await res.json();
        if (json.success) {
            allPredictions = [];
            updateMetrics({ total_count: 0, high_crowd_percentage: 0, average_confidence: 0, top_destination: "--" });
            renderTable([]);
        }
    } catch (e) {
        console.error("Clear error:", e);
        alert("Unable to clear history.");
    }
}

function exportToCsv() {
    if (!allPredictions || allPredictions.length === 0) {
        alert("No prediction records to export.");
        return;
    }

    const headers = [
        "Prediction ID", "Logged At", "Source Station", "Destination Station",
        "Metro Line", "Travel Date", "Travel Time", "Predicted Passengers",
        "Crowd Level", "Confidence (%)", "Weather", "Holiday", "Special Event",
        "Recommended Time", "Travel Advice"
    ];

    const rows = allPredictions.map(p => [
        p.id,
        `"${p.timestamp}"`,
        `"${p.source_station}"`,
        `"${p.destination_station}"`,
        `"${p.metro_line}"`,
        `"${p.travel_date}"`,
        `"${p.travel_time}"`,
        p.predicted_passengers,
        `"${p.crowd_level}"`,
        p.confidence,
        `"${p.weather || ''}"`,
        `"${p.holiday || ''}"`,
        `"${p.special_event || ''}"`,
        `"${p.recommended_time || ''}"`,
        `"${(p.travel_advice || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `metroai_prediction_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
