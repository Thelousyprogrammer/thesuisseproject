/**
 * TELEMETRY CORE MODULE
 * Shared constants and global state
 */

const MASTER_GOAL = MASTER_TARGET_HOURS;
// TARGET_DEADLINE consolidated in dtr-core.js

// --- GLOBAL STATE ---
if (typeof window !== "undefined") {
    window.COLORS = window.COLORS || {};
    window.allLogs = window.allLogs || [];
    window.realLogs = window.realLogs || [];
    window.isSimulating = window.isSimulating || false;
    window.charts = window.charts || {};
}
let COLORS = window.COLORS;
let allLogs = window.allLogs;
let realLogs = window.realLogs;
let isSimulating = window.isSimulating;
let charts = window.charts;

// Week computation uses dtr-core.js getWeekNumber() with GMT+8 semantics.