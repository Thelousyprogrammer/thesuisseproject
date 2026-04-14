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

/**
 * Interpolates between two hex colors based on a factor (0-1)
 */
function interpolateHex(color1, color2, factor) {
    const f = Math.max(0, Math.min(1, factor));
    const parse = (c) => {
        if (typeof c !== 'string') return [255, 255, 255];
        if (c.startsWith('#')) {
            const hex = c.length === 4 ? c[1]+c[1]+c[2]+c[2]+c[3]+c[3] : c.slice(1);
            return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        }
        const match = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [255, 255, 255];
    };
    const c1 = parse(color1);
    const c2 = parse(color2);
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Maps a ratio (0-1) to the project's performance color ramp
 */
function getPerformanceColor(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    // Ramp: Warning (0.0) -> Accent (0.35) -> Good (0.7) -> Excellent (1.0)
    const cWarning = (typeof COLORS !== 'undefined') ? COLORS.warning : '#FFB800';
    const cAccent = (typeof COLORS !== 'undefined') ? COLORS.accent : '#ff1e00';
    const cGood = (typeof COLORS !== 'undefined') ? COLORS.good : '#00D1FF';
    const cExcellent = (typeof COLORS !== 'undefined') ? COLORS.excellent : '#FF00FF';

    if (r < 0.35) return interpolateHex(cWarning, cAccent, r / 0.35);
    if (r < 0.7) return interpolateHex(cAccent, cGood, (r - 0.35) / 0.35);
    return interpolateHex(cGood, cExcellent, (r - 0.7) / 0.3);
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
    const lineText = boostColor(COLORS.aux || COLORS.text, 0.12);

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
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_trajectory_actual') : 'Actual Progress', 
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
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_trajectory_projected') : 'Forecasted Projection', 
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
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_trajectory_ideal', { hours: DAILY_TARGET_HOURS }) : `Ideal Target (Standard ${DAILY_TARGET_HOURS}h Daily)`,
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
                            const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
                            const deficitLabel = t ? t('charts_general.chart_deficit') : 'Deficit: ';
                            const surplusLabel = t ? t('charts_general.chart_surplus') : 'Surplus: ';
                            const onTrackLabel = t ? t('status_indicators.status_on_track') : 'On Track';
                            const hours = Math.abs(diff).toFixed(1);

                            if (diff > 0) {
                                return t ? t('charts_general.chart_behind_tooltip', { hours }) : `${deficitLabel}${hours}h behind`;
                            } else if (diff < 0) {
                                return t ? t('charts_general.chart_ahead_tooltip', { hours }) : `${surplusLabel}${hours}h ahead`;
                            } else {
                                return onTrackLabel;
                            }
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

    const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
    const zoneTranslationMap = {
        "Elite": t ? t("charts_general.chart_energy_elite") : "Elite",
        "Overdrive": t ? t("charts_general.chart_energy_overdrive") : "Overdrive",
        "Solid": t ? t("charts_general.chart_energy_solid") : "Solid",
        "Survival": t ? t("charts_general.chart_energy_survival") : "Survival",
        "Recovery": t ? t("charts_general.chart_energy_recovery") : "Recovery"
    };
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

    const noDatesLabel = t ? t("charts_general.chart_no_dates_window") : "No dates in current window.";
    const zoneClickText = t ? t("charts_general.chart_click_zone_bar") : "Click a zone bar to view specific dates.";

    if (detailsEl) {
        detailsEl.innerHTML = zoneClickText;
    }

    charts.energy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: zoneOrder.map(z => zoneTranslationMap[z] || z),
            datasets: [{
                label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_energy_sessions') : 'Sessions',
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
    const t = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;

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
    const noDataLabel = t ? t("chart_id_no_data") : "No Data";
    const alignScoreLabel = t ? t("chart_id_alignment") : "Alignment Score";

    if (!sortedWeeks.length) {
        charts.identity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [(window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_id_no_data') : noDataLabel],
                datasets: [{
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_id_alignment') : alignScoreLabel,
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

    const labels = sortedWeeks.map((w) => (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t("ui.week_label", { week: w }) : `Week ${w}`);
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

    const weeklyAvgLabel = t ? t("chart_id_weekly_avg") : "Weekly Avg";
    const targetLabel = t ? t("chart_id_target") : "Target (4.0)";
    const entryCountLabel = t ? t("chart_id_entry_count") : "Entry Count";

    charts.identity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('charts_general.chart_id_weekly_avg') : weeklyAvgLabel,
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
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_id_target') : targetLabel,
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
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_id_entry_count') : entryCountLabel,
                    data: counts,
                    borderColor: COLORS.aux || idTheme.accent,
                    backgroundColor: withAlpha(COLORS.aux || idTheme.accent, 0.2),
                    pointBackgroundColor: COLORS.aux || idTheme.accent,
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
    const t = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;

    const tCandle = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;
    const wickLabel = tCandle ? tCandle('ui.chart_wick') : "Wick";
    const bodyLabel = tCandle ? tCandle('ui.chart_body') : "Body";
    const highLabel = tCandle ? tCandle('ui.chart_high') : "High";
    const openLabel = tCandle ? tCandle('ui.chart_open') : "Open";
    const closeLabel = tCandle ? tCandle('ui.chart_close') : "Close";
    const lowLabel = tCandle ? tCandle('ui.chart_low') : "Low";

    sorted.forEach(r => {
        const w = getWeekNumber(r.date);
        const delta = r.hours - 8;
        
        if (!weeklyOHLC[w]) {
            const label = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t("week_label", { week: w }) : `Week ${w}`;
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
        
        const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
        const dailyDeltaLabel = t ? t('chart_daily_delta') : "Daily Delta";
        const cumulativeDeltaLabel = t ? t('chart_cumulative_delta') : "Cumulative Delta";
        const dailyDeltaHoursLabel = t ? t('chart_daily_delta_label') : "Daily Delta (hours)";
        const cumulativeHoursLabel = t ? t('chart_delta_cumulative_label') : "Cumulative (hours)";

        charts.delta = new Chart(deltaCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: logs.map(r => r.date),
                datasets: [
                    {
                        label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_delta_daily') : dailyDeltaLabel,
                        data: deltas,
                        backgroundColor: deltas.map(d => d >= 0 ? withAlpha(COLORS.good, 0.53) : withAlpha(COLORS.accent, 0.53)),
                        borderColor: deltas.map(d => d >= 0 ? COLORS.good : COLORS.accent),
                        borderWidth: 1,
                        borderRadius: 2,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_delta_cumulative') : cumulativeDeltaLabel,
                        type: 'line',
                        data: cumulativeDeltas,
                        borderColor: COLORS.aux || boostColor(COLORS.accent, 0.22),
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        pointBackgroundColor: COLORS.aux || boostColor(COLORS.accent, 0.22),
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

    const tRadar = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
    const days = tRadar 
        ? [tRadar('chart_radar_mon'), tRadar('chart_radar_tue'), tRadar('chart_radar_wed'), tRadar('chart_radar_thu'), tRadar('chart_radar_fri'), tRadar('chart_radar_sat')]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; 
    const avgHoursLabel = tRadar ? tRadar('chart_radar_avg_hours') : "Avg Hours";

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
                label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_radar_avg_hours') : 'Avg Hours',
                data: data,
                borderColor: COLORS.aux || boostColor(COLORS.accent, 0.22),
                backgroundColor: withAlpha(COLORS.aux || boostColor(COLORS.accent, 0.22), 0.12),
                borderWidth: 3,
                pointBackgroundColor: COLORS.aux || boostColor(COLORS.accent, 0.24),
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

function renderProductivityMatrix(logs) {
    const canvas = document.getElementById('productivityMatrixChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;

    const dataPoints = logs.map(r => {
        const tasks = (r.accomplishments && Array.isArray(r.accomplishments)) ? r.accomplishments.length : 0;
        const output = r.hours > 0 ? (tasks / r.hours) : 0;
        const identity = parseInt(r.identityScore, 10) || 0;
        const perfRatio = Math.min(1, (output / 2.5) * 0.4 + (identity / 5) * 0.6);
        return {
            x: identity,
            y: parseFloat(output.toFixed(2)),
            r: Math.max(6, Math.min(22, (r.hours * 2.2))),
            perf: perfRatio,
            date: r.date,
            duration: r.hours,
            tasks: tasks
        };
    }).filter(p => p.x > 0);

    if (charts.productivity && typeof charts.productivity.destroy === "function") {
        charts.productivity.destroy();
    }

    charts.productivity = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                data: dataPoints,
                backgroundColor: (ctx) => {
                    const p = ctx.raw;
                    return p ? withAlpha(getPerformanceColor(p.perf), 0.8) : COLORS.accent;
                },
                borderColor: (ctx) => {
                    const p = ctx.raw;
                    return p ? getPerformanceColor(p.perf) : COLORS.accent;
                },
                borderWidth: 2,
                hoverRadius: 2,
                hoverBorderWidth: 3,
                hoverBorderColor: '#ffffff',
                // Neon Glow effect
                shadowBlur: 20,
                shadowColor: (ctx) => {
                    const p = ctx.raw;
                    return p ? getPerformanceColor(p.perf) : 'transparent';
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(16, 19, 26, 0.95)',
                    titleColor: COLORS.accent,
                    borderColor: COLORS.border || 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    bodyFont: { family: "'Formula1 Display', sans-serif", size: 11 },
                    titleFont: { family: "'Formula1 Display', sans-serif", size: 12 },
                    callbacks: {
                        label: (context) => {
                            const p = context.raw;
                            return [
                                `DATE: ${p.date}`,
                                `ALIGNMENT: ${p.x}/5`,
                                `OUTPUT: ${p.y} tasks/hr`,
                                `INTENSITY: ${p.duration}h`,
                                `PERFORMANCE: ${p.perf}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: t ? t('charts_general.chart_productivity_matrix_x') : 'IDENTITY ALIGNMENT', color: COLORS.text, font: { size: 10, weight: 'bold', family: "'Formula1 Display', sans-serif" } },
                    min: 0.5,
                    max: 5.5,
                    grid: { color: COLORS.grid, borderDash: [2, 2] },
                    ticks: { stepSize: 1, color: withAlpha(COLORS.text, 0.7), font: { family: "'Formula1 Display', sans-serif", size: 9 } }
                },
                y: {
                    title: { display: true, text: t ? t('charts_general.chart_productivity_matrix_y') : 'TASKS PER HOUR', color: COLORS.text, font: { size: 10, weight: 'bold', family: "'Formula1 Display', sans-serif" } },
                    beginAtZero: true,
                    grid: { color: COLORS.grid, borderDash: [2, 2] },
                    ticks: { color: withAlpha(COLORS.text, 0.7), font: { family: "'Formula1 Display', sans-serif", size: 9 } }
                }
            }
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
    const t = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;
    const labels = sortedWeeks.map(w => (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t("week_label", { week: w }) : `Week ${w}`);
    const ojtHours = sortedWeeks.map(w => weeklyData[w].ojt);
    const personalHours = sortedWeeks.map(w => weeklyData[w].personal);

    charts.weeklyEffort = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_effort_ojt') : 'OJT Hours',
                    data: ojtHours,
                    backgroundColor: COLORS.accent,
                    borderRadius: 4
                },
                {
                    label: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('chart_effort_personal') : 'Personal Hours',
                    data: personalHours,
                    backgroundColor: COLORS.aux || COLORS.excellent,
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
                            const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
                            return t ? t('chart_effort_total', { hours: total.toFixed(1) }) : `Total Effort: ${total.toFixed(1)}h`;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { color: COLORS.grid }, title: { display: true, text: (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t('hours_worked') : 'Hours', color: COLORS.text } }
            }
        }
    });
}

// --- EXPOSE TO WINDOW FOR HTML INLINE CONTROLLERS ---
if(typeof window !== "undefined") { window.boostColor = window.boostColor || boostColor; }
if(typeof window !== "undefined") { window.withAlpha = window.withAlpha || withAlpha; }
if(typeof window !== "undefined") { window.renderTrajectoryChart = window.renderTrajectoryChart || renderTrajectoryChart; }
if(typeof window !== "undefined") { window.renderEnergyZoneChart = window.renderEnergyZoneChart || renderEnergyZoneChart; }
if(typeof window !== "undefined") { window.renderIdentityChart = window.renderIdentityChart || renderIdentityChart; }
if(typeof window !== "undefined") { window.renderCandlestickChart = window.renderCandlestickChart || renderCandlestickChart; }
if(typeof window !== "undefined") { window.renderContextualCharts = window.renderContextualCharts || renderContextualCharts; }
if(typeof window !== "undefined") { window.renderRadarChart = window.renderRadarChart || renderRadarChart; }
if(typeof window !== "undefined") { window.renderHourDistChart = window.renderHourDistChart || renderHourDistChart; }
if(typeof window !== "undefined") { window.renderWeeklyEffortChart = window.renderWeeklyEffortChart || renderWeeklyEffortChart; }
