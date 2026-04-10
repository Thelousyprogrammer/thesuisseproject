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
        let fileLang = lang;
        if (lang === "zh") fileLang = "zh-Hans";

        const baseLang = lang.split('-')[0];
        const langsToTry = [fileLang];
        if (baseLang !== fileLang) langsToTry.push(baseLang);

        const extensions = ["toml", "json"];
        
        for (const l of langsToTry) {
            for (const ext of extensions) {
                try {
                    const response = await fetch(`${LOCALES_DIR}/${l}.${ext}`);
                    if (!response.ok) continue;

                    if (ext === "toml") {
                        const text = await response.text();
                        DICT[lang] = parseTOML(text);
                    } else {
                        DICT[lang] = await response.json();
                    }
                    
                    console.log(`[i18n] Loaded ${l}.${ext} for '${lang}'`);
                    return true;
                } catch (err) { /* silent fail */ }
            }
        }
        return false;
    }

    const FALLBACK_LANGS = {
        "zh-Hant": "zh-Hans",
        "pt-BR": "pt",
        "es-MX": "es",
        "fr-CA": "fr"
    };

    function t(keyPath, params = {}) {
        const chain = [CURRENT_LANG];
        if (FALLBACK_LANGS[CURRENT_LANG]) chain.push(FALLBACK_LANGS[CURRENT_LANG]);
        
        // Add "base" language if regional (e.g., de-CH -> de)
        const base = CURRENT_LANG.split('-')[0];
        if (base !== CURRENT_LANG && !chain.includes(base)) chain.push(base);
        
        // Final fallback: en
        if (!chain.includes("en")) chain.push("en");

        function find(d, kp) {
            if (!d || typeof d !== 'object') return null;
            // 1. Dotted
            let val = kp.split('.').reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), d);
            // 2. Clear flat key search (if no dots)
            if (!val && !kp.includes('.')) {
                if (d[kp] !== undefined && typeof d[kp] !== 'object') return d[kp];
                for (const table in d) {
                    if (d[table] && typeof d[table] === 'object' && d[table][kp] !== undefined) {
                        return d[table][kp];
                    }
                }
            }
            if (!val) val = d[kp] || null;
            return val;
        }

        let val = null;
        for (const lang of chain) {
            val = find(DICT[lang], keyPath);
            if (val) break;
        }

        if (!val) val = keyPath;

        // Enhanced Interpolation: Replace {key} with params[key]
        if (typeof val === "string" && params && typeof params === "object") {
            Object.keys(params).forEach(key => {
                const placeholder = new RegExp(`\\{${key}\\}`, "g");
                val = val.replace(placeholder, params[key]);
            });
        }

        return val;
    }

    // --- THE CORE API ---
    window.DTRI18N = {
        t: t,
        getDict: () => DICT[CURRENT_LANG],
        
        applyTranslations: function() {
            function getArgs(el) {
                const raw = el.getAttribute("data-i18n-args");
                if (!raw) return {};
                try { return JSON.parse(raw); } catch(e) { return {}; }
            }

            // Body text
            document.querySelectorAll("[data-i18n]").forEach(el => {
                const key = el.getAttribute("data-i18n");
                const translation = t(key, getArgs(el));
                if (translation !== key) {
                    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                        // Keep content as is
                    } else {
                        el.textContent = translation;
                    }
                }
            });

            // Attributes
            document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
                const key = el.getAttribute("data-i18n-placeholder");
                const translation = t(key, getArgs(el));
                if (translation !== key) el.placeholder = translation;
            });
            document.querySelectorAll("[data-i18n-title]").forEach(el => {
                const key = el.getAttribute("data-i18n-title");
                const translation = t(key, getArgs(el));
                if (translation !== key) el.title = translation;
            });

            console.log(`[i18n] Application Complete.`);
        },

        runMapper: function() {
            const elements = [
                ...document.querySelectorAll("[data-i18n]"),
                ...document.querySelectorAll("[data-i18n-placeholder]"),
                ...document.querySelectorAll("[data-i18n-title]")
            ];
            const currentDict = DICT[CURRENT_LANG] || DICT["en"] || {};

            elements.forEach(el => {
                const attrs = ["data-i18n", "data-i18n-placeholder", "data-i18n-title"];
                attrs.forEach(attr => {
                    if (!el.hasAttribute(attr)) return;
                    const currentKey = el.getAttribute(attr);
                    
                    // Skip if already mapped (has dot)
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
                        el.setAttribute(attr, foundPath);
                    } else {
                        // console.warn(`[i18n] Key "${currentKey}" not found in any TOML table.`);
                    }
                });
            });
            this.applyTranslations();
        },

        renderLanguageSelector: function() {
            const selector = document.getElementById("languageSelect");
            if (!selector) return;

            // Complete list of supported languages
            const langs = [
                { code: "en", label: "English" },
                { code: "de", label: "Deutsch" },
                { code: "es", label: "Español" },
                { code: "fr", label: "Français" },
                { code: "it", label: "Italiano" },
                { code: "pt", label: "Português" },
                { code: "vi", label: "Tiếng Việt" },
                { code: "ms", label: "Bahasa Melayu" },
                { code: "id", label: "Bahasa Indonesia" },
                { code: "tl", label: "Tagalog" },
                { code: "zh-Hans", label: "简体中文" },
                { code: "zh-Hant", label: "繁體中文" },
                { code: "ja", label: "日本語" }
            ];

            selector.innerHTML = "";
            langs.forEach(l => {
                const opt = document.createElement("option");
                opt.value = l.code;
                opt.textContent = l.label;
                if (l.code === CURRENT_LANG) opt.selected = true;
                selector.appendChild(opt);
            });

            selector.onchange = (e) => this.setLanguage(e.target.value);
            console.log("[i18n] Language Selector Rendered.");
        },

        bootstrap: async function() {
            const savedLang = localStorage.getItem(STORAGE_KEY);
            // Default to 'en' or browser lang if supported
            CURRENT_LANG = savedLang || "en";
            
            await loadLocale("en");
            if (CURRENT_LANG !== "en") {
                const success = await loadLocale(CURRENT_LANG);
                if (!success) CURRENT_LANG = "en";
            }
            
            this.renderLanguageSelector();
            this.runMapper();
            document.dispatchEvent(new CustomEvent("dtr:languageChanged", { detail: { lang: CURRENT_LANG } }));
        },
    
        setLanguage: async function(lang) {
            const success = await loadLocale(lang);
            if (success) {
                CURRENT_LANG = lang;
                localStorage.setItem(STORAGE_KEY, lang);
                this.runMapper();
                document.dispatchEvent(new CustomEvent("dtr:languageChanged", { detail: { lang: lang } }));
            }
        }
    };
})();