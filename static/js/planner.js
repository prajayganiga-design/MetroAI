// =======================================================
// MetroAI Journey Planner
// Part 1 - Initialization & Station Search
// =======================================================

// -----------------------------
// Input Elements
// -----------------------------

const sourceInput = document.getElementById("sourceSearch");
const destinationInput = document.getElementById("destinationSearch");

const sourceSuggestions = document.getElementById("sourceSuggestions");
const destinationSuggestions = document.getElementById(
  "destinationSuggestions",
);

const travelDate = document.getElementById("travelDate");
const travelTime = document.getElementById("travelTime");

const journeyForm = document.getElementById("journeyForm");
const predictBtn = document.getElementById("predictBtn");

// -----------------------------
// Result Elements
// -----------------------------

const placeholderCard = document.getElementById("placeholderCard");
const resultsContainer = document.getElementById("resultsContainer");

const crowdLevel = document.getElementById("crowdLevel");
const passengerCount = document.getElementById("passengerCount");
const metroLine = document.getElementById("metroLine");
const recommendedTime = document.getElementById("recommendedTime");
const weatherInput = document.getElementById("weatherSearch");
const holidayInput = document.getElementById("holidaySearch");

const eventInput = document.getElementById("eventSearch");

const eventSuggestions = document.getElementById("eventSuggestions");

const holidaySuggestions = document.getElementById("holidaySuggestions");

const weatherSuggestions = document.getElementById("weatherSuggestions");
const sourceStation = document.getElementById("sourceStation");
const destinationStation = document.getElementById("destinationStation");

const journeyLine = document.getElementById("journeyLine");

const travelAdvice = document.getElementById("travelAdvice");

const confidence = document.getElementById("confidence");

// -----------------------------
// Variables
// -----------------------------

let stations = [];

const weatherOptions = ["☀️ Sunny", "☁️ Cloudy", "🌧️ Rainy"];
const holidayOptions = ["No", "Yes"];

let selectedSource = "";

let selectedDestination = "";

// =======================================================
// Page Load
// =======================================================

window.addEventListener("load", async () => {
  resultsContainer.style.display = "none";

  placeholderCard.style.display = "block";

  await loadStations();
});

// =======================================================
// Load Stations
// =======================================================

async function loadStations() {
  try {
    const response = await fetch("http://127.0.0.1:5008/api/stations");

    stations = await response.json();

    console.log("Stations Loaded:", stations.length);
  } catch (error) {
    console.error(error);

    alert("Unable to load station list.");
  }
}

