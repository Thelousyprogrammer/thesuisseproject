/**
 * DTR CORE MODULE
 * Configuration, Models, and Fundamental Utilities
 */

const MASTER_TARGET_HOURS = 500;
const DAILY_TARGET_HOURS = 8;
const GREAT_DELTA_THRESHOLD = 2;
const DEFAULT_OJT_START = new Date(2026, 0, 26);
let OJT_START = new Date(DEFAULT_OJT_START.getTime());
const DEFAULT_SEMESTER_END = new Date(2026, 3, 25); // April 25
const DEFAULT_TIMEZONE = "UTC";

const DTR_COLORS = {
    neutral: "var(--color-neutral)",
    warning: "var(--color-warning)",
    good: "var(--color-good)",
    excellent: "var(--color-excellent)"
};

let dailyRecords = []; // Global state for the DTR app
let editingIndex = null;
let currentSortMode = "date-asc";
let currentReflectionViewMode = "all";
const REQUIRED_OJT_HOURS_MIN = 1;

class DailyRecord {
    constructor(date, hours, reflection, accomplishments, tools, images = [], l2Data = {}, imageIds = []) {
        this.date = date;
        this.hours = hours;
        this.delta = hours - DAILY_TARGET_HOURS;
        this.reflection = reflection;
        this.accomplishments = accomplishments;
        this.tools = tools;
        this.images = images;
        this.imageIds = imageIds;

        this.personalHours = parseFloat(l2Data.personalHours) || 0;
        this.sleepHours = parseFloat(l2Data.sleepHours) || 0;
        this.recoveryHours = parseFloat(l2Data.recoveryHours) || 0;
        this.commuteTotal = parseFloat(l2Data.commuteTotal) || 0;
        this.commuteProductive = parseFloat(l2Data.commuteProductive) || 0;
        this.identityScore = parseInt(l2Data.identityScore) || null;
    }
}

// --- UTILITIES ---

const DAY_MS = 24 * 60 * 60 * 1000;
const warnedInvalidDateInputs = new Set();
let _cachedTimeZoneIds = null;

function pad2(n) {
    return String(n).padStart(2, "0");
}

function warnInvalidDateInput(input) {
    const key = String(input);
    if (warnedInvalidDateInputs.has(key)) return;
    warnedInvalidDateInputs.add(key);
    console.warn("Skipping invalid date input:", input);
}

function toGmt8DateKey(input) {
    if (input == null) return null;
    if (typeof input === "string") {
        const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }

    const d = input instanceof Date ? new Date(input.getTime()) : new Date(input);
    if (Number.isNaN(d.getTime())) {
        warnInvalidDateInput(input);
        return null;
    }
    const tz = getCurrentTimeZone();
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return year && month && day ? `${year}-${month}-${day}` : null;
}

function getOjtSettings() {
    try {
        return JSON.parse(localStorage.getItem("dtrSettings") || "{}") || {};
    } catch (_) {
        return {};
    }
}

function saveOjtSettings(next) {
    const merged = { ...getOjtSettings(), ...(next || {}) };
    localStorage.setItem("dtrSettings", JSON.stringify(merged));
}

function getCurrentOjtStartDate() {
    const settings = getOjtSettings();
    const key = toGmt8DateKey(settings.ojtStartDate || OJT_START || DEFAULT_OJT_START);
    return key || toGmt8DateKey(DEFAULT_OJT_START);
}

