/**
 * DTR I18N MODULE (Phase 1)
 * Languages: en, es, pt, fr, de, it, ja, zh-Hans, zh-Hant, id, ms, vi, tl
 */

(function () {
    const STORAGE_KEY = "dtr-language";
    const LOCALES_DIR = "locales";
    const SUPPORTED_LANGUAGES = [
        { code: "en", label: "English" },
        { code: "es", label: "Espa\u00f1ol" },
        { code: "pt", label: "Portugu\u00eas" },
        { code: "fr", label: "Fran\u00e7ais" },
        { code: "de", label: "Deutsch" },
        { code: "it", label: "Italiano" },
        { code: "ja", label: "\u65e5\u672c\u8a9e" },
        { code: "zh-Hans", label: "\u4e2d\u6587\uff08\u7b80\u4f53\uff09" },
        { code: "zh-Hant", label: "\u4e2d\u6587\uff08\u7e41\u9ad4\uff09" },
        { code: "id", label: "Bahasa Indonesia" },
        { code: "ms", label: "Bahasa Melayu" },
        { code: "vi", label: "Ti\u1ebfng Vi\u1ec7t" },
        { code: "tl", label: "Tagalog" }
    ];

    const DICT = {
        en: {
            language: "Language",
            app_title: "Custom Daily Time Record (DTR)",
            app_subtitle: "Formula 1 Delta System • Target-Based Productivity Telemetry",
            faq: "FAQ",
            dtr_theme: "DTR Theme",
            theme_formula1: "Formula 1",
            theme_cadillac: "Cadillac",
            theme_apx: "APX GP",
            theme_mclaren: "McLaren",
            theme_ferrari: "Ferrari",
            theme_kiki: "Kiki",
            ojt_timeline_settings: "OJT Timeline Settings",
            starting_date: "Starting Date",
            required_ojt_hours: "Required OJT Hours",
            semester_end_date: "Semester End Date",
            timezone: "Timezone",
            save_timeline_settings: "Save Timeline Settings",
            ojt_start_help: "Used as week 1 anchor for viewer, graphs, and telemetry.",
            ojt_required_help: "Used for overall target, remaining hours, and forecast completion.",
            ojt_end_help: "Forecasting and required pace are computed up to this date.",
            ojt_tz_help: "Used to interpret date boundaries and \"today\" for week/forecast calculations.",
            session_input: "Session Input",
            dtr_date: "DTR Date",
            hours_worked: "Hours Worked",
            daily_reflection: "Daily Reflection",
            accomplishments_per_line: "Accomplishments (one per line)",
            tools_used: "Tools Used (comma separated)",
            upload_images: "Upload Images",
            level2_telemetry: "Level 2 Telemetry (Advanced)",
            personal_project_hours: "Personal Project Hours",
            sleep_hours: "Sleep (Hours)",
            recovery_hours: "Recovery Hours",
            identity_alignment: "Identity Alignment (1-5)",
            total_commute_min: "Total Commute (min)",
            productive_commute_min: "Productive Commute (min)",
            not_set: "Not Set",
            reflection_viewer: "Reflection Viewer",
            reflection_viewer_subtitle: "All saved reflections for quick review and export",
            daily_performance_graph: "Daily Performance Graph",
            weekly_summary_graph: "Weekly Summary Graph",
            telemetry_view: "Telemetry View",
            dtr_exports: "DTR Exports",
            storage_capacity: "Storage Capacity",
            save_day: "Save Day",
            delete_last_entry: "Delete Last Entry",
            clear_all_records: "Clear All Records",
            clear_dtr_form: "Clear DTR Form",
            import_record_json: "Import Record (.json)",
            export_all: "Export All",
            export_docx: "Export .docx",
            export_json: "Export .json",
            export_week_pdf: "Export Week .pdf",
            export_week_docx: "Export Week .docx",
            all_entries: "All Entries",
            by_week: "By Week",
            sort_by: "Sort by",
            view: "View",
            less: "Less",
            more: "More",
            week: "Week",
            all_weeks: "All Weeks",
            current_week: "Current Week",
            week_label: "Week {week}",
            no_reflections_saved: "No reflections saved yet.",
            placeholder_hours_example: "e.g. 8",
            placeholder_reflection: "What did you learn today?",
            placeholder_accomplishments: "Implemented UI\nFixed bug in script",
            placeholder_tools: "VS Code, Chrome, Git",
            placeholder_required_hours: "e.g. 500",
            placeholder_deep_work_hours: "Deep work hours",
            placeholder_last_night_rest: "last night's rest",
            placeholder_rest_recharge: "Rest/Recharge",
            placeholder_total_time: "Total time",
            placeholder_time_spent_working: "Time spent working",
            placeholder_edit_accomplishments: "Task A\nTask B",
            placeholder_edit_tools: "VS Code, Chrome",
            placeholder_export_filename: "DTR_Record_Name_YYYY-MM-DD.json",
            no_records_to_export: "No records to export.",
            no_records_to_delete: "No records to delete.",
            confirm_delete_latest: "Delete the most recent DTR entry?",
            deleted_latest_success: "Last DTR entry deleted.",
            confirm_clear_all: "This will delete ALL DTR records. Continue?",
            cleared_all_success: "All DTR records cleared.",
            invalid_date_hours: "Please enter a valid date and number of hours.",
            date_before_start: "DTR Date cannot be earlier than OJT Starting Date ({startDate}).",
            saved_and_cleared: "Daily DTR saved and form cleared!",
            storage_full_try_optimize: "Storage full! Try:\n- Run \"Optimize Storage\" to compress images\n- Remove images from older records\n- Export and clear some data",
            failed_to_save_prefix: "Failed to save: ",
            storage_full_primary_unavailable: "Storage full and primary storage is unavailable. Please free space and try again.",
            failed_to_save_records_prefix: "Failed to save records: ",
            some_images_failed_store: "Some images failed to store ({count}). Saving only successfully uploaded images.",
            failed_to_save_images_idb_confirm: "Failed to save images to IndexedDB. Save DTR without images?",
            submission_cancelled: "Submission cancelled.",
            incoming_existing_dates_invalid: "Incoming and existing dates must both be valid and different.",
            date_already_used: "One of the selected dates is already used by another record.",
            save_without_images_confirm: "Save without images to free space?",
            choose_valid_starting_date: "Please choose a valid starting date.",
            enter_valid_required_hours: "Please enter a valid Required OJT Hours value (minimum 1).",
            choose_valid_semester_end_date: "Please choose a valid Semester End Date.",
            semester_end_before_start: "Semester End Date cannot be earlier than Starting Date.",
            choose_valid_timezone: "Please choose a valid timezone.",
            confirm_start_date_change: "You are changing the OJT starting date from {oldDate} to {newDate}. Week mapping, graphs, and forecasts will be updated. Continue?",
            confirm_wipe_when_start_advanced: "The new starting date ({newDate}) is ahead of your original date ({oldDate}). All saved DTR data will be wiped. Continue?",
            unable_save_start_date: "Unable to save starting date. Please use YYYY-MM-DD format.",
            unable_save_required_hours: "Unable to save Required OJT Hours.",
            unable_save_semester_end: "Unable to save Semester End Date.",
            unable_save_timezone: "Unable to save timezone.",
            timeline_saved_with_wipe: "Timeline saved: {start} | Required: {hours}h | End: {end} | TZ: {tz}\n\nAll DTR records were wiped because the new start date is ahead of the original date.",
            timeline_saved: "Timeline saved: {start} | Required: {hours}h | End: {end} | TZ: {tz}",
            docx_deps_not_loaded: "DOCX export dependencies are not loaded.",
            docx_export_failed: "DOCX export failed. Check console for details.",
            no_weekly_records_for_filter: "No weekly records found for the selected filter.",
            weekly_docx_export_failed: "Weekly DOCX export failed. Check console for details.",
            imported_record_loaded: "Imported record loaded into Session Input. Click Save Day to persist it.",
            no_valid_record_in_json: "No valid record found in this JSON file.",
            json_no_valid_record_format: "JSON parsed, but no valid record format was found.",
            failed_parse_json: "Failed to parse JSON file.",
            failed_read_selected_file: "Failed to read selected file.",
            target_images: "Target Images",
            batch_processing: "Batch processing",
            batch_processing_help: "Enable to select multiple records below.",
            records_local_to_idb: "Records: localStorage to IndexedDB",
            records_idb_to_local: "Records: IndexedDB to localStorage",
            remove_idb_duplicates: "Remove IDB Duplicates",
            optimize_db: "Optimize DB",
            restore_originals: "Restore Originals",
            import_record_preview: "Import Record Preview",
            cancel: "Cancel",
            confirm_import: "Confirm Import",
            confirm_ojt_timeline_settings: "Confirm OJT Timeline Settings",
            ojt_apply_help: "Applying this will refresh week mapping, graphs, and forecast calculations.",
            confirm: "Confirm",
            edit_dtr_record: "Edit DTR Record",
            replace_images_optional: "Replace Images (optional)",
            save_changes: "Save Changes",
            pdf_preview: "PDF Preview",
            close: "Close",
            download_pdf: "Download PDF",
            json_export_preview: "JSON Export Preview",
            filename: "Filename",
            download_json: "Download JSON"
        }
    };
    const _localeLoaded = Object.create(null);

    DICT.es = { ...DICT.en, language: "Idioma", save_day: "Guardar dia", clear_all_records: "Borrar todo", reflection_viewer: "Visor de reflexiones", all_weeks: "Todas las semanas", current_week: "Semana actual", week_label: "Semana {week}" };
    DICT.pt = { ...DICT.en, language: "Idioma", save_day: "Salvar dia", clear_all_records: "Limpar tudo", reflection_viewer: "Visualizador de reflexoes", all_weeks: "Todas as semanas", current_week: "Semana atual", week_label: "Semana {week}" };
    DICT.fr = { ...DICT.en, language: "Langue", save_day: "Enregistrer la journee", clear_all_records: "Tout effacer", reflection_viewer: "Visionneuse de reflexions", all_weeks: "Toutes les semaines", current_week: "Semaine actuelle", week_label: "Semaine {week}" };
    DICT.de = { ...DICT.en, language: "Sprache", save_day: "Tag speichern", clear_all_records: "Alles loeschen", reflection_viewer: "Reflexionsansicht", all_weeks: "Alle Wochen", current_week: "Aktuelle Woche", week_label: "Woche {week}" };
    DICT.it = { ...DICT.en, language: "Lingua", save_day: "Salva giorno", clear_all_records: "Cancella tutto", reflection_viewer: "Visualizzatore riflessioni", all_weeks: "Tutte le settimane", current_week: "Settimana corrente", week_label: "Settimana {week}" };
    DICT.ja = { ...DICT.en, language: "\u8a00\u8a9e", save_day: "\u4fdd\u5b58", clear_all_records: "\u5168\u3066\u6d88\u53bb", reflection_viewer: "\u632f\u308a\u8fd4\u308a\u30d3\u30e5\u30fc\u30a2", all_weeks: "\u5168\u9031", current_week: "\u4eca\u9031", week_label: "\u7b2c{week}\u9031" };
    DICT["zh-Hans"] = { ...DICT.en, language: "\u8bed\u8a00", save_day: "\u4fdd\u5b58\u5f53\u65e5", clear_all_records: "\u6e05\u7a7a\u6240\u6709", reflection_viewer: "\u53cd\u601d\u67e5\u770b\u5668", all_weeks: "\u6240\u6709\u5468", current_week: "\u672c\u5468", week_label: "\u7b2c {week} \u5468" };
    DICT["zh-Hant"] = { ...DICT.en, language: "\u8a9e\u8a00", save_day: "\u5132\u5b58\u7576\u65e5", clear_all_records: "\u6e05\u9664\u5168\u90e8", reflection_viewer: "\u53cd\u601d\u6aa2\u8996\u5668", all_weeks: "\u6240\u6709\u9031", current_week: "\u672c\u9031", week_label: "\u7b2c {week} \u9031" };
    DICT.id = { ...DICT.en, language: "Bahasa", save_day: "Simpan hari", clear_all_records: "Hapus semua", reflection_viewer: "Penampil refleksi", all_weeks: "Semua minggu", current_week: "Minggu ini", week_label: "Minggu {week}" };
    DICT.ms = { ...DICT.en, language: "Bahasa", save_day: "Simpan hari", clear_all_records: "Padam semua", reflection_viewer: "Paparan refleksi", all_weeks: "Semua minggu", current_week: "Minggu semasa", week_label: "Minggu {week}" };
    DICT.vi = { ...DICT.en, language: "Ngon ngu", save_day: "Luu ngay", clear_all_records: "Xoa tat ca", reflection_viewer: "Trinh xem phan hoi", all_weeks: "Tat ca tuan", current_week: "Tuan hien tai", week_label: "Tuan {week}" };
    DICT.tl = { ...DICT.en, language: "Wika", save_day: "I-save ang araw", clear_all_records: "Burahin lahat", reflection_viewer: "Viewer ng pagninilay", all_weeks: "Lahat ng linggo", current_week: "Kasalukuyang linggo", week_label: "Linggo {week}" };

    function interpolate(template, params) {
        if (!params) return template;
        return String(template).replace(/\{(\w+)\}/g, (_, key) =>
            Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`
        );
    }

    function detectLanguage() {
        const nav = (navigator.language || "en").toLowerCase();
        if (nav.startsWith("zh")) {
            const region = nav.split("-")[1] || "";
            if (region === "cn") return "zh-Hans";
            if (["tw", "hk", "mo", "sg"].includes(region)) return "zh-Hant";
            return "zh-Hant";
        }
        const root = nav.split("-")[0];
        const map = {
            es: "es", pt: "pt", fr: "fr", de: "de", it: "it", ja: "ja",
            id: "id", ms: "ms", vi: "vi", tl: "tl", fil: "tl", en: "en"
        };
        return map[root] || "en";
    }

    function getCurrentLanguage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && DICT[saved]) return saved;
        return detectLanguage();
    }

    function getDictionary(lang) {
        return DICT[lang] || DICT.en;
    }

    function t(key, params) {
        const lang = getCurrentLanguage();
        const dict = getDictionary(lang);
        const raw = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : (DICT.en[key] || key);
        return interpolate(raw, params);
    }

    function tf(key, fallback, params) {
        const val = t(key, params);
        if (val === key && typeof fallback === "string") return interpolate(fallback, params);
        return val;
    }

    function applyLanguageClass(lang) {
        const html = document.documentElement;
        html.setAttribute("lang", lang === "zh-Hans" ? "zh-CN" : lang === "zh-Hant" ? "zh-TW" : lang);
        html.classList.toggle("lang-cjk", ["ja", "zh-Hans", "zh-Hant"].includes(lang));
    }

    async function loadLocale(lang) {
        const safeLang = DICT[lang] ? lang : "en";
        if (_localeLoaded[safeLang]) return true;
        try {
            const res = await fetch(`${LOCALES_DIR}/${safeLang}.json`, { cache: "no-cache" });
            if (!res.ok) {
                _localeLoaded[safeLang] = true;
                return false;
            }
            const data = await res.json();
            if (data && typeof data === "object" && !Array.isArray(data)) {
                DICT[safeLang] = { ...DICT.en, ...DICT[safeLang], ...data };
            }
            _localeLoaded[safeLang] = true;
            return true;
        } catch (_) {
            _localeLoaded[safeLang] = true;
            return false;
        }
    }

    function applyTranslations() {
        const lang = getCurrentLanguage();
        applyLanguageClass(lang);
        document.querySelectorAll("[data-i18n]").forEach((node) => {
            const key = node.getAttribute("data-i18n");
            if (!key) return;
            node.textContent = t(key);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
            const key = node.getAttribute("data-i18n-placeholder");
            if (!key) return;
            node.setAttribute("placeholder", t(key));
        });
    }

    function initLanguageSelector() {
        const select = document.getElementById("languageSelect");
        if (!select) return;
        select.innerHTML = "";
        SUPPORTED_LANGUAGES.forEach((entry) => {
            const option = document.createElement("option");
            option.value = entry.code;
            option.textContent = entry.label;
            select.appendChild(option);
        });
        select.value = getCurrentLanguage();
        select.addEventListener("change", async () => {
            localStorage.setItem(STORAGE_KEY, select.value);
            await loadLocale(select.value);
            applyTranslations();
            document.dispatchEvent(new CustomEvent("dtr:languageChanged", { detail: { language: select.value } }));
        });
    }

    async function bootstrap() {
        const lang = getCurrentLanguage();
        await loadLocale("en");
        if (lang !== "en") await loadLocale(lang);
        initLanguageSelector();
        applyTranslations();
    }

    window.DTRI18N = {
        t,
        tf,
        loadLocale,
        bootstrap,
        setLanguage(lang) {
            if (!DICT[lang]) return false;
            localStorage.setItem(STORAGE_KEY, lang);
            applyTranslations();
            document.dispatchEvent(new CustomEvent("dtr:languageChanged", { detail: { language: lang } }));
            return true;
        },
        getLanguage: getCurrentLanguage,
        getLanguages: () => [...SUPPORTED_LANGUAGES],
        applyTranslations,
        initLanguageSelector,
        getWeekLabel(week) {
            return t("week_label", { week });
        }
    };
})();
