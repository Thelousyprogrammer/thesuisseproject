/**
 * WEEK COMPARISON MODULE
 */

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof hydrateOjtSettingsFromStorage === "function") {
        hydrateOjtSettingsFromStorage();
    }
    const logs = await fetchTelemetryData();
    renderWeekComparison(logs);
});

async function fetchTelemetryData() {
    let logs = [];
    if (typeof getRecordsFromStore === "function") {
        try {
            const stored = await getRecordsFromStore();
            if (Array.isArray(stored)) logs = stored;
        } catch (_) {}
    }
    if (!logs.length) {
        try {
            const raw = localStorage.getItem("dtr");
            logs = JSON.parse(raw) || [];
        } catch (_) {
            logs = [];
        }
    }
    return logs.map(l => ({
        ...l,
        hours: parseFloat(l.hours) || 0,
        personalHours: parseFloat(l.personalHours) || 0
    }));
}

function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
        accent: style.getPropertyValue('--accent').trim() || '#ff1e00',
        excellent: style.getPropertyValue('--level-3').trim() || '#FF00FF',
        text: style.getPropertyValue('--text').trim() || '#ffffff'
    };
}

function renderWeekComparison(logs) {
    const t = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;
    if (!logs || logs.length === 0) {
        const noDataLabel = t ? t("no_data_available") : "No data available";
        document.getElementById("comparisonTableBody").innerHTML = `<tr><td colspan="5" data-i18n="no_data_available">${noDataLabel}</td></tr>`;
        return;
    }

    const colors = getThemeColors();
    // ... group by week logic ...
    const weekGroups = {};
    logs.forEach(r => {
        const w = getWeekNumber(r.date);
        if (!weekGroups[w]) weekGroups[w] = { hours: 0, personal: 0, count: 0, dates: [] };
        weekGroups[w].hours += r.hours;
        weekGroups[w].personal += r.personalHours;
        weekGroups[w].count++;
        weekGroups[w].dates.push(new Date(r.date));
    });

    const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a,b) => a - b);
    const tbody = document.getElementById("comparisonTableBody");
    tbody.innerHTML = "";

    const labels = sortedWeeks.map(w => t ? t("week_label", { week: w }) : `Week ${w}`);
    const ojtData = sortedWeeks.map(w => weekGroups[w].hours);
    const personalData = sortedWeeks.map(w => weekGroups[w].personal);

    new Chart(document.getElementById('growthChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: t ? t('chart_effort_ojt') : 'OJT Hours',
                    data: ojtData,
                    borderColor: colors.accent,
                    backgroundColor: colors.accent + '22',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: t ? t('chart_effort_personal') : 'Personal Hours',
                    data: personalData,
                    borderColor: colors.excellent,
                    backgroundColor: colors.excellent + '22',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: colors.text } },
                x: { grid: { display: false }, ticks: { color: colors.text } }
            },
            plugins: {
                legend: { labels: { color: colors.text } }
            }
        }
    });

    let prevWeekHours = null;

    sortedWeeks.forEach(w => {
        const data = weekGroups[w];
        const totalEffort = data.hours + data.personal;
        
        let growthLabel = "-";
        let growthClass = "";
        if (prevWeekHours !== null && prevWeekHours > 0) {
            const diff = ((data.hours - prevWeekHours) / prevWeekHours) * 100;
            growthLabel = (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
            growthClass = diff >= 0 ? "growth-positive" : "growth-negative";
        }

        const dateRange = getWeekDateRange(w);
        const rangeLabel = `${formatGmt8DateLabel(dateRange.start)} - ${formatGmt8DateLabel(dateRange.end)}`;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${t ? t("week_label", { week: w }) : `Week ${w}`}<br><small>${rangeLabel}</small></td>
            <td>${data.hours.toFixed(1)}h</td>
            <td>${data.personal.toFixed(1)}h</td>
            <td class="${growthClass}">${growthLabel}</td>
            <td>${((data.hours / (data.count * 8)) * 100).toFixed(1)}%</td>
        `;
        tbody.appendChild(row);
        prevWeekHours = data.hours;
    });

    // Add summary
    const totalHours = logs.reduce((s,r) => s + r.hours, 0);
    const totalPersonal = logs.reduce((s,r) => s + r.personalHours, 0);
    document.getElementById("grandTotalHours").innerText = totalHours.toFixed(1) + "h";
    document.getElementById("grandTotalPersonal").innerText = totalPersonal.toFixed(1) + "h";
}

// --- EXPOSE TO WINDOW FOR HTML INLINE CONTROLLERS ---
if(typeof window !== "undefined") { window.fetchTelemetryData = window.fetchTelemetryData || fetchTelemetryData; }
if(typeof window !== "undefined") { window.getThemeColors = window.getThemeColors || getThemeColors; }
if(typeof window !== "undefined") { window.renderWeekComparison = window.renderWeekComparison || renderWeekComparison; }