function getKnownTimeZoneIds() {
    if (_cachedTimeZoneIds) return _cachedTimeZoneIds;
    const fromIntl = (typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function")
        ? Intl.supportedValuesOf("timeZone")
        : [];
    const supplemental = [
        "UTC",
        "Etc/GMT-12",
        "Etc/GMT-11",
        "Etc/GMT-10",
        "Etc/GMT-9",
        "Etc/GMT-8",
        "Etc/GMT-7",
        "Etc/GMT-6",
        "Etc/GMT-5",
        "Etc/GMT-4",
        "Etc/GMT-3",
        "Etc/GMT-2",
        "Etc/GMT-1",
        "Etc/GMT",
        "Etc/GMT+1",
        "Etc/GMT+2",
        "Etc/GMT+3",
        "Etc/GMT+4",
        "Etc/GMT+5",
        "Etc/GMT+6",
        "Etc/GMT+7",
        "Etc/GMT+8",
        "Etc/GMT+9",
        "Etc/GMT+10",
        "Etc/GMT+11",
        "Etc/GMT+12",
        "Etc/GMT+13",
        "Etc/GMT+14"
    ];
    _cachedTimeZoneIds = [...new Set([...fromIntl, ...supplemental])]
        .filter((tz) => !/^Etc\/GMT(?:[+-]\d{1,2})?$/.test(tz))
        .sort((a, b) => a.localeCompare(b));
    return _cachedTimeZoneIds;
}

function getTimeZoneOffsetMinutes(timeZoneId, referenceDate = new Date()) {
    if (!isValidTimeZoneId(timeZoneId)) return 0;
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timeZoneId,
            timeZoneName: "shortOffset"
        }).formatToParts(referenceDate);
        const zoneName = (parts.find((p) => p.type === "timeZoneName") || {}).value || "GMT";
        if (zoneName === "GMT" || zoneName === "UTC") return 0;
        const m = zoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
        if (!m) return 0;
        const sign = m[1] === "-" ? -1 : 1;
        const hh = parseInt(m[2], 10) || 0;
        const mm = parseInt(m[3] || "0", 10) || 0;
        return sign * (hh * 60 + mm);
    } catch (_) {
        return 0;
    }
}

function formatUtcOffset(minutes) {
    if (minutes === 0) return "UTC 00:00";
    const sign = minutes < 0 ? " -" : " +";
    const abs = Math.abs(minutes);
    const hh = pad2(Math.floor(abs / 60));
    const mm = pad2(abs % 60);
    return `UTC${sign}${hh}:${mm}`;
}

function formatGmtOffset(minutes) {
    if (minutes === 0) return "GMT 00:00";
    const sign = minutes < 0 ? " -" : "+";
    const abs = Math.abs(minutes);
    const hh = pad2(Math.floor(abs / 60));
    const mm = pad2(abs % 60);
    return `GMT${sign}${hh}:${mm}`;
}

function buildTimeZoneDisplayLabel(timeZoneId, offsetMinutes) {
    const utcLabel = formatUtcOffset(offsetMinutes);
    const gmtLabel = formatGmtOffset(offsetMinutes);
    return `(${utcLabel} | ${gmtLabel}) ${timeZoneId}`;
}

function getTimeZoneOptionsByOffset(referenceDate = new Date()) {
    return getKnownTimeZoneIds()
        .map((id) => {
            const offsetMinutes = getTimeZoneOffsetMinutes(id, referenceDate);
            return {
                id,
                offsetMinutes,
                offsetLabel: formatUtcOffset(offsetMinutes),
                label: buildTimeZoneDisplayLabel(id, offsetMinutes)
            };
        })
        .sort((a, b) => (a.offsetMinutes - b.offsetMinutes) || a.id.localeCompare(b.id));
}

function isValidTimeZoneId(tz) {
    if (!tz || typeof tz !== "string") return false;
    try {
        Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
        return true;
    } catch (_) {
        return false;
    }
}

function getCurrentTimeZone() {
    const settings = getOjtSettings();
    const raw = settings.timeZone;
    if (isValidTimeZoneId(raw)) return raw;
    return DEFAULT_TIMEZONE;
}

function applyTimeZone(timeZoneId) {
    if (!isValidTimeZoneId(timeZoneId)) return false;
    saveOjtSettings({ timeZone: timeZoneId });
    return true;
}

function getCurrentSemesterEndDate() {
    const settings = getOjtSettings();
    const key = toGmt8DateKey(settings.semesterEndDate || DEFAULT_SEMESTER_END);
    return key || toGmt8DateKey(DEFAULT_SEMESTER_END);
}

function getCurrentRequiredOjtHours() {
    const settings = getOjtSettings();
    const parsed = parseFloat(settings.requiredOjtHours);
    if (Number.isFinite(parsed) && parsed >= REQUIRED_OJT_HOURS_MIN) {
        return parsed;
    }
    return MASTER_TARGET_HOURS;
}

function applyOjtStartDate(startDateLike) {
    const key = toGmt8DateKey(startDateLike);
    if (!key) return false;
    const parsed = parseDateKeyGmt8(key);
    if (!parsed) return false;
    OJT_START = parsed;
    saveOjtSettings({ ojtStartDate: key });
    return true;
}

