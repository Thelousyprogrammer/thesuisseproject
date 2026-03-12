/**
 * DTR MAIN ENTRY POINT
 * Initializes the application and global event listeners
 */

window.addEventListener("DOMContentLoaded", async () => {

    const savedOjt = typeof hydrateOjtSettingsFromStorage === "function"
        ? hydrateOjtSettingsFromStorage()
        : null;

    // 1. Initial Data Sync
    if (typeof loadDTRRecords === "function") {
        dailyRecords = await loadDTRRecords();
    } else {
        dailyRecords = JSON.parse(localStorage.getItem("dtr")) || [];
    }

    // 2. Initial Theme Sync
    const localTheme = (window.ThemeSync && typeof window.ThemeSync.getLocalTheme === "function")
        ? window.ThemeSync.getLocalTheme()
        : (localStorage.getItem("user-theme") || "f1");
    setTheme(localTheme, { broadcast: false });
    if (typeof syncF1LightToggleLabel === "function") {
        syncF1LightToggleLabel("f1LightToggleBtn");
    }

    // 3. UI Initialization
    const startInput = document.getElementById("ojtStartDate");
    if (startInput && savedOjt && savedOjt.startDateKey) {
        startInput.value = savedOjt.startDateKey;
    }
    const requiredHoursInput = document.getElementById("ojtRequiredHours");
    if (requiredHoursInput) {
        const hydratedHours = savedOjt && Number.isFinite(savedOjt.requiredHours)
            ? savedOjt.requiredHours
            : (typeof getCurrentRequiredOjtHours === "function" ? getCurrentRequiredOjtHours() : MASTER_TARGET_HOURS);
        requiredHoursInput.value = hydratedHours;
    }
    const semesterEndInput = document.getElementById("semesterEndDate");
    if (semesterEndInput) {
        const hydratedEnd = savedOjt && savedOjt.semesterEndDateKey
            ? savedOjt.semesterEndDateKey
            : (typeof getCurrentSemesterEndDate === "function" ? getCurrentSemesterEndDate() : "");
        semesterEndInput.value = hydratedEnd;
    }
    if (typeof populateOjtTimeZoneOptions === "function") {
        populateOjtTimeZoneOptions(savedOjt && savedOjt.timeZone ? savedOjt.timeZone : null);
    }
    if (typeof applyDtrDateIntegrityGuardToInputs === "function") {
        applyDtrDateIntegrityGuardToInputs();
    }

    const reflectionViewSelect = document.getElementById("reflectionViewMode");
    if (reflectionViewSelect) {
        reflectionViewSelect.value = currentReflectionViewMode;
    }
    if (typeof changeReflectionViewMode === "function") {
        changeReflectionViewMode(currentReflectionViewMode);
    }

    loadReflectionViewer();
    renderDailyGraph();
    renderWeeklyGraph();

    if (dailyRecords.length) {
        showSummary(dailyRecords[dailyRecords.length - 1]);
        updateWeeklyCounter(dailyRecords[dailyRecords.length - 1].date);
    } else {
        showSummary({});
        updateWeeklyCounter();
    }

    // 4. Export UI Setup
    updateExportWeekOptions();
    if (typeof updateReflectionWeekOptions === "function") {
        updateReflectionWeekOptions();
    }
    if (typeof updateExportWeekRangeLabel === 'function') {
        updateExportWeekRangeLabel();
    }

    // 5. Storage Visualizer
    if (typeof updateStorageVisualizer === 'function') {
        updateStorageVisualizer();
        if (!window.__dtrStorageVisualizerTimer) {
            window.__dtrStorageVisualizerTimer = setInterval(() => {
                if (typeof updateStorageVisualizer === "function") {
                    updateStorageVisualizer();
                }
            }, 3000);
        }
    }

    // 6. Live Sync: Real-time Graph Updates
    const syncGraphsRealTime = (dateId, hoursId) => {
        const dateVal = document.getElementById(dateId).value;
        const hoursVal = parseFloat(document.getElementById(hoursId).value);
        
        if (!dateVal || isNaN(hoursVal)) {
            renderDailyGraph();
            renderWeeklyGraph();
            return;
        }

        // Create a temporary record set for simulation
        const tempRecord = { date: dateVal, hours: hoursVal };
        const mergedRecords = dailyRecords.filter(r => r.date !== dateVal);
        mergedRecords.push(tempRecord);
        mergedRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

        renderDailyGraph(mergedRecords);
        renderWeeklyGraph(mergedRecords);
    };

    // Listeners for Main Form
    ['date', 'hours'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => syncGraphsRealTime('date', 'hours'));
    });

    // Listeners for Edit Modal
    ['editDate', 'editHours'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => syncGraphsRealTime('editDate', 'editHours'));
    });
});

document.addEventListener("dtr:languageChanged", () => {
    if (typeof updateReflectionWeekOptions === "function") updateReflectionWeekOptions();
    if (typeof updateExportWeekOptions === "function") updateExportWeekOptions();
    if (typeof loadReflectionViewer === "function") loadReflectionViewer();
    if (typeof updateWeeklyCounter === "function") {
        const dateInput = document.getElementById("date");
        if (dateInput && dateInput.value) updateWeeklyCounter(dateInput.value);
    }
});

document.addEventListener("theme:changed", () => {
    if (typeof syncF1LightToggleLabel === "function") {
        syncF1LightToggleLabel("f1LightToggleBtn");
    }
});

// --- GLOBAL LISTENERS ---

// Image Preview Listener
const imagesInput = document.getElementById("images");
if (imagesInput) {
    imagesInput.addEventListener("change", function () {
        const preview = document.getElementById("imagePreview");
        if (!preview) return;
        preview.innerHTML = "";
        const files = Array.from(this.files);

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement("img");
                img.src = e.target.result;
                img.style.width = "80px";
                img.style.height = "80px";
                img.style.objectFit = "cover";
                img.style.borderRadius = "5px";
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
    });
}
