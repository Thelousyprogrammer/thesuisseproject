/**
 * TELEMETRY RENDER MODULE
 * Handles chart initialization and data visualization
 */

// Shared chart motion profile + hover feedback for telemetry cards.
if (typeof window !== "undefined" && window.Chart && !window.__telemetryMotionInit) {
    window.__telemetryMotionInit = true;

    Chart.defaults.animation = {
        duration: 850,
        easing: "easeOutQuart"
    };
    Chart.defaults.animations = {
        x: { duration: 650, easing: "easeOutCubic" },
        y: { duration: 850, easing: "easeOutQuart" }
    };
    Chart.defaults.transitions.active = {
        animation: {
            duration: 180
        }
    };

    Chart.register({
        id: "telemetryHoverPulse",
        afterEvent(chart, args) {
            const card = chart && chart.canvas ? chart.canvas.closest(".chart-card") : null;
            if (!card || !args || !args.event) return;
            const type = args.event.type;
            if (type === "mouseout" || type === "mouseleave") {
                card.classList.remove("telemetry-chart-hover");
                return;
            }
            if (type === "mousemove" || type === "touchmove" || type === "pointermove") {
                const active = chart.getActiveElements();
                card.classList.toggle("telemetry-chart-hover", Array.isArray(active) && active.length > 0);
            }
        }
    });
}

function boostColor(hexOrRgba, boost = 0.18) {
    if (!hexOrRgba || typeof hexOrRgba !== 'string') return hexOrRgba;

    const hex = hexOrRgba.trim();
    if (/^#([0-9a-fA-F]{6})$/.test(hex)) {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        const nr = Math.min(255, Math.round(r + (255 - r) * boost));
        const ng = Math.min(255, Math.round(g + (255 - g) * boost));
        const nb = Math.min(255, Math.round(b + (255 - b) * boost));
        return `rgb(${nr}, ${ng}, ${nb})`;
    }

    const rgbMatch = hex.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(',').map(p => p.trim());
        if (parts.length >= 3) {
            const r = Number(parts[0]);
            const g = Number(parts[1]);
            const b = Number(parts[2]);
            const a = parts.length > 3 ? Number(parts[3]) : null;
            if ([r, g, b].every(v => Number.isFinite(v))) {
                const nr = Math.min(255, Math.round(r + (255 - r) * boost));
                const ng = Math.min(255, Math.round(g + (255 - g) * boost));
                const nb = Math.min(255, Math.round(b + (255 - b) * boost));
                return a !== null && Number.isFinite(a)
                    ? `rgba(${nr}, ${ng}, ${nb}, ${a})`
                    : `rgb(${nr}, ${ng}, ${nb})`;
            }
        }
    }

    return hexOrRgba;
}

function withAlpha(color, alpha = 0.2) {
    if (!color || typeof color !== "string") return color;
    const clamped = Math.max(0, Math.min(1, Number(alpha) || 0));
    const v = color.trim();

    if (/^#([0-9a-fA-F]{6})$/.test(v)) {
        const n = parseInt(v.slice(1), 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        return `rgba(${r}, ${g}, ${b}, ${clamped})`;
    }

    const rgbMatch = v.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(",").map((p) => p.trim());
        if (parts.length >= 3) {
            const r = Number(parts[0]);
            const g = Number(parts[1]);
            const b = Number(parts[2]);
            if ([r, g, b].every((num) => Number.isFinite(num))) {
                return `rgba(${r}, ${g}, ${b}, ${clamped})`;
            }
        }
    }

    return color;
}