function applySemesterEndDate(endDateLike) {
    const key = toGmt8DateKey(endDateLike);
    if (!key) return false;
    saveOjtSettings({ semesterEndDate: key });
    return true;
}

function applyRequiredOjtHours(hoursLike) {
    const parsed = parseFloat(hoursLike);
    if (!Number.isFinite(parsed) || parsed < REQUIRED_OJT_HOURS_MIN) return false;
    saveOjtSettings({ requiredOjtHours: parsed });
    return true;
}

function hydrateOjtSettingsFromStorage() {
    const key = getCurrentOjtStartDate();
    const parsed = parseDateKeyGmt8(key);
    if (parsed) OJT_START = parsed;
    return {
        startDateKey: key,
        requiredHours: getCurrentRequiredOjtHours(),
        semesterEndDateKey: getCurrentSemesterEndDate(),
        timeZone: getCurrentTimeZone()
    };
}

function parseDateKeyGmt8(dateKey) {
    if (typeof dateKey !== "string") return null;
    const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        warnInvalidDateInput(dateKey);
        return null;
    }
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const utcMs = Date.UTC(y, m - 1, d, 0, 0, 0);
    const parsed = new Date(utcMs);
    if (Number.isNaN(parsed.getTime())) {
        warnInvalidDateInput(dateKey);
        return null;
    }
    return parsed;
}

function nowGmt8StartOfDay() {
    return parseDateKeyGmt8(toGmt8DateKey(new Date()));
}

function addDaysGmt8(date, n) {
    const baseKey = toGmt8DateKey(date);
    const baseDate = parseDateKeyGmt8(baseKey);
    if (!baseDate) return null;
    return new Date(baseDate.getTime() + (n * DAY_MS));
}

