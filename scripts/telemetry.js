/**
 * TELEMETRY MAIN CONTROLLER
 */

document.addEventListener("DOMContentLoaded", async () => {
    const loader = document.getElementById("loadingOverlay");
    if (loader) loader.style.display = "flex";

    if (typeof hydrateOjtSettingsFromStorage === "function") {
        hydrateOjtSettingsFromStorage();
    }

    await initThemeSwitcher();
    COLORS = getThemeValues();
    syncTelemetryF1LightToggleLabel();

    try {
        allLogs = await fetchTelemetryData();
        populateWeekSelector(allLogs);
        renderTelemetry(allLogs);
        initTelemetryEntranceAnimations();
    } catch (err) {
        console.error("Telemetry Sync Failed:", err);
    } finally {
        if (loader) setTimeout(() => { loader.style.display = "none"; }, 800);
    }
});

// --- CORE UTILITIES ---

function getThemeValues() {
    const style = getComputedStyle(document.documentElement);
    return {
        accent: style.getPropertyValue('--accent').trim() || '#ff1e00',
        excellent: style.getPropertyValue('--level-3').trim() || '#FF00FF',
        good: style.getPropertyValue('--level-2').trim() || '#00FF00',
        warning: style.getPropertyValue('--level-1').trim() || '#FFF000',
        text: style.getPropertyValue('--text').trim() || '#ffffff',
        grid: style.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.05)',
        fill: style.getPropertyValue('--chart-fill').trim() || 'rgba(255,255,255,0.02)',
        fontBody: style.getPropertyValue('--font-body').trim() || 'monospace',
        fontHeading: style.getPropertyValue('--font-heading').trim() || 'sans-serif'
    };
}

async function initThemeSwitcher() {
    const localTheme = (window.ThemeSync && typeof window.ThemeSync.getLocalTheme === "function")
        ? window.ThemeSync.getLocalTheme()
        : (localStorage.getItem("user-theme") || "f1");

    setTelemetryTheme(localTheme, { broadcast: false, rerender: false });
}

function setTelemetryTheme(themeName, options = {}) {
    const opts = { rerender: true, ...options };
    const done = (appliedTheme) => {
        try { if (typeof updateFavicon === "function") updateFavicon(appliedTheme); } catch (_) {}
        if (!opts.rerender) return;
        setTimeout(() => {
            COLORS = getThemeValues();
            renderTelemetry(Array.isArray(allLogs) ? allLogs : []);
        }, 50);
    };

    if (window.ThemeSync && typeof window.ThemeSync.setTheme === "function") {
        window.ThemeSync.setTheme(themeName, options)
            .then(done)
            .catch(() => {
                document.documentElement.setAttribute("data-theme", themeName);
                localStorage.setItem("user-theme", themeName);
                done(themeName);
            });
        return;
    }

    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem("user-theme", themeName);
    done(themeName);
}

function syncTelemetryF1LightToggleLabel() {
    const btn = document.getElementById("telemetryF1LightToggleBtn");
    if (!btn) return;
    const activeTheme = (window.ThemeSync && typeof window.ThemeSync.getLocalTheme === "function")
        ? window.ThemeSync.getLocalTheme()
        : (localStorage.getItem("user-theme") || "f1");
    const isF1Family = activeTheme === "f1" || activeTheme === "f1-light";
    if (!isF1Family) {
        btn.textContent = "Light: N/A";
        btn.setAttribute("aria-pressed", "false");
        btn.disabled = true;
        return;
    }
    btn.disabled = false;
    const isLight = activeTheme === "f1-light";
    btn.textContent = (isLight ? "Light: On" : "Light: Off");
    btn.setAttribute("aria-pressed", isLight ? "true" : "false");
}

function toggleTelemetryF1LightMode() {
    const activeTheme = (window.ThemeSync && typeof window.ThemeSync.getLocalTheme === "function")
        ? window.ThemeSync.getLocalTheme()
        : (localStorage.getItem("user-theme") || "f1");
    if (activeTheme !== "f1" && activeTheme !== "f1-light") return;
    const nextTheme = activeTheme === "f1-light" ? "f1" : "f1-light";
    setTelemetryTheme(nextTheme);
}