async function showEventSuggestions() {
  const keyword = eventInput.value.trim();

  if (keyword === "") {
    eventSuggestions.innerHTML = "";

    eventSuggestions.style.display = "none";

    return;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:5008/api/events?q=${encodeURIComponent(keyword)}`,
    );

    const events = await response.json();

    eventSuggestions.innerHTML = "";

    events.forEach((event) => {
      const item = document.createElement("div");

      item.className = "suggestion-item";

      item.textContent = event;

      item.onclick = () => {
        eventInput.value = event;

        eventSuggestions.style.display = "none";
      };

      eventSuggestions.appendChild(item);
    });

    eventSuggestions.style.display = events.length ? "block" : "none";
  } catch (error) {
    console.error(error);
  }
}

// =======================================================
// Show Suggestions
// =======================================================

function showSuggestions(inputBox, suggestionBox, isSource) {
  const keyword = inputBox.value.trim().toLowerCase();

  suggestionBox.innerHTML = "";

  if (keyword === "") {
    suggestionBox.style.display = "none";

    return;
  }

  const filteredStations = stations.filter((station) =>
    station.station_name.toLowerCase().includes(keyword),
  );

  filteredStations.forEach((station) => {
    const item = document.createElement("div");

    item.className = "suggestion-item";

    item.innerHTML = `
            <strong>${station.station_name}</strong>
            <br>
            <small>${station.metro_line}</small>
        `;

    item.onclick = () => {
      inputBox.value = station.station_name;

      if (isSource) {
        selectedSource = station.station_name;
      } else {
        selectedDestination = station.station_name;
      }

      suggestionBox.innerHTML = "";

      suggestionBox.style.display = "none";
    };

    suggestionBox.appendChild(item);
  });

  suggestionBox.style.display = filteredStations.length ? "block" : "none";
}

// =======================================================
// Live Search
// =======================================================

sourceInput.addEventListener("input", () => {
  showSuggestions(
    sourceInput,

    sourceSuggestions,

    true,
  );
});

destinationInput.addEventListener("input", () => {
  showSuggestions(
    destinationInput,

    destinationSuggestions,

    false,
  );
});

eventInput.addEventListener("input", () => {
  showEventSuggestions();
});

// Hide suggestions when clicking outside

document.addEventListener("click", (event) => {
  if (!sourceInput.contains(event.target)) {
    sourceSuggestions.style.display = "none";
  }

  if (!destinationInput.contains(event.target)) {
    destinationSuggestions.style.display = "none";

    if (
      !eventInput.contains(event.target) &&
      !eventSuggestions.contains(event.target)
    ) {
      eventSuggestions.style.display = "none";
    }
  }
  // =======================================================
  // Part 2 - Journey Prediction
  // =======================================================

  // -----------------------------
  // Form Submit
  // -----------------------------

  journeyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Validation

    if (selectedSource === "") {
      alert("Please select a source station.");

      return;
    }

    if (selectedDestination === "") {
      alert("Please select a destination station.");

      return;
    }

    if (selectedSource === selectedDestination) {
      alert("Source and Destination cannot be the same.");

      return;
    }

    if (travelDate.value === "") {
      alert("Please select a travel date.");

      return;
    }

    if (travelTime.value === "") {
      alert("Please select a departure time.");

      return;
    }

    // Loading

    predictBtn.disabled = true;

    predictBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Predicting...`;

    try {
      const response = await fetch("http://127.0.0.1:5008/predict", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          source_station: selectedSource,

          destination_station: selectedDestination,

          date: travelDate.value,

          time: travelTime.value,

          weather: weatherInput.value,

          holiday: holidayInput.value,

          special_event: eventInput.value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error);

        return;
      }

      displayPrediction(data);
    } catch (error) {
      console.error(error);

      alert("Unable to generate prediction.");
    } finally {
      predictBtn.disabled = false;

      predictBtn.innerHTML = `<i class="fa-solid fa-brain"></i> Predict Passenger Flow`;
    }
  });

  // =======================================================
  // Display Prediction
  // =======================================================

  function displayPrediction(data) {
    // Hide Placeholder

    placeholderCard.style.display = "none";

    // Show Results

    resultsContainer.style.display = "block";

    // -------------------------
    // Summary
    // -------------------------

    crowdLevel.textContent = data.prediction.crowd_level;

    passengerCount.textContent = data.prediction.predicted_passenger_arrivals;

    metroLine.textContent = data.prediction.metro_line;

    recommendedTime.textContent = data.ai_recommendation.recommended_time;

    // -------------------------
    // Journey
    // -------------------------

    sourceStation.textContent = data.journey.source_station;

    destinationStation.textContent = data.journey.destination_station;

    journeyLine.textContent = data.prediction.metro_line;

    // -------------------------
    // Recommendation
    // -------------------------

    travelAdvice.textContent = data.ai_recommendation.travel_advice;

    // -------------------------
    // Confidence
    // -------------------------

    if (data.prediction.confidence !== undefined) {
      confidence.textContent = data.prediction.confidence + "%";
    } else {
      confidence.textContent = "--";
    }
  }
});
function showWeatherSuggestions() {
  weatherSuggestions.innerHTML = "";

  weatherOptions.forEach((option) => {
    const item = document.createElement("div");

    item.className = "suggestion-item";

    item.textContent = option;

    item.onclick = () => {
      weatherInput.value = option;

      weatherSuggestions.style.display = "none";
    };

    weatherSuggestions.appendChild(item);
  });

  weatherSuggestions.style.display = "block";
}

function showHolidaySuggestions() {
  holidaySuggestions.innerHTML = "";

  holidayOptions.forEach((option) => {
    const item = document.createElement("div");

    item.className = "suggestion-item";

    item.textContent = option;

    item.onclick = () => {
      holidayInput.value = option;

      holidaySuggestions.style.display = "none";
    };

    holidaySuggestions.appendChild(item);
  });

  holidaySuggestions.style.display = "block";
}
weatherInput.addEventListener("click", () => {
  showWeatherSuggestions();
});

document.addEventListener("click", (e) => {
  if (
    !weatherInput.contains(e.target) &&
    !weatherSuggestions.contains(e.target)
  ) {
    weatherSuggestions.style.display = "none";
  }
});

holidayInput.addEventListener("click", () => {
  showHolidaySuggestions();
});

document.addEventListener("click", (e) => {
  if (
    !holidayInput.contains(e.target) &&
    !holidaySuggestions.contains(e.target)
  ) {
    holidaySuggestions.style.display = "none";
  }
});
