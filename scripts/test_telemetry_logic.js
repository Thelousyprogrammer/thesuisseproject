const assert = require("assert");

const MASTER_TARGET_HOURS = 500;
const DAILY_TARGET_HOURS = 8;
const OJT_START = new Date(2026, 0, 26);
const TARGET_DEADLINE = new Date(2026, 3, 25);
const TZ_OFFSET_MINUTES = 8 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n) {
    return String(n).padStart(2, "0");
}

function toGmt8DateKey(input) {
    if (input == null) return null;
    if (typeof input === "string") {
        const m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    }
    const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    const shifted = new Date(d.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
    return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

function parseDateKeyGmt8(dateKey) {
    const m = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d) - (TZ_OFFSET_MINUTES * 60 * 1000));
}

function addDaysGmt8(date, n) {
    return new Date(date.getTime() + n * DAY_MS);
}

function diffDaysGmt8(a, b) {
    return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function getGmt8Weekday(date) {
    const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
    return shifted.getUTCDay();
}

function isWorkdayGmt8(date) {
    return getGmt8Weekday(date) !== 0;
}

function getWeekNumber(date, reference = OJT_START) {
    const d = parseDateKeyGmt8(toGmt8DateKey(date));
    const ref = parseDateKeyGmt8(toGmt8DateKey(reference));
    if (!d || !ref) return 1;
    const diff = d.getTime() - ref.getTime();
    if (diff < 0) return 1;
    return Math.floor(diff / (7 * DAY_MS)) + 1;
}

function normalizeForecastLogs(logs) {
    const out = [];
    logs.forEach((r) => {
        const key = toGmt8DateKey(r.date);
        if (!key) return;
        out.push({ ...r, dateKey: key, hours: parseFloat(r.hours) || 0 });
    });
    out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return out;
}

function calculateForecastUnified({ logs, paceOverride = null, todayOverride = null }) {
    const normalized = normalizeForecastLogs(logs || []);
    const totalActualHours = normalized.reduce((s, r) => s + r.hours, 0);
    const remainingHours = Math.max(0, MASTER_TARGET_HOURS - totalActualHours);

    const start = parseDateKeyGmt8(toGmt8DateKey(OJT_START));
    const deadline = parseDateKeyGmt8(toGmt8DateKey(TARGET_DEADLINE));
    const today = parseDateKeyGmt8(toGmt8DateKey(todayOverride || new Date()));

    let idealHoursToDate = 0;
    for (let d = new Date(start.getTime()); d <= today; d = addDaysGmt8(d, 1)) {
        if (isWorkdayGmt8(d)) idealHoursToDate += DAILY_TARGET_HOURS;
    }
    idealHoursToDate = Math.min(MASTER_TARGET_HOURS, idealHoursToDate);

    let workDaysRemaining = 0;
    for (let d = addDaysGmt8(today, 1); d <= deadline; d = addDaysGmt8(d, 1)) {
        if (isWorkdayGmt8(d)) workDaysRemaining++;
    }

    const calendarDaysRemaining = Math.max(0, diffDaysGmt8(today, deadline));
    const requiredRate = workDaysRemaining > 0 ? remainingHours / workDaysRemaining : 0;

    const recent = normalized.slice(-7);
    const inferred = recent.length ? recent.reduce((s, r) => s + r.hours, 0) / recent.length : 8;
    const paceUsed = paceOverride != null ? Math.max(0.1, parseFloat(paceOverride)) : Math.max(0.1, inferred);

    let projectedDate = new Date(today.getTime());
    let projectedTotal = totalActualHours;
    let safety = 0;
    while (remainingHours > 0 && projectedTotal < MASTER_TARGET_HOURS && safety < 5000) {
        safety++;
        projectedDate = addDaysGmt8(projectedDate, 1);
        if (isWorkdayGmt8(projectedDate)) projectedTotal += paceUsed;
    }

    return {
        remainingHours,
        workDaysRemaining,
        calendarDaysRemaining,
        requiredRate,
        paceUsed,
        idealHoursToDate,
        currentStatusDelta: totalActualHours - idealHoursToDate,
        projectedDateKey: toGmt8DateKey(projectedDate)
    };
}

function buildTrajectorySeries({ logs, paceOverride = null, todayOverride = null }) {
    const normalized = normalizeForecastLogs(logs || []);
    const f = calculateForecastUnified({ logs: normalized, paceOverride, todayOverride });
    const start = parseDateKeyGmt8(toGmt8DateKey(OJT_START));
    const deadline = parseDateKeyGmt8(toGmt8DateKey(TARGET_DEADLINE));
    const today = parseDateKeyGmt8(toGmt8DateKey(todayOverride || new Date()));
    const lastLogKey = normalized.length ? normalized[normalized.length - 1].dateKey : null;
    const lastLogDate = lastLogKey ? parseDateKeyGmt8(lastLogKey) : null;
    const projectionStart = lastLogDate && lastLogDate > today ? lastLogDate : today;

    const map = {};
    normalized.forEach((l) => { map[l.dateKey] = l.hours; });

    let current = 0;
    let proj = 0;
    const projectedCumulative = [];
    for (let d = new Date(start.getTime()); d <= deadline; d = addDaysGmt8(d, 1)) {
        const key = toGmt8DateKey(d);
        if (map[key] !== undefined) current += map[key];
        if (d <= projectionStart) {
            if (!lastLogDate || d <= lastLogDate) proj = current;
            projectedCumulative.push(null);
        } else {
            if (isWorkdayGmt8(d)) proj += f.paceUsed;
            projectedCumulative.push(Math.round(proj));
        }
    }
    return { projectedCumulative, forecast: f };
}

// 1) GMT+8 rollover correctness.
assert.strictEqual(toGmt8DateKey(new Date("2026-02-10T16:30:00Z")), "2026-02-11");
assert.strictEqual(toGmt8DateKey(new Date("2026-02-10T01:00:00Z")), "2026-02-10");

// 2) Sunday exclusion / Saturday inclusion.
const sat = parseDateKeyGmt8("2026-02-07");
const sun = parseDateKeyGmt8("2026-02-08");
assert.strictEqual(isWorkdayGmt8(sat), true);
assert.strictEqual(isWorkdayGmt8(sun), false);

// 3) Remaining day consistency.
const sampleLogs = [
    { date: "2026-01-26", hours: 8 },
    { date: "2026-01-27", hours: 8 },
    { date: "2026-01-28", hours: 8 },
    { date: "2026-02-02", hours: 6 },
    { date: "2026-02-03", hours: 7 }
];
const f = calculateForecastUnified({ logs: sampleLogs, todayOverride: "2026-02-10" });
assert.ok(f.calendarDaysRemaining >= f.workDaysRemaining);
assert.ok(f.requiredRate >= 0);

// 4) Deterministic projection.
const f1 = calculateForecastUnified({ logs: sampleLogs, todayOverride: "2026-02-10", paceOverride: 7.5 });
const f2 = calculateForecastUnified({ logs: sampleLogs, todayOverride: "2026-02-10", paceOverride: 7.5 });
assert.strictEqual(f1.projectedDateKey, f2.projectedDateKey);

// 5) Ideal-vs-actual sanity.
assert.ok(Number.isFinite(f.currentStatusDelta));
assert.ok(Number.isFinite(f.idealHoursToDate));

// 6) Deadline edge behavior.
const edge = calculateForecastUnified({ logs: [], todayOverride: "2026-04-26", paceOverride: 8 });
assert.ok(edge.workDaysRemaining >= 0);
assert.ok(edge.calendarDaysRemaining >= 0);
assert.ok(edge.requiredRate >= 0);

// 7) Empty logs no NaN and series stays valid.
const empty = calculateForecastUnified({ logs: [], todayOverride: "2026-02-10" });
assert.ok(Number.isFinite(empty.remainingHours));
const series = buildTrajectorySeries({ logs: [], todayOverride: "2026-02-10", paceOverride: 8 });
assert.ok(Array.isArray(series.projectedCumulative));
assert.ok(series.projectedCumulative.length > 0);

// Week-number GMT+8 stable check.
assert.strictEqual(getWeekNumber("2026-01-26"), 1);
assert.strictEqual(getWeekNumber("2026-02-02"), 2);

console.log("All unified telemetry logic tests passed.");