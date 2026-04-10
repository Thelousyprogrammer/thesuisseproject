/**
 * DTR STORAGE AUX MODULE
 * Non-core storage utilities: migration, optimizer, restore, visualizer, and batch selectors.
 */

function getStorageEligibleRecordEntries(action = "all") {
    const entries = (Store.getRecords() || []).map((record, index) => ({ record, index }));
    if (action === "optimize") {
        return entries.filter((e) =>
            e.record && ((e.record.imageIds && e.record.imageIds.length) || (e.record.images && e.record.images.length))
        );
    }
    if (action === "restore") {
        return entries.filter((e) => e.record && e.record.imageIds && e.record.imageIds.length);
    }
    return entries.filter((e) =>
        e.record && ((e.record.imageIds && e.record.imageIds.length) || (e.record.images && e.record.images.length))
    );
}

function buildStorageRecordOptionLabel(entry) {
    const date = entry && entry.record && entry.record.date ? entry.record.date : `Record #${(entry.index || 0) + 1}`;
    const idbCount = entry && entry.record && entry.record.imageIds ? entry.record.imageIds.length : 0;
    const legacyCount = entry && entry.record && entry.record.images ? entry.record.images.length : 0;
    return `${date} | IndexedDB: ${idbCount} | Legacy: ${legacyCount}`;
}

function refreshStorageActionSelectors() {
    const single = document.getElementById("storageTargetSelect");
    const multi = document.getElementById("storageBatchSelect");
    if (!single || !multi) return;

    const entries = getStorageEligibleRecordEntries("all");
    const previousSingle = single.value || "__ALL__";
    const previousMulti = new Set(Array.from(multi.selectedOptions || []).map((o) => o.value));

    single.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "__ALL__";
    const allEligibleText = window.DTRI18N ? window.DTRI18N.t("all_eligible_records") : "All Eligible Records";
    allOption.textContent = `${allEligibleText} (${entries.length})`;
    single.appendChild(allOption);

    multi.innerHTML = "";
    entries.forEach((entry) => {
        const value = String(entry.index);
        const label = buildStorageRecordOptionLabel(entry);

        const singleOption = document.createElement("option");
        singleOption.value = value;
        singleOption.textContent = label;
        single.appendChild(singleOption);

        const multiOption = document.createElement("option");
        multiOption.value = value;
        multiOption.textContent = label;
        if (previousMulti.has(value)) multiOption.selected = true;
        multi.appendChild(multiOption);
    });

    if (single.querySelector(`option[value="${previousSingle}"]`)) {
        single.value = previousSingle;
    } else {
        single.value = "__ALL__";
    }
}

function toggleStorageBatchMode() {
    const checkbox = document.getElementById("storageBatchMode");
    const batchWrap = document.getElementById("storageBatchWrap");
    if (!checkbox || !batchWrap) return;
    batchWrap.style.display = checkbox.checked ? "block" : "none";
}

function getSelectedStorageTargetRecords(action = "all") {
    const eligibleEntries = getStorageEligibleRecordEntries(action);
    if (!eligibleEntries.length) return [];

    const batchMode = document.getElementById("storageBatchMode");
    const single = document.getElementById("storageTargetSelect");
    const multi = document.getElementById("storageBatchSelect");

    if (batchMode && batchMode.checked && multi) {
        const selectedIndexes = new Set(Array.from(multi.selectedOptions).map((o) => Number(o.value)));
        return eligibleEntries
            .filter((entry) => selectedIndexes.has(entry.index))
            .map((entry) => entry.record);
    }

    if (!single || single.value === "__ALL__") {
        return eligibleEntries.map((entry) => entry.record);
    }

    const selectedIndex = Number(single.value);
    return eligibleEntries
        .filter((entry) => entry.index === selectedIndex)
        .map((entry) => entry.record);
}

