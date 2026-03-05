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

document.addEventListener("theme:changed", () => {
    setTimeout(() => {
        COLORS = getThemeValues();
        renderTelemetry(Array.isArray(allLogs) ? allLogs : []);
    }, 50);
});

let telemetryOnScreenObserver = null;

function replayChartAnimationForCanvas(canvas) {
    if (!canvas || typeof charts !== "object") return;
    const chartList = Object.values(charts || {});
    const instance = chartList.find((c) => c && c.canvas === canvas);
    if (!instance || typeof instance.reset !== "function" || typeof instance.update !== "function") return;
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
    
    select.innerHTML = '<option value="all">Full OJT Period</option>';
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
    safeUpdate("completionDateText", `Projected: ${formatGmt8DateLabel(f.projectedDate, { month: "long", day: "numeric", year: "numeric" })}`);

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
            statusMsg.innerText = `"Goal already reached."`;
            statusMsg.style.color = COLORS.excellent;
        } else if (paceSufficient) {
            statusMsg.innerText = `"At ${pace.toFixed(1)}h/day, you finish by ${projectedLabel}."`;
            statusMsg.style.color = COLORS.good;
        } else {
            statusMsg.innerText = `"${pace.toFixed(1)}h/day is insufficient. Target ${Math.ceil(f.requiredRate)}h+."`;
            statusMsg.style.color = COLORS.accent;
        }
    }
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
    Object.values(charts).forEach(c => { if(c && typeof c.destroy === 'function') c.destroy(); });
    charts = {};

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
            statusMsg.innerText = f.isAhead
                ? `"On track to finish by ${formatGmt8DateLabel(f.projectedDate, { month: "short", day: "numeric" })}."`
                : `"Required pace higher than current. Increase hours."`;
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
        initTelemetryEntranceAnimations();
    }
}

// --- CALCULATIONS ---

function handleHealthIndicators(logs) {
    let fatigueRisk = 0;
    const sorted = [...allLogs].sort((a,b) => (toGmt8DateKey(a.date) || "").localeCompare(toGmt8DateKey(b.date) || ""));
    
    let consecutiveHigh = 0;
    for (const r of sorted) {
        if (r.hours > 8) consecutiveHigh++;
        else consecutiveHigh = 0;
        if (consecutiveHigh >= 3) fatigueRisk++; 
    }

    const fatLabel = document.getElementById("fatigueLabel");
    if (fatLabel) {
        const fatInd = document.getElementById("fatigueIndicator");
        const fatNote = document.getElementById("fatigueNote");
        if (fatigueRisk === 0) {
            if (fatInd) fatInd.innerText = "🟢";
            fatLabel.innerText = "Stable";
            fatLabel.style.color = COLORS.good;
            if (fatNote) fatNote.innerText = "Performance is sustainable";
        } else if (fatigueRisk < 3) {
            if (fatInd) fatInd.innerText = "🟠";
            fatLabel.innerText = "Accumulating Fatigue";
            fatLabel.style.color = COLORS.warning;
            if (fatNote) fatNote.innerText = "High load detected";
        } else {
            if (fatInd) fatInd.innerText = "🚩";
            fatLabel.innerText = "Burnout Risk";
            fatLabel.style.color = COLORS.accent;
            if (fatNote) fatNote.innerText = "CRITICAL: Rest Required";
        }
    }

    const avgTotalHours = logs.length > 0 ? logs.reduce((s,r) => s + r.hours + (r.personalHours||0), 0) / logs.length : 0;
    const cogLabel = document.getElementById("cogLabel");
    const cogInd = document.getElementById("cogIndicator");
    const cogNote = document.getElementById("cogNote");

    if (cogLabel) {
        if (avgTotalHours > 12) {
            cogInd.innerText = "⚠️";
            cogLabel.innerText = "System Overload";
            cogLabel.style.color = COLORS.accent;
            cogNote.innerText = `Avg Load: ${avgTotalHours.toFixed(1)}h/day`;
        } else if (avgTotalHours > 9) {
            cogInd.innerText = "⚡";
            cogLabel.innerText = "High Engagement";
            cogLabel.style.color = COLORS.warning;
            cogNote.innerText = "Pushing boundaries";
        } else {
            cogInd.innerText = "✅";
            cogLabel.innerText = "Optimal";
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
        mStatus.innerText = momentum > 5 ? "ACCELERATING" : (momentum < -5 ? "SLOWING" : "STABLE");
        mStatus.style.color = momentum > 5 ? COLORS.good : (momentum < -5 ? COLORS.accent : COLORS.text);
    }

    let streak = 0;
    const sortedDesc = [...allLogs].sort((a,b) => (toGmt8DateKey(b.date) || "").localeCompare(toGmt8DateKey(a.date) || ""));
    for (const r of sortedDesc) {
        if (r.hours >= 8) streak++;
        else break;
    }
    safeUpdate("streakValue", `${streak} Days`);
}
