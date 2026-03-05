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

function renderTrajectoryChart(logs, customPace = null) {
    const canvas = document.getElementById('trajectoryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Create GRADIENTS
    const gradAccent = ctx.createLinearGradient(0, 0, 0, 400);
    gradAccent.addColorStop(0, boostColor(COLORS.accent, 0.22).replace('rgb(', 'rgba(').replace(')', ', 0.5)'));
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
                    borderColor: lineText + '',
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
                                : (diff < 0 ? `Surplus: ${Math.abs(diff).toFixed(1)}h ahead` : 'On Track');
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

    const zoneOrder = ["Recovery", "Survival", "Solid", "Overdrive", "Elite"];
    const zones = { Elite: 0, Overdrive: 0, Solid: 0, Survival: 0, Recovery: 0 };

    logs.forEach(r => {
        const total = r.hours + (r.personalHours || 0);
        if (r.hours >= 8 && (r.personalHours || 0) >= 1) zones["Elite"]++;
        else if (total > 9) zones["Overdrive"]++;
        else if (r.hours >= 8) zones["Solid"]++;
        else if (r.hours >= 6) zones["Survival"]++;
        else zones["Recovery"]++;
    });

    charts.energy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: zoneOrder,
            datasets: [{
                label: 'Sessions',
                data: zoneOrder.map(z => zones[z]),
                backgroundColor: [COLORS.text + '99', COLORS.warning, COLORS.good, COLORS.accent, COLORS.excellent],
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false,
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
    if (!sortedWeeks.length) {
        charts.identity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'Alignment Score',
                    data: [0],
                    backgroundColor: COLORS.grid
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

    charts.identity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Weekly Avg',
                    data: avgScores,
                    backgroundColor: avgScores.map((score) => {
                        if (score >= 4) return COLORS.excellent + 'aa';
                        if (score >= 3) return COLORS.good + 'aa';
                        if (score >= 2) return COLORS.warning + 'aa';
                        return COLORS.accent + 'aa';
                    }),
                    borderColor: avgScores.map((score) => {
                        if (score >= 4) return COLORS.excellent;
                        if (score >= 3) return COLORS.good;
                        if (score >= 2) return COLORS.warning;
                        return COLORS.accent;
                    }),
                    borderWidth: 2,
                    borderRadius: 4,
                    yAxisID: 'y',
                    xAxisID: 'x'
                },
                {
                    type: 'line',
                    label: 'Target (4.0)',
                    data: targetLine,
                    borderColor: COLORS.text + '88',
                    borderDash: [5, 3],
                    pointRadius: 0,
                    tension: 0,
                    yAxisID: 'y',
                    xAxisID: 'x'
                },
                {
                    type: 'line',
                    label: 'Entry Count',
                    data: counts,
                    borderColor: boostColor(COLORS.accent, 0.2),
                    backgroundColor: boostColor(COLORS.accent, 0.2) + '33',
                    pointBackgroundColor: boostColor(COLORS.accent, 0.22),
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
                                return `Entries: ${counts[idx]}`;
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
                    title: { display: true, text: 'Alignment Score (1-5)', font: { size: 11 } }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { precision: 0 },
                    title: { display: true, text: 'Entry Count', font: { size: 11 } }
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

    sorted.forEach(r => {
        const w = getWeekNumber(r.date);
        const delta = r.hours - 8;
        
        if (!weeklyOHLC[w]) {
            weeklyOHLC[w] = { week: `Week ${w}`, open: delta, close: delta, high: delta, low: delta };
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
                    label: 'Wick',
                    data: weeks.map(w => [w.low, w.high]),
                    backgroundColor: weeks.map(w => w.close >= w.open ? COLORS.good + '88' : COLORS.accent + '88'),
                    borderColor: 'transparent',
                    barPercentage: 0.1,
                    grouped: false,
                    order: 2
                },
                {
                    label: 'Body',
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
                                `High:  ${d.high > 0 ? '+' : ''}${d.high.toFixed(1)}h`,
                                `Open:  ${d.open > 0 ? '+' : ''}${d.open.toFixed(1)}h`,
                                `Close: ${d.close > 0 ? '+' : ''}${d.close.toFixed(1)}h`,
                                `Low:   ${d.low > 0 ? '+' : ''}${d.low.toFixed(1)}h`
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
        
        charts.delta = new Chart(deltaCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: logs.map(r => r.date),
                datasets: [
                    {
                        label: 'Daily Delta',
                        data: deltas,
                        backgroundColor: deltas.map(d => d >= 0 ? COLORS.good + '88' : COLORS.accent + '88'),
                        borderColor: deltas.map(d => d >= 0 ? COLORS.good : COLORS.accent),
                        borderWidth: 1,
                        borderRadius: 2,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: 'Cumulative Delta',
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
                                if (context.dataset.label === 'Daily Delta') {
                                    const val = context.parsed.y;
                                    return `Daily: ${val > 0 ? '+' : ''}${val.toFixed(1)}h`;
                                } else {
                                    const val = context.parsed.y;
                                    return `Cumulative: ${val > 0 ? '+' : ''}${val.toFixed(1)}h`;
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
                        title: { display: true, text: 'Daily Delta (hours)', font: { size: 10 } },
                        ticks: { callback: value => (value > 0 ? '+' : '') + value + 'h' }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Cumulative (hours)', font: { size: 10 } },
                        ticks: { callback: value => (value > 0 ? '+' : '') + value + 'h' }
                    },
                    x: { display: true }
                }
            }
        });
    }
    renderCandlestickChart(allLogs);
}

function renderRadarChart(logs) {
    const canvas = document.getElementById('dayVelocityRadar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
                label: 'Avg Hours',
                data: data,
                borderColor: boostColor(COLORS.accent, 0.22),
                backgroundColor: boostColor(COLORS.accent, 0.22) + '33',
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
                    COLORS.text + '99',
                    COLORS.warning,
                    COLORS.accent,
                    COLORS.good,
                    COLORS.excellent
                ],
                borderWidth: 1,
                borderColor: COLORS.grid
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { color: COLORS.text, boxWidth: 12, font: { size: 10 } } }
            }
        }
    });
}
