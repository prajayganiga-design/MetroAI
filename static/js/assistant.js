/* ========================================
   METROFLOW AI - TRAVEL ASSISTANT
======================================== */

document.addEventListener("DOMContentLoaded", () => {
  const routeForm = document.getElementById("routeForm");

  const sourceInput = document.getElementById("sourceStation");
  const destinationInput = document.getElementById("destinationStation");
  const interchangeGuidanceList = document.getElementById(
    "interchangeGuidanceList",
  );

  // =====================================
  // LOAD STATIONS INTO DROPDOWNS
  // =====================================

  async function loadStationOptions() {
    const selects = [sourceInput, destinationInput];

    try {
      const response = await fetch("/api/station-options");

      if (!response.ok) {
        throw new Error("Failed to load station list.");
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.stations)) {
        throw new Error("Invalid station list received.");
      }

      selects.forEach((select, index) => {
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent =
          index === 0
            ? "Select starting station"
            : "Select destination station";

        placeholder.disabled = true;
        placeholder.selected = true;

        select.appendChild(placeholder);

        data.stations.forEach((station) => {
          const option = document.createElement("option");

          option.value = station;
          option.textContent = station;

          select.appendChild(option);
        });
      });
    } catch (error) {
      console.error("Station loading error:", error);

      selects.forEach((select) => {
        select.replaceChildren();

        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Unable to load stations";

        select.appendChild(option);
      });

      showStatus(
        "Unable to load stations. Please refresh the page or check the server.",
        "error",
      );
    }
  }

  loadStationOptions();

  const swapButton = document.getElementById("swapStations");
  const findRouteButton = document.getElementById("findRouteButton");

  const statusMessage = document.getElementById("statusMessage");
  const routeResults = document.getElementById("routeResults");
  const initialInfo = document.getElementById("initialInfo");

  const connectionCount = document.getElementById("connectionCount");
  const transferCount = document.getElementById("transferCount");
  const distanceValue = document.getElementById("distanceValue");

  const lineList = document.getElementById("lineList");
  const interchangeList = document.getElementById("interchangeList");
  const stationRoute = document.getElementById("stationRoute");
  const travelInstructions = document.getElementById("travelInstructions");
  const distanceNote = document.getElementById("distanceNote");

  // Display a status message safely
  function showStatus(message, type = "info") {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.hidden = false;
  }

  function hideStatus() {
    statusMessage.hidden = true;
    statusMessage.textContent = "";
  }

  // Swap source and destination
  swapButton.addEventListener("click", () => {
    const source = sourceInput.value;

    sourceInput.value = destinationInput.value;
    destinationInput.value = source;
  });

  // Get a CSS class for each metro line
  function getLineClass(line) {
    const normalized = String(line).toLowerCase();

    if (normalized.includes("green")) {
      return "green";
    }

    if (normalized.includes("yellow")) {
      return "yellow";
    }

    if (normalized.includes("purple")) {
      return "purple";
    }

    return "default";
  }

  // Render lines used
  function renderLines(lines) {
    lineList.replaceChildren();

    if (!Array.isArray(lines) || lines.length === 0) {
      lineList.textContent = "No line information available.";
      return;
    }

    lines.forEach((line) => {
      const chip = document.createElement("div");
      chip.className = "line-chip";

      const colorDot = document.createElement("span");
      colorDot.className = `line-color ${getLineClass(line)}`;

      const label = document.createElement("span");
      label.textContent = `${line} Line`;

      chip.append(colorDot, label);
      lineList.appendChild(chip);
    });
  }

  // Render interchange stations
  function renderInterchanges(interchanges) {
    interchangeList.replaceChildren();

    if (!Array.isArray(interchanges) || interchanges.length === 0) {
      const message = document.createElement("span");
      message.className = "interchange-chip";
      message.textContent = "No line transfers required.";

      interchangeList.appendChild(message);
      return;
    }

    interchanges.forEach((station) => {
      const chip = document.createElement("span");
      chip.className = "interchange-chip";
      chip.textContent = station;

      interchangeList.appendChild(chip);
    });
  }

  function renderInterchangeGuidance(guidance) {
    if (!interchangeGuidanceList) {
      return;
    }

    interchangeGuidanceList.replaceChildren();

    // Handle journeys without an interchange
    if (!Array.isArray(guidance) || guidance.length === 0) {
      const message = document.createElement("p");

      message.textContent = "No line change is required for this journey.";

      interchangeGuidanceList.appendChild(message);
      return;
    }

    // Display each interchange
    guidance.forEach((item) => {
      const card = document.createElement("div");
      card.className = "interchange-guidance-item";

      // Interchange station name
      const heading = document.createElement("h5");
      heading.textContent = item.station || "Interchange Station";

      card.appendChild(heading);

      // Interchange details
      const details = [
        ["Arriving Line", `${item.from_line || "Not available"} Line`],
        ["Connecting Line", `${item.to_line || "Not available"} Line`],
        ["Transfer Floor / Level", item.transfer_floor || "Not available"],
        ["Platform Guidance", item.platform_guidance || "Not available"],
      ];

      details.forEach(([label, value]) => {
        const row = document.createElement("div");
        row.className = "interchange-detail";

        const labelElement = document.createElement("span");
        labelElement.textContent = label;

        const valueElement = document.createElement("span");
        valueElement.textContent = value;

        row.append(labelElement, valueElement);
        card.appendChild(row);
      });

      // Passenger guidance
      const note = document.createElement("p");
      note.className = "interchange-passenger-note";

      note.textContent =
        item.passenger_guidance ||
        "Follow the official station signs or ask station staff.";

      card.appendChild(note);

      // Verification status

      interchangeGuidanceList.appendChild(card);
    });
  }

  // Render every station in the route
  function renderStationRoute(route, interchanges, destination) {
    stationRoute.replaceChildren();

    if (!Array.isArray(route) || route.length === 0) {
      stationRoute.textContent = "No station sequence available.";
      return;
    }

    route.forEach((item, index) => {
      const stationItem = document.createElement("div");
      stationItem.className = "station-item";

      const isInterchange =
        Array.isArray(interchanges) && interchanges.includes(item.station);

      const isDestination = item.station === destination;

      if (isInterchange) {
        stationItem.classList.add("interchange");
      }

      if (isDestination && index === route.length - 1) {
        stationItem.classList.add("destination");
      }

      const markerColumn = document.createElement("div");
      markerColumn.className = "station-marker-column";

      const marker = document.createElement("div");
      marker.className = "station-marker";

      markerColumn.appendChild(marker);

      if (index < route.length - 1) {
        const connector = document.createElement("div");
        connector.className = "station-connector";
        markerColumn.appendChild(connector);
      }

      const details = document.createElement("div");

      const stationName = document.createElement("div");
      stationName.className = "station-name";
      stationName.textContent = item.station;

      const lineName = document.createElement("span");
      lineName.className = "station-line";
      lineName.textContent = `${item.line} Line`;

      details.append(stationName, lineName);

      if (isInterchange) {
        const tag = document.createElement("span");
        tag.className = "station-tag";
        tag.textContent = "INTERCHANGE";

        details.appendChild(tag);
      }

      if (isDestination && index === route.length - 1) {
        const tag = document.createElement("span");
        tag.className = "station-tag";
        tag.textContent = "DESTINATION";

        details.appendChild(tag);
      }

      stationItem.append(markerColumn, details);
      stationRoute.appendChild(stationItem);
    });
  }

  // Render step-by-step travel instructions
  function renderInstructions(instructions) {
    travelInstructions.replaceChildren();

    if (!Array.isArray(instructions) || instructions.length === 0) {
      travelInstructions.textContent = "No travel instructions are available.";

      return;
    }

    instructions.forEach((item) => {
      const instructionItem = document.createElement("div");
      instructionItem.className = "instruction-item";

      const number = document.createElement("div");
      number.className = "instruction-number";
      number.textContent = item.step;

      const text = document.createElement("div");
      text.className = "instruction-text";
      text.textContent = item.instruction;

      instructionItem.append(number, text);
      travelInstructions.appendChild(instructionItem);
    });
  }

  // Display the complete route response
  function renderRoute(data) {
    connectionCount.textContent = data.station_connections ?? "--";
    transferCount.textContent = data.line_transfers ?? "--";

    const distance = Number(data.approximate_distance_km);

    distanceValue.textContent = Number.isFinite(distance)
      ? `${distance.toFixed(2)} km`
      : "Unavailable";

    renderLines(data.lines);
    renderInterchanges(data.interchanges);
    renderInterchangeGuidance(data.interchange_guidance);

    renderStationRoute(data.route, data.interchanges, data.destination);

    renderInstructions(data.instructions);

    distanceNote.textContent =
      data.distance_note ||
      "Distance and travel-time estimates may not represent actual railway conditions.";

    routeResults.hidden = false;
    initialInfo.hidden = true;

    routeResults.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // Submit route request to Flask
  routeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    hideStatus();

    const source = sourceInput.value.trim();
    const destination = destinationInput.value.trim();

    if (!source || !destination) {
      showStatus(
        "Please enter both your starting station and destination.",
        "error",
      );
      return;
    }

    if (source.toLowerCase() === destination.toLowerCase()) {
      showStatus(
        "Your starting station and destination are the same.",
        "error",
      );
      return;
    }

    findRouteButton.disabled = true;
    findRouteButton.innerHTML = "<span>Finding route...</span><span>…</span>";

    showStatus("Calculating your route. Please wait...", "info");

    try {
      const response = await fetch("/api/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: source,
          destination: destination,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to find a route.");
      }

      hideStatus();
      renderRoute(data);
    } catch (error) {
      showStatus(
        error.message ||
          "Unable to connect to the server. Check that Flask is running.",
        "error",
      );

      routeResults.hidden = true;
      initialInfo.hidden = false;
    } finally {
      findRouteButton.disabled = false;
      findRouteButton.innerHTML = "<span>Find Route</span><span>→</span>";
    }
  });
});
