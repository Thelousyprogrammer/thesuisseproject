/**
 * DTR UI AUX MODULE
 * Auxiliary UI flows separated from core submit/edit/summary logic.
 */

function changeSortMode(mode) {
    currentSortMode = mode;
    loadReflectionViewer();
}

function getReflectionSelectedWeek() {
    const select = document.getElementById("reflectionWeekSelect");
    if (!select) return null;
    const raw = select.value;
    if (raw === "current") {
        const latestDate = dailyRecords.length ? dailyRecords[dailyRecords.length - 1].date : toGmt8DateKey(new Date());
        return getWeekNumber(latestDate);
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
}

function updateReflectionWeekOptions() {
    const select = document.getElementById("reflectionWeekSelect");
    if (!select) return;

    const currentValue = select.value || "current";
    const currentWeekLabel = "Current Week";
    select.innerHTML = `<option value="current">${currentWeekLabel}</option>`;

    const weeks = [...new Set(dailyRecords.map(r => getWeekNumber(r.date)))].sort((a, b) => b - a);
    weeks.forEach((w) => {
        const range = getWeekDateRange(w);
        const opt = document.createElement("option");
        opt.value = String(w);
        opt.textContent = `Week ${w}`;
        opt.title = `${range.start} - ${range.end}`;
        select.appendChild(opt);
    });

    if (select.querySelector(`option[value="${currentValue}"]`)) {
        select.value = currentValue;
    }

    const viewMode = document.getElementById("reflectionViewMode");
    if (viewMode && viewMode.value !== "week") {
        select.style.display = "none";
    }
}

function changeReflectionViewMode(mode) {
    currentReflectionViewMode = mode === "week" ? "week" : "all";
    const weekLabel = document.querySelector('label[for="reflectionWeekSelect"]');
    const weekSelect = document.getElementById("reflectionWeekSelect");
    const showWeek = currentReflectionViewMode === "week";
    if (weekLabel) weekLabel.style.display = showWeek ? "inline-block" : "none";
    if (weekSelect) weekSelect.style.display = showWeek ? "inline-block" : "none";
    if (showWeek) updateReflectionWeekOptions();
    loadReflectionViewer();
}

function closeOjtConfirmModal() {
    const modal = document.getElementById("ojtConfirmModal");
    if (modal) modal.style.display = "none";
}

function applyDtrDateIntegrityGuardToInputs() {
    const startDate = typeof getCurrentOjtStartDate === "function" ? getCurrentOjtStartDate() : "";
    if (!startDate) return;
    ["date", "editDate"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.min = startDate;
    });
}

function populateOjtTimeZoneOptions(selectedTz = null) {
    const select = document.getElementById("ojtTimeZone");
    if (!select) return;
    const zoneOptions = typeof getTimeZoneOptionsByOffset === "function"
        ? getTimeZoneOptionsByOffset()
        : [{ id: DEFAULT_TIMEZONE, label: `(UTC0 | GMT0) ${DEFAULT_TIMEZONE}` }];
    const current = selectedTz || (typeof getCurrentTimeZone === "function" ? getCurrentTimeZone() : DEFAULT_TIMEZONE);
    select.innerHTML = "";
    const options = [...zoneOptions];
    const zoneIds = options.map((z) => z.id);
    if (current && !zoneIds.includes(current) && typeof isValidTimeZoneId === "function" && isValidTimeZoneId(current)) {
        options.unshift({
            id: current,
            label: `${current} (Legacy: uses inverted Etc/GMT naming)`
        });
    }
    options.forEach((tz) => {
        const opt = document.createElement("option");
        opt.value = tz.id;
        opt.textContent = tz.label;
        select.appendChild(opt);
    });
    const finalIds = options.map((z) => z.id);
    if (finalIds.includes(current)) {
        select.value = current;
    } else if (finalIds.includes(DEFAULT_TIMEZONE)) {
        select.value = DEFAULT_TIMEZONE;
    }
}

function saveOjtStartDateFromUI() {
    const input = document.getElementById("ojtStartDate");
    if (!input || !input.value) {
        alert("Please choose a valid starting date.");
        return;
    }

    const requiredInput = document.getElementById("ojtRequiredHours");
    const requiredHours = requiredInput ? parseFloat(requiredInput.value) : getCurrentRequiredOjtHours();
    if (!Number.isFinite(requiredHours) || requiredHours < 1) {
        alert("Please enter a valid Required OJT Hours value (minimum 1).");
        return;
    }

    const semesterEndInput = document.getElementById("semesterEndDate");
    const semesterEndDate = semesterEndInput ? semesterEndInput.value : "";
    if (!semesterEndDate) {
        alert("Please choose a valid Semester End Date.");
        return;
    }
    if (semesterEndDate < input.value) {
        alert("Semester End Date cannot be earlier than Starting Date.");
        return;
    }

    const timezoneSelect = document.getElementById("ojtTimeZone");
    const selectedTz = timezoneSelect ? timezoneSelect.value : getCurrentTimeZone();
    const selectedTzLabel = timezoneSelect && timezoneSelect.selectedOptions && timezoneSelect.selectedOptions.length
        ? timezoneSelect.selectedOptions[0].textContent
        : selectedTz;
    if (!isValidTimeZoneId(selectedTz)) {
        alert("Please choose a valid timezone.");
        return;
    }

    const startText = document.getElementById("ojtConfirmStartDate");
    const requiredText = document.getElementById("ojtConfirmRequiredHours");
    const semesterEndText = document.getElementById("ojtConfirmSemesterEndDate");
    const timezoneText = document.getElementById("ojtConfirmTimeZone");
    if (startText) startText.innerText = input.value;
    if (requiredText) requiredText.innerText = `${requiredHours}h`;
    if (semesterEndText) semesterEndText.innerText = semesterEndDate;
    if (timezoneText) timezoneText.innerText = selectedTzLabel;

    const modal = document.getElementById("ojtConfirmModal");
    if (modal) modal.style.display = "flex";
}