document.addEventListener("theme:changed", () => {
    setTimeout(() => {
        COLORS = getThemeValues();
        renderTelemetry(Array.isArray(allLogs) ? allLogs : []);
        syncTelemetryF1LightToggleLabel();
    }, 50);
});

document.addEventListener("dtr:languageChanged", () => {
    renderTelemetry(Array.isArray(allLogs) ? allLogs : []);
});

let telemetryOnScreenObserver = null;

function withSequentialLineDelays(animations) {
    const source = animations && typeof animations === "object" ? animations : {};
    const addDelay = (cfg) => ({
        ...(cfg || {}),
        delay(ctx) {
            if (!ctx || ctx.type !== "data") return 0;
            const dsType = (ctx.dataset && ctx.dataset.type) || (ctx.chart && ctx.chart.config && ctx.chart.config.type) || "";
            const type = String(dsType).toLowerCase();
            if (type !== "line" && type !== "radar") return 0;
            const ds = Number.isFinite(ctx.datasetIndex) ? ctx.datasetIndex : 0;
            const pt = Number.isFinite(ctx.dataIndex) ? ctx.dataIndex : 0;
            return ds * 240 + pt * 16;
        }
    });

    return {
        ...source,
        x: addDelay(source.x),
        y: addDelay(source.y)
    };
}

function replayChartAnimationForCanvas(canvas) {
    if (!canvas || typeof charts === 'undefined' || !charts) return;
    const chartId = canvas.id;
    let instance = null;
    for (let k in charts) {
        if (charts[k] && charts[k].canvas === canvas) {
            instance = charts[k];
            break;
        }
    }
    if (!instance || typeof instance.reset !== "function" || typeof instance.update !== "function") return;

    const profileByChartId = {
        trajectoryChart: {
            animation: { duration: 1350, easing: "easeOutExpo" },
            animations: {
                x: { duration: 900, easing: "easeOutCubic", from: 0 },
                y: { duration: 1350, easing: "easeOutExpo", from: 0 }
            }
        },
        deltaChart: {
            animation: { duration: 1000, easing: "easeOutCubic" },
            animations: {
                x: {
                    duration: 650,
                    easing: "easeOutSine",
                    from: 0
                },
                y: {
                    duration: 1000,
                    easing: "easeOutCubic",
                    from: 0
                }
            }
        },
        hourDistChart: {
            animation: { duration: 1100, easing: "easeOutBack" },
            animations: {
                rotate: {
                    duration: 1100,
                    easing: "easeOutBack",
                    from: -1.5
                },
                scale: {
                    duration: 800,
                    easing: "easeOutCubic",
                    from: 0.65
                }
            }
        },
        dayVelocityRadar: {
            animation: { duration: 980, easing: "easeOutQuart" },
            animations: {
                x: {
                    duration: 700,
                    easing: "easeOutQuad",
                    from: 0
                },
                y: {
                    duration: 980,
                    easing: "easeOutQuart",
                    from: 0
                }
            }
        },
        candlestickChart: {
            animation: { duration: 980, easing: "easeOutQuart" },
            animations: {
                x: {
                    duration: 600,
                    easing: "easeOutSine",
                    from: 0
                },
                y: {
                    duration: 980,
                    easing: "easeOutQuart",
                    from: 0
                }
            }
        },
        identityChart: {
            animation: { duration: 1150, easing: "easeOutQuart" },
            animations: {
                x: {
                    duration: 800,
                    easing: "easeOutCubic",
                    from: 0
                },
                y: {
                    duration: 1150,
                    easing: "easeOutExpo",
                    from: 0
                }
            }
        },
        energyZoneChart: {
            animation: { duration: 1250, easing: "easeOutBack" },
            animations: {
                x: {
                    duration: 700,
                    easing: "easeOutCubic",
                    from: 0
                },
                y: {
                    duration: 1250,
                    easing: "easeOutBack",
                    from: 0
                }
            }
        }
    };

    const profile = profileByChartId[chartId];
    if (profile && instance.options) {
        if (profile.animation) instance.options.animation = profile.animation;
        if (profile.animations) instance.options.animations = profile.animations;
    }
    if (instance.options) {
        instance.options.animations = withSequentialLineDelays(instance.options.animations);
    }

    try {
        instance.reset();
        instance.update();
    } catch (_) {}
}