function renderTrajectoryChart(logs, customPace = null) {
    const canvas = document.getElementById('trajectoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Create GRADIENTS
    const gradAccent = ctx.createLinearGradient(0, 0, 0, 400);
    gradAccent.addColorStop(0, withAlpha(boostColor(COLORS.accent, 0.22), 0.5));
    gradAccent.addColorStop(1, COLORS.fill);

    const lineAccent = boostColor(COLORS.accent, 0.2);
    const lineExcellent = boostColor(COLORS.excellent, 0.18);
    const lineText = boostColor(COLORS.text, 0.12);

    const series = buildTrajectorySeries({ logs, paceOverride: customPace });
    const labels = series.labels;
    const actualCumulative = series.actualCumulative;
    const projectedCumulative = series.projectedCumulative;
    const idealCumulative = series.idealCumulative;
    const maxProjected = projectedCumulative.filter((v) => v != null);
    const maxActual = actualCumulative.filter((v) => v != null);
    const targetHours = series && series.forecast && Number.isFinite(series.forecast.targetHours)
        ? series.forecast.targetHours
        : getCurrentRequiredOjtHours();
    const yMaxSource = Math.max(
        targetHours,
        maxActual.length ? Math.max(...maxActual) : 0,
        maxProjected.length ? Math.max(...maxProjected) : 0
    );

    if (charts.trajectory && typeof charts.trajectory.destroy === "function") {
        charts.trajectory.destroy();
    }

    charts.trajectory = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Actual Progress', 
                    data: actualCumulative, 
                    borderColor: lineAccent, 
                    backgroundColor: gradAccent, 
                    borderWidth: 3,
                    fill: true, 
                    tension: 0.1,
                    pointRadius: 2,
                    spanGaps: false
                },
                { 
                    label: 'Forecasted Projection', 
                    data: projectedCumulative, 
                    borderColor: lineExcellent, 
                    borderWidth: 2.5,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4,
                    spanGaps: true
                },
                { 
                    label: `Ideal Target (Standard ${DAILY_TARGET_HOURS}h Daily)`,
                    data: idealCumulative, 
                    borderColor: lineText,
                    borderWidth: 2,
                    borderDash: [5, 5], 
                    pointRadius: 0 
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        footer: (tooltipItems) => {
                            const actual = tooltipItems.find(i => i.datasetIndex === 0)?.parsed.y || 0;
                            const ideal = tooltipItems.find(i => i.datasetIndex === 2)?.parsed.y || 0;
                            const diff = ideal - actual;
                            if (actual === 0 && ideal === 0) return null;
                            return diff > 0 
                                ? `Deficit: ${diff.toFixed(1)}h behind` 
                                : (diff < 0 ? `Surplus: ${Math.abs(diff).toFixed(1)}h` : `On Track`);
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    max: Math.ceil(yMaxSource / 50) * 50 + 50,
                    grid: { color: COLORS.grid } 
                }, 
                x: { ticks: { autoSkip: true, maxTicksLimit: 12 }, grid: { display: false } } 
            }
        }
    });
}

function renderEnergyZoneChart(logs) {
    const canvas = document.getElementById('energyZoneChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const detailsEl = document.getElementById('energyZoneDateDetails');

    const zoneOrder = ["Recovery", "Survival", "Solid", "Overdrive", "Elite"];
    const zones = { Elite: 0, Overdrive: 0, Solid: 0, Survival: 0, Recovery: 0 };
    const zoneDates = { Elite: [], Overdrive: [], Solid: [], Survival: [], Recovery: [] };

    // Build a set of all logged date keys for gap detection
    const loggedDateKeys = new Set();
    logs.forEach(r => {
        const dateKey = toGmt8DateKey(r.date) || r.date;
        if (dateKey) loggedDateKeys.add(dateKey);
    });

    // Count missing dates between OJT start and last log as Recovery
    if (loggedDateKeys.size > 0) {
        const ojtStartKey = toGmt8DateKey(OJT_START || getCurrentOjtStartDate());
        const sortedKeys = [...loggedDateKeys].sort();
        const lastKey = sortedKeys[sortedKeys.length - 1];
        const startDate = parseDateKeyGmt8(ojtStartKey);
        const endDate = parseDateKeyGmt8(lastKey);
        if (startDate && endDate) {
            for (let d = new Date(startDate.getTime()); d <= endDate; d = addDaysGmt8(d, 1)) {
                const dk = toGmt8DateKey(d);
                if (dk && !loggedDateKeys.has(dk) && isWorkdayGmt8(d)) {
                    zones["Recovery"]++;
                    zoneDates["Recovery"].push(dk + " ⟵ gap");
                }
            }
        }
    }

    logs.forEach(r => {
        const total = r.hours + (r.personalHours || 0);
        const dateKey = toGmt8DateKey(r.date) || r.date;
        let zone = "Recovery";
        if (r.hours >= 8 && (r.personalHours || 0) >= 1) zone = "Elite";
        else if (total > 9) zone = "Overdrive";
        else if (r.hours >= 8) zone = "Solid";
        else if (r.hours >= 6) zone = "Survival";
        zones[zone]++;
        if (dateKey) zoneDates[zone].push(dateKey);
    });

    const noDatesLabel = "No dates in current window.";
    const zoneClickText = "Click a zone bar to view specific dates.";

    if (detailsEl) {
        detailsEl.innerHTML = zoneClickText;
    }

    charts.energy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: zoneOrder,
            datasets: [{
                label: 'Sessions',
                data: zoneOrder.map(z => zones[z]),
                backgroundColor: [withAlpha(COLORS.text, 0.6), COLORS.warning, COLORS.good, COLORS.accent, COLORS.excellent],
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (!detailsEl) return;
                if (!elements || !elements.length) return;
                const idx = elements[0].index;
                const zone = zoneOrder[idx];
                const dates = zoneDates[zone] || [];
                if (!dates.length) {
                    detailsEl.innerHTML = `<strong>${zone}:</strong> ${noDatesLabel}`;
                    return;
                }
                const items = dates.map((d) => `<li>${d}</li>`).join("");
                detailsEl.innerHTML = `
                    <strong>${zone} (${dates.length})</strong>
                    <ul style="margin:6px 0 0 16px; padding:0;">
                        ${items}
                    </ul>
                `;
            },
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { color: COLORS.grid } } }
        }
    });
}

