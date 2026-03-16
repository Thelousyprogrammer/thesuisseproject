/**
 * PERFORMANCE SIMULATOR MODULE
 * Handles synthetic data injection and what-if scenarios
 */

let simAnchorDate = null; // Tracks the start of the current simulation sequence

function _getSimStartDate() {
    const modeEl = document.getElementById("simStartMode");
    const mode = modeEl ? modeEl.value : "last";
    if (mode === "specific") {
        const dateEl = document.getElementById("simStartDate");
        const dateVal = dateEl ? dateEl.value : "";
        if (dateVal) {
            // Use core utility to parse YYYY-MM-DD into a UTC midnight Date object
            const d = parseDateKeyGmt8(dateVal);
            if (d && !isNaN(d.getTime())) return d;
        }
    }
    // Default: after last log
    if (allLogs.length > 0) {
        const sorted = [...allLogs].sort((a,b) => new Date(a.date) - new Date(b.date));
        return parseDateKeyGmt8(toGmt8DateKey(sorted[sorted.length - 1].date));
    }
    return nowGmt8StartOfDay();
}

function toggleSimStartDate(mode) {
    const group = document.getElementById("simSpecificDateGroup");
    if (!group) return;
    group.style.display = mode === "specific" ? "flex" : "none";
    if (mode === "specific") {
        const input = document.getElementById("simStartDate");
        if (input && !input.value) {
            // Default to today
            input.value = toGmt8DateKey(new Date());
        }
    }
    // Re-trigger preview with new start date
    previewSimulation();
}

function _buildSimPreviewLogs(simHours, simDaysToAdd) {
    const lastDate = _getSimStartDate();
    const previewEntries = [];
    for (let i = 1; i <= simDaysToAdd; i++) {
        const nextDate = addDaysGmt8(lastDate, i);
        previewEntries.push({
            date: toGmt8DateKey(nextDate),
            hours: simHours
        });
    }
    return [...allLogs, ...previewEntries];
}

function previewSimulation() {
    if (!isSimulating) return;
    if (typeof charts === 'undefined' || !charts || !charts.trajectory) return;
    if (typeof buildTrajectorySeries !== 'function') return;

    const simHoursRaw = parseFloat(document.getElementById("simHours").value);
    const simHours = Number.isFinite(simHoursRaw) ? Math.max(0, simHoursRaw) : 8;
    const simDaysToAdd = parseInt(document.getElementById("simDays").value) || 5;

    const previewLogs = _buildSimPreviewLogs(simHours, simDaysToAdd);

    const slider = document.getElementById("paceSlider");
    const currentPace = slider ? parseFloat(slider.value) : null;

    const series = buildTrajectorySeries({ logs: previewLogs, paceOverride: currentPace });

    charts.trajectory.data.labels = series.labels;
    charts.trajectory.data.datasets[0].data = series.actualCumulative;
    charts.trajectory.data.datasets[1].data = series.projectedCumulative;
    charts.trajectory.data.datasets[2].data = series.idealCumulative;

    const targetHours = series.forecast ? series.forecast.targetHours : getCurrentRequiredOjtHours();
    const allActual = series.actualCumulative.filter(v => v != null);
    const allProjected = series.projectedCumulative.filter(v => v != null);
    const yMaxSource = Math.max(
        targetHours,
        allActual.length ? Math.max(...allActual) : 0,
        allProjected.length ? Math.max(...allProjected) : 0
    );
    if (charts.trajectory.options && charts.trajectory.options.scales && charts.trajectory.options.scales.y) {
        charts.trajectory.options.scales.y.max = Math.ceil(yMaxSource / 50) * 50 + 50;
    }

    charts.trajectory.update("none");
}