function initTelemetryEntranceAnimations() {
    const cards = Array.from(document.querySelectorAll(".telemetry-page .stat-card, .telemetry-page .chart-card"));
    if (!cards.length) return;

    if (telemetryOnScreenObserver) {
        try { telemetryOnScreenObserver.disconnect(); } catch (_) {}
    }

    telemetryOnScreenObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            const card = entry.target;
            const canvas = card.querySelector("canvas");

            if (entry.isIntersecting) {
                card.classList.add("telemetry-anim-in");
                if (canvas) replayChartAnimationForCanvas(canvas);
                return;
            }

            // Off-screen: reset so the element can animate again on re-entry.
            card.classList.remove("telemetry-anim-in");
        });
    }, { threshold: 0.22, rootMargin: "0px 0px -8% 0px" });

    cards.forEach((card, idx) => {
        card.classList.add("telemetry-anim-ready");
        card.classList.remove("telemetry-anim-in");
        card.style.setProperty("--telemetry-stagger", `${Math.min(idx * 40, 480)}ms`);
        telemetryOnScreenObserver.observe(card);
    });
}

// --- UI UTILITIES ---

const safeUpdate = (id, value, color = null) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (value !== null) el.innerText = value;
    if (color !== null) el.style.color = color;
};

function fetchTelemetryData() {
    return new Promise(async (resolve) => {
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

        const cleaned = logs.map(l => ({
            ...l,
            hours: parseFloat(l.hours) || 0,
            personalHours: parseFloat(l.personalHours) || 0,
            identityScore: parseInt(l.identityScore) || 0
        }));
        realLogs = JSON.parse(JSON.stringify(cleaned));
        setTimeout(() => resolve(cleaned), 300);
    });
}

function populateWeekSelector(logs) {
    const select = document.getElementById("weekSelect");
    if (!select) return;
    
    const allWeeksLabel = "Full OJT Period";
    select.innerHTML = `<option value="all">${allWeeksLabel}</option>`;
    if (!logs || logs.length === 0) return;

    const weeks = [...new Set(logs.map(r => getWeekNumber(r.date)))].sort((a,b) => b-a);
    
    weeks.forEach(w => {
        const opt = document.createElement("option");
        opt.value = w;
        opt.innerText = `Week ${w}`;
        select.appendChild(opt);
    });
}

function updateView() {
    const select = document.getElementById("weekSelect");
    if (!select) return;
    const val = select.value;
    let filtered = allLogs;
    if (val !== "all") {
        filtered = allLogs.filter(r => getWeekNumber(r.date) == val);
    }
    renderTelemetry(filtered, val);
}

