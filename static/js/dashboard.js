/* ==========================================================================
   MetroAI - Simple & Efficient Operations Dashboard Controller
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initClock();
    initGreeting();
    loadDashboardStats();
});

// -----------------------------------------------------------------------------
// 1. Live Real-Time Clock & Date
// -----------------------------------------------------------------------------
function initClock() {
    const clockEl = document.getElementById("liveClock");
    const dateEl = document.getElementById("liveDate");

    function update() {
        const now = new Date();
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            });
        }
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        }
    }

    update();
    setInterval(update, 1000);
}

// -----------------------------------------------------------------------------
// 2. Dynamic Greeting
// -----------------------------------------------------------------------------
function initGreeting() {
    const greetingEl = document.getElementById("dynamicGreeting");
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let greeting = "Good Morning 👋";
    if (hour >= 12 && hour < 17) {
        greeting = "Good Afternoon 👋";
    } else if (hour >= 17 && hour < 22) {
        greeting = "Good Evening 👋";
    } else if (hour >= 22 || hour < 5) {
        greeting = "Good Night 🌙";
    }

    greetingEl.textContent = greeting;
}

// -----------------------------------------------------------------------------
// 2. Fetch and Update Dashboard Statistics
// -----------------------------------------------------------------------------
async function loadDashboardStats() {
    try {
        const response = await fetch("/api/dashboard/stats");
        if (!response.ok) return;

        const data = await response.json();
        if (!data || !data.success) return;

        // Update KPIs
        if (data.kpis) {
            const stEl = document.getElementById("kpiStations");
            if (stEl && data.kpis.total_stations) {
                stEl.textContent = data.kpis.total_stations;
            }

            const loadEl = document.getElementById("kpiNetworkLoad");
            if (loadEl && data.kpis.current_network_load !== undefined) {
                loadEl.textContent = `${data.kpis.current_network_load}%`;
            }

            const peakEl = document.getElementById("kpiPeakStatus");
            if (peakEl && data.kpis.peak_status) {
                peakEl.textContent = data.kpis.peak_status;
            }

            const confEl = document.getElementById("kpiConfidence");
            if (confEl && data.kpis.model_confidence) {
                confEl.textContent = data.kpis.model_confidence;
            }
        }

        // Update Lines Status
        if (Array.isArray(data.corridors)) {
            data.corridors.forEach(corridor => {
                if (corridor.id === "purple") {
                    updateLineUI("purple", corridor);
                } else if (corridor.id === "green") {
                    updateLineUI("green", corridor);
                } else if (corridor.id === "yellow") {
                    updateLineUI("yellow", corridor);
                }
            });
        }
    } catch (err) {
        console.warn("Using offline / fallback dashboard values:", err);
    }
}

function updateLineUI(linePrefix, corridor) {
    const statusEl = document.getElementById(`${linePrefix}Status`);
    const loadTextEl = document.getElementById(`${linePrefix}LoadText`);
    const barEl = document.getElementById(`${linePrefix}Bar`);

    if (loadTextEl && corridor.load_pct !== undefined) {
        loadTextEl.textContent = `${corridor.load_pct}% Load`;
    }

    if (barEl && corridor.load_pct !== undefined) {
        barEl.style.width = `${Math.min(100, Math.max(5, corridor.load_pct))}%`;
    }

    if (statusEl && corridor.load_pct !== undefined) {
        statusEl.className = "line-status-badge";
        if (corridor.load_pct >= 75) {
            statusEl.classList.add("busy");
            statusEl.textContent = "Busy";
        } else if (corridor.load_pct >= 50) {
            statusEl.classList.add("moderate");
            statusEl.textContent = "Moderate";
        } else {
            statusEl.classList.add("normal");
            statusEl.textContent = "Normal";
        }
    }
}