function toggleSimulation() {
    isSimulating = !isSimulating;
    const btn = document.getElementById("simToggleBtn");
    const controls = document.getElementById("simControls");
    const resetBtn = document.getElementById("simResetBtn");
    const card = document.querySelector(".sim-card");

    if (isSimulating) {
        btn.innerText = "Exit Sim Mode";
        btn.classList.replace("btn-dim", "btn-accent");
        controls.style.display = "block";
        resetBtn.style.display = "inline-block";
        if (card) card.classList.add("active");
        realLogs = JSON.parse(JSON.stringify(allLogs)); // Snapshot current state

        // Wire live preview listeners
        const simHoursInput = document.getElementById("simHours");
        const simDaysInput = document.getElementById("simDays");
        if (simHoursInput) simHoursInput.addEventListener("input", previewSimulation);
        if (simDaysInput) simDaysInput.addEventListener("input", previewSimulation);
    } else {
        btn.innerText = "Enter Sim Mode";
        btn.classList.replace("btn-accent", "btn-dim");
        controls.style.display = "none";
        resetBtn.style.display = "none";
        if (card) card.classList.remove("active");

        // Remove live preview listeners on exit
        const simHoursInput = document.getElementById("simHours");
        const simDaysInput = document.getElementById("simDays");
        if (simHoursInput) simHoursInput.removeEventListener("input", previewSimulation);
        if (simDaysInput) simDaysInput.removeEventListener("input", previewSimulation);

        resetTelemetry();
        simAnchorDate = null;
        updateSimTrackerUI();
    }
}

function updateSimTrackerUI() {
    const tracker = document.getElementById("simTracker");
    const display = document.getElementById("simAnchorDateDisplay");
    if (!tracker || !display) return;

    if (simAnchorDate) {
        tracker.style.display = "block";
        display.innerText = formatGmt8DateLabel(simAnchorDate, { month: "short", day: "numeric", year: "numeric" });
    } else {
        tracker.style.display = "none";
    }
}

function runSimulation() {
    if (!isSimulating) return;

    const simHoursRaw = parseFloat(document.getElementById("simHours").value);
    const simHours = Number.isFinite(simHoursRaw) ? Math.max(0, simHoursRaw) : 8;
    const simDaysToAdd = parseInt(document.getElementById("simDays").value) || 5;
    
    const lastDate = _getSimStartDate();
    
    // Set anchor date on first injection if not set
    if (!simAnchorDate) {
        simAnchorDate = addDaysGmt8(lastDate, 1);
        updateSimTrackerUI();
    }

    const newEntries = [];
    for (let i = 1; i <= simDaysToAdd; i++) {
        const nextDate = addDaysGmt8(lastDate, i);
        const dateStr = toGmt8DateKey(nextDate);
        
        newEntries.push({
            date: dateStr,
            hours: simHours,
            personalHours: simHours > 8 ? (simHours - 8) * 0.5 : 0, 
            sleepHours: Math.max(4, 9 - (simHours * 0.3)), 
            identityScore: simHours === 0 ? 1 : (simHours > 10 ? 2 : (simHours >= 8 ? 4 : 5)), 
            accomplishments: ["Simulated Entry"],
            commuteTotal: 1.5,
            commuteProductive: 1.0
        });
    }

    // Merge: if specific date mode, override any existing record on same date
    const modeEl = document.getElementById("simStartMode");
    const isSpecific = modeEl && modeEl.value === "specific";
    let merged = [...allLogs];
    if (isSpecific) {
        const newDateSet = new Set(newEntries.map(e => e.date));
        merged = merged.filter(r => !newDateSet.has(toGmt8DateKey(r.date) || r.date));
    }
    allLogs = [...merged, ...newEntries];
    allLogs.sort((a, b) => (toGmt8DateKey(a.date) || "").localeCompare(toGmt8DateKey(b.date) || ""));
    
    // Auto-advance Specific Start Date if applicable to help with chaining
    if (isSpecific && newEntries.length > 0) {
        const lastEntry = newEntries[newEntries.length - 1];
        const dateInput = document.getElementById("simStartDate");
        if (dateInput) dateInput.value = lastEntry.date;
    }

    // Re-render EVERYTHING
    renderTelemetry(allLogs);
    
    // Add visual feedback
    const note = document.querySelector(".sim-note");
    if (note) {
        note.innerText = `Simulated: Added ${simDaysToAdd} days @ ${simHours}h/day. Cumulative: ${allLogs.reduce((s,l)=>s+l.hours,0).toFixed(1)}h`;
        note.style.color = COLORS.excellent;
    }
}

function resetTelemetry() {
    allLogs = JSON.parse(JSON.stringify(realLogs));
    renderTelemetry(allLogs);
    
    const note = document.querySelector(".sim-note");
    if (note) {
        note.innerText = "Note: Simulated data is temporary and won't affect your real DTR records unless synced.";
        note.style.color = "";
    }
}