function renderIdentityChart(logs) {
    const canvas = document.getElementById('identityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const weeklyIdentity = {};
    logs.forEach((r) => {
        const score = parseInt(r.identityScore, 10) || 0;
        if (score <= 0) return;
        const w = getWeekNumber(r.date);
        if (!weeklyIdentity[w]) weeklyIdentity[w] = { sum: 0, count: 0 };
        weeklyIdentity[w].sum += score;
        weeklyIdentity[w].count += 1;
    });

    const sortedWeeks = Object.keys(weeklyIdentity).map(Number).sort((a, b) => a - b);
    const noDataLabel = "No Data";
    const alignScoreLabel = "Alignment Score";

    if (!sortedWeeks.length) {
        charts.identity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [noDataLabel],
                datasets: [{
                    label: alignScoreLabel,
                    data: [0],
                    backgroundColor: withAlpha(COLORS.grid, 0.35)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 5, grid: { color: COLORS.grid } } }
            }
        });
        return;
    }

    const labels = sortedWeeks.map((w) => `Week ${w}`);
    const avgScores = sortedWeeks.map((w) => weeklyIdentity[w].sum / weeklyIdentity[w].count);
    const counts = sortedWeeks.map((w) => weeklyIdentity[w].count);
    const targetLine = sortedWeeks.map(() => 4);
    const idTheme = {
        excellent: boostColor(COLORS.excellent, 0.12),
        good: boostColor(COLORS.good, 0.12),
        warning: boostColor(COLORS.accent, 0.12),
        accent: boostColor(COLORS.accent, 0.12),
        text: boostColor(COLORS.text, 0.06)
    };

    const weeklyAvgLabel = "Weekly Avg";
    const targetLabel = "Target (4.0)";
    const entryCountLabel = "Entry Count";

    charts.identity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: weeklyAvgLabel,
                    data: avgScores,
                    backgroundColor: avgScores.map((score) => {
                        if (score >= 4) return withAlpha(idTheme.excellent, 0.67);
                        if (score >= 3) return withAlpha(idTheme.good, 0.67);
                        if (score >= 2) return withAlpha(idTheme.warning, 0.67);
                        return withAlpha(idTheme.accent, 0.67);
                    }),
                    borderColor: avgScores.map((score) => {
                        if (score >= 4) return idTheme.excellent;
                        if (score >= 3) return idTheme.good;
                        if (score >= 2) return idTheme.warning;
                        return idTheme.accent;
                    }),
                    borderWidth: 2,
                    borderRadius: 4,
                    yAxisID: 'y',
                    xAxisID: 'x'
                },
                {
                    type: 'line',
                    label: targetLabel,
                    data: targetLine,
                    borderColor: withAlpha(idTheme.text, 0.53),
                    borderDash: [5, 3],
                    pointRadius: 0,
                    tension: 0,
                    yAxisID: 'y',
                    xAxisID: 'x'
                },
                {
                    type: 'line',
                    label: entryCountLabel,
                    data: counts,
                    borderColor: idTheme.accent,
                    backgroundColor: withAlpha(idTheme.accent, 0.2),
                    pointBackgroundColor: idTheme.accent,
                    pointRadius: 3,
                    pointBorderColor: boostColor(COLORS.text, 0.1),
                    pointBorderWidth: 1,
                    tension: 0.3,
                    yAxisID: 'y1',
                    xAxisID: 'x'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 11 }, color: COLORS.text }
                },
                tooltip: {
                    callbacks: {
                        afterLabel: (context) => {
                            if (context.dataset.type === 'bar') {
                                const idx = context.dataIndex;
                                return `${entryCountLabel}: ${counts[idx]}`;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    grid: { display: false }
                },
                y: {
                    min: 0,
                    max: 5,
                    ticks: { stepSize: 1, callback: value => value.toFixed(1) },
                    grid: { color: COLORS.grid },
                    title: { display: true, text: alignScoreLabel, font: { size: 11 } }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { precision: 0 },
                    title: { display: true, text: entryCountLabel, font: { size: 11 } }
                }
            }
        }
    });
}