async function wipeAllDtrDataForTimelineChange() {
    const allImageIds = (dailyRecords || []).flatMap((r) => r.imageIds || []);
    dailyRecords = [];

    if (typeof clearRecordsFromStore === "function") {
        try { await clearRecordsFromStore(); } catch (_) {}
    }

    localStorage.removeItem("dtr");

    if (allImageIds.length && typeof deleteImagesFromStore === "function") {
        try { await deleteImagesFromStore(allImageIds); } catch (_) {}
    }

    if (typeof clearDTRForm === "function") clearDTRForm();
    if (typeof showSummary === "function") showSummary({});
    if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
}

async function confirmSaveOjtTimelineSettings() {
    const input = document.getElementById("ojtStartDate");
    const requiredInput = document.getElementById("ojtRequiredHours");
    const semesterEndInput = document.getElementById("semesterEndDate");
    const timezoneSelect = document.getElementById("ojtTimeZone");
    if (!input || !input.value || !requiredInput || !semesterEndInput || !timezoneSelect) return;

    const previousStartDate = typeof getCurrentOjtStartDate === "function" ? getCurrentOjtStartDate() : null;
    const persistedStartDate = typeof getOjtSettings === "function"
        ? toGmt8DateKey((getOjtSettings() || {}).ojtStartDate)
        : null;
    const originalStartDate = persistedStartDate || previousStartDate;
    const nextStartDate = input.value;
    const startDateChanged = !!persistedStartDate && persistedStartDate !== nextStartDate;

    if (startDateChanged) {
        const proceedWithChange = confirm(
            `You are changing the OJT starting date from ${originalStartDate} to ${nextStartDate}. Week mapping, graphs, and forecasts will be updated. Continue?`
        );
        if (!proceedWithChange) return;
    }

    let shouldWipeData = false;
    if (startDateChanged && nextStartDate > originalStartDate) {
        shouldWipeData = confirm(
            `The new starting date (${nextStartDate}) is ahead of your original date (${originalStartDate}). All saved DTR data will be wiped. Continue?`
        );
        if (!shouldWipeData) return;
    }

    if (!applyOjtStartDate(nextStartDate)) {
        alert("Unable to save starting date. Please use YYYY-MM-DD format.");
        return;
    }

    const requiredHours = parseFloat(requiredInput.value);
    if (!applyRequiredOjtHours(requiredHours)) {
        alert("Unable to save Required OJT Hours.");
        return;
    }

    if (!semesterEndInput.value || semesterEndInput.value < nextStartDate) {
        alert("Semester End Date cannot be earlier than Starting Date.");
        return;
    }

    if (!applySemesterEndDate(semesterEndInput.value)) {
        alert("Unable to save Semester End Date.");
        return;
    }

    if (!applyTimeZone(timezoneSelect.value)) {
        alert("Unable to save timezone.");
        return;
    }

    if (shouldWipeData) {
        await wipeAllDtrDataForTimelineChange();
    }

    if (typeof hydrateOjtSettingsFromStorage === "function") {
        hydrateOjtSettingsFromStorage();
    }
    if (typeof applyDtrDateIntegrityGuardToInputs === "function") {
        applyDtrDateIntegrityGuardToInputs();
    }

    closeOjtConfirmModal();
    updateReflectionWeekOptions();
    if (typeof updateExportWeekOptions === "function") updateExportWeekOptions();
    loadReflectionViewer();
    renderDailyGraph();
    renderWeeklyGraph();

    const dateInput = document.getElementById("date");
    const activeDate = dateInput && dateInput.value ? dateInput.value : (dailyRecords.length ? dailyRecords[dailyRecords.length - 1].date : null);
    if (activeDate) updateWeeklyCounter(activeDate);

    if (shouldWipeData) {
        alert(`Timeline saved: ${nextStartDate} | Required: ${requiredHours}h | End: ${semesterEndInput.value} | TZ: ${timezoneSelect.value}\n\nAll DTR records were wiped because the new start date is ahead of the original date.`);
    } else {
        alert(`Timeline saved: ${nextStartDate} | Required: ${requiredHours}h | End: ${semesterEndInput.value} | TZ: ${timezoneSelect.value}`);
    }
}
