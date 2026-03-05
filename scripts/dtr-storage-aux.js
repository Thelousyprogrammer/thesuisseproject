/**
 * DTR STORAGE AUX MODULE
 * Non-core storage utilities: migration, optimizer, restore, visualizer, and batch selectors.
 */

async function migrateImagesToIndexedDB(targetRecords = null) {
    if (typeof saveImageToStore !== "function") {
        return { recordsUpdated: 0, imagesMigrated: 0, failedImages: 0, changed: false };
    }

    let changed = false;
    let recordsUpdated = 0;
    let imagesMigrated = 0;
    let failedImages = 0;

    const sourceRecords = Array.isArray(targetRecords) ? targetRecords : dailyRecords;
    for (const record of sourceRecords) {
        if (!record.images || !record.images.length) continue;
        const legacyCount = record.images.length;
        const imageIds = [];
        for (const dataUrl of record.images) {
            if (!dataUrl || typeof dataUrl !== "string") continue;
            try {
                const id = await saveImageToStore(dataUrl);
                imageIds.push(id);
                imagesMigrated++;
            } catch (e) {
                console.warn("Migration: failed to store one image, skipping.", e);
            }
        }
        if (imageIds.length === legacyCount) {
            record.imageIds = imageIds;
            record.images = [];
            changed = true;
            recordsUpdated++;
        } else if (imageIds.length > 0) {
            // Roll back partial writes to avoid orphaned blobs in IndexedDB.
            if (typeof deleteImagesFromStore === "function") {
                try { await deleteImagesFromStore(imageIds); } catch (_) {}
            }
            imagesMigrated -= imageIds.length;
            failedImages += legacyCount;
        } else {
            failedImages += legacyCount;
        }
    }

    if (changed && await persistDTR(dailyRecords)) {
        console.log("DTR: Migrated legacy images to IndexedDB.");
    }

    return { recordsUpdated, imagesMigrated, failedImages, changed };
}

