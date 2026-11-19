/**
 * MetroAI Journey Planner Controller
 * Real-time crowd prediction, route telemetry, quick presets & departure matrix
 */

// Form & Input elements
const sourceInput = document.getElementById("sourceSearch");
const destinationInput = document.getElementById("destinationSearch");
const sourceSuggestions = document.getElementById("sourceSuggestions");
const destinationSuggestions = document.getElementById("destinationSuggestions");
const clearSourceBtn = document.getElementById("clearSourceBtn");
const clearDestBtn = document.getElementById("clearDestBtn");
const sourceLineTag = document.getElementById("sourceLineTag");
const destLineTag = document.getElementById("destLineTag");
const swapStationsBtn = document.getElementById("swapStationsBtn");
const resetPlannerBtn = document.getElementById("resetPlannerBtn");

const travelDate = document.getElementById("travelDate");
const travelTime = document.getElementById("travelTime");
const setNowBtn = document.getElementById("setNowBtn");
const weatherInput = document.getElementById("weatherSearch");
const holidayInput = document.getElementById("holidaySearch");
const eventInput = document.getElementById("eventSearch");
const eventSuggestions = document.getElementById("eventSuggestions");

const journeyForm = document.getElementById("journeyForm");
const predictBtn = document.getElementById("predictBtn");

// Results Elements
const placeholderCard = document.getElementById("placeholderCard");
const resultsContainer = document.getElementById("resultsContainer");

const resultStationName = document.getElementById("resultStationName");
const resultCorridorTag = document.getElementById("resultCorridorTag");
const crowdLevelBadge = document.getElementById("crowdLevelBadge");
const crowdLevel = document.getElementById("crowdLevel");
const passengerCount = document.getElementById("passengerCount");
const confidence = document.getElementById("confidence");
const recommendedTime = document.getElementById("recommendedTime");
const utilizationPctText = document.getElementById("utilizationPctText");
const utilizationFill = document.getElementById("utilizationFill");

const sourceStation = document.getElementById("sourceStation");
const destinationStation = document.getElementById("destinationStation");
const sourceLineDetail = document.getElementById("sourceLineDetail");
const destLineDetail = document.getElementById("destLineDetail");
const interchangeStepContainer = document.getElementById("interchangeStepContainer");
const routeTransferBadge = document.getElementById("routeTransferBadge");
const routeTotalStations = document.getElementById("routeTotalStations");
const routeDistance = document.getElementById("routeDistance");
const routeDuration = document.getElementById("routeDuration");
const routeInterchangeCount = document.getElementById("routeInterchangeCount");
const interchangeInstructionBox = document.getElementById("interchangeInstructionBox");
const interchangeInstructionText = document.getElementById("interchangeInstructionText");

const departureMatrix = document.getElementById("departureMatrix");
const travelAdvice = document.getElementById("travelAdvice");
const openInAssistantBtn = document.getElementById("openInAssistantBtn");
const viewHistoryBtn = document.getElementById("viewHistoryBtn");

// State
let stationsList = [];
let selectedSource = "";
let selectedDestination = "";

// --------------------------------------------------------
// 1. Initialization
// --------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
    setDefaultDateTime();
    setupPillsSelectors();
    setupPresetChips();
    setupTimeChips();
    setupEventTags();
    await loadStations();

    // Event Listeners
    journeyForm.addEventListener("submit", handleFormSubmit);
    swapStationsBtn.addEventListener("click", swapStations);
    if (resetPlannerBtn) resetPlannerBtn.addEventListener("click", resetForm);
    if (setNowBtn) setNowBtn.addEventListener("click", setDefaultDateTime);

    if (travelDate) {
        travelDate.addEventListener("change", () => {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");
            const todayStr = `${yyyy}-${mm}-${dd}`;

            if (travelDate.value && travelDate.value < todayStr) {
                alert("The selected travel date has already passed. Predictions cannot be calculated for past dates. Resetting to today.");
                travelDate.value = todayStr;
            }
        });
    }

    if (openInAssistantBtn) {
        openInAssistantBtn.addEventListener("click", () => {
            if (selectedSource && selectedDestination) {
                window.location.href = `/assistant?src=${encodeURIComponent(selectedSource)}&dest=${encodeURIComponent(selectedDestination)}`;
            } else {
                window.location.href = `/assistant`;
            }
        });
    }

    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener("click", () => {
            window.location.href = `/prediction`;
        });
    }
});

