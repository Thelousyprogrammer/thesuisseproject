/**
 * TELEMETRY CORE MODULE
 * Shared constants and global state
 */

const MASTER_GOAL = MASTER_TARGET_HOURS;
// TARGET_DEADLINE consolidated in dtr-core.js

// --- GLOBAL STATE ---
let COLORS = {};
let allLogs = [];
let realLogs = []; 
let isSimulating = false;
let charts = {};

// Week computation uses dtr-core.js getWeekNumber() with GMT+8 semantics.