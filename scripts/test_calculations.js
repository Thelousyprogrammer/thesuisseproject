const assert = require("assert");

// Mocking necessary constants and functions for the test environment
const MASTER_TARGET_HOURS = 500;
const DAILY_TARGET_HOURS = 8;
const TZ_OFFSET_MINUTES = 8 * 60; // GMT+8
const DAY_MS = 24 * 60 * 60 * 1000;
const OJT_START = new Date(2026, 0, 26); // Jan 26, 2026
const TARGET_DEADLINE = new Date(2026, 3, 25); // April 25, 2026

function pad2(n) { return String(n).padStart(2, "0"); }

function toGmt8DateKey(input) {
    if (!input) return null;
    const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
    if (isNaN(d.getTime())) return null;
    const shifted = new Date(d.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
    return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

function parseDateKeyGmt8(dateKey) {
    const m = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d) - (TZ_OFFSET_MINUTES * 60 * 1000));
}

function addDaysGmt8(date, n) { return new Date(date.getTime() + n * DAY_MS); }
function isWorkdayGmt8(date) {
    const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
    return shifted.getUTCDay() !== 0; // Sunday is 0
}

function calculateForecastUnified({ logs, paceOverride = null, todayOverride = null }) {
    const totalActualHours = (logs || []).reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
    const targetHours = MASTER_TARGET_HOURS;
    const remainingHours = Math.max(0, targetHours - totalActualHours);

    const start = parseDateKeyGmt8(toGmt8DateKey(OJT_START));
    const deadline = parseDateKeyGmt8(toGmt8DateKey(TARGET_DEADLINE));
    const today = todayOverride ? parseDateKeyGmt8(toGmt8DateKey(todayOverride)) : new Date();

    // Required Pace
    let workDaysRemaining = 0;
    for (let d = addDaysGmt8(today, 1); d <= deadline; d = addDaysGmt8(d, 1)) {
        if (isWorkdayGmt8(d)) workDaysRemaining++;
    }
    const requiredRate = workDaysRemaining > 0 ? remainingHours / workDaysRemaining : 0;

    // Cumulative Progress Vs Goal (Ideal hours to today)
    let idealHoursToDate = 0;
    for (let d = new Date(start.getTime()); d <= today; d = addDaysGmt8(d, 1)) {
        if (isWorkdayGmt8(d)) idealHoursToDate += DAILY_TARGET_HOURS;
    }
    idealHoursToDate = Math.min(targetHours, idealHoursToDate);

    // Projected Date
    const paceUsed = paceOverride !== null ? parseFloat(paceOverride) : 8;
    let projectedDate = new Date(today.getTime());
    let projHoursAccum = totalActualHours;
    let safety = 0;
    while (projHoursAccum < targetHours && safety < 5000) {
        safety++;
        projectedDate = addDaysGmt8(projectedDate, 1);
        if (isWorkdayGmt8(projectedDate)) projHoursAccum += paceUsed;
    }

    return {
        totalActualHours,
        remainingHours,
        workDaysRemaining,
        requiredRate,
        idealHoursToDate,
        projectedDateKey: toGmt8DateKey(projectedDate)
    };
}

// --- TESTS ---

console.log("Running Telemetry Calculation Validation...");

// Test Case 1: Fresh start
const result1 = calculateForecastUnified({ logs: [], todayOverride: "2026-01-26" });
assert.strictEqual(result1.totalActualHours, 0);
assert.strictEqual(result1.remainingHours, 500);
// Jan 26 to April 25: 
// Jan: 26 (Mon), 27 (Tue), 28 (Wed), 29 (Thu), 30 (Fri), 31 (Sat) = 6 days
// Feb: 28 days - 4 Sundays = 24 days
// Mar: 31 days - 5 Sundays = 26 days
// Apr: 25 days - 3 Sundays (5, 12, 19) = 22 days
// Total workdays: 6 + 24 + 26 + 22 = 78 days.
// Wait, Jan 26 is today, so workDaysRemaining is from Jan 27.
// Jan 27-31: 5 days.
// Total: 5 + 24 + 26 + 22 = 77 days.
assert.strictEqual(result1.workDaysRemaining, 77);
assert.ok(Math.abs(result1.requiredRate - (500 / 77)) < 0.01);

// Test Case 2: Halfway through with some progress
const sampleLogs = [
    { date: "2026-01-26", hours: 10 },
    { date: "2026-01-27", hours: 10 },
    { date: "2026-01-28", hours: 10 },
    { date: "2026-01-29", hours: 10 },
];
const result2 = calculateForecastUnified({ logs: sampleLogs, todayOverride: "2026-01-29" });
assert.strictEqual(result2.totalActualHours, 40);
assert.strictEqual(result2.remainingHours, 460);
assert.strictEqual(result2.idealHoursToDate, 32); // 4 workdays * 8h

// Test Case 3: Ahead of schedule
assert.strictEqual(result2.totalActualHours > result2.idealHoursToDate, true);

// Test Case 4: Required pace when behind
const behindLogs = [
    { date: "2026-01-26", hours: 4 },
    { date: "2026-01-27", hours: 4 }
];
const result3 = calculateForecastUnified({ logs: behindLogs, todayOverride: "2026-01-27" });
assert.strictEqual(result3.totalActualHours, 8);
assert.strictEqual(result3.idealHoursToDate, 16);
assert.ok(result3.requiredRate > 6.4); // 492 / (~76 days)

// Test Case 5: Goal reached
const finisherLogs = Array(63).fill({ hours: 8 }); // 63 * 8 = 504
const result4 = calculateForecastUnified({ logs: finisherLogs, todayOverride: "2026-03-25" });
assert.strictEqual(result4.remainingHours, 0);
assert.strictEqual(result4.requiredRate, 0);

console.log("✅ All Telemetry Logic Validation Tests Passed!");