function setDefaultDateTime() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (travelDate) {
        travelDate.min = todayStr;
        travelDate.value = todayStr;
    }

    // Round to nearest 15 mins
    const roundedMins = Math.round(now.getMinutes() / 15) * 15;
    now.setMinutes(roundedMins);
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    if (travelTime) {
        travelTime.value = `${hh}:${min}`;
    }
}

// --------------------------------------------------------
// 2. Load Stations from API
// --------------------------------------------------------
async function loadStations() {
    try {
        const response = await fetch("/api/stations");
        const data = await response.json();
        stationsList = Array.isArray(data) ? data : (data.stations || []);
        handleUrlParams();
    } catch (e) {
        console.error("Could not load stations:", e);
    }
}

function setStation(name, isSource) {
    const cleanName = (name || "").trim();
    if (!cleanName) return;
    const stObj = stationsList.find(s => s.station_name.toLowerCase() === cleanName.toLowerCase());
    const line = stObj ? stObj.metro_line : "Purple";

    if (isSource) {
        selectedSource = cleanName;
        sourceInput.value = cleanName;
        clearSourceBtn.style.display = "block";
        updateLineTag(sourceLineTag, line);
    } else {
        selectedDestination = cleanName;
        destinationInput.value = cleanName;
        clearDestBtn.style.display = "block";
        updateLineTag(destLineTag, line);
    }
}

function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src") || params.get("source");
    const dest = params.get("dest") || params.get("destination") || params.get("dst");

    if (src && dest) {
        setStation(src, true);
        setStation(dest, false);
        executePrediction();
    }
}

// --------------------------------------------------------
// 3. Search & Autocomplete
// --------------------------------------------------------
function filterStations(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stationsList.filter(s => 
        s.station_name.toLowerCase().includes(q) ||
        (s.metro_line && s.metro_line.toLowerCase().includes(q))
    ).slice(0, 8);
}

function renderSuggestions(inputEl, dropdownEl, isSource) {
    const query = inputEl.value;
    const matches = filterStations(query);

    if (matches.length === 0) {
        dropdownEl.style.display = "none";
        dropdownEl.innerHTML = "";
        return;
    }

    let html = "";
    matches.forEach(st => {
        const lineClass = `line-pill ${(st.metro_line || "purple").toLowerCase()}`;
        html += `
            <div class="suggestion-item" data-name="${st.station_name}" data-line="${st.metro_line}">
                <span class="suggestion-station-name">${st.station_name}</span>
                <span class="${lineClass}">${st.metro_line} Line</span>
            </div>
        `;
    });

    dropdownEl.innerHTML = html;
    dropdownEl.style.display = "block";

    dropdownEl.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-name");
            const line = item.getAttribute("data-line");
            inputEl.value = name;
            dropdownEl.style.display = "none";

            if (isSource) {
                selectedSource = name;
                clearSourceBtn.style.display = "block";
                updateLineTag(sourceLineTag, line);
            } else {
                selectedDestination = name;
                clearDestBtn.style.display = "block";
                updateLineTag(destLineTag, line);
            }
        });
    });
}

function updateLineTag(tagEl, line) {
    if (!tagEl) return;
    tagEl.textContent = `${line} Line`;
    tagEl.className = `mini-line-tag line-pill ${line.toLowerCase()}`;
    tagEl.style.display = "inline-block";
}

sourceInput.addEventListener("input", () => {
    selectedSource = sourceInput.value.trim();
    clearSourceBtn.style.display = selectedSource ? "block" : "none";
    renderSuggestions(sourceInput, sourceSuggestions, true);
});

destinationInput.addEventListener("input", () => {
    selectedDestination = destinationInput.value.trim();
    clearDestBtn.style.display = selectedDestination ? "block" : "none";
    renderSuggestions(destinationInput, destinationSuggestions, false);
});

clearSourceBtn.addEventListener("click", () => {
    sourceInput.value = "";
    selectedSource = "";
    sourceLineTag.style.display = "none";
    clearSourceBtn.style.display = "none";
    sourceInput.focus();
});

clearDestBtn.addEventListener("click", () => {
    destinationInput.value = "";
    selectedDestination = "";
    destLineTag.style.display = "none";
    clearDestBtn.style.display = "none";
    destinationInput.focus();
});