function updateTargetPace(val) {
    const pace = parseFloat(val);
    const display = document.getElementById("paceSliderVal");
    if (display) display.innerText = pace.toFixed(1);

    if (charts.trajectory && typeof buildTrajectorySeries === "function") {
        const series = buildTrajectorySeries({ logs: allLogs, paceOverride: pace });
        charts.trajectory.data.labels = series.labels;
        charts.trajectory.data.datasets[0].data = series.actualCumulative;
        charts.trajectory.data.datasets[1].data = series.projectedCumulative;
        charts.trajectory.data.datasets[2].data = series.idealCumulative;

        const projected = series.projectedCumulative.filter((v) => v != null);
        const actual = series.actualCumulative.filter((v) => v != null);
        const targetHours = series && series.forecast && Number.isFinite(series.forecast.targetHours)
            ? series.forecast.targetHours
            : getCurrentRequiredOjtHours();
        const yMaxSource = Math.max(
            targetHours,
            actual.length ? Math.max(...actual) : 0,
            projected.length ? Math.max(...projected) : 0
        );
        if (charts.trajectory.options && charts.trajectory.options.scales && charts.trajectory.options.scales.y) {
            charts.trajectory.options.scales.y.max = Math.ceil(yMaxSource / 50) * 50 + 50;
        }
        charts.trajectory.update("none");
    } else if (typeof renderTrajectoryChart === "function") {
        renderTrajectoryChart(allLogs, pace);
    }

    const f = calculateForecastUnified({ logs: allLogs, paceOverride: pace });
    const projectedLabelLong = formatGmt8DateLabel(f.projectedDate, { month: "long", day: "numeric", year: "numeric" });
    safeUpdate("completionDateText", `Projected: ${projectedLabelLong}`);

    const paceSufficient = f.remainingHours <= 0 || pace >= f.requiredRate;
    const defEl = document.getElementById("timeDeficitText");
    if (defEl) {
        if (f.remainingHours <= 0) {
            defEl.innerHTML = `Simulation: <strong>Goal Reached</strong>`;
            defEl.style.color = COLORS.excellent;
        } else if (!paceSufficient) {
            defEl.innerHTML = `Simulation: <strong>Below Target Pace</strong>`;
            defEl.style.color = COLORS.accent;
        } else {
            defEl.innerHTML = `Simulation: <strong>On Track</strong>`;
            defEl.style.color = COLORS.good;
        }
    }

    const statusMsg = document.getElementById("paceStatusMsg");
    if (statusMsg) {
        const projectedLabel = formatGmt8DateLabel(f.projectedDate, { month: "short", day: "numeric" });
        if (f.remainingHours <= 0) {
            statusMsg.innerText = `Goal already reached.`;
            statusMsg.style.color = COLORS.excellent;
        } else if (paceSufficient) {
            statusMsg.innerText = `At ${pace.toFixed(1)}h/day, you finish by ${projectedLabel}.`;
            statusMsg.style.color = COLORS.good;
        } else {
            statusMsg.innerText = `${pace.toFixed(1)}h/day is insufficient. Target ${Math.ceil(f.requiredRate)}h+.`;
            statusMsg.style.color = COLORS.accent;
        }
    }

    // Update Health Predictions
    handleHealthIndicators(allLogs, pace);
}

function resetPaceSlider() {
    const slider = document.getElementById("paceSlider");
    if (slider) {
        slider.value = 8.0;
        updateTargetPace(8.0);
    }
}

// --- MAIN RENDER LOOP ---

