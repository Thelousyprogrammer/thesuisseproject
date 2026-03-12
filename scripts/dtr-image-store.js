/**
 * DTR IMAGE STORE (IndexedDB)
 * Stores image data in IndexedDB to avoid localStorage quota limits.
 * Records hold imageIds; this module stores/retrieves by id.
 */

const DTR_IMAGE_DB_NAME = "DTRImageStore";
const DTR_IMAGE_STORE_NAME = "images";
const DTR_IMAGE_ORIGINAL_STORE_NAME = "images_original";
const DTR_RECORDS_STORE_NAME = "records";
const DTR_RECORDS_KEY = "primary";
const DB_VERSION = 3;

let _db = null;

function buildStoreError(stage, err) {
    if (!err) return new Error(`${stage} failed with unknown error`);
    const name = err.name ? String(err.name) : "Error";
    const message = err.message ? String(err.message) : String(err);
    return new Error(`${stage} failed (${name}): ${message}`);
}

function openImageDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DTR_IMAGE_DB_NAME, DB_VERSION);
        req.onerror = () => reject(buildStoreError("openImageDB", req.error));
        req.onblocked = () => reject(new Error("openImageDB failed: database open is blocked by another tab/session"));
        req.onsuccess = () => {
            _db = req.result;
            _db.onversionchange = () => {
                _db.close();
                _db = null;
            };
            resolve(_db);
        };
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(DTR_IMAGE_STORE_NAME)) {
                db.createObjectStore(DTR_IMAGE_STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(DTR_IMAGE_ORIGINAL_STORE_NAME)) {
                db.createObjectStore(DTR_IMAGE_ORIGINAL_STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(DTR_RECORDS_STORE_NAME)) {
                db.createObjectStore(DTR_RECORDS_STORE_NAME, { keyPath: "id" });
            }
        };
    });
}

function generateImageId() {
    return "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11);
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        if (!(blob instanceof Blob)) {
            reject(new Error("blobToDataUrl: input is not a Blob"));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(buildStoreError("blobToDataUrl", reader.error));
        reader.readAsDataURL(blob);
    });
}

/**
 * Save image payload to IndexedDB. Accepts File/Blob (preferred) or legacy data URL.
 * Returns the image id to store in the record.
 */
function saveImageToStore(imageInput) {
    const id = generateImageId();
    let payload = null;

    if (imageInput instanceof Blob) {
        payload = {
            id,
            blob: imageInput,
            mimeType: imageInput.type || "image/*",
            sizeBytes: imageInput.size || 0
        };
    } else if (typeof imageInput === "string" && imageInput.startsWith("data:image/")) {
        payload = {
            id,
            dataUrl: imageInput,
            sizeBytes: imageInput.length
        };
    } else {
        return Promise.reject(new Error("Invalid image payload"));
    }

    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_STORE_NAME, "readwrite");
            const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
            tx.onabort = () => reject(buildStoreError("saveImageToStore transaction abort", tx.error));
            tx.onerror = () => reject(buildStoreError("saveImageToStore transaction", tx.error));
            const req = store.put(payload);
            req.onsuccess = () => resolve(id);
            req.onerror = () => reject(buildStoreError("saveImageToStore request", req.error));
        });
    });
}

function getImageEntryFromStore(id) {
    if (!id) return Promise.resolve(null);
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_STORE_NAME, "readonly");
            const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(buildStoreError("getImageEntryFromStore request", req.error));
        });
    });
}

function putImageEntryToStore(entry) {
    if (!entry || !entry.id) return Promise.reject(new Error("putImageEntryToStore requires entry with id"));
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_STORE_NAME, "readwrite");
            const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
            const req = store.put(entry);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(buildStoreError("putImageEntryToStore request", req.error));
        });
    });
}

function backupOriginalImageIfMissing(id, entry) {
    if (!id || !entry) return Promise.resolve(false);
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_ORIGINAL_STORE_NAME, "readwrite");
            const store = tx.objectStore(DTR_IMAGE_ORIGINAL_STORE_NAME);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                if (getReq.result) {
                    resolve(false);
                    return;
                }
                const putReq = store.put({ ...entry, id, backupAt: Date.now() });
                putReq.onsuccess = () => resolve(true);
                putReq.onerror = () => reject(buildStoreError("backupOriginalImageIfMissing put", putReq.error));
            };
            getReq.onerror = () => reject(buildStoreError("backupOriginalImageIfMissing get", getReq.error));
        });
    });
}

function restoreOriginalImageForId(id) {
    if (!id) return Promise.resolve(false);
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction([DTR_IMAGE_ORIGINAL_STORE_NAME, DTR_IMAGE_STORE_NAME], "readwrite");
            const originalStore = tx.objectStore(DTR_IMAGE_ORIGINAL_STORE_NAME);
            const imageStore = tx.objectStore(DTR_IMAGE_STORE_NAME);
            const getReq = originalStore.get(id);
            getReq.onsuccess = () => {
                const original = getReq.result;
                if (!original) {
                    resolve(false);
                    return;
                }
                const { backupAt, ...restoredEntry } = original;
                const putReq = imageStore.put(restoredEntry);
                putReq.onsuccess = () => resolve(true);
                putReq.onerror = () => reject(buildStoreError("restoreOriginalImageForId put", putReq.error));
            };
            getReq.onerror = () => reject(buildStoreError("restoreOriginalImageForId get", getReq.error));
        });
    });
}

