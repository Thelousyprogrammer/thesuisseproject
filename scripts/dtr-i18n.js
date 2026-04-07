(function () {
    const STORAGE_KEY = "dtr-language";
    const LOCALES_DIR = "locales";
    let DICT = {};
    let CURRENT_LANG = "en";

    // --- NANO TOML PARSER ---
    function parseTOML(text) {
        const result = {};
        let currentTable = result;
        text.split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            const tableMatch = line.match(/^\[(.+)\]$/);
            if (tableMatch) {
                const tableName = tableMatch[1];
                result[tableName] = result[tableName] || {};
                currentTable = result[tableName];
                return;
            }
            const kvMatch = line.match(/^([\w.-]+)\s*=\s*["'](.*)["']$/);
            if (kvMatch) {
                currentTable[kvMatch[1].trim()] = kvMatch[2].trim();
            }
        });
        return result;
    }

    async function loadLocale(lang) {
        try {
            const response = await fetch(`${LOCALES_DIR}/${lang}.toml`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const tomlText = await response.text();
            DICT[lang] = parseTOML(tomlText);
            console.log(`[i18n] Parsed: ${lang}.toml`);
            return true;
        } catch (err) {
            console.error(`[i18n] Load Error:`, err.message);
            return false;
        }
    }

    function t(keyPath) {
        const dict = DICT[CURRENT_LANG] || DICT["en"] || {};
        // Handles 'table.key'
        let val = keyPath.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), dict);

        // If not found by path, try a direct root lookup (for flat keys)
        if (!val) val = dict[keyPath];

        return val || keyPath;
    }

    // --- THE CORE API ---
    window.DTRI18N = {
        t: function(keyPath) {
        // Fallback to empty if DICT is not loaded yet
        const dict = DICT[CURRENT_LANG] || DICT["en"] || {};
        
        // Handle dot notation (e.g., "themes.light_off")
        const val = keyPath.split('.').reduce((obj, key) => 
            (obj && obj[key] !== undefined ? obj[key] : null), dict);
            
        // If not found in a table, try a direct root lookup
        if (!val) {
            // New: search all tables for the flat key if it doesn't have a dot
            if (!keyPath.includes('.')) {
                for (const table in dict) {
                    if (dict[table][keyPath]) return dict[table][keyPath];
                }
            }
            return dict[keyPath] || keyPath; // Return the key itself as a fallback
        }
        return val;
        },
        getDict: () => DICT[CURRENT_LANG],
        
        applyTranslations: function() {
            document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            const translation = t(key);
            if (translation !== key) {
                el.textContent = translation;
                }
            });
            console.log(`[i18n] Reflection Complete.`);
        },

    runMapper: function() {
        const elements = document.querySelectorAll("[data-i18n]");
        const currentDict = DICT[CURRENT_LANG] || {};

        elements.forEach(el => {
            const currentKey = el.getAttribute("data-i18n");
            
            // If the key already has a dot (e.g., 'meta.app_title'), skip mapping
            if (currentKey.includes('.')) return;

            // Deep Search: Find which table owns this key
            let foundPath = null;
            for (const table in currentDict) {
                if (typeof currentDict[table] === 'object' && currentDict[table][currentKey]) {
                    foundPath = `${table}.${currentKey}`;
                    break;
                }
            }

            if (foundPath) {
                el.setAttribute("data-i18n", foundPath);
            } else {
                console.warn(`[i18n] Key "${currentKey}" not found in any TOML table.`);
            }
        });
        this.applyTranslations();
    },

    renderLanguageSelector: function() {
        const selector = document.getElementById("languageSelect");
        if (!selector) return;

        // Supported languages for customDTR
        const langs = [
            { code: "en", label: "English" },
            { code: "es", label: "Español" },
            { code: "ja", label: "日本語" },
            { code: "tl", label: "Tagalog" },
            { code: "pt", label: "Português" },
            { code: "zh", label: "简体中文" }
        ];

        selector.innerHTML = ""; // Clear existing
        langs.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.code;
            opt.textContent = l.label;
            if (l.code === CURRENT_LANG) opt.selected = true;
            selector.appendChild(opt);
        });

        // Add the change listener
        selector.onchange = (e) => this.setLanguage(e.target.value);
        console.log("[i18n] Language Selector Rendered.");
    },

    bootstrap: async function() {
            CURRENT_LANG = localStorage.getItem(STORAGE_KEY) || "en";
            await loadLocale("en");
            if (CURRENT_LANG !== "en") await loadLocale(CURRENT_LANG);
            
            this.renderLanguageSelector(); // <--- ADD THIS
            this.runMapper();
        },
    
    setLanguage: async function(lang) {
        await loadLocale(lang);
        CURRENT_LANG = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        this.runMapper();
        }
    };
})();