function renderTelemetry(logs, selectedWeek = "all") {
    const today = nowGmt8StartOfDay();
    if (typeof charts !== 'undefined' && charts) {
        for (let k in charts) {
            if (charts[k] && typeof charts[k].destroy === 'function') {
                charts[k].destroy();
            }
            delete charts[k];
        }
    }

    if (!logs) logs = [];

    const f = calculateForecastUnified({ logs: allLogs });

    safeUpdate("totalRenderedText", `${Math.round(f.totalActualHours)}h`);
    safeUpdate("remainingHoursText", `${Math.round(f.remainingHours)}h`);
    const defEl = document.getElementById("timeDeficitText");
    if (defEl) {
        const d = f.currentStatusDelta;
        const absD = Math.abs(d).toFixed(1);
        if (d > 0) {
            defEl.innerHTML = `Ahead (+${absD}h)`;
            defEl.style.color = COLORS.good;
        } else if (d < 0) {
            defEl.innerHTML = `Behind (-${absD}h)`;
            defEl.style.color = COLORS.accent;
        } else {
            defEl.innerHTML = `On Track`;
            defEl.style.color = COLORS.text;
        }
    }

    safeUpdate("completionDateText", formatGmt8DateLabel(f.projectedDate, { month: "short", day: "numeric" }));
    safeUpdate("remHoursPace", `${Math.round(f.remainingHours)}h`);
    safeUpdate("remDaysPace", `${f.workDaysRemaining}`);
    safeUpdate("reqPaceValue", `${Math.ceil(f.requiredRate)}h/day`);
    safeUpdate("last7DayPace", `${Math.round(allLogs.slice(-7).reduce((s,r)=>s+r.hours,0)/Math.max(1, Math.min(7, allLogs.length)))}h/day`);

    const statusMsg = document.getElementById("paceStatusMsg");
    if (statusMsg) {
        if (f.remainingHours <= 0) {
            statusMsg.innerText = "Goal Reached! OJT Complete.";
            statusMsg.style.color = COLORS.excellent;
        } else {
            const projectedLabel = formatGmt8DateLabel(f.projectedDate, { month: "short", day: "numeric" });
            if (f.isAhead) {
                statusMsg.innerText = `On track to finish by ${projectedLabel}.`;
            } else {
                statusMsg.innerText = `Required pace higher than current. Increase hours.`;
            }
            statusMsg.style.color = f.isAhead ? COLORS.good : COLORS.accent;
        }
    }

    const filteredActual = logs.reduce((sum, r) => sum + r.hours, 0);
    const totalPlanned = logs.length * 8;
    const timeEfficiency = totalPlanned > 0 ? (filteredActual / totalPlanned) * 100 : 0;
    const totalBlocks = logs.reduce((sum, r) => sum + (r.accomplishments ? r.accomplishments.length : 0), 0);
    const energyEfficiency = filteredActual > 0 ? (totalBlocks / filteredActual) * 100 : 0;

    safeUpdate("timeEffValue", `${timeEfficiency.toFixed(1)}%`);
    safeUpdate("energyEffValue", `${energyEfficiency.toFixed(1)}%`);

    // --- FOCUS SCORE CALCULATION ---
    const avgIdentity = logs.length > 0 ? logs.reduce((sum, r) => sum + (r.identityScore || 0), 0) / logs.length : 0;
    const blocksPerHour = filteredActual > 0 ? totalBlocks / filteredActual : 0;
    const focusScore = (blocksPerHour * (avgIdentity / 5)) * 10;
    safeUpdate("focusScore", focusScore.toFixed(1));

    handleHealthIndicators(logs);

    const totalCommute = logs.reduce((sum, r) => sum + (r.commuteTotal || 0), 0);
    const prodCommute = logs.reduce((sum, r) => sum + (r.commuteProductive || 0), 0);
    const commuteEff = totalCommute > 0 ? (prodCommute / totalCommute) * 100 : 0;
    safeUpdate("commuteEff", `${commuteEff.toFixed(1)}%`);
    
    const weekLogs = logs.filter(r => (r.personalHours || 0) > 0);
    let consistencyFactor = weekLogs.length >= 4 ? 1.0 : (weekLogs.length >= 2 ? 0.7 : 0.4);
    const totalDeepHours = logs.reduce((sum, r) => sum + (r.personalHours || 0), 0);
    safeUpdate("deepWorkScore", (totalDeepHours * consistencyFactor).toFixed(1));

    const totalSleep = logs.reduce((sum, r) => sum + (r.sleepHours || 0), 0);
    safeUpdate("avgSleep", `${(logs.length > 0 ? totalSleep / logs.length : 0).toFixed(1)}h`);
    const totalRecovery = logs.reduce((sum, r) => sum + (r.recoveryHours || 0), 0);
    safeUpdate("avgRecovery", `${(logs.length > 0 ? totalRecovery / logs.length : 0).toFixed(1)}h`);
    safeUpdate("avgIdentity", `${avgIdentity.toFixed(1)} / 5`);
    const totalPersonal = logs.reduce((sum, r) => sum + (r.personalHours || 0), 0);
    const personalRatio = filteredActual > 0 ? (totalPersonal / filteredActual) * 100 : 0;
    safeUpdate("personalOjtRatio", `${personalRatio.toFixed(1)}%`);

    calculateMomentum(today);

    if (typeof Chart !== 'undefined') {
        Chart.defaults.color = COLORS.text;
        Chart.defaults.borderColor = COLORS.grid;
        Chart.defaults.font.family = COLORS.fontBody;

        const slider = document.getElementById("paceSlider");
        const currentPace = slider ? slider.value : null;
        if (slider) {
            const display = document.getElementById("paceSliderVal");
            if (display) display.innerText = parseFloat(slider.value).toFixed(1);
        }

        renderTrajectoryChart(allLogs, currentPace);
        renderIdentityChart(allLogs);
        renderEnergyZoneChart(logs);
        renderContextualCharts(logs, selectedWeek);
        renderRadarChart(logs);
        renderHourDistChart(logs);
        renderWeeklyEffortChart(allLogs);
        renderWeeklyMatrix(allLogs);
        initTelemetryEntranceAnimations();
    }
}

