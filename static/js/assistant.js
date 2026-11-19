/* ==========================================================================
   MetroAI - Intelligent Travel Assistant Script
   Graph Pathfinding · Interchange Platforms · Subway Tube Stepper · Telemetry
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------------------
    // DOM Element References
    // -------------------------------------------------------------------------
    const routeForm = document.getElementById("routeForm");
    const sourceInput = document.getElementById("sourceInput");
    const destInput = document.getElementById("destInput");
    const sourceSuggestions = document.getElementById("sourceSuggestions");
    const destSuggestions = document.getElementById("destSuggestions");
    const clearSrcBtn = document.getElementById("clearSrcBtn");
    const clearDestBtn = document.getElementById("clearDestBtn");
    const toggleSrcDropdownBtn = document.getElementById("toggleSrcDropdownBtn");
    const toggleDestDropdownBtn = document.getElementById("toggleDestDropdownBtn");
    const srcLineTag = document.getElementById("srcLineTag");
    const destLineTag = document.getElementById("destLineTag");

    const swapStationsBtn = document.getElementById("swapStationsBtn");
    const resetRouteBtn = document.getElementById("resetRouteBtn");
    const findRouteButton = document.getElementById("findRouteButton");
    const statusMessage = document.getElementById("statusMessage");

    const initialInfo = document.getElementById("initialInfo");
    const routeResults = document.getElementById("routeResults");

    const heroSource = document.getElementById("heroSource");
    const heroDest = document.getElementById("heroDest");
    const transferSummaryBadge = document.getElementById("transferSummaryBadge");

    const connectionCount = document.getElementById("connectionCount");
    const transferCount = document.getElementById("transferCount");
    const transferDetailSub = document.getElementById("transferDetailSub");
    const distanceValue = document.getElementById("distanceValue");
    const estimatedDuration = document.getElementById("estimatedDuration");

    const lineList = document.getElementById("lineList");
    const interchangeGuidanceSection = document.getElementById("interchangeGuidanceSection");
    const interchangeGuidanceList = document.getElementById("interchangeGuidanceList");
    const toggleAllStationsBtn = document.getElementById("toggleAllStationsBtn");
    const stationRoute = document.getElementById("stationRoute");
    const travelInstructions = document.getElementById("travelInstructions");
    const distanceNote = document.getElementById("distanceNote");

    const predictCrowdForRouteBtn = document.getElementById("predictCrowdForRouteBtn");
    const reverseRouteBtn = document.getElementById("reverseRouteBtn");
    const copyDirectionsBtn = document.getElementById("copyDirectionsBtn");
    const presetButtons = document.querySelectorAll(".preset-btn");

    // -------------------------------------------------------------------------
    // State Store
    // -------------------------------------------------------------------------
    let stationsList = [];
    let stationsMap = new Map(); // lowercase trimmed name -> station object
    let lastCalculatedData = null;
    let isCompactTrackView = false;
    let activeSuggestionIndex = -1;

    // -------------------------------------------------------------------------
    // Line Helpers
    // -------------------------------------------------------------------------
    function getLineClass(lineName) {
        if (!lineName) return "default";
        const val = String(lineName).trim().toLowerCase();
        if (val.includes("purple")) return "purple";
        if (val.includes("green")) return "green";
        if (val.includes("yellow")) return "yellow";
        return "default";
    }

    function updateLineTag(tagElement, stationName) {
        if (!tagElement) return;
        const station = stationsMap.get((stationName || "").trim().toLowerCase());
        if (station && station.metro_line) {
            const lineClass = getLineClass(station.metro_line);
            tagElement.className = `line-tag-mini ${lineClass}`;
            tagElement.textContent = `${station.metro_line} Line`;
            tagElement.style.display = "inline-block";
        } else {
            tagElement.style.display = "none";
        }
    }

    // -------------------------------------------------------------------------
    // Status Notification Banner
    // -------------------------------------------------------------------------
    function showStatus(message, type = "info") {
        if (!statusMessage) return;
        const icon = type === "error"
            ? '<i class="fa-solid fa-triangle-exclamation"></i>'
            : '<i class="fa-solid fa-circle-notch fa-spin"></i>';

        statusMessage.innerHTML = `${icon} <span>${message}</span>`;
        statusMessage.className = `status-banner ${type}`;
        statusMessage.style.display = "flex";
    }

    function hideStatus() {
        if (!statusMessage) return;
        statusMessage.style.display = "none";
        statusMessage.innerHTML = "";
    }

    // -------------------------------------------------------------------------
    // Station Data Loading
    // -------------------------------------------------------------------------
    async function loadStations() {
        try {
            const res = await fetch("/api/stations");
            if (!res.ok) throw new Error("Could not fetch station list");

            const data = await res.json();
            // /api/stations returns an array directly, or an object with stations key
            stationsList = Array.isArray(data) ? data : (data.stations || []);

            stationsMap.clear();
            stationsList.forEach(st => {
                if (st && st.station_name) {
                    const key = st.station_name.trim().toLowerCase();
                    if (!stationsMap.has(key)) {
                        stationsMap.set(key, st);
                    }
                }
            });

            // Populate native datalist fallback
            const datalist = document.getElementById("stationsDatalist");
            if (datalist) {
                datalist.innerHTML = "";
                const seen = new Set();
                stationsList.forEach(st => {
                    const cleanName = (st.station_name || "").trim();
                    if (cleanName && !seen.has(cleanName.toLowerCase())) {
                        seen.add(cleanName.toLowerCase());
                        const opt = document.createElement("option");
                        opt.value = cleanName;
                        opt.label = `${st.metro_line || "Metro"} Line`;
                        datalist.appendChild(opt);
                    }
                });
            }

            // Check URL query parameters for auto-routing (e.g. ?src=Indiranagar&dest=Majestic)
            handleUrlParams();
        } catch (err) {
            console.warn("Failed to load /api/stations, trying fallback...", err);
            try {
                const optRes = await fetch("/api/station-options");
                const optData = await optRes.json();
                const names = optData.stations || optData;
                if (Array.isArray(names)) {
                    stationsList = names.map(name => ({
                        station_name: name,
                        metro_line: "Metro"
                    }));
                    stationsList.forEach(st => {
                        stationsMap.set(st.station_name.trim().toLowerCase(), st);
                    });
                    handleUrlParams();
                }
            } catch (fallbackErr) {
                console.error("Critical: Could not load any stations", fallbackErr);
                showStatus("Failed to load metro stations. Please refresh the page.", "error");
            }
        }
    }

    // -------------------------------------------------------------------------
    // URL Query Parameter Auto-Router
    // -------------------------------------------------------------------------
    function handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const srcParam = params.get("src") || params.get("source");
        const destParam = params.get("dest") || params.get("destination") || params.get("dst");

        if (srcParam && destParam) {
            sourceInput.value = srcParam;
            destInput.value = destParam;
            clearSrcBtn.style.display = "block";
            clearDestBtn.style.display = "block";
            updateLineTag(srcLineTag, srcParam);
            updateLineTag(destLineTag, destParam);

            // Trigger route search
            executeRouteSearch(srcParam, destParam);
        }
    }

    // -------------------------------------------------------------------------
    // Autocomplete & Dropdown Engine
    // -------------------------------------------------------------------------
    function filterStations(query) {
        if (!query) return [];
        const cleanQuery = query.toLowerCase().trim();
        const seen = new Set();
        const results = [];

        stationsList.forEach(st => {
            const name = (st.station_name || "").toLowerCase();
            const line = (st.metro_line || "").toLowerCase();
            if (name.includes(cleanQuery) || line.includes(cleanQuery)) {
                if (!seen.has(name)) {
                    seen.add(name);
                    results.push(st);
                }
            }
        });

        return results.slice(0, 15);
    }

    function createSuggestionItem(st, inputElem, dropdownElem, isSource) {
        const item = document.createElement("div");
        item.className = "suggestion-item";

        const lineClass = getLineClass(st.metro_line);
        const categoryText = st.station_category ? ` · ${st.station_category}` : "";
        const isInterchange = st.is_interchange === "Yes" || st.is_interchange === true;

        item.innerHTML = `
            <div>
                <span class="suggestion-name">${st.station_name}</span>
                <small style="font-size: 10px; color: #94a3b8; margin-left: 6px;">${categoryText}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                ${isInterchange ? '<span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-weight: 800; border: 1px solid rgba(245, 158, 11, 0.4);"><i class="fa-solid fa-arrows-split-up-and-left"></i> HUB</span>' : ''}
                <span class="suggestion-line line-tag-mini ${lineClass}">${st.metro_line || "Line"}</span>
            </div>
        `;

        item.addEventListener("mousedown", (e) => {
            e.preventDefault(); // prevent blur before selection
            selectStation(inputElem, dropdownElem, st.station_name, isSource);
        });

        return item;
    }

    function renderSuggestions(inputElem, dropdownElem, isSource, showAllIfEmpty = false) {
        const query = inputElem.value.trim();
        dropdownElem.innerHTML = "";
        activeSuggestionIndex = -1;

        let displayList = [];
        let isDefaultList = false;

        if (!query) {
            if (!showAllIfEmpty) {
                dropdownElem.style.display = "none";
                return;
            }
            isDefaultList = true;
        } else {
            displayList = filterStations(query);
        }

        if (!isDefaultList && displayList.length === 0) {
            dropdownElem.innerHTML = `
                <div class="suggestion-item" style="color: #94a3b8; cursor: default; justify-content: center; padding: 16px;">
                    <i class="fa-solid fa-magnifying-glass" style="margin-right: 8px;"></i> No stations matching "${query}"
                </div>
            `;
            dropdownElem.style.display = "block";
            return;
        }

        if (isDefaultList) {
            // 1. Group: Interchange Hubs Pinned at Top
            const hubs = stationsList.filter(s => s.is_interchange === "Yes" || s.is_interchange === true);
            const uniqueHubs = [];
            const seenHubs = new Set();
            hubs.forEach(h => {
                const k = (h.station_name || "").toLowerCase().trim();
                if (!seenHubs.has(k)) {
                    seenHubs.add(k);
                    uniqueHubs.push(h);
                }
            });

            if (uniqueHubs.length > 0) {
                const hubTitle = document.createElement("div");
                hubTitle.className = "suggestion-group-title";
                hubTitle.innerHTML = `
                    <span><i class="fa-solid fa-arrows-split-up-and-left" style="color: #fbbf24; margin-right: 6px;"></i> Major Interchange Hubs</span>
                    <small style="color: #94a3b8; font-weight: 500;">Multi-Line Junctions</small>
                `;
                dropdownElem.appendChild(hubTitle);

                uniqueHubs.forEach(st => {
                    dropdownElem.appendChild(createSuggestionItem(st, inputElem, dropdownElem, isSource));
                });
            }

            // 2. Group: All Network Stations Alphabetically
            const allSorted = [...stationsList].sort((a, b) => (a.station_name || "").localeCompare(b.station_name || ""));
            const uniqueAll = [];
            const seenAll = new Set();
            allSorted.forEach(s => {
                const k = (s.station_name || "").toLowerCase().trim();
                if (k && !seenAll.has(k)) {
                    seenAll.add(k);
                    uniqueAll.push(s);
                }
            });

            const allTitle = document.createElement("div");
            allTitle.className = "suggestion-group-title";
            allTitle.innerHTML = `
                <span><i class="fa-solid fa-train-subway" style="color: #38bdf8; margin-right: 6px;"></i> All Stations (${uniqueAll.length})</span>
                <small style="color: #94a3b8; font-weight: 500;">Alphabetical A–Z</small>
            `;
            dropdownElem.appendChild(allTitle);

            uniqueAll.forEach(st => {
                dropdownElem.appendChild(createSuggestionItem(st, inputElem, dropdownElem, isSource));
            });
        } else {
            const countHeader = document.createElement("div");
            countHeader.className = "suggestion-group-title";
            countHeader.innerHTML = `<span>Matching Stations (${displayList.length})</span>`;
            dropdownElem.appendChild(countHeader);

            displayList.forEach(st => {
                dropdownElem.appendChild(createSuggestionItem(st, inputElem, dropdownElem, isSource));
            });
        }

        dropdownElem.style.display = "block";
    }

    function selectStation(inputElem, dropdownElem, stationName, isSource) {
        inputElem.value = stationName;
        dropdownElem.style.display = "none";
        hideStatus();

        if (isSource) {
            clearSrcBtn.style.display = "block";
            updateLineTag(srcLineTag, stationName);
            if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.remove("open");
            destInput.focus();
            renderSuggestions(destInput, destSuggestions, false, true);
        } else {
            clearDestBtn.style.display = "block";
            updateLineTag(destLineTag, stationName);
            if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.remove("open");
        }
    }

    // Input listeners for Origin
    sourceInput.addEventListener("input", () => {
        clearSrcBtn.style.display = sourceInput.value.trim() ? "block" : "none";
        updateLineTag(srcLineTag, sourceInput.value);
        renderSuggestions(sourceInput, sourceSuggestions, true, false);
    });

    sourceInput.addEventListener("focus", () => {
        renderSuggestions(sourceInput, sourceSuggestions, true, true);
        if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.add("open");
    });

    sourceInput.addEventListener("click", () => {
        renderSuggestions(sourceInput, sourceSuggestions, true, true);
        if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.add("open");
    });

    // Input listeners for Destination
    destInput.addEventListener("input", () => {
        clearDestBtn.style.display = destInput.value.trim() ? "block" : "none";
        updateLineTag(destLineTag, destInput.value);
        renderSuggestions(destInput, destSuggestions, false, false);
    });

    destInput.addEventListener("focus", () => {
        renderSuggestions(destInput, destSuggestions, false, true);
        if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.add("open");
    });

    destInput.addEventListener("click", () => {
        renderSuggestions(destInput, destSuggestions, false, true);
        if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.add("open");
    });

    // Chevron Toggle Buttons
    if (toggleSrcDropdownBtn) {
        toggleSrcDropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (sourceSuggestions.style.display === "block") {
                sourceSuggestions.style.display = "none";
                toggleSrcDropdownBtn.classList.remove("open");
            } else {
                destSuggestions.style.display = "none";
                if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.remove("open");
                renderSuggestions(sourceInput, sourceSuggestions, true, true);
                toggleSrcDropdownBtn.classList.add("open");
                sourceInput.focus();
            }
        });
    }

    if (toggleDestDropdownBtn) {
        toggleDestDropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (destSuggestions.style.display === "block") {
                destSuggestions.style.display = "none";
                toggleDestDropdownBtn.classList.remove("open");
            } else {
                sourceSuggestions.style.display = "none";
                if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.remove("open");
                renderSuggestions(destInput, destSuggestions, false, true);
                toggleDestDropdownBtn.classList.add("open");
                destInput.focus();
            }
        });
    }

    // Clear buttons
    clearSrcBtn.addEventListener("click", () => {
        sourceInput.value = "";
        clearSrcBtn.style.display = "none";
        srcLineTag.style.display = "none";
        sourceSuggestions.style.display = "none";
        if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.remove("open");
        sourceInput.focus();
    });

    clearDestBtn.addEventListener("click", () => {
        destInput.value = "";
        clearDestBtn.style.display = "none";
        destLineTag.style.display = "none";
        destSuggestions.style.display = "none";
        if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.remove("open");
        destInput.focus();
    });

    // Keyboard navigation inside dropdowns
    function handleKeyNav(e, inputElem, dropdownElem, isSource) {
        const items = dropdownElem.querySelectorAll(".suggestion-item:not([style*='cursor: default'])");
        if (dropdownElem.style.display !== "block" || items.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
            highlightItem(items);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
            highlightItem(items);
        } else if (e.key === "Enter") {
            if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
                e.preventDefault();
                const name = items[activeSuggestionIndex].querySelector(".suggestion-name").textContent;
                selectStation(inputElem, dropdownElem, name, isSource);
            }
        } else if (e.key === "Escape") {
            dropdownElem.style.display = "none";
            if (isSource && toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.remove("open");
            if (!isSource && toggleDestDropdownBtn) toggleDestDropdownBtn.classList.remove("open");
        }
    }

    function highlightItem(items) {
        items.forEach((it, idx) => {
            if (idx === activeSuggestionIndex) {
                it.classList.add("active");
                it.scrollIntoView({ block: "nearest" });
            } else {
                it.classList.remove("active");
            }
        });
    }

    sourceInput.addEventListener("keydown", (e) => handleKeyNav(e, sourceInput, sourceSuggestions, true));
    destInput.addEventListener("keydown", (e) => handleKeyNav(e, destInput, destSuggestions, false));

    // Close suggestions on outside click
    document.addEventListener("click", (e) => {
        if (!sourceInput.contains(e.target) && !sourceSuggestions.contains(e.target) && (!toggleSrcDropdownBtn || !toggleSrcDropdownBtn.contains(e.target))) {
            sourceSuggestions.style.display = "none";
            if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.remove("open");
        }
        if (!destInput.contains(e.target) && !destSuggestions.contains(e.target) && (!toggleDestDropdownBtn || !toggleDestDropdownBtn.contains(e.target))) {
            destSuggestions.style.display = "none";
            if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.remove("open");
        }
    });

    // -------------------------------------------------------------------------
    // Swap Stations Button
    // -------------------------------------------------------------------------
    swapStationsBtn.addEventListener("click", () => {
        const tempVal = sourceInput.value;
        sourceInput.value = destInput.value;
        destInput.value = tempVal;

        clearSrcBtn.style.display = sourceInput.value ? "block" : "none";
        clearDestBtn.style.display = destInput.value ? "block" : "none";

        updateLineTag(srcLineTag, sourceInput.value);
        updateLineTag(destLineTag, destInput.value);

        if (sourceInput.value && destInput.value) {
            executeRouteSearch(sourceInput.value, destInput.value);
        }
    });

    // -------------------------------------------------------------------------
    // Reset Button
    // -------------------------------------------------------------------------
    resetRouteBtn.addEventListener("click", () => {
        sourceInput.value = "";
        destInput.value = "";
        clearSrcBtn.style.display = "none";
        clearDestBtn.style.display = "none";
        srcLineTag.style.display = "none";
        destLineTag.style.display = "none";
        sourceSuggestions.style.display = "none";
        destSuggestions.style.display = "none";
        if (toggleSrcDropdownBtn) toggleSrcDropdownBtn.classList.remove("open");
        if (toggleDestDropdownBtn) toggleDestDropdownBtn.classList.remove("open");
        hideStatus();

        routeResults.style.display = "none";
        initialInfo.style.display = "flex";
        lastCalculatedData = null;
        sourceInput.focus();
    });

    // -------------------------------------------------------------------------
    // Preset Route Buttons
    // -------------------------------------------------------------------------
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const src = btn.getAttribute("data-src");
            const dest = btn.getAttribute("data-dest");

            if (src && dest) {
                sourceInput.value = src;
                destInput.value = dest;
                clearSrcBtn.style.display = "block";
                clearDestBtn.style.display = "block";
                updateLineTag(srcLineTag, src);
                updateLineTag(destLineTag, dest);

                executeRouteSearch(src, dest);
            }
        });
    });

    // -------------------------------------------------------------------------
    // Route Calculation (API Call)
    // -------------------------------------------------------------------------
    routeForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const src = sourceInput.value.trim();
        const dest = destInput.value.trim();
        executeRouteSearch(src, dest);
    });

    async function executeRouteSearch(src, dest) {
        hideStatus();

        if (!src || !dest) {
            showStatus("Please enter both an origin and a destination station.", "error");
            return;
        }

        if (src.toLowerCase() === dest.toLowerCase()) {
            showStatus("Origin and destination cannot be the same station.", "error");
            return;
        }

        // Set Loading State
        findRouteButton.disabled = true;
        findRouteButton.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Computing Shortest Path...</span>`;

        try {
            const response = await fetch("/api/route", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: src, destination: dest })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || "Unable to compute route between the selected stations.");
            }

            lastCalculatedData = data;
            renderRouteResults(data);
        } catch (error) {
            console.error("Route calculation error:", error);
            showStatus(error.message || "Failed to calculate optimal route. Please verify station names.", "error");
            routeResults.style.display = "none";
            initialInfo.style.display = "flex";
        } finally {
            findRouteButton.disabled = false;
            findRouteButton.innerHTML = `<i class="fa-solid fa-route"></i> <span>Calculate Optimal Route</span> <i class="fa-solid fa-arrow-right"></i>`;
        }
    }

    // -------------------------------------------------------------------------
    // Render Complete Route Results
    // -------------------------------------------------------------------------
    function renderRouteResults(data) {
        initialInfo.style.display = "none";
        routeResults.style.display = "flex";

        // 1. Hero Overview
        heroSource.textContent = data.source;
        heroDest.textContent = data.destination;

        const transfers = Number(data.line_transfers) || 0;
        if (transfers === 0) {
            transferSummaryBadge.textContent = "Direct Journey";
            transferSummaryBadge.classList.remove("has-transfer");
        } else if (transfers === 1) {
            transferSummaryBadge.textContent = "1 Interchange Transfer";
            transferSummaryBadge.classList.add("has-transfer");
        } else {
            transferSummaryBadge.textContent = `${transfers} Interchange Transfers`;
            transferSummaryBadge.classList.add("has-transfer");
        }

        // 2. 4 Telemetry Cards
        connectionCount.textContent = `${data.station_connections ?? "--"} Stops`;
        transferCount.textContent = `${transfers}`;

        if (transfers === 0) {
            transferDetailSub.textContent = "Direct route · No train switch";
        } else if (data.interchanges && data.interchanges.length > 0) {
            transferDetailSub.textContent = `Via ${data.interchanges.join(", ")}`;
        } else {
            transferDetailSub.textContent = "Line transfer required";
        }

        const distKm = Number(data.approximate_distance_km);
        distanceValue.textContent = Number.isFinite(distKm) ? `${distKm.toFixed(1)} km` : "Unavailable";

        // Estimated Duration: ~2.2 mins per stop + 5 mins per interchange buffer
        const estMinutes = Math.max(5, Math.round((data.station_connections || 1) * 2.2 + transfers * 5));
        estimatedDuration.textContent = `~${estMinutes} mins`;

        // 3. Corridors Utilized Chips
        renderCorridors(data.lines);

        // 4. Interchange & Platform Guidance
        renderInterchangeGuidance(data.interchange_guidance);

        // 5. Subway Tube Stepper Track
        renderTubeStepper(data);

        // 6. Step-by-Step Passenger Directions
        renderInstructions(data.instructions);

        // 7. Distance Disclaimer Note
        if (distanceNote) {
            distanceNote.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${data.distance_note || "Distance and travel time estimates are modeled on standard headway and dwell times."}`;
        }

        // Smooth scroll to results
        routeResults.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // -------------------------------------------------------------------------
    // Render Corridors Chips
    // -------------------------------------------------------------------------
    function renderCorridors(lines) {
        lineList.innerHTML = "";
        if (!Array.isArray(lines) || lines.length === 0) {
            lineList.innerHTML = `<span style="font-size: 12px; color: #64748b;">No corridor data</span>`;
            return;
        }

        lines.forEach(line => {
            const lineClass = getLineClass(line);
            const chip = document.createElement("span");
            chip.className = `line-chip ${lineClass}`;
            chip.innerHTML = `<span style="width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span> ${line} Line`;
            lineList.appendChild(chip);
        });
    }

    // -------------------------------------------------------------------------
    // Render Interchange Guidance Cards
    // -------------------------------------------------------------------------
    function renderInterchangeGuidance(guidance) {
        if (!interchangeGuidanceSection || !interchangeGuidanceList) return;

        interchangeGuidanceList.innerHTML = "";

        if (!Array.isArray(guidance) || guidance.length === 0) {
            interchangeGuidanceSection.style.display = "none";
            return;
        }

        interchangeGuidanceSection.style.display = "block";

        guidance.forEach(item => {
            const card = document.createElement("div");
            card.className = "interchange-card";

            const fromLineClass = getLineClass(item.from_line);
            const toLineClass = getLineClass(item.to_line);

            card.innerHTML = `
                <div class="interchange-card-header">
                    <h4>
                        <i class="fa-solid fa-arrows-split-up-and-left"></i>
                        ${item.station}
                    </h4>
                    <span class="badge-interchange">Station Transfer</span>
                </div>

                <div class="interchange-meta-grid">
                    <div class="meta-box">
                        <span class="lbl">Transfer Corridors</span>
                        <span class="val" style="display: flex; align-items: center; gap: 6px;">
                            <span class="line-tag-mini ${fromLineClass}">${item.from_line}</span>
                            <i class="fa-solid fa-arrow-right" style="font-size: 10px; color: #94a3b8;"></i>
                            <span class="line-tag-mini ${toLineClass}">${item.to_line}</span>
                        </span>
                    </div>

                    <div class="meta-box">
                        <span class="lbl">Transfer Floor / Level</span>
                        <span class="val">${item.transfer_floor || "Concourse Level"}</span>
                    </div>

                    <div class="meta-box">
                        <span class="lbl">Platform Guidance</span>
                        <span class="val">${item.platform_guidance || "Follow directional overhead signs"}</span>
                    </div>

                    <div class="meta-box">
                        <span class="lbl">Protocol Reference</span>
                        <span class="val">BMRCL Namma Metro Operational Guide</span>
                    </div>
                </div>

                <div class="interchange-note-box">
                    <i class="fa-solid fa-circle-info" style="color: #fbbf24; margin-right: 6px;"></i>
                    ${item.passenger_guidance || "Follow the station signage or consult station staff at the concourse level."}
                </div>
            `;

            interchangeGuidanceList.appendChild(card);
        });
    }

    // -------------------------------------------------------------------------
    // Render Subway Tube Stepper Track
    // -------------------------------------------------------------------------
    function renderTubeStepper(data) {
        if (!stationRoute) return;
        stationRoute.innerHTML = "";

        const rawRoute = data.route || [];
        if (rawRoute.length === 0) {
            stationRoute.innerHTML = `<div style="padding: 20px; color: #64748b;">No station nodes available.</div>`;
            return;
        }

        // Deduplicate consecutive identical stations into unified interchange nodes
        const displayNodes = [];
        for (let i = 0; i < rawRoute.length; i++) {
            const curr = rawRoute[i];
            const next = rawRoute[i + 1];

            if (next && curr.station.trim().toLowerCase() === next.station.trim().toLowerCase()) {
                displayNodes.push({
                    station: curr.station,
                    line: next.line, // Outgoing line
                    incomingLine: curr.line,
                    outgoingLine: next.line,
                    isInterchange: true
                });
                i++; // Skip duplicate transfer station node
            } else {
                displayNodes.push({
                    station: curr.station,
                    line: curr.line,
                    isInterchange: data.interchanges && data.interchanges.includes(curr.station)
                });
            }
        }

        const totalNodes = displayNodes.length;

        // Render each node in sequence
        displayNodes.forEach((node, idx) => {
            const isOrigin = idx === 0;
            const isDestination = idx === totalNodes - 1;
            const isInterchange = node.isInterchange;

            let rowClass = "";
            let dotClass = "";
            let tagBadge = "";

            if (isOrigin) {
                rowClass = "origin-row";
                dotClass = "origin";
                tagBadge = `<span class="tag-badge tag-origin">ORIGIN</span>`;
            } else if (isDestination) {
                rowClass = "dest-row";
                dotClass = "destination";
                tagBadge = `<span class="tag-badge tag-destination">DESTINATION</span>`;
            } else if (isInterchange) {
                rowClass = "interchange-row";
                dotClass = "interchange";
                const fromLine = node.incomingLine || node.line;
                const toLine = node.outgoingLine || node.line;
                tagBadge = `<span class="tag-badge tag-interchange">TRANSFER · ${fromLine} ➔ ${toLine}</span>`;
            }

            const activeLine = node.outgoingLine || node.line;
            const lineClass = getLineClass(activeLine);

            const row = document.createElement("div");
            row.className = `tube-station-row ${rowClass}`;
            row.dataset.stationIndex = idx;

            // Connector Column (Node Dot + Segment Line)
            const isLast = idx === totalNodes - 1;
            const segmentColorClass = getLineClass(node.line);

            row.innerHTML = `
                <div class="tube-connector-col">
                    <div class="tube-node-dot ${dotClass}"></div>
                    ${!isLast ? `<div class="tube-line-segment ${segmentColorClass}"></div>` : ''}
                </div>
                <div class="tube-station-info">
                    <div class="tube-station-title">
                        <span class="tube-station-name">${node.station}</span>
                    </div>
                    <div class="tube-tags">
                        ${tagBadge}
                        <span class="line-chip ${lineClass}">${activeLine} Line</span>
                    </div>
                </div>
            `;

            stationRoute.appendChild(row);
        });
    }

    // -------------------------------------------------------------------------
    // Toggle All Stations / Compact Mode
    // -------------------------------------------------------------------------
    if (toggleAllStationsBtn) {
        toggleAllStationsBtn.addEventListener("click", () => {
            isCompactTrackView = !isCompactTrackView;
            const rows = stationRoute.querySelectorAll(".tube-station-row");
            const total = rows.length;

            if (isCompactTrackView) {
                toggleAllStationsBtn.innerHTML = `<i class="fa-solid fa-expand"></i> Show All Stops`;
                // Hide intermediate standard stops, keep origin, interchanges, destination
                rows.forEach((row, idx) => {
                    const isOrigin = idx === 0;
                    const isDest = idx === total - 1;
                    const isInterchange = row.classList.contains("interchange-row");

                    if (!isOrigin && !isDest && !isInterchange) {
                        row.style.display = "none";
                    }
                });
            } else {
                toggleAllStationsBtn.innerHTML = `<i class="fa-solid fa-compress"></i> Compact View`;
                rows.forEach(row => {
                    row.style.display = "flex";
                });
            }
        });
    }

    // -------------------------------------------------------------------------
    // Render Step-by-Step Directions
    // -------------------------------------------------------------------------
    function renderInstructions(instructions) {
        if (!travelInstructions) return;
        travelInstructions.innerHTML = "";

        if (!Array.isArray(instructions) || instructions.length === 0) {
            travelInstructions.innerHTML = `<div style="padding: 14px; color: #64748b;">No directional steps available.</div>`;
            return;
        }

        instructions.forEach(step => {
            const card = document.createElement("div");
            card.className = "instruction-step-card";

            card.innerHTML = `
                <div class="step-num-badge">${step.step}</div>
                <p class="step-text">${step.instruction}</p>
            `;

            travelInstructions.appendChild(card);
        });
    }

    // -------------------------------------------------------------------------
    // Action Strip Buttons
    // -------------------------------------------------------------------------

    // 1. Check AI Crowd Forecast on Journey Planner
    if (predictCrowdForRouteBtn) {
        predictCrowdForRouteBtn.addEventListener("click", () => {
            if (!lastCalculatedData) return;
            const src = encodeURIComponent(lastCalculatedData.source);
            const dst = encodeURIComponent(lastCalculatedData.destination);
            window.location.href = `/planner?src=${src}&dest=${dst}`;
        });
    }

    // 2. Reverse Route
    if (reverseRouteBtn) {
        reverseRouteBtn.addEventListener("click", () => {
            if (!lastCalculatedData) return;
            const newSrc = lastCalculatedData.destination;
            const newDest = lastCalculatedData.source;

            sourceInput.value = newSrc;
            destInput.value = newDest;
            clearSrcBtn.style.display = "block";
            clearDestBtn.style.display = "block";
            updateLineTag(srcLineTag, newSrc);
            updateLineTag(destLineTag, newDest);

            executeRouteSearch(newSrc, newDest);
        });
    }

    // 3. Copy Directions to Clipboard
    if (copyDirectionsBtn) {
        copyDirectionsBtn.addEventListener("click", async () => {
            if (!lastCalculatedData) return;

            const d = lastCalculatedData;
            const transfersText = d.line_transfers === 0
                ? "Direct route (0 transfers)"
                : `${d.line_transfers} transfer(s) via ${d.interchanges.join(", ")}`;

            let text = `🚇 MetroAI Travel Itinerary\n`;
            text += `========================================\n`;
            text += `Origin:        ${d.source}\n`;
            text += `Destination:   ${d.destination}\n`;
            text += `Stops:         ${d.station_connections} stations\n`;
            text += `Transfers:     ${transfersText}\n`;
            text += `Distance:      ${Number(d.approximate_distance_km).toFixed(1)} km\n`;
            text += `Est. Duration: ~${Math.round(d.station_connections * 2.2 + d.line_transfers * 5)} mins\n`;
            text += `Corridors:     ${d.lines.join(", ")} Line\n\n`;

            if (d.interchange_guidance && d.interchange_guidance.length > 0) {
                text += `Transfer Guidance:\n`;
                d.interchange_guidance.forEach(g => {
                    text += `• ${g.station}: Change from ${g.from_line} Line to ${g.to_line} Line at ${g.transfer_floor}. Platform: ${g.platform_guidance}.\n`;
                });
                text += `\n`;
            }

            text += `Step-by-Step Directions:\n`;
            if (Array.isArray(d.instructions)) {
                d.instructions.forEach(step => {
                    text += `${step.step}. ${step.instruction}\n`;
                });
            }

            text += `\nComputed via MetroAI Intelligent Transit Assistant`;

            try {
                await navigator.clipboard.writeText(text);
                const originalHtml = copyDirectionsBtn.innerHTML;
                copyDirectionsBtn.innerHTML = `<i class="fa-solid fa-check" style="color: #34d399;"></i> <span>Copied to Clipboard!</span>`;
                copyDirectionsBtn.style.borderColor = "#10b981";

                setTimeout(() => {
                    copyDirectionsBtn.innerHTML = originalHtml;
                    copyDirectionsBtn.style.borderColor = "";
                }, 2500);
            } catch (copyErr) {
                console.error("Clipboard write error:", copyErr);
                alert("Itinerary copied to clipboard.");
            }
        });
    }

    // -------------------------------------------------------------------------
    // Initializer
    // -------------------------------------------------------------------------
    loadStations();
});