// Close suggestions on outside click
document.addEventListener("click", (e) => {
    if (!sourceInput.contains(e.target) && !sourceSuggestions.contains(e.target)) {
        sourceSuggestions.style.display = "none";
    }
    if (!destinationInput.contains(e.target) && !destinationSuggestions.contains(e.target)) {
        destinationSuggestions.style.display = "none";
    }
    if (!eventInput.contains(e.target) && !eventSuggestions.contains(e.target)) {
        eventSuggestions.style.display = "none";
    }
});

// --------------------------------------------------------
// 4. Swap Stations
// --------------------------------------------------------
function swapStations() {
    const tempName = selectedSource;
    selectedSource = selectedDestination;
    selectedDestination = tempName;

    sourceInput.value = selectedSource;
    destinationInput.value = selectedDestination;

    clearSourceBtn.style.display = selectedSource ? "block" : "none";
    clearDestBtn.style.display = selectedDestination ? "block" : "none";

    // Update tags
    const srcObj = stationsList.find(s => s.station_name === selectedSource);
    const destObj = stationsList.find(s => s.station_name === selectedDestination);

    if (srcObj) updateLineTag(sourceLineTag, srcObj.metro_line); else sourceLineTag.style.display = "none";
    if (destObj) updateLineTag(destLineTag, destObj.metro_line); else destLineTag.style.display = "none";
}

// --------------------------------------------------------
// 5. Preset Chips & Shortcuts
// --------------------------------------------------------
function setupPresetChips() {
    document.querySelectorAll(".preset-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            const src = btn.getAttribute("data-src");
            const dest = btn.getAttribute("data-dest");

            selectedSource = src;
            selectedDestination = dest;
            sourceInput.value = src;
            destinationInput.value = dest;

            clearSourceBtn.style.display = "block";
            clearDestBtn.style.display = "block";

            const srcObj = stationsList.find(s => s.station_name === src);
            const destObj = stationsList.find(s => s.station_name === dest);
            if (srcObj) updateLineTag(sourceLineTag, srcObj.metro_line);
            if (destObj) updateLineTag(destLineTag, destObj.metro_line);

            setDefaultDateTime();
            executePrediction();
        });
    });
}

function setupTimeChips() {
    document.querySelectorAll(".time-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            const timeVal = chip.getAttribute("data-time");
            if (timeVal) {
                travelTime.value = timeVal;
            } else {
                setDefaultDateTime();
            }
        });
    });
}

function setupPillsSelectors() {
    // Weather pills
    const weatherPills = document.querySelectorAll("#weatherPillGroup .selector-pill");
    weatherPills.forEach(pill => {
        pill.addEventListener("click", () => {
            weatherPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            weatherInput.value = pill.getAttribute("data-val");
        });
    });

    // Holiday pills
    const holidayPills = document.querySelectorAll("#holidayPillGroup .selector-pill");
    holidayPills.forEach(pill => {
        pill.addEventListener("click", () => {
            holidayPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            holidayInput.value = pill.getAttribute("data-val");
        });
    });
}

function setupEventTags() {
    document.querySelectorAll(".quick-tag").forEach(tag => {
        tag.addEventListener("click", () => {
            eventInput.value = tag.getAttribute("data-event");
        });
    });

    // Autocomplete for events
    eventInput.addEventListener("input", async () => {
        const q = eventInput.value.trim();
        if (!q) {
            eventSuggestions.style.display = "none";
            return;
        }
        try {
            const res = await fetch(`/api/events?q=${encodeURIComponent(q)}`);
            const events = await res.json();
            if (events && events.length > 0) {
                eventSuggestions.innerHTML = events.map(ev => `<div class="suggestion-item">${ev}</div>`).join("");
                eventSuggestions.style.display = "block";
                eventSuggestions.querySelectorAll(".suggestion-item").forEach(item => {
                    item.addEventListener("click", () => {
                        eventInput.value = item.textContent;
                        eventSuggestions.style.display = "none";
                    });
                });
            } else {
                eventSuggestions.style.display = "none";
            }
        } catch (e) {
            console.warn(e);
        }
    });
}

function resetForm() {
    sourceInput.value = "";
    destinationInput.value = "";
    selectedSource = "";
    selectedDestination = "";
    sourceLineTag.style.display = "none";
    destLineTag.style.display = "none";
    clearSourceBtn.style.display = "none";
    clearDestBtn.style.display = "none";
    eventInput.value = "";
    setDefaultDateTime();
    resultsContainer.style.display = "none";
    placeholderCard.style.display = "flex";
}

