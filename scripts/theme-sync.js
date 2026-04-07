/**
 * Shared theme sync helper (frontend-only).
 * Uses localStorage as source of truth and syncs across tabs via storage/BroadcastChannel.
 */
(function () {
    const DEFAULT_THEME = "f1";
    const ALLOWED_THEMES = new Set(["f1", "f1-light", "cadillac", "apx", "mclaren", "ferrari", "kiki", "ztmy"]);
    const THEME_KEY = "user-theme";
    const EVENT_KEY = "user-theme-updated-at";
    const BC_NAME = "dtr-theme-sync";
    const bc = (typeof BroadcastChannel !== "undefined") ? new BroadcastChannel(BC_NAME) : null;

    function sanitizeTheme(themeName) {
        const raw = String(themeName || "").trim().toLowerCase();
        return ALLOWED_THEMES.has(raw) ? raw : DEFAULT_THEME;
    }

    function applyDomTheme(themeName) {
        const safeTheme = sanitizeTheme(themeName);
        document.documentElement.setAttribute("data-theme", safeTheme);
        try {
            localStorage.setItem(THEME_KEY, safeTheme);
        } catch (_) {}
        return safeTheme;
    }

    function notifyThemeChanged(themeName) {
        try {
            localStorage.setItem(EVENT_KEY, String(Date.now()));
        } catch (_) {}
        try {
            if (bc) bc.postMessage({ theme: themeName });
        } catch (_) {}
    }

    function getLocalTheme() {
        try {
            return sanitizeTheme(localStorage.getItem(THEME_KEY));
        } catch (_) {
            return DEFAULT_THEME;
        }
    }

    function emitChange(themeName) {
        try {
            document.dispatchEvent(new CustomEvent("theme:changed", { detail: { theme: themeName } }));
        } catch (_) {}
    }

    async function setTheme(themeName, options = {}) {
        const safeTheme = applyDomTheme(themeName);
        if (options.broadcast !== false) {
            notifyThemeChanged(safeTheme);
        }
        emitChange(safeTheme);
        return safeTheme;
    }

    function bindCrossTabSync() {
        if (window.__dtrThemeSyncBound) return;
        window.__dtrThemeSyncBound = true;

        window.addEventListener("storage", (event) => {
            if (event.key !== THEME_KEY && event.key !== EVENT_KEY) return;
            const current = document.documentElement.getAttribute("data-theme");
            const next = getLocalTheme();
            if (next !== current) {
                applyDomTheme(next);
                emitChange(next);
            }
        });

        if (bc) {
            bc.addEventListener("message", (event) => {
                const incoming = sanitizeTheme(event && event.data && event.data.theme);
                const current = document.documentElement.getAttribute("data-theme");
                if (incoming !== current) {
                    applyDomTheme(incoming);
                    emitChange(incoming);
                }
            });
        }
    }

    bindCrossTabSync();

    window.ThemeSync = {
        DEFAULT_THEME,
        sanitizeTheme,
        getLocalTheme,
        setTheme
    };
})();