function diffDaysGmt8(a, b) {
    if (!a || !b) return 0;
    return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function getGmt8Weekday(date) {
    if (!date) return 0;
    return date.getUTCDay(); // 0=Sun ... 6=Sat
}

function isWorkdayGmt8(date) {
    if (!date) return false;
    return getGmt8Weekday(date) !== 0; // Exclude Sundays only (Mon-Sat workdays)
}

function countWorkdaysGmt8(start, endInclusive) {
    if (!start || !endInclusive) return 0;
    let count = 0;
    for (let d = new Date(start.getTime()); d <= endInclusive; d = addDaysGmt8(d, 1)) {
        if (isWorkdayGmt8(d)) count++;
    }
    return count;
}

function formatGmt8DateLabel(input, options = { month: "short", day: "numeric" }) {
    const key = toGmt8DateKey(input);
    if (!key) return "";
    const date = parseDateKeyGmt8(key);
    if (!date) return "";
    return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

function getWeekNumber(date, reference = OJT_START) {
    const d = parseDateKeyGmt8(toGmt8DateKey(date));
    const ref = parseDateKeyGmt8(toGmt8DateKey(reference));
    if (!d || !ref) return 1;
    const diff = d.getTime() - ref.getTime();
    if (diff < 0) return 1;
    return Math.floor(diff / (7 * DAY_MS)) + 1;
}

function getTotalHours() {
    return dailyRecords.reduce((sum, r) => sum + r.hours, 0);
}

function getOverallDelta() {
    return getTotalHours() - getCurrentRequiredOjtHours();
}

function getWeekHours(weekNumber) {
    return dailyRecords
        .filter(r => getWeekNumber(r.date) === weekNumber)
        .reduce((sum, r) => sum + r.hours, 0);
}

function getWeekDateRange(weekNumber) {
    const ref = parseDateKeyGmt8(toGmt8DateKey(OJT_START));
    const start = addDaysGmt8(ref, (weekNumber - 1) * 7);
    const end = addDaysGmt8(start, 6);
    const fmt = d => formatGmt8DateLabel(d, { month: "short", day: "numeric", year: "numeric" });
    return { start: fmt(start), end: fmt(end), startDate: start, endDate: end };
}

function getTodayFileName(prefix, ext) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${prefix}_${yyyy}-${mm}-${dd}.${ext}`;
}

function setTheme(themeName, options = {}) {
    const fallbackTheme = (window.ThemeSync && typeof window.ThemeSync.sanitizeTheme === "function")
        ? window.ThemeSync.sanitizeTheme(themeName)
        : (themeName || "f1");

    if (window.ThemeSync && typeof window.ThemeSync.setTheme === "function") {
        window.ThemeSync.setTheme(fallbackTheme, options)
            .then((appliedTheme) => {
                try { updateFavicon(appliedTheme); } catch (_) {}
                console.log("Theme synced:", appliedTheme);
            })
            .catch(() => {
                document.documentElement.setAttribute("data-theme", fallbackTheme);
                localStorage.setItem("user-theme", fallbackTheme);
                try { updateFavicon(fallbackTheme); } catch (_) {}
            });
        return;
    }

    document.documentElement.setAttribute("data-theme", fallbackTheme);
    localStorage.setItem("user-theme", fallbackTheme);
    try { updateFavicon(fallbackTheme); } catch (_) {}
    console.log("Theme synced:", fallbackTheme);
}

/**
 * Update the page favicon based on the active theme.
 * Looks for an element with id `site-favicon` and updates its href.
 */
function updateFavicon(themeName) {
    const map = {
        'f1': 'favicons/F1Favicon32.png',
        'cadillac': 'favicons/CaddyFavicon32.png',
        'apx': 'favicons/APXFavicon32.png',
        'mclaren': 'favicons/McLFavicon32.png',
        'kiki': 'favicons/KikiFavicon32.png',
        'ferrari': 'favicons/FerrariFavicon32.png'
        // fallback or other themes can be added here
    };
    const href = map[themeName] || map['f1'];
    let link = document.getElementById('site-favicon');
    if (!link) {
        link = document.querySelector('link[rel~="icon"]');
    }
    if (!link) {
        link = document.createElement('link');
        link.id = 'site-favicon';
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = href;
    link.type = 'image/png';
    link.sizes = '32x32';
}

function getIdentityAlignmentLabel(score) {
    const map = {
        0: "Not Set",
        1: "1 - Drifting",
        2: "2 - Re-centering",
        3: "3 - Aligned",
        4: "4 - Compounding",
        5: "5 - Mission Locked"
    };
    return map[parseInt(score, 10)] || map[0];
}

function normalizeForecastLogs(logs = dailyRecords) {
    const normalized = [];
    (logs || []).forEach((r) => {
        const dateKey = toGmt8DateKey(r && r.date);
        if (!dateKey) return;
        normalized.push({ ...r, dateKey, hours: parseFloat(r.hours) || 0 });
    });
    normalized.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    return normalized;
}

function calculateForecastUnified({
    logs = dailyRecords,
    paceOverride = null,
    startDate = OJT_START,
    deadlineDate = null,
    todayOverride = null
} = {}) {
    const targetHours = getCurrentRequiredOjtHours();
    const normalizedLogs = normalizeForecastLogs(logs);
    const totalActualHours = normalizedLogs.reduce((sum, r) => sum + (r.hours || 0), 0);
    const remainingHours = Math.max(0, targetHours - totalActualHours);

    const start = parseDateKeyGmt8(toGmt8DateKey(startDate));
    const effectiveDeadline = deadlineDate || getCurrentSemesterEndDate();
    const deadline = parseDateKeyGmt8(toGmt8DateKey(effectiveDeadline));
    const today = todayOverride ? parseDateKeyGmt8(toGmt8DateKey(todayOverride)) : nowGmt8StartOfDay();

    let idealHoursToDate = 0;
    if (start && today) {
        for (let d = new Date(start.getTime()); d <= today; d = addDaysGmt8(d, 1)) {
            if (isWorkdayGmt8(d)) idealHoursToDate += DAILY_TARGET_HOURS;
        }
    }
    idealHoursToDate = Math.min(targetHours, idealHoursToDate);
    const currentStatusDelta = totalActualHours - idealHoursToDate;

    let workDaysRemaining = 0;
    if (today && deadline) {
        for (let d = addDaysGmt8(today, 1); d && d <= deadline; d = addDaysGmt8(d, 1)) {
            if (isWorkdayGmt8(d)) workDaysRemaining++;
        }
    }
    const calendarDaysRemaining = today && deadline ? Math.max(0, diffDaysGmt8(today, deadline)) : 0;
    const requiredRate = workDaysRemaining > 0 ? (remainingHours / workDaysRemaining) : 0;

    let paceUsed = 8;
    if (paceOverride !== null && !Number.isNaN(parseFloat(paceOverride))) {
        paceUsed = Math.max(0.1, parseFloat(paceOverride));
    } else {
        const recentLogs = normalizedLogs.slice(-7);
        const recentAvg = recentLogs.length > 0
            ? recentLogs.reduce((s, r) => s + (r.hours || 0), 0) / recentLogs.length
            : 8;
        paceUsed = Math.max(0.1, recentAvg);
    }

    let projectedDate = today ? new Date(today.getTime()) : parseDateKeyGmt8(toGmt8DateKey(new Date()));
    let projHoursAccum = totalActualHours;
    let safety = 0;
    while (remainingHours > 0 && projHoursAccum < targetHours && safety < 5000) {
        safety++;
        projectedDate = addDaysGmt8(projectedDate, 1);
        if (isWorkdayGmt8(projectedDate)) projHoursAccum += paceUsed;
    }

    const projectedDateKey = toGmt8DateKey(projectedDate);
    const projectedDateLabel = formatGmt8DateLabel(projectedDate, { month: "short", day: "numeric", year: "numeric" });
    const isAhead = totalActualHours >= idealHoursToDate;

    return {
        totalActualHours,
        remainingHours,
        workDaysRemaining,
        calendarDaysRemaining,
        requiredRate,
        paceUsed,
        idealHoursToDate,
        currentStatusDelta,
        isAhead,
        projectedDateKey,
        projectedDateLabel,
        projectedDate,
        recentAvg: paceUsed,
        daysRemaining: calendarDaysRemaining,
        workDaysUntilDeadline: workDaysRemaining,
        targetHours
    };
}

function buildTrajectorySeries({ logs = dailyRecords, paceOverride = null, startDate = OJT_START, deadlineDate = null } = {}) {
    const effectiveDeadline = deadlineDate || getCurrentSemesterEndDate();
    const normalizedLogs = normalizeForecastLogs(logs);
    const forecast = calculateForecastUnified({ logs: normalizedLogs, paceOverride, startDate, deadlineDate: effectiveDeadline });
    const targetHours = forecast.targetHours;
    const start = parseDateKeyGmt8(toGmt8DateKey(startDate));
    const deadline = parseDateKeyGmt8(toGmt8DateKey(effectiveDeadline));
    const today = nowGmt8StartOfDay();
    const lastLogKey = normalizedLogs.length ? normalizedLogs[normalizedLogs.length - 1].dateKey : null;
    const lastLogDate = lastLogKey ? parseDateKeyGmt8(lastLogKey) : null;
    const projectionStartDate = lastLogDate && lastLogDate > today ? lastLogDate : today;

    const logMap = {};
    normalizedLogs.forEach((l) => { logMap[l.dateKey] = l.hours; });

    const labels = [];
    const labelDateKeys = [];
    const actualCumulative = [];
    const projectedCumulative = [];
    const idealCumulative = [];

    let currentSum = 0;
    let projSum = 0;
    let idealSum = 0;

    for (let d = new Date(start.getTime()); d <= deadline; d = addDaysGmt8(d, 1)) {
        const dateKey = toGmt8DateKey(d);
        labelDateKeys.push(dateKey);
        labels.push(formatGmt8DateLabel(d, { month: "short", day: "numeric" }));

        const dayHours = logMap[dateKey];
        if (dayHours !== undefined) currentSum += dayHours;

        if (d <= projectionStartDate) {
            actualCumulative.push(currentSum);
            if (!lastLogDate || d <= lastLogDate) projSum = currentSum;
            projectedCumulative.push(null);
        } else {
            actualCumulative.push(null);
            if (isWorkdayGmt8(d)) projSum += forecast.paceUsed;
            projectedCumulative.push(Math.round(projSum));
        }

        if (isWorkdayGmt8(d)) idealSum += DAILY_TARGET_HOURS;
        idealCumulative.push(Math.min(targetHours, idealSum));
    }

    return {
        labels,
        labelDateKeys,
        actualCumulative,
        projectedCumulative,
        idealCumulative,
        forecast
    };
}

function calculateForecast(logs = dailyRecords, overridePace = null) {
    return calculateForecastUnified({ logs, paceOverride: overridePace });
}