function renderWeeklyMatrix(logs) {
    const tbody = document.getElementById("telemetryWeeklyTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const weeklyData = {};
    logs.forEach(r => {
        const w = getWeekNumber(r.date);
        if (!weeklyData[w]) weeklyData[w] = { ojt: 0, personal: 0, count: 0 };
        weeklyData[w].ojt += r.hours;
        weeklyData[w].personal += (r.personalHours || 0);
        weeklyData[w].count++;
    });

    const sortedWeeks = Object.keys(weeklyData).map(Number).sort((a,b) => a - b);
    let prevHours = null;

    sortedWeeks.forEach(w => {
        const data = weeklyData[w];
        let growth = "-";
        if (prevHours !== null && prevHours > 0) {
            const diff = ((data.ojt - prevHours) / prevHours) * 100;
            growth = (diff >= 0 ? "+" : "") + diff.toFixed(1) + "%";
        }
        
        const eff = ((data.ojt / (data.count * 8)) * 100).toFixed(1) + "%";
        
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--grid)";
        tr.innerHTML = `
            <td style="padding: 8px;">Week ${w}</td>
            <td style="padding: 8px;">${data.ojt.toFixed(1)}h</td>
            <td style="padding: 8px;">${data.personal.toFixed(1)}h</td>
            <td style="padding: 8px; color: ${growth.startsWith('+') ? COLORS.good : (growth === '-' ? COLORS.text : COLORS.accent)}">${growth}</td>
            <td style="padding: 8px;">${eff}</td>
        `;
        tbody.appendChild(tr);
        prevHours = data.ojt;
    });
}

// --- CALCULATIONS ---