/**
 * Get a displayable data URL by id. Returns null if not found.
 */
function getImageFromStore(id) {
    if (!id) return Promise.resolve(null);
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_STORE_NAME, "readonly");
            const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
            const req = store.get(id);
            req.onsuccess = async () => {
                const row = req.result;
                if (!row) {
                    resolve(null);
                    return;
                }
                if (row.dataUrl && typeof row.dataUrl === "string") {
                    resolve(row.dataUrl);
                    return;
                }
                if (row.blob instanceof Blob) {
                    try {
                        const dataUrl = await blobToDataUrl(row.blob);
                        resolve(dataUrl || null);
                    } catch (_) {
                        resolve(null);
                    }
                    return;
                }
                resolve(null);
            };
            req.onerror = () => reject(buildStoreError("getImageFromStore request", req.error));
        });
    });
}

/**
 * Delete one image by id.
 */
function deleteImageFromStore(id) {
    if (!id) return Promise.resolve();
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_STORE_NAME, "readwrite");
            const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(buildStoreError("deleteImageFromStore request", req.error));
        });
    });
}

/**
 * Delete multiple images by id.
 */
function deleteImagesFromStore(ids) {
    if (!ids || !ids.length) return Promise.resolve();
    return openImageDB().then((db) => {
        const tx = db.transaction([DTR_IMAGE_STORE_NAME, DTR_IMAGE_ORIGINAL_STORE_NAME], "readwrite");
        const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
        const backupStore = tx.objectStore(DTR_IMAGE_ORIGINAL_STORE_NAME);
        ids.forEach((id) => {
            store.delete(id);
            backupStore.delete(id);
        });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(buildStoreError("deleteImagesFromStore transaction", tx.error));
        });
    });
}

/**
 * Get total bytes used by the images store.
 */
function getImageStoreUsageBytes() {
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_IMAGE_STORE_NAME, "readonly");
            const store = tx.objectStore(DTR_IMAGE_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const items = req.result || [];
                const bytes = items.reduce((sum, item) => {
                    if (!item) return sum;
                    if (item.blob instanceof Blob) return sum + (item.blob.size || 0);
                    // Mobile IDB strings count as 2 bytes per character under iOS quota enforcement
                    if (typeof item.dataUrl === "string") return sum + (item.dataUrl.length * 2);
                    return sum;
                }, 0);
                resolve(bytes);
            };
            req.onerror = () => reject(buildStoreError("getImageStoreUsageBytes request", req.error));
        });
    });
}

/**
 * Get storage estimate for origin (quota/usage) if available.
 */
function getImageStoreEstimate() {
    if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
        return navigator.storage.estimate();
    }
    return Promise.resolve({ usage: 0, quota: 0 });
}

function saveRecordsToStore(records) {
    const payload = Array.isArray(records) ? records : [];
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_RECORDS_STORE_NAME, "readwrite");
            const store = tx.objectStore(DTR_RECORDS_STORE_NAME);
            tx.onabort = () => reject(buildStoreError("saveRecordsToStore transaction abort", tx.error));
            tx.onerror = () => reject(buildStoreError("saveRecordsToStore transaction", tx.error));

            const req = store.put({ id: DTR_RECORDS_KEY, records: payload });
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(buildStoreError("saveRecordsToStore request", req.error));
        });
    });
}

function getRecordsFromStore() {
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_RECORDS_STORE_NAME, "readonly");
            const store = tx.objectStore(DTR_RECORDS_STORE_NAME);
            const req = store.get(DTR_RECORDS_KEY);
            req.onsuccess = () => {
                if (!req.result || !Array.isArray(req.result.records)) {
                    resolve(null);
                    return;
                }
                resolve(req.result.records);
            };
            req.onerror = () => reject(buildStoreError("getRecordsFromStore request", req.error));
        });
    });
}

function clearRecordsFromStore() {
    return openImageDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DTR_RECORDS_STORE_NAME, "readwrite");
            const store = tx.objectStore(DTR_RECORDS_STORE_NAME);
            const req = store.delete(DTR_RECORDS_KEY);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(buildStoreError("clearRecordsFromStore request", req.error));
        });
    });
}

/**
 * Returns image data URLs for a record. Supports legacy .images (base64) and new .imageIds (IndexedDB).
 */
function getRecordImageUrls(record) {
    if (!record) return Promise.resolve([]);
    if (record.imageIds && record.imageIds.length) {
        return Promise.all(record.imageIds.map((id) => getImageFromStore(id))).then((urls) =>
            urls.filter((u) => u != null)
        );
    }
    if (record.images && record.images.length) {
        return Promise.resolve(record.images.filter((s) => s && typeof s === "string"));
    }
    return Promise.resolve([]);
}