function getStorageEligibleRecordEntries(action = "all") {
    const entries = (dailyRecords || []).map((record, index) => ({ record, index }));
    if (action === "transfer") {
        return entries.filter((e) => e.record && e.record.images && e.record.images.length);
    }
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
    allOption.textContent = `All Eligible Records (${entries.length})`;
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

async function transferLegacyPhotos(buttonEl) {
    if (!dailyRecords || !dailyRecords.length) {
        alert("No records found.");
        return;
    }

    const legacyRecords = getSelectedStorageTargetRecords("transfer");
    const legacyCount = legacyRecords.reduce((sum, r) => sum + r.images.length, 0);

    if (!legacyCount) {
        alert("No eligible legacy photos found in the selected target(s).");
        return;
    }

    if (!confirm(`Transfer ${legacyCount} localStorage image(s) to IndexedDB now?`)) return;

    const btn = buttonEl && buttonEl.tagName === "BUTTON" ? buttonEl : null;
    const originalText = btn ? btn.innerText : "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Transferring...";
    }

    try {
        const result = await migrateImagesToIndexedDB(legacyRecords);
        if (result.imagesMigrated === 0) {
            alert("No photos were transferred. Please check browser storage permissions and try again.");
        } else if (result.failedImages > 0) {
            alert(
                `Transferred ${result.imagesMigrated} photo(s). ` +
                `${result.failedImages} photo(s) could not be transferred and were kept as legacy data.`
            );
        } else {
            alert(`Transfer complete: ${result.imagesMigrated} photo(s) moved to IndexedDB.`);
        }
        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        loadReflectionViewer();
        refreshStorageActionSelectors();
    } catch (err) {
        alert("Legacy photo transfer failed: " + (err && err.message ? err.message : err));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // ~5 MB typical localStorage limit

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
    const usedBytes = typeof dailyRecords !== "undefined"
        ? new Blob([JSON.stringify(dailyRecords)]).size
        : new Blob([localStorage.getItem("dtr") || "[]"]).size;
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
    const recordsInfo = `${formatBytesAdaptive(usedBytes)} used of ${formatBytesAdaptive(STORAGE_LIMIT_BYTES)} (${Math.round(percent)}%)`;
    if (usedText) usedText.title = `Records usage: ${recordsInfo}`;
    if (limitText) limitText.title = `Records capacity: ${formatBytesAdaptive(STORAGE_LIMIT_BYTES)}`;
    if (bar) bar.title = `Records: ${recordsInfo}`;
    if (barTip) barTip.textContent = recordsInfo;
    if (bar) {
        bar.style.width = `${percent}%`;
        bar.setAttribute("aria-valuenow", Math.round(percent));
    }
    if (el) {
        el.setAttribute("data-percent", percent >= 95 ? "critical" : percent >= 80 ? "high" : "normal");
    }

    if (status) {
        if (percent >= 80) {
            status.textContent = "âš ï¸ Running low on storage. Consider optimizing or removing images.";
            status.style.color = "var(--color-warning)";
        } else if (percent >= 95) {
            status.textContent = "âš ï¸ Storage almost full! Run Optimize DB or remove images.";
            status.style.color = "var(--accent)";
        } else {
            status.textContent = percent < 50 ? "Storage healthy" : "Storage usage moderate";
            status.style.color = "var(--color-good)";
        }
    }

    if (typeof getImageStoreUsageBytes === "function" && typeof getImageStoreEstimate === "function") {
        const idbSection = document.getElementById("storageIdbSection");
        const idbStatus = document.getElementById("storageIdbStatus");
        Promise.all([getImageStoreUsageBytes(), getImageStoreEstimate()]).then(([idbBytes, estimate]) => {
            const idbMB = (idbBytes / 1024 / 1024).toFixed(2);
            const quota = estimate.quota || 0;
            const quotaAdaptive = quota > 0 ? formatBytesAdaptive(quota) : "--";
            if (idbUsedText) idbUsedText.textContent = `${idbMB} MB`;
            if (idbQuotaText) idbQuotaText.textContent = quota > 0 ? quotaAdaptive : "--";
            const idbPercent = quota > 0 ? Math.min(100, (idbBytes / quota) * 100) : 0;
            if (idbBar && quota > 0) {
                idbBar.style.width = `${idbPercent}%`;
                idbBar.setAttribute("aria-valuenow", Math.round(idbPercent));
            }
            const idbInfo = quota > 0
                ? `${formatBytesAdaptive(idbBytes)} used of ${quotaAdaptive} (${Math.round(idbPercent)}%)`
                : `${formatBytesAdaptive(idbBytes)} used (quota unavailable)`;
            if (idbUsedText) idbUsedText.title = `IndexedDB usage: ${idbInfo}`;
            if (idbQuotaText) idbQuotaText.title = quota > 0
                ? `IndexedDB capacity: ${quotaAdaptive}`
                : "IndexedDB capacity unavailable";
            if (idbBar) idbBar.title = `IndexedDB: ${idbInfo}`;
            if (idbBarTip) idbBarTip.textContent = idbInfo;
            if (idbSection) {
                idbSection.setAttribute("data-percent", idbPercent >= 95 ? "critical" : idbPercent >= 80 ? "high" : "normal");
            }
            if (idbStatus) {
                if (idbPercent >= 80) {
                    idbStatus.textContent = "âš ï¸ Running low on image storage. Consider optimizing or removing images.";
                    idbStatus.style.color = "var(--color-warning)";
                } else if (idbPercent >= 95) {
                    idbStatus.textContent = "âš ï¸ Image storage almost full! Run Optimize DB or remove images.";
                    idbStatus.style.color = "var(--accent)";
                } else {
                    idbStatus.textContent = idbPercent < 50 ? "Image storage healthy" : "Image storage usage moderate";
                    idbStatus.style.color = "var(--color-good)";
                }
            }
        }).catch(() => {
            if (idbUsedText) idbUsedText.textContent = "â€”";
            if (idbQuotaText) idbQuotaText.textContent = "â€”";
            if (idbStatus) idbStatus.textContent = "Unable to read image storage.";
            if (idbBarTip) idbBarTip.textContent = "IndexedDB usage unavailable";
        });
    }

    if (typeof refreshStorageActionSelectors === "function") {
        refreshStorageActionSelectors();
    }
}

async function optimizeStorage() {
    if (!dailyRecords.length) return alert("No records found to optimize.");
    
    const targetRecords = getSelectedStorageTargetRecords("optimize");
    if (!targetRecords.length) return alert("No eligible records selected for compression.");

    const originalCount = targetRecords.length;
    let imagesProcessed = 0;
    
    if (!confirm("This will retroactively compress all images in your history to free up space. This is safe and won't delete your reflections. Proceed?")) return;

    const btn = document.activeElement;
    const originalText = btn ? btn.innerText : "";
    if (btn && btn.tagName === "BUTTON") btn.innerText = "Optimizing... â³";
    const liveStatusEl = document.getElementById("storageStatus");
    const uiTickMs = 250;
    let lastUiTick = 0;
    let recordsDone = 0;

    async function refreshLiveOptimizeUi(recordForSummary, force = false) {
        const now = Date.now();
        if (!force && (now - lastUiTick) < uiTickMs) return;
        lastUiTick = now;
        if (liveStatusEl) {
            liveStatusEl.textContent = `Optimizing images... ${recordsDone}/${originalCount} record(s), ${imagesProcessed} image(s) compressed`;
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

        if (!await persistDTR(dailyRecords)) {
            alert("Optimization ran but storage is still full. Try deleting some records or removing images.");
            return;
        }
        if (typeof updateStorageVisualizer === "function") updateStorageVisualizer();
        refreshStorageActionSelectors();
        await refreshLiveOptimizeUi(dailyRecords[dailyRecords.length - 1], true);

        alert(`Optimization complete!\n- Records processed: ${originalCount}\n- Images found and lightened: ${imagesProcessed}\n- Your storage is now much cleaner.`);
        
        loadReflectionViewer();
        if (dailyRecords.length) showSummary(dailyRecords[dailyRecords.length - 1]);
    } catch (err) {
        alert("Optimization failed: " + err.message);
    } finally {
        if (btn && btn.tagName === "BUTTON") btn.innerText = originalText;
    }
}
async function restoreOptimizedImages(buttonEl) {
    if (!dailyRecords.length) return alert("No records found.");

    const targetRecords = getSelectedStorageTargetRecords("restore");
    const imageIds = [...new Set((targetRecords || []).flatMap((r) => r.imageIds || []))];
    if (!imageIds.length) {
        alert("No eligible IndexedDB images found in the selected target(s).");
        return;
    }

    if (!confirm("Restore original versions for all optimized images from backup and keep them in IndexedDB?")) return;

    const btn = buttonEl && buttonEl.tagName === "BUTTON" ? buttonEl : null;
    const originalText = btn ? btn.innerText : "";
    if (btn) btn.innerText = "Restoring... â³";
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
            liveStatusEl.textContent = `Restoring originals... ${processedCount}/${totalIds} image(s), ${restoredCount} restored`;
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
        if (dailyRecords.length) showSummary(dailyRecords[dailyRecords.length - 1]);
        await refreshLiveRestoreUi(dailyRecords[dailyRecords.length - 1], true);

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