function handleHealthIndicators(logs, paceOverride = null) {
    let fatigueRisk = 0;
    const sorted = [...allLogs].sort((a,b) => (toGmt8DateKey(a.date) || "").localeCompare(toGmt8DateKey(b.date) || ""));
    
    // If paceOverride is provided, simulate a few future days to see impact
    const simulatedLogs = [...sorted];
    if (paceOverride !== null) {
        const pace = parseFloat(paceOverride);
        const lastDateKey = sorted.length > 0 ? (toGmt8DateKey(sorted[sorted.length - 1].date) || toGmt8DateKey(new Date())) : toGmt8DateKey(new Date());
        let lastDate = parseDateKeyGmt8(lastDateKey);

        for (let i = 1; i <= 7; i++) {
            const nextDate = addDaysGmt8(lastDate, i);
            if (isWorkdayGmt8(nextDate)) {
                simulatedLogs.push({
                    hours: pace,
                    personalHours: pace > 8 ? (pace - 8) * 0.5 : 0,
                    sleepHours: Math.max(4, 9 - (pace * 0.3)),
                    date: nextDate.toISOString()
                });
            }
        }
    }

    let consecutiveHigh = 0;
    for (const r of simulatedLogs) {
        if (r.hours > 8) consecutiveHigh++;
        else consecutiveHigh = 0;
        if (consecutiveHigh >= 3) fatigueRisk++; 
    }

    const fatLabel = document.getElementById("fatigueLabel");
    if (fatLabel) {
        const fatInd = document.getElementById("fatigueIndicator");
        const fatNote = document.getElementById("fatigueNote");
        const prefix = paceOverride !== null ? "Predicted: " : "";
        if (fatigueRisk === 0) {
            if (fatInd) fatInd.innerText = "🟢";
            fatLabel.innerText = prefix + "Stable";
            fatLabel.style.color = COLORS.good;
            if (fatNote) fatNote.innerText = "Performance is sustainable";
        } else if (fatigueRisk < 3) {
            if (fatInd) fatInd.innerText = "🟠";
            fatLabel.innerText = prefix + "Accumulating Fatigue";
            fatLabel.style.color = COLORS.warning;
            if (fatNote) fatNote.innerText = "High load detected";
        } else {
            if (fatInd) fatInd.innerText = "🚩";
            fatLabel.innerText = prefix + "Burnout Risk";
            fatLabel.style.color = COLORS.accent;
            if (fatNote) fatNote.innerText = "CRITICAL: Rest Required";
        }
    }

    const totalLogsForAvg = simulatedLogs.slice(-14); // Look at recent 14 days (actual + simulated)
    const avgTotalHours = totalLogsForAvg.length > 0 ? totalLogsForAvg.reduce((s,r) => s + r.hours + (r.personalHours||0), 0) / totalLogsForAvg.length : 0;
    const cogLabel = document.getElementById("cogLabel");
    const cogInd = document.getElementById("cogIndicator");
    const cogNote = document.getElementById("cogNote");

    if (cogLabel) {
        const prefix = paceOverride !== null ? "Predicted: " : "";
        if (avgTotalHours > 12) {
            cogInd.innerText = "⚠️";
            cogLabel.innerText = prefix + "System Overload";
            cogLabel.style.color = COLORS.accent;
            cogNote.innerText = `Avg Load: ${avgTotalHours.toFixed(1)}h/day`;
        } else if (avgTotalHours > 9) {
            cogInd.innerText = "⚡";
            cogLabel.innerText = prefix + "High Engagement";
            cogLabel.style.color = COLORS.warning;
            cogNote.innerText = "Pushing boundaries";
        } else {
            cogInd.innerText = "✅";
            cogLabel.innerText = prefix + "Optimal";
            cogLabel.style.color = COLORS.good;
            cogNote.innerText = "Steady mental state";
        }
    }
}

function calculateMomentum(today) {
    const oneDay = 24 * 60 * 60 * 1000;
    const now = addDaysGmt8(today, 1);
    
    const sevenDaysAgo = new Date(now.getTime() - (7 * oneDay));
    const fourteenDaysAgo = new Date(now.getTime() - (14 * oneDay));

    const sumHours = (start, end) => {
        return allLogs.reduce((sum, r) => {
            const d = parseDateKeyGmt8(toGmt8DateKey(r.date));
            if (!d) return sum;
            return (d > start && d <= end) ? sum + r.hours : sum;
        }, 0);
    };

    const currentVelocity = sumHours(sevenDaysAgo, now);
    const previousVelocity = sumHours(fourteenDaysAgo, sevenDaysAgo);

    let momentum = 0;
    if (previousVelocity > 0) {
        momentum = ((currentVelocity - previousVelocity) / previousVelocity) * 100;
    } else if (currentVelocity > 0) {
        momentum = 100;
    }

    safeUpdate("momentumValue", `${momentum > 0 ? "+" : ""}${momentum.toFixed(1)}%`, momentum >= 0 ? COLORS.good : COLORS.accent);
    
    const mStatus = document.getElementById("momentumStatus");
    if (mStatus) {
        if (momentum > 5) {
            mStatus.innerText = "ACCELERATING";
        } else if (momentum < -5) {
            mStatus.innerText = "SLOWING";
        } else {
            mStatus.innerText = "STABLE";
        }
        mStatus.style.color = momentum > 5 ? COLORS.good : (momentum < -5 ? COLORS.accent : COLORS.text);
    }

    let streak = 0;
    const sortedDesc = [...allLogs].sort((a,b) => (toGmt8DateKey(b.date) || "").localeCompare(toGmt8DateKey(a.date) || ""));
    for (const r of sortedDesc) {
        if (r.hours >= 8) streak++;
        else break;
    }
    const streakUnit = "Days";
    safeUpdate("streakValue", `${streak} ${streakUnit}`);
}