async function transferRecordsToIndexedDB(buttonEl) {
    if (typeof saveRecordsToStore !== "function") {
        const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
        alert(t ? t('idb_unavailable') : "IndexedDB record store is unavailable in this browser.");
        return;
    }

    const btn = buttonEl && buttonEl.tagName === "BUTTON" ? buttonEl : null;
    const originalText = btn ? btn.innerText : "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳";
    }

    try {
        let localRecords = [];
        try {
            localRecords = JSON.parse(localStorage.getItem("dtr") || "[]");
        } catch (_) {
            localRecords = [];
        }

        const sourceRecords = normalizeTransferRecords(localRecords);
        if (!sourceRecords.length) {
            alert("No localStorage records found to transfer.");
            return;
        }

        const transferMode = await chooseTransferModeModal({
            sourceLabel: "localStorage",
            targetLabel: "IndexedDB",
            recordCount: sourceRecords.length
        });
        if (!transferMode || transferMode.mode === "abort") return;

        let existingIdbRecords = [];
        try {
            const current = await getRecordsFromStore();
            existingIdbRecords = normalizeTransferRecords(current);
        } catch (_) {
            existingIdbRecords = [];
        }

        backupTransferSnapshot("idb", existingIdbRecords);
        const nextRecords = sourceRecords;
        const imageMigration = transferMode.includeImages
            ? await migrateTransferRecordImagesToIdb(nextRecords)
            : { records: normalizeTransferRecords(nextRecords), migratedImages: 0, failedImages: 0 };

        Store.setRecords(imageMigration.records);
        if (transferMode.mode === "replace" && typeof deleteImagesFromStore === "function") {
            const oldIds = collectTransferRecordImageIds(existingIdbRecords);
            const nextIds = collectTransferRecordImageIds(Store.getRecords());
            const idsToDelete = oldIds.filter((id) => !nextIds.includes(id));
            if (idsToDelete.length) {
                try { await deleteImagesFromStore(idsToDelete); } catch (_) {}
            }
        }
        if (typeof persistDTR === "function") {
            const ok = await persistDTR(Store.getRecords());
            if (!ok) throw new Error("Failed to persist transferred records.");
        } else {
            await saveRecordsToStore(Store.getRecords());
        }
        loadReflectionViewer();
        if (Store.getRecords().length) showSummary(Store.getRecords()[Store.getRecords().length - 1]);
        if (typeof renderDailyGraph === "function") renderDailyGraph();
        if (typeof renderWeeklyGraph === "function") renderWeeklyGraph();
        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        alert(
            `Transfer complete: ${Store.getRecords().length} record(s) in IndexedDB ` +
            `(replace mode).` +
            (transferMode.includeImages
                ? `\nImages migrated to IndexedDB: ${imageMigration.migratedImages}` +
                  (imageMigration.failedImages > 0 ? `\nImages kept as legacy fallback: ${imageMigration.failedImages}` : "")
                : `\nImage transfer skipped (records only).`)
        );
    } catch (err) {
        alert("Transfer to IndexedDB failed: " + (err && err.message ? err.message : err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

async function transferRecordsToLocalStorage(buttonEl) {
    if (typeof getRecordsFromStore !== "function") {
        const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
        alert(t ? t('idb_unavailable') : "IndexedDB record store is unavailable in this browser.");
        return;
    }

    const btn = buttonEl && buttonEl.tagName === "BUTTON" ? buttonEl : null;
    const originalText = btn ? btn.innerText : "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⏳";
    }

    try {
        const idbRecords = await getRecordsFromStore();
        const sourceRecords = normalizeTransferRecords(idbRecords);
        if (!sourceRecords.length) {
            alert("No IndexedDB records found to transfer.");
            return;
        }
        const transferMode = await chooseTransferModeModal({
            sourceLabel: "IndexedDB",
            targetLabel: "localStorage",
            recordCount: sourceRecords.length
        });
        if (!transferMode || transferMode.mode === "abort") return;

        let existingLocalRecords = [];
        try {
            existingLocalRecords = normalizeTransferRecords(JSON.parse(localStorage.getItem("localStorage") || "[]"));
        } catch (_) {
            existingLocalRecords = [];
        }
        backupTransferSnapshot("local", existingLocalRecords);
        const nextRecords = sourceRecords;
        const imageExpansion = transferMode.includeImages
            ? await expandTransferRecordImagesFromIdb(nextRecords)
            : { records: normalizeTransferRecords(nextRecords), embeddedImages: 0, missingImages: 0 };

        if (!safeSetDTR(imageExpansion.records)) {
            throw new Error("Failed to write records to localStorage.");
        }
        Store.setRecords(imageExpansion.records);
        loadReflectionViewer();
        if (Store.getRecords().length) showSummary(Store.getRecords()[Store.getRecords().length - 1]);
        if (typeof renderDailyGraph === "function") renderDailyGraph();
        if (typeof renderWeeklyGraph === "function") renderWeeklyGraph();
        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        alert(
            `Transfer complete: ${Store.getRecords().length} record(s) in localStorage ` +
            `(replace mode).` +
            (transferMode.includeImages
                ? `\nImages embedded to localStorage records: ${imageExpansion.embeddedImages}` +
                  (imageExpansion.missingImages > 0 ? `\nImage IDs missing in IndexedDB: ${imageExpansion.missingImages}` : "")
                : `\nImage transfer skipped (records only).`)
        );
    } catch (err) {
        alert("Transfer to localStorage failed: " + (err && err.message ? err.message : err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

function normalizeTransferRecord(raw) {
    if (!raw || typeof raw !== "object") return null;
    const dateKey = toGmt8DateKey(raw.date);
    const hours = parseFloat(raw.hours);
    if (!dateKey || !Number.isFinite(hours)) return null;

    return {
        ...raw,
        date: dateKey,
        hours,
        delta: Number.isFinite(parseFloat(raw.delta)) ? parseFloat(raw.delta) : (hours - DAILY_TARGET_HOURS),
        reflection: typeof raw.reflection === "string" ? raw.reflection : "",
        accomplishments: Array.isArray(raw.accomplishments)
            ? raw.accomplishments.map((a) => String(a || "").trim()).filter(Boolean)
            : [],
        tools: Array.isArray(raw.tools)
            ? raw.tools.map((t) => String(t || "").trim()).filter(Boolean)
            : [],
        images: Array.isArray(raw.images) ? raw.images.filter((i) => typeof i === "string") : [],
        imageIds: Array.isArray(raw.imageIds) ? raw.imageIds.filter((id) => typeof id === "string" && id) : [],
        personalHours: parseFloat(raw.personalHours) || 0,
        sleepHours: parseFloat(raw.sleepHours) || 0,
        recoveryHours: parseFloat(raw.recoveryHours) || 0,
        commuteTotal: parseFloat(raw.commuteTotal) || 0,
        commuteProductive: parseFloat(raw.commuteProductive) || 0,
        identityScore: parseInt(raw.identityScore, 10) || 0
    };
}

function normalizeTransferRecords(records) {
    if (!Array.isArray(records)) return [];
    return records
        .map(normalizeTransferRecord)
        .filter(Boolean)
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function backupTransferSnapshot(sourceLabel, records) {
    try {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const prefix = `dtr_backup_${sourceLabel}_`;
        const key = `${prefix}${stamp}`;
        localStorage.setItem(key, JSON.stringify(Array.isArray(records) ? records : []));

        // Limit backups to last 3 per category to manage storage
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort();
        if (allKeys.length > 3) {
            allKeys.slice(0, allKeys.length - 3).forEach(k => localStorage.removeItem(k));
        }
    } catch (e) {
        console.warn("Unable to create transfer backup snapshot:", e);
    }
}

async function clearDuplicateIndexedDbRecords(buttonEl) {
    if (typeof getRecordsFromStore !== "function" || typeof saveRecordsToStore !== "function") {
        alert("IndexedDB record store is unavailable in this browser.");
        return;
    }

    const btn = buttonEl && buttonEl.tagName === "BUTTON" ? buttonEl : null;
    const originalText = btn ? btn.innerText : "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Cleaning...";
    }

    try {
        const idbRecordsRaw = await getRecordsFromStore();
        const idbRecords = Array.isArray(idbRecordsRaw) ? idbRecordsRaw : [];
        if (!idbRecords.length) {
            alert("No IndexedDB records found.");
            return;
        }

        const dedupe = dedupeRecordsByDateKeepLatest(idbRecords);
        const imageDedupe = await dedupeRecordImageIdsByContent(dedupe.records);
        const totalRecordDuplicates = dedupe.removedCount;
        const totalImageDuplicates = imageDedupe.duplicateImageIds.length;

        if (totalRecordDuplicates <= 0 && totalImageDuplicates <= 0) {
            alert("No duplicate IndexedDB records or pictures found.");
            return;
        }

        if (!confirm(
            `Found duplicates in IndexedDB:\n` +
            `- Records (by date): ${totalRecordDuplicates}\n` +
            `- Pictures (by content): ${totalImageDuplicates}\n\n` +
            `Remove duplicates now?`
        )) {
            return;
        }

        backupTransferSnapshot("idb_dedupe", idbRecords);

        Store.setRecords(imageDedupe.records);
        if (typeof persistDTR === "function") {
            const ok = await persistDTR(Store.getRecords());
            if (!ok) throw new Error("Failed to persist deduplicated records.");
        } else {
            await saveRecordsToStore(Store.getRecords());
            safeSetDTR(Store.getRecords());
        }

        if (typeof deleteImagesFromStore === "function") {
            const stillReferenced = new Set(collectTransferRecordImageIds(Store.getRecords()));
            const candidates = [...dedupe.orphanImageIds, ...imageDedupe.duplicateImageIds];
            const idsToDelete = [...new Set(candidates)].filter((id) => !stillReferenced.has(id));
            if (idsToDelete.length) {
                try { await deleteImagesFromStore(idsToDelete); } catch (_) {}
            }
        }

        loadReflectionViewer();
        if (Store.getRecords().length) showSummary(Store.getRecords()[Store.getRecords().length - 1]);
        if (typeof renderDailyGraph === "function") renderDailyGraph();
        if (typeof renderWeeklyGraph === "function") renderWeeklyGraph();
        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        if (typeof refreshStorageActionSelectors === "function") refreshStorageActionSelectors();

        alert(
            `IndexedDB dedupe complete.\n` +
            `Removed duplicate records: ${totalRecordDuplicates}\n` +
            `Removed duplicate pictures: ${totalImageDuplicates}\n` +
            `Records kept: ${Store.getRecords().length}`
        );
    } catch (err) {
        alert("Failed to clear IndexedDB duplicates: " + (err && err.message ? err.message : err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

async function dedupeRecordImageIdsByContent(records) {
    const normalized = normalizeTransferRecords(records);
    const rewritten = [];
    const seenBySignature = new Map();
    const duplicateImageIds = [];

    for (const record of normalized) {
        const imageIds = Array.isArray(record.imageIds) ? record.imageIds : [];
        const nextIds = [];

        for (const id of imageIds) {
            if (!id || typeof id !== "string") continue;
            const existingInRecord = nextIds.includes(id);
            if (existingInRecord) {
                duplicateImageIds.push(id);
                continue;
            }

            let signature = "";
            if (typeof getImageFromStore === "function") {
                try {
                    const dataUrl = await getImageFromStore(id);
                    signature = await buildImageSignature(dataUrl);
                } catch (_) {
                    signature = "";
                }
            }

            if (!signature) {
                nextIds.push(id);
                continue;
            }

            if (!seenBySignature.has(signature)) {
                seenBySignature.set(signature, id);
                nextIds.push(id);
                continue;
            }

            const canonicalId = seenBySignature.get(signature);
            if (!nextIds.includes(canonicalId)) {
                nextIds.push(canonicalId);
            }
            if (id !== canonicalId) {
                duplicateImageIds.push(id);
            }
        }

        rewritten.push({
            ...record,
            imageIds: [...new Set(nextIds)]
        });
    }

    return {
        records: rewritten,
        duplicateImageIds: [...new Set(duplicateImageIds)]
    };
}

async function buildImageSignature(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl) return "";
    const bytes = dataUrlToBytes(dataUrl);
    if (bytes && bytes.length && typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
        try {
            const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
            const hashHex = bytesToHex(new Uint8Array(hashBuffer));
            return `sha256:${hashHex}`;
        } catch (_) {
            // Fall back to lightweight signature below.
        }
    }
    // NOTE: SHA-256 is precise. This fallback fp fingerprint is intentional for lightweight 
    // browser detection, but may produce rare false negatives for images with identical head/tails.
    return `fp:${dataUrl.length}:${dataUrl.slice(0, 128)}:${dataUrl.slice(-128)}`;
}

function dataUrlToBytes(dataUrl) {
    if (typeof dataUrl !== "string") return null;
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) return null;
    const header = dataUrl.slice(0, commaIndex);
    const payload = dataUrl.slice(commaIndex + 1);
    if (!payload) return null;

    const isBase64 = /;base64/i.test(header);
    try {
        if (isBase64) {
            const binary = atob(payload);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        }

        const decoded = decodeURIComponent(payload);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i) & 0xff;
        }
        return bytes;
    } catch (_) {
        return null;
    }
}

function bytesToHex(bytes) {
    if (!bytes || !bytes.length) return "";
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
        out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
}

function dedupeRecordsByDateKeepLatest(records) {
    const source = Array.isArray(records) ? records : [];
    const latestByDate = new Map();

    source.forEach((record, idx) => {
        const dateKey = toGmt8DateKey(record && record.date);
        if (!dateKey) return;
        latestByDate.set(dateKey, { record: { ...record, date: dateKey }, idx });
    });

    const kept = Array.from(latestByDate.values())
        .sort((a, b) => (a.record.date || "").localeCompare(b.record.date || ""))
        .map((x) => x.record);

    const keptDateKeys = new Set(kept.map((r) => r.date));
    const removedRecords = source.filter((r, idx) => {
        const dateKey = toGmt8DateKey(r && r.date);
        if (!dateKey) return false;
        const latestMeta = latestByDate.get(dateKey);
        return !!latestMeta && latestMeta.idx !== idx;
    });

    const keptImageIds = new Set(collectTransferRecordImageIds(kept));
    const orphanImageIds = collectTransferRecordImageIds(removedRecords).filter((id) => !keptImageIds.has(id));
    const normalizedKept = normalizeTransferRecords(kept);

    return {
        records: normalizedKept,
        removedCount: Math.max(0, source.length - normalizedKept.length),
        orphanImageIds,
        keptDateKeys
    };
}

async function migrateTransferRecordImagesToIdb(records) {
    const normalized = normalizeTransferRecords(records);
    const result = [];
    let migratedImages = 0;
    let failedImages = 0;

    for (const record of normalized) {
        const next = {
            ...record,
            imageIds: Array.isArray(record.imageIds) ? [...record.imageIds] : [],
            images: Array.isArray(record.images) ? [...record.images] : []
        };
        if (!next.images.length || typeof saveImageToStore !== "function") {
            next.imageIds = [...new Set(next.imageIds)];
            result.push(next);
            continue;
        }

        // If legacy/base64 images are present, treat them as the source of truth.
        // This avoids ID duplication when round-tripping localStorage <-> IndexedDB.
        next.imageIds = [];
        const remainingLegacy = [];
        for (const dataUrl of next.images) {
            if (!dataUrl || typeof dataUrl !== "string") continue;
            try {
                const id = await saveImageToStore(dataUrl);
                if (id) {
                    next.imageIds.push(id);
                    migratedImages++;
                } else {
                    remainingLegacy.push(dataUrl);
                    failedImages++;
                }
            } catch (_) {
                remainingLegacy.push(dataUrl);
                failedImages++;
            }
        }
        next.imageIds = [...new Set(next.imageIds)];
        next.images = remainingLegacy;
        result.push(next);
    }

    return { records: result, migratedImages, failedImages };
}

function collectTransferRecordImageIds(records) {
    if (!Array.isArray(records)) return [];
    const ids = new Set();
    records.forEach((r) => {
        const imageIds = r && Array.isArray(r.imageIds) ? r.imageIds : [];
        imageIds.forEach((id) => {
            if (typeof id === "string" && id) ids.add(id);
        });
    });
    return Array.from(ids);
}

async function expandTransferRecordImagesFromIdb(records) {
    const normalized = normalizeTransferRecords(records);
    const result = [];
    let embeddedImages = 0;
    let missingImages = 0;

    for (const record of normalized) {
        const next = {
            ...record,
            imageIds: Array.isArray(record.imageIds) ? [...record.imageIds] : [],
            images: Array.isArray(record.images) ? [...record.images] : []
        };
        if (!next.imageIds.length || typeof getImageFromStore !== "function") {
            result.push(next);
            continue;
        }

        const hydratedImages = [];
        for (const id of next.imageIds) {
            if (!id || typeof id !== "string") continue;
            try {
                const dataUrl = await getImageFromStore(id);
                if (dataUrl && typeof dataUrl === "string") {
                    hydratedImages.push(dataUrl);
                    embeddedImages++;
                } else {
                    missingImages++;
                }
            } catch (_) {
                missingImages++;
            }
        }

        if (hydratedImages.length) {
            next.images = hydratedImages;
        }
        result.push(next);
    }

    return { records: result, embeddedImages, missingImages };
}

function chooseTransferModeModal({ sourceLabel, targetLabel, recordCount }) {
    return new Promise((resolve) => {
        const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
        let settled = false;
        const finish = (mode) => {
            if (settled) return;
            settled = true;
            const includeImages = !!panel.querySelector("#transferIncludeImages")?.checked;
            modal.remove();
            resolve({ mode: mode || "abort", includeImages });
        };

        const modal = document.createElement("div");
        modal.style.cssText = [
            "position:fixed",
            "inset:0",
            "background:rgba(0,0,0,0.72)",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "z-index:10050",
            "padding:16px"
        ].join(";");

        const panel = document.createElement("div");
        panel.style.cssText = [
            "width:min(560px,100%)",
            "background:var(--panel)",
            "border:1px solid var(--border)",
            "border-radius:10px",
            "padding:16px",
            "box-shadow:0 10px 28px rgba(0,0,0,0.4)",
            "color:var(--text)"
        ].join(";");

        const transferTitle = t ? t('transfer_records_title') : "Transfer Records";
        const helpText = t ? t('transfer_records_help', { count: recordCount, source: sourceLabel, target: targetLabel }) : `Move <strong>${recordCount}</strong> valid record(s) from <strong>${sourceLabel}</strong> to <strong>${targetLabel}</strong>.`;
        const replaceHelpText = t ? t('transfer_replace_help') : "Replace overwrites the entire target dataset.";
        const includeImagesLabel = t ? t('transfer_include_images') : "Include images in transfer";
        const abortBtnText = t ? t('abort') : "Abort";
        const replaceBtnText = t ? t('transfer_replace_target') : "Replace Target";

        panel.innerHTML = `
            <h3 style="margin:0 0 10px 0; color:var(--accent);">${transferTitle}</h3>
            <p style="margin:0 0 8px 0;">${helpText}</p>
            <p style="margin:0 0 12px 0; opacity:0.85; font-size:0.92em;">
              ${replaceHelpText}
            </p>
            <label style="display:flex; align-items:center; gap:8px; margin:0 0 12px 0; font-size:0.92em;">
                <input id="transferIncludeImages" type="checkbox" checked>
                ${includeImagesLabel}
            </label>
            <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                <button id="transferAbortBtn" type="button" style="background:transparent; color:var(--text); border:1px solid var(--border);">${abortBtnText}</button>
                <button id="transferReplaceBtn" type="button" style="background:var(--accent); color:#fff;">${replaceBtnText}</button>
            </div>
        `;

        modal.appendChild(panel);
        document.body.appendChild(modal);

        panel.querySelector("#transferAbortBtn").addEventListener("click", () => finish("abort"));
        panel.querySelector("#transferReplaceBtn").addEventListener("click", () => finish("replace"));
        modal.addEventListener("click", (e) => {
            if (e.target === modal) finish("abort");
        });
    });
}
 


 
const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // ~5 MB typical localStorage limit
const IDB_QUOTA_DISPLAY_CAP_BYTES = 10 * 1024 * 1024 * 1024; // Normalize display across browsers/devices

function formatBytesAdaptive(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function getStorageInfo() {
    let dtrString = localStorage.getItem("dtr");
    if (!dtrString && typeof Store.getRecords() !== "undefined") {
        try { dtrString = JSON.stringify(Store.getRecords()); } catch(e) {}
    }
    if (!dtrString) dtrString = "[]";
    
    // Browsers naturally measure localStorage limits by UTF-16 character count (2 bytes per unit).
    // NOTE: This estimate accounts for BMP characters; supplementary planes (emojis, etc.) 
    // are surrogate pairs (4 bytes) but stay accurate for typical DTR text content.
    const usedBytes = dtrString.length * 2;
    
    const usedMB = (usedBytes / 1024 / 1024).toFixed(2);
    const limitMB = (STORAGE_LIMIT_BYTES / 1024 / 1024).toFixed(2);
    const percent = Math.min(100, (usedBytes / STORAGE_LIMIT_BYTES) * 100);
    return { usedBytes, usedMB, limitMB, percent };
}

function getStorageUsage() {
    const { usedMB } = getStorageInfo();
    console.log(`Current Usage: ${usedMB} MB / 5.00 MB`);
    return usedMB;
}

function updateStorageVisualizer() {
    const el = document.getElementById("storageVisualizer");
    if (!el) return;

    const t = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;

    try {
        const { usedBytes, usedMB, limitMB, percent } = getStorageInfo();

        const usedText = document.getElementById("storageUsedText");
        const limitText = document.getElementById("storageLimitText");
        const bar = document.getElementById("storageBar");
        const status = document.getElementById("storageStatus");

        const idbUsedText = document.getElementById("storageIdbUsedText");
        const idbQuotaText = document.getElementById("storageIdbQuotaText");
        const idbBar = document.getElementById("storageIdbBar");
        const barTip = document.getElementById("storageBarTip");
        const idbBarTip = document.getElementById("storageIdbBarTip");

        if (usedText) usedText.textContent = `${usedMB} MB`;
        if (limitText) limitText.textContent = `${limitMB} MB`;

        // Localized info string: "5.00 MB used of 10.00 MB (50%)"
        const usedOfText = t ? t('used_of') : 'used of';
        const recordsInfo = `${formatBytesAdaptive(usedBytes)} ${usedOfText} ${formatBytesAdaptive(STORAGE_LIMIT_BYTES)} (${Math.round(percent)}%)`;

        if (usedText) usedText.title = `${t ? t('storage_usage_label') : 'Records usage'}: ${recordsInfo}`;
        if (limitText) limitText.title = `${t ? t('storage_capacity_label') : 'Records capacity'}: ${formatBytesAdaptive(STORAGE_LIMIT_BYTES)}`;
        if (bar) bar.title = `${t ? t('storage_records_label') : 'Records'}: ${recordsInfo}`;

        if (barTip) barTip.textContent = recordsInfo;
        if (bar) {
            bar.style.width = `${percent}%`;
            bar.setAttribute("aria-valuenow", Math.round(percent));
        }
        if (el) {
            el.setAttribute("data-percent", percent >= 95 ? "critical" : percent >= 80 ? "high" : "normal");
        }

        if (status) {
            if (percent >= 100) {
                status.textContent = t ? t('storage_full') : "Storage full! Run Optimize DB or remove images.";
                status.style.color = "var(--accent)";
                if (bar) bar.style.backgroundColor = "var(--accent)";
            } else if (percent >= 75) {
                status.textContent = t ? t('storage_running_low') : "Running low on storage. Consider optimizing or removing images.";
                status.style.color = "var(--accent)";
                if (bar) bar.style.backgroundColor = "var(--accent)";
            } else if (percent >= 50) {
                status.textContent = t ? t('storage_moderate') : "Storage usage moderate";
                status.style.color = "var(--color-warning)";
                if (bar) bar.style.backgroundColor = "var(--color-warning)";
            } else {
                status.textContent = t ? t('storage_healthy') : "Storage healthy";
                status.style.color = "var(--color-good)";
                if (bar) bar.style.backgroundColor = "var(--color-good)";
            }
        }

        if (typeof getImageStoreUsageBytes === "function" && typeof getImageStoreEstimate === "function") {
            const idbSection = document.getElementById("storageIdbSection");
            const idbStatus = document.getElementById("storageIdbStatus");
            
            // Increased timeout to 4s to allow cursor iteration for large image stores without premature failure
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Storage check timed out")), 4000));
            
            Promise.race([
                Promise.all([getImageStoreUsageBytes(), getImageStoreEstimate()]),
                timeoutPromise
            ]).then(([idbBytes, estimate]) => {
                const idbMB = (idbBytes / 1024 / 1024).toFixed(2);
                const rawQuota = Number(estimate && estimate.quota) || 0;
                const effectiveQuota = rawQuota > 0
                    ? Math.min(rawQuota, IDB_QUOTA_DISPLAY_CAP_BYTES)
                    : IDB_QUOTA_DISPLAY_CAP_BYTES;
                const quotaAdaptive = formatBytesAdaptive(effectiveQuota);
                if (idbUsedText) idbUsedText.textContent = `${idbMB} MB`;
                if (idbQuotaText) idbQuotaText.textContent = quotaAdaptive;
                const idbPercent = Math.min(100, (idbBytes / effectiveQuota) * 100);
                if (idbBar) {
                    idbBar.style.width = `${idbPercent}%`;
                    idbBar.setAttribute("aria-valuenow", Math.round(idbPercent));
                }
                const idbUsedOfText = t ? t('used_of') : 'used of';
                const idbInfo = `${formatBytesAdaptive(idbBytes)} ${idbUsedOfText} ${quotaAdaptive} (${Math.round(idbPercent)}%)`;
                
                if (idbUsedText) idbUsedText.title = `${t ? t('idb_usage_label') : 'IndexedDB usage'}: ${idbInfo}`;
                if (idbQuotaText) {
                    const rawQuotaLabel = rawQuota > 0 ? formatBytesAdaptive(rawQuota) : (t ? t('idb_none') : "unavailable");
                    const idbCapLabel = t ? t('idb_capacity_label') : 'IndexedDB capacity (normalized)';
                    const rawEstimateLabel = t ? t('idb_raw_estimate_label') : 'raw browser estimate';
                    idbQuotaText.title = `${idbCapLabel}: ${quotaAdaptive}; ${rawEstimateLabel}: ${rawQuotaLabel}`;
                }
                if (idbBar) idbBar.title = `IndexedDB: ${idbInfo}`;
                if (idbBarTip) idbBarTip.textContent = idbInfo;
                if (idbSection) {
                    idbSection.setAttribute("data-percent", idbPercent >= 95 ? "critical" : idbPercent >= 80 ? "high" : "normal");
                }
                if (idbStatus) {
                    if (idbPercent >= 100) {
                        idbStatus.textContent = t ? t('image_storage_full') : "Image storage full! Run Optimize DB or remove images.";
                        idbStatus.style.color = "var(--accent)";
                        if (idbBar) idbBar.style.backgroundColor = "var(--accent)";
                    } else if (idbPercent >= 75) {
                        idbStatus.textContent = t ? t('image_storage_running_low') : "Running low on image storage. Consider optimizing or removing images.";
                        idbStatus.style.color = "var(--accent)";
                        if (idbBar) idbBar.style.backgroundColor = "var(--accent)";
                    } else if (idbPercent >= 50) {
                        idbStatus.textContent = t ? t('image_storage_moderate') : "Image storage usage moderate";
                        idbStatus.style.color = "var(--color-warning)";
                        if (idbBar) idbBar.style.backgroundColor = "var(--color-warning)";
                    } else {
                        idbStatus.textContent = t ? t('image_storage_healthy') : "Image storage healthy";
                        idbStatus.style.color = "var(--color-good)";
                        if (idbBar) idbBar.style.backgroundColor = "var(--color-good)";
                    }
                }
            }).catch(() => {
                if (idbUsedText) idbUsedText.textContent = "—";
                if (idbQuotaText) idbQuotaText.textContent = "—";
                if (idbStatus) idbStatus.textContent = t ? t('unable_to_read_storage') : "Unable to read image storage.";
                const idbTipText = t ? t('idb_usage_unavailable') : "IndexedDB usage unavailable";
                if (idbBarTip) idbBarTip.textContent = idbTipText;
            });
        }

    if (typeof refreshStorageActionSelectors === "function") {
        refreshStorageActionSelectors();
    }
    } catch (e) {
        console.error("updateStorageVisualizer error:", e);
        const status = document.getElementById("storageStatus");
        if (status) {
            status.textContent = "Error: " + e.message;
            status.style.color = "var(--accent)";
        }
    }
}

async function optimizeStorage() {
    if (!Store.getRecords().length) return alert("No records found to optimize.");
    
    const targetRecords = getSelectedStorageTargetRecords("optimize");
    if (!targetRecords.length) return alert("No eligible records selected for compression.");

    const originalCount = targetRecords.length;
    let imagesProcessed = 0;
    
    if (!confirm("This will retroactively compress all images in your history to free up space. This is safe and won't delete your reflections. Proceed?")) return;

    const btn = document.activeElement;
    const originalText = btn ? btn.innerText : "";
    if (btn && btn.tagName === "BUTTON") btn.innerText = "Optimizing... ⏳";
    const liveStatusEl = document.getElementById("storageStatus");
    const uiTickMs = 250;
    let lastUiTick = 0;
    let recordsDone = 0;

    async function refreshLiveOptimizeUi(recordForSummary, force = false) {
        const now = Date.now();
        if (!force && (now - lastUiTick) < uiTickMs) return;
        lastUiTick = now;
        if (liveStatusEl) {
            const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
            const optText = t ? t('optimizing_images_status') : "Optimizing images...";
            liveStatusEl.textContent = `${optText} ${recordsDone}/${originalCount} record(s), ${imagesProcessed} image(s) compressed`;
        }
        if (typeof loadReflectionViewer === "function") {
            await Promise.resolve(loadReflectionViewer());
        }
        if (recordForSummary && typeof showSummary === "function") {
            await Promise.resolve(showSummary(recordForSummary));
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    try {
        for (const record of targetRecords) {
            if (record.imageIds && record.imageIds.length) {
                const compressedIds = [];
                for (const id of record.imageIds) {
                    try {
                        const entry = typeof getImageEntryFromStore === "function"
                            ? await getImageEntryFromStore(id)
                            : null;
                        const dataUrl = await getImageFromStore(id);
                        if (!dataUrl) { compressedIds.push(id); continue; }
                        if (dataUrl.length > 150000) {
                            if (entry && typeof backupOriginalImageIfMissing === "function") {
                                await backupOriginalImageIfMissing(id, entry);
                            }
                            const compressed = await compressImage(dataUrl);
                            if (typeof putImageEntryToStore === "function") {
                                await putImageEntryToStore({
                                    id,
                                    dataUrl: compressed,
                                    sizeBytes: compressed.length,
                                    optimizedAt: Date.now(),
                                    isCompressed: true
                                });
                            }
                            imagesProcessed++;
                        }
                        compressedIds.push(id);
                    } catch (e) {
                        console.warn("Failed to compress image " + id + ", keeping original.", e);
                        compressedIds.push(id);
                    }
                }
                record.imageIds = compressedIds;
                record.images = [];
                recordsDone++;
                await refreshLiveOptimizeUi(record);
                continue;
            }
            if (record.images && record.images.length) {
                const imageIds = [];
                for (const base64 of record.images) {
                    try {
                        const id = await saveImageToStore(base64);
                        if (base64.length > 150000) {
                            const originalEntry = typeof getImageEntryFromStore === "function"
                                ? await getImageEntryFromStore(id)
                                : null;
                            if (originalEntry && typeof backupOriginalImageIfMissing === "function") {
                                await backupOriginalImageIfMissing(id, originalEntry);
                            }

                            const compressed = await compressImage(base64);
                            if (typeof putImageEntryToStore === "function") {
                                await putImageEntryToStore({
                                    id,
                                    dataUrl: compressed,
                                    sizeBytes: compressed.length,
                                    optimizedAt: Date.now(),
                                    isCompressed: true
                                });
                            }
                            imagesProcessed++;
                        }
                        imageIds.push(id);
                    } catch (e) {
                        console.warn("Failed to migrate/compress an image, skipping.", e);
                    }
                }
                record.imageIds = imageIds;
                record.images = [];
                recordsDone++;
                await refreshLiveOptimizeUi(record);
            }
        }

        if (!await persistDTR(Store.getRecords())) {
            alert("Optimization ran but storage is still full. Try deleting some records or removing images.");
            return;
        }
        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        refreshStorageActionSelectors();
        await refreshLiveOptimizeUi(Store.getRecords()[Store.getRecords().length - 1], true);

        alert(`Optimization complete!\n- Records processed: ${originalCount}\n- Images found and lightened: ${imagesProcessed}\n- Your storage is now much cleaner.`);
        
        loadReflectionViewer();
        if (Store.getRecords().length) showSummary(Store.getRecords()[Store.getRecords().length - 1]);
    } catch (err) {
        alert("Optimization failed: " + err.message);
    } finally {
        if (btn && btn.tagName === "BUTTON") btn.innerText = originalText;
    }
}
async function restoreOptimizedImages(buttonEl) {
    if (!Store.getRecords().length) return alert("No records found.");

    const targetRecords = getSelectedStorageTargetRecords("restore");
    const imageIds = [...new Set((targetRecords || []).flatMap((r) => r.imageIds || []))];
    if (!imageIds.length) {
        alert("No eligible IndexedDB images found in the selected target(s).");
        return;
    }

    if (!confirm("Restore original versions for all optimized images from backup and keep them in IndexedDB?")) return;

    const btn = buttonEl && buttonEl.tagName === "BUTTON" ? buttonEl : null;
    const originalText = btn ? btn.innerText : "";
    if (btn) btn.innerText = "Restoring... ⏳";
    const liveStatusEl = document.getElementById("storageStatus");
    const totalIds = imageIds.length;
    const uiTickMs = 250;
    let lastUiTick = 0;
    let processedCount = 0;

    let restoredCount = 0;
    const idToRecord = new Map();
    (targetRecords || []).forEach((record) => {
        (record.imageIds || []).forEach((id) => idToRecord.set(id, record));
    });

    async function refreshLiveRestoreUi(recordForSummary, force = false) {
        const now = Date.now();
        if (!force && (now - lastUiTick) < uiTickMs) return;
        lastUiTick = now;
        if (liveStatusEl) {
            const t = (window.DTRI18N && window.DTRI18N.t) ? window.DTRI18N.t : null;
            const restoreText = t ? t('restoring_originals_status') : "Restoring originals...";
            liveStatusEl.textContent = `${restoreText} ${processedCount}/${totalIds} image(s), ${restoredCount} restored`;
        }
        if (typeof loadReflectionViewer === "function") {
            await Promise.resolve(loadReflectionViewer());
        }
        if (recordForSummary && typeof showSummary === "function") {
            await Promise.resolve(showSummary(recordForSummary));
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    try {
        for (const id of imageIds) {
            try {
                const restored = typeof restoreOriginalImageForId === "function"
                    ? await restoreOriginalImageForId(id)
                    : false;
                if (restored) restoredCount++;
            } catch (e) {
                console.warn("Failed to restore original image for id:", id, e);
            }
            processedCount++;
            await refreshLiveRestoreUi(idToRecord.get(id));
        }

        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        loadReflectionViewer();
        refreshStorageActionSelectors();
        if (Store.getRecords().length) showSummary(Store.getRecords()[Store.getRecords().length - 1]);
        await refreshLiveRestoreUi(Store.getRecords()[Store.getRecords().length - 1], true);

        if (restoredCount > 0) {
            alert(`Restore complete. ${restoredCount} image(s) restored to original quality from IndexedDB backup.`);
        } else {
            alert("No original backups were found to restore.");
        }
    } catch (err) {
        alert("Restore failed: " + (err && err.message ? err.message : err));
    } finally {
        if (btn) btn.innerText = originalText;
    }
}
// --- EXPOSE TO WINDOW FOR HTML INLINE CONTROLLERS ---
if(typeof window !== "undefined") { window.getStorageEligibleRecordEntries = window.getStorageEligibleRecordEntries || getStorageEligibleRecordEntries; }
if(typeof window !== "undefined") { window.buildStorageRecordOptionLabel = window.buildStorageRecordOptionLabel || buildStorageRecordOptionLabel; }
if(typeof window !== "undefined") { window.refreshStorageActionSelectors = window.refreshStorageActionSelectors || refreshStorageActionSelectors; }
if(typeof window !== "undefined") { window.toggleStorageBatchMode = window.toggleStorageBatchMode || toggleStorageBatchMode; }
if(typeof window !== "undefined") { window.getSelectedStorageTargetRecords = window.getSelectedStorageTargetRecords || getSelectedStorageTargetRecords; }
if(typeof window !== "undefined") { window.transferRecordsToIndexedDB = window.transferRecordsToIndexedDB || transferRecordsToIndexedDB; }
if(typeof window !== "undefined") { window.transferRecordsToLocalStorage = window.transferRecordsToLocalStorage || transferRecordsToLocalStorage; }
if(typeof window !== "undefined") { window.normalizeTransferRecord = window.normalizeTransferRecord || normalizeTransferRecord; }
if(typeof window !== "undefined") { window.normalizeTransferRecords = window.normalizeTransferRecords || normalizeTransferRecords; }
if(typeof window !== "undefined") { window.backupTransferSnapshot = window.backupTransferSnapshot || backupTransferSnapshot; }
if(typeof window !== "undefined") { window.clearDuplicateIndexedDbRecords = window.clearDuplicateIndexedDbRecords || clearDuplicateIndexedDbRecords; }
if(typeof window !== "undefined") { window.dedupeRecordImageIdsByContent = window.dedupeRecordImageIdsByContent || dedupeRecordImageIdsByContent; }
if(typeof window !== "undefined") { window.buildImageSignature = window.buildImageSignature || buildImageSignature; }
if(typeof window !== "undefined") { window.dataUrlToBytes = window.dataUrlToBytes || dataUrlToBytes; }
if(typeof window !== "undefined") { window.bytesToHex = window.bytesToHex || bytesToHex; }
if(typeof window !== "undefined") { window.dedupeRecordsByDateKeepLatest = window.dedupeRecordsByDateKeepLatest || dedupeRecordsByDateKeepLatest; }
if(typeof window !== "undefined") { window.migrateTransferRecordImagesToIdb = window.migrateTransferRecordImagesToIdb || migrateTransferRecordImagesToIdb; }
if(typeof window !== "undefined") { window.collectTransferRecordImageIds = window.collectTransferRecordImageIds || collectTransferRecordImageIds; }
if(typeof window !== "undefined") { window.expandTransferRecordImagesFromIdb = window.expandTransferRecordImagesFromIdb || expandTransferRecordImagesFromIdb; }
if(typeof window !== "undefined") { window.chooseTransferModeModal = window.chooseTransferModeModal || chooseTransferModeModal; }
if(typeof window !== "undefined") { window.formatBytesAdaptive = window.formatBytesAdaptive || formatBytesAdaptive; }
if(typeof window !== "undefined") { window.getStorageInfo = window.getStorageInfo || getStorageInfo; }
if(typeof window !== "undefined") { window.getStorageUsage = window.getStorageUsage || getStorageUsage; }
if(typeof window !== "undefined") { window.updateStorageVisualizer = window.updateStorageVisualizer || updateStorageVisualizer; }
if(typeof window !== "undefined") { window.optimizeStorage = window.optimizeStorage || optimizeStorage; }
if(typeof window !== "undefined") { window.restoreOptimizedImages = window.restoreOptimizedImages || restoreOptimizedImages; }