function renderCandlestickChart(logs) {
    const canvas = document.getElementById('candlestickChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const weeklyOHLC = {};
    const sorted = [...logs].sort((a,b) => (toGmt8DateKey(a.date) || "").localeCompare(toGmt8DateKey(b.date) || ""));

    const wickLabel = "Wick";
    const bodyLabel = "Body";
    const highLabel = "High";
    const openLabel = "Open";
    const closeLabel = "Close";
    const lowLabel = "Low";

    sorted.forEach(r => {
        const w = getWeekNumber(r.date);
        const delta = r.hours - 8;
        
        if (!weeklyOHLC[w]) {
            const label = `Week ${w}`;
            weeklyOHLC[w] = { week: label, open: delta, close: delta, high: delta, low: delta };
        } else {
            weeklyOHLC[w].close = delta; 
            weeklyOHLC[w].high = Math.max(weeklyOHLC[w].high, delta);
            weeklyOHLC[w].low = Math.min(weeklyOHLC[w].low, delta);
        }
    });

    const weeks = Object.values(weeklyOHLC).map(w => {
        if (Math.abs(w.open - w.close) < 0.05) {
            w.close = w.open + 0.05;
        }
        return w;
    });

    charts.candlestick = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weeks.map(w => w.week),
            datasets: [
                {
                    label: wickLabel,
                    data: weeks.map(w => [w.low, w.high]),
                    backgroundColor: weeks.map(w => w.close >= w.open ? withAlpha(COLORS.good, 0.53) : withAlpha(COLORS.accent, 0.53)),
                    borderColor: 'transparent',
                    barPercentage: 0.1,
                    grouped: false,
                    order: 2
                },
                {
                    label: bodyLabel,
                    data: weeks.map(w => [Math.min(w.open, w.close), Math.max(w.open, w.close)]),
                    backgroundColor: weeks.map(w => w.close >= w.open ? COLORS.good : COLORS.accent),
                    borderColor: weeks.map(w => w.close >= w.open ? COLORS.good : COLORS.accent),
                    borderWidth: 1,
                    barPercentage: 0.7, 
                    grouped: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const d = weeks[context.dataIndex];
                            return [
                                `${highLabel}:  ${d.high > 0 ? '+' : ''}${d.high.toFixed(1)}h`,
                                `${openLabel}:  ${d.open > 0 ? '+' : ''}${d.open.toFixed(1)}h`,
                                `${closeLabel}: ${d.close > 0 ? '+' : ''}${d.close.toFixed(1)}h`,
                                `${lowLabel}:   ${d.low > 0 ? '+' : ''}${d.low.toFixed(1)}h`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: COLORS.grid },
                    ticks: { callback: value => (value > 0 ? '+' : '') + value + 'h' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderContextualCharts(logs, selectedWeek) {
    const deltaCanvas = document.getElementById('deltaChart');
    if (deltaCanvas) {
        // Calculate delta values and cumulative delta
        const deltas = logs.map(r => r.hours - 8);
        let cumulativeDelta = 0;
        const cumulativeDeltas = deltas.map(d => {
            cumulativeDelta += d;
            return cumulativeDelta;
        });
        
        const dailyDeltaLabel = "Daily Delta";
        const cumulativeDeltaLabel = "Cumulative Delta";
        const dailyDeltaHoursLabel = "Daily Delta (hours)";
        const cumulativeHoursLabel = "Cumulative (hours)";

        charts.delta = new Chart(deltaCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: logs.map(r => r.date),
                datasets: [
                    {
                        label: dailyDeltaLabel,
                        data: deltas,
                        backgroundColor: deltas.map(d => d >= 0 ? withAlpha(COLORS.good, 0.53) : withAlpha(COLORS.accent, 0.53)),
                        borderColor: deltas.map(d => d >= 0 ? COLORS.good : COLORS.accent),
                        borderWidth: 1,
                        borderRadius: 2,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: cumulativeDeltaLabel,
                        type: 'line',
                        data: cumulativeDeltas,
                        borderColor: boostColor(COLORS.accent, 0.22),
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointBackgroundColor: boostColor(COLORS.accent, 0.22),
                        pointBorderColor: boostColor(COLORS.text, 0.1),
                        pointBorderWidth: 1,
                        pointRadius: 3,
                        tension: 0.3,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                indexAxis: undefined,
                plugins: { 
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: { font: { size: 11 }, color: COLORS.text }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.label === dailyDeltaLabel) {
                                    const val = context.parsed.y;
                                    return `${dailyDeltaLabel}: ${val > 0 ? '+' : ''}${val.toFixed(1)}h`;
                                } else {
                                    const val = context.parsed.y;
                                    return `${cumulativeDeltaLabel}: ${val > 0 ? '+' : ''}${val.toFixed(1)}h`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        type: 'linear',
                        position: 'left',
                        grid: { color: COLORS.grid },
                        title: { display: true, text: dailyDeltaHoursLabel, font: { size: 10 } },
                        ticks: { callback: value => (value > 0 ? '+' : '') + value + 'h' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: cumulativeHoursLabel, font: { size: 10 } },
                        ticks: { callback: value => (value > 0 ? '+' : '') + value + 'h' }
                    },
                    x: { display: true }
                }
            }
        });
    }
    renderCandlestickChart(logs);
}

function renderRadarChart(logs) {
    const canvas = document.getElementById('dayVelocityRadar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // Use default labels for radar logic but we could localize display if needed
    const avgHoursLabel = "Avg Hours";

    const dayAverages = [0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0];

    logs.forEach(l => {
        const d0 = parseDateKeyGmt8(toGmt8DateKey(l.date));
        if (!d0) return;
        const d = getGmt8Weekday(d0);
        if (d === 0) return;
        const idx = d - 1;
        dayAverages[idx] += l.hours;
        dayCounts[idx]++;
    });

    const data = dayAverages.map((sum, i) => dayCounts[i] > 0 ? sum / dayCounts[i] : 0);

    charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: days,
            datasets: [{
                label: avgHoursLabel,
                data: data,
                borderColor: boostColor(COLORS.accent, 0.22),
                backgroundColor: withAlpha(boostColor(COLORS.accent, 0.22), 0.12),
                borderWidth: 3,
                pointBackgroundColor: boostColor(COLORS.accent, 0.24),
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: COLORS.grid },
                    grid: { color: COLORS.grid },
                    pointLabels: { color: COLORS.text, font: { size: 11 } },
                    ticks: { display: false, stepSize: 2 },
                    min: 0,
                    max: 12
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderHourDistChart(logs) {
    const canvas = document.getElementById('hourDistChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bins = ["<4h", "4-6h", "6-8h", "8-9h", "9h+"];
    const counts = [0, 0, 0, 0, 0];

    logs.forEach(l => {
        const h = l.hours;
        if (h < 4) counts[0]++;
        else if (h < 6) counts[1]++;
        else if (h < 8) counts[2]++;
        else if (h < 9) counts[3]++;
        else counts[4]++;
    });

    charts.hourDist = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: bins,
            datasets: [{
                data: counts,
                backgroundColor: [
                    withAlpha(COLORS.text, 0.6),
                    COLORS.warning,
                    COLORS.accent,
                    COLORS.good,
                    COLORS.excellent
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: COLORS.text, font: { size: 11 }, padding: 15 }
                }
            },
            cutout: '70%',
            spacing: 2
        }
    });
}

function renderWeeklyEffortChart(logs) {
    const canvas = document.getElementById('weeklyEffortChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const weeklyData = {};
    logs.forEach(r => {
        const w = getWeekNumber(r.date);
        if (!weeklyData[w]) weeklyData[w] = { ojt: 0, personal: 0 };
        weeklyData[w].ojt += r.hours;
        weeklyData[w].personal += (r.personalHours || 0);
    });

    const sortedWeeks = Object.keys(weeklyData).map(Number).sort((a,b) => a - b);
    const labels = sortedWeeks.map(w => `Week ${w}`);
    const ojtHours = sortedWeeks.map(w => weeklyData[w].ojt);
    const personalHours = sortedWeeks.map(w => weeklyData[w].personal);

    charts.weeklyEffort = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'OJT Hours',
                    data: ojtHours,
                    backgroundColor: COLORS.accent,
                    borderRadius: 4
                },
                {
                    label: 'Personal Hours',
                    data: personalHours,
                    backgroundColor: COLORS.excellent,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: COLORS.text, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        footer: (tooltipItems) => {
                            const total = tooltipItems.reduce((s, i) => s + i.parsed.y, 0);
                            return `Total Effort: ${total.toFixed(1)}h`;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { color: COLORS.grid }, title: { display: true, text: 'Hours', color: COLORS.text } }
            }
        }
    });
}