// --------------------------------------------------------
// 6. Submit & Prediction Execution
// --------------------------------------------------------
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!selectedSource) {
        alert("Please select a valid Origin Station.");
        sourceInput.focus();
        return;
    }

    if (!selectedDestination) {
        alert("Please select a valid Destination Station.");
        destinationInput.focus();
        return;
    }

    if (selectedSource.toLowerCase() === selectedDestination.toLowerCase()) {
        alert("Origin and Destination stations cannot be identical.");
        return;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (!travelDate.value || travelDate.value < todayStr) {
        alert("The selected travel date has already passed. Predictions cannot be calculated for past dates. Please select today or a future date.");
        travelDate.focus();
        return;
    }

    await executePrediction();
}

async function executePrediction() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (!travelDate.value || travelDate.value < todayStr) {
        alert("The selected travel date has already passed. Predictions cannot be calculated for past dates. Please select today or a future date.");
        travelDate.focus();
        return;
    }

    predictBtn.disabled = true;
    predictBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Computing AI Simulation...</span>`;

    const predictPayload = {
        source_station: selectedSource,
        destination_station: selectedDestination,
        date: travelDate.value,
        time: travelTime.value,
        weather: weatherInput.value,
        holiday: holidayInput.value,
        special_event: eventInput.value || "No Event"
    };

    const routePayload = {
        source: selectedSource,
        destination: selectedDestination
    };

    try {
        // Run prediction and route calculations in parallel
        const [predRes, routeRes] = await Promise.all([
            fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(predictPayload)
            }),
            fetch("/api/route", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(routePayload)
            })
        ]);

        const predData = await predRes.json();
        const routeData = await routeRes.json();

        if (!predRes.ok) {
            alert(predData.error || "Unable to generate prediction.");
            return;
        }

        displayComprehensiveResults(predData, routeData);

    } catch (err) {
        console.error("Execution error:", err);
        alert("Failed to communicate with prediction engine.");
    } finally {
        predictBtn.disabled = false;
        predictBtn.innerHTML = `<i class="fa-solid fa-brain"></i> <span>Predict Passenger Demand & Route</span>`;
    }
}

// --------------------------------------------------------
// 7. Render Rich Results
// --------------------------------------------------------
function displayComprehensiveResults(pred, route) {
    placeholderCard.style.display = "none";
    resultsContainer.style.display = "flex";

    const p = pred.prediction;
    const rec = pred.ai_recommendation;

    // 1. Hero Card Info
    resultStationName.textContent = p.station_name;
    passengerCount.textContent = p.predicted_passenger_arrivals.toLocaleString();
    confidence.textContent = `${p.confidence}%`;
    recommendedTime.textContent = rec.recommended_time || "On schedule";

    // Corridor Badge
    const lineName = p.metro_line || "Purple";
    resultCorridorTag.textContent = `${lineName} Line`;
    resultCorridorTag.className = `line-pill ${lineName.toLowerCase()}`;

    // Crowd Badge & Styling
    crowdLevel.textContent = p.crowd_level;
    const crowdSlug = p.crowd_level.toLowerCase().replace(" ", "-");
    crowdLevelBadge.className = `crowd-indicator-pill crowd-${crowdSlug}`;

    // Capacity Progress Bar
    const destStationObj = stationsList.find(s => s.station_name === p.station_name);
    const baseCap = destStationObj ? Number(destStationObj.base_capacity) : 5000;
    const utilizationPct = Math.min(150, Math.round((p.predicted_passenger_arrivals / baseCap) * 100));
    utilizationPctText.textContent = `${utilizationPct}% Utilization (Base: ${baseCap.toLocaleString()})`;
    utilizationFill.style.width = `${Math.min(100, utilizationPct)}%`;

    // 2. Route Stepper & Telemetry
    sourceStation.textContent = selectedSource;
    destinationStation.textContent = selectedDestination;
    const srcObj = stationsList.find(s => s.station_name === selectedSource);
    sourceLineDetail.textContent = srcObj ? `${srcObj.metro_line} Line` : "Origin";
    destLineDetail.textContent = destStationObj ? `${destStationObj.metro_line} Line` : "Destination";

    // Interchange rendering
    interchangeStepContainer.innerHTML = "";
    if (route && route.success) {
        const routeStations = route.route || [];
        routeTotalStations.textContent = routeStations.length;
        routeDistance.textContent = `${route.approximate_distance_km || Math.round(routeStations.length * 1.3)} km`;
        routeDuration.textContent = `${Math.round(routeStations.length * 2.2 + (route.interchanges?.length || 0) * 4)} mins`;
        routeInterchangeCount.textContent = route.interchanges?.length || 0;

        if (route.interchanges && route.interchanges.length > 0) {
            routeTransferBadge.textContent = `${route.interchanges.length} Transfer${route.interchanges.length > 1 ? "s" : ""}`;
            routeTransferBadge.style.color = "#fbbf24";
            routeTransferBadge.style.borderColor = "rgba(245, 158, 11, 0.4)";

            // Build interchange node in stepper
            let interHtml = "";
            route.interchanges.forEach(ic => {
                interHtml += `
                    <div class="stepper-node">
                        <div class="node-marker transfer"></div>
                        <div class="node-info">
                            <span class="node-type" style="color:#fbbf24;">LINE TRANSFER</span>
                            <h4>${ic}</h4>
                            <small>Change metro lines at interchange hub</small>
                        </div>
                    </div>
                `;
            });
            interchangeStepContainer.innerHTML = interHtml;

            // Show interchange guidance
            if (route.interchange_guidance && route.interchange_guidance.length > 0) {
                const g = route.interchange_guidance[0];
                interchangeInstructionText.textContent = `${g.passenger_guidance} (Transfer floor: ${g.transfer_floor}, Platform: ${g.platform_guidance})`;
                interchangeInstructionBox.style.display = "flex";
            } else {
                interchangeInstructionBox.style.display = "none";
            }
        } else {
            routeTransferBadge.textContent = "Direct Line (No Transfers)";
            routeTransferBadge.style.color = "#34d399";
            routeTransferBadge.style.borderColor = "rgba(16, 185, 129, 0.4)";
            interchangeInstructionBox.style.display = "none";
        }
    } else {
        routeTotalStations.textContent = "--";
        routeDistance.textContent = "--";
        routeDuration.textContent = "--";
        routeInterchangeCount.textContent = "0";
    }

    // 3. Departure Matrix
    renderDepartureMatrix(travelTime.value, p.crowd_level);

    // 4. Advisory text
    travelAdvice.textContent = rec.travel_advice;

    // Smooth scroll on smaller screens
    if (window.innerWidth <= 1100) {
        resultsContainer.scrollIntoView({ behavior: "smooth" });
    }
}

// --------------------------------------------------------
// 8. Departure Window Matrix Generator
// --------------------------------------------------------
function renderDepartureMatrix(baseTimeStr, mainCrowdLevel) {
    if (!departureMatrix) return;

    const [h, m] = baseTimeStr.split(":").map(Number);
    const slots = [
        { offset: -30, label: "-30 mins" },
        { offset: 0, label: "Scheduled", isCurrent: true },
        { offset: 30, label: "+30 mins" },
        { offset: 60, label: "+1 hour" },
        { offset: 120, label: "+2 hours" }
    ];

    let html = "";
    slots.forEach(slot => {
        let slotH = h + Math.floor((m + slot.offset) / 60);
        let slotM = (m + slot.offset) % 60;
        if (slotM < 0) {
            slotM += 60;
            slotH -= 1;
        }
        slotH = (slotH + 24) % 24;
        const timeFormatted = `${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`;

        // Estimate crowd based on rush hours (8-10, 17-19)
        let slotCrowd = "Moderate";
        let badgeClass = "crowd-moderate";
        if ((slotH >= 8 && slotH <= 10) || (slotH >= 17 && slotH <= 19)) {
            slotCrowd = "High";
            badgeClass = "crowd-high";
        } else if (slotH >= 22 || slotH <= 6) {
            slotCrowd = "Low";
            badgeClass = "crowd-low";
        }

        const isRecommended = slotCrowd === "Low" || (slotCrowd === "Moderate" && mainCrowdLevel === "High");

        html += `
            <div class="matrix-slot ${isRecommended ? "recommended" : ""}">
                <span class="matrix-time">${timeFormatted}</span>
                <span class="matrix-offset">${slot.label}</span>
                <span class="matrix-badge ${badgeClass}">${slotCrowd}</span>
                ${isRecommended ? '<small style="font-size:9px; color:#10b981; font-weight:700; margin-top:4px;">Optimal</small>' : ""}
            </div>
        `;
    });

    departureMatrix.innerHTML = html;
}
