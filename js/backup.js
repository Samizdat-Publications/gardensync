/* GardenSync — IndexedDB Backup & Auto-Save Layer */

const BACKUP_DB_NAME = 'gardensync_backups';
const BACKUP_DB_VERSION = 1;
const BACKUP_STORE = 'snapshots';
const MAX_BACKUPS = 30;
const BACKUP_DEBOUNCE_MS = 5000; // 5 seconds after last save

let _backupDB = null;
let _backupTimer = null;
let _lastSaveTime = 0;

// ---- IndexedDB OPEN ----
function openBackupDB() {
    return new Promise((resolve, reject) => {
        if (_backupDB) { resolve(_backupDB); return; }
        const req = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(BACKUP_STORE)) {
                const store = db.createObjectStore(BACKUP_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        req.onsuccess = (e) => {
            _backupDB = e.target.result;
            resolve(_backupDB);
        };
        req.onerror = (e) => {
            console.warn('[GardenSync] IndexedDB open failed:', e.target.error);
            reject(e.target.error);
        };
    });
}

// ---- BACKUP SNAPSHOT ----
function backupToIDB() {
    return openBackupDB().then(db => {
        return new Promise((resolve, reject) => {
            const snapshot = {
                timestamp: Date.now(),
                dateStr: new Date().toLocaleString(),
                data: {
                    version: 2,
                    containers: JSON.parse(JSON.stringify(state.containers)),
                    volunteers: JSON.parse(JSON.stringify(state.volunteers)),
                    canvasZoom: state.canvasZoom,
                    canvasOffsetX: state.canvasOffsetX,
                    canvasOffsetY: state.canvasOffsetY,
                },
                extras: {
                    plantingLog: getPlantingLogData(),
                    harvests: getHarvestData(),
                    journal: getJournalData(),
                    completedTasks: JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}'),
                },
                stats: {
                    containerCount: state.containers.length,
                    plantCount: state.containers.reduce((s, c) => s + c.plants.length, 0),
                },
            };

            const tx = db.transaction(BACKUP_STORE, 'readwrite');
            const store = tx.objectStore(BACKUP_STORE);
            store.add(snapshot);

            tx.oncomplete = () => {
                _lastSaveTime = Date.now();
                updateSaveIndicator('saved');
                // Prune old backups
                pruneOldBackups(db).then(resolve).catch(resolve);
            };
            tx.onerror = (e) => {
                console.warn('[GardenSync] Backup write failed:', e.target.error);
                reject(e.target.error);
            };
        });
    }).catch(err => {
        console.warn('[GardenSync] Backup skipped:', err);
        updateSaveIndicator('error');
    });
}

// ---- PRUNE OLD BACKUPS ----
function pruneOldBackups(db) {
    return new Promise((resolve) => {
        const tx = db.transaction(BACKUP_STORE, 'readwrite');
        const store = tx.objectStore(BACKUP_STORE);
        const countReq = store.count();
        countReq.onsuccess = () => {
            const total = countReq.result;
            if (total <= MAX_BACKUPS) { resolve(); return; }
            // Delete oldest entries
            const deleteCount = total - MAX_BACKUPS;
            const idx = store.index('timestamp');
            const cursor = idx.openCursor(); // oldest first
            let deleted = 0;
            cursor.onsuccess = (e) => {
                const c = e.target.result;
                if (c && deleted < deleteCount) {
                    c.delete();
                    deleted++;
                    c.continue();
                } else {
                    resolve();
                }
            };
            cursor.onerror = () => resolve();
        };
        countReq.onerror = () => resolve();
    });
}

// ---- SCHEDULE BACKUP (debounced) ----
function scheduleBackup() {
    if (_backupTimer) clearTimeout(_backupTimer);
    updateSaveIndicator('saving');
    _backupTimer = setTimeout(() => {
        backupToIDB();
    }, BACKUP_DEBOUNCE_MS);
}

// ---- GET BACKUP LIST ----
function getBackupList() {
    return openBackupDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE, 'readonly');
            const store = tx.objectStore(BACKUP_STORE);
            const idx = store.index('timestamp');
            const req = idx.openCursor(null, 'prev'); // newest first
            const list = [];
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    const v = cursor.value;
                    list.push({
                        id: v.id,
                        timestamp: v.timestamp,
                        dateStr: v.dateStr,
                        containerCount: v.stats ? v.stats.containerCount : '?',
                        plantCount: v.stats ? v.stats.plantCount : '?',
                    });
                    cursor.continue();
                } else {
                    resolve(list);
                }
            };
            req.onerror = (e) => reject(e.target.error);
        });
    });
}

// ---- RESTORE A SPECIFIC BACKUP ----
function restoreFromBackup(backupId) {
    return openBackupDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE, 'readonly');
            const store = tx.objectStore(BACKUP_STORE);
            const req = store.get(backupId);
            req.onsuccess = (e) => {
                const snapshot = e.target.result;
                if (!snapshot) { reject(new Error('Backup not found')); return; }

                // Validate and apply state data
                const validated = validateLoadedState(snapshot.data);
                if (!validated) { reject(new Error('Backup data is corrupt')); return; }

                state.containers = validated.containers;
                state.volunteers = validated.volunteers;
                state.canvasZoom = validated.canvasZoom;
                state.canvasOffsetX = validated.canvasOffsetX;
                state.canvasOffsetY = validated.canvasOffsetY;

                if (state.containers.length > 0 && !state.selectedContainer) {
                    state.selectedContainer = state.containers[0].id;
                }

                // Restore extras
                if (snapshot.extras) {
                    if (snapshot.extras.plantingLog) savePlantingLogData(snapshot.extras.plantingLog);
                    if (snapshot.extras.harvests) saveHarvestData(snapshot.extras.harvests);
                    if (snapshot.extras.journal) saveJournalData(snapshot.extras.journal);
                    if (snapshot.extras.completedTasks) {
                        localStorage.setItem('gardensync_completed_tasks', JSON.stringify(snapshot.extras.completedTasks));
                    }
                }

                renderAllContainers();
                updateContainerSelector();
                updateBedDetails();
                updateToolbarSublabel();
                saveState(); // Re-persist to localStorage
                setTimeout(() => zoomToFit(), 150);

                resolve(snapshot);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    });
}

// ---- LOAD LATEST BACKUP (fallback if localStorage empty) ----
function loadLatestBackup() {
    return openBackupDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(BACKUP_STORE, 'readonly');
            const store = tx.objectStore(BACKUP_STORE);
            const idx = store.index('timestamp');
            const req = idx.openCursor(null, 'prev'); // newest
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    resolve(cursor.value);
                } else {
                    resolve(null); // No backups
                }
            };
            req.onerror = () => resolve(null);
        });
    }).catch(() => null);
}

// ---- SAVE INDICATOR UI ----
function updateSaveIndicator(status) {
    const el = document.getElementById('save-indicator');
    if (!el) return;

    el.className = 'save-indicator';
    switch (status) {
        case 'saving':
            el.innerHTML = '<span class="save-dot saving"></span> Saving…';
            el.classList.add('status-saving');
            break;
        case 'saved':
            el.innerHTML = '<span class="save-dot saved"></span> Saved';
            el.classList.add('status-saved');
            break;
        case 'error':
            el.innerHTML = '<span class="save-dot error"></span> Backup failed';
            el.classList.add('status-error');
            break;
        default:
            el.innerHTML = '';
    }
}

// ---- BACKUP BROWSER MODAL ----
function showBackupBrowser() {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal backup-browser-modal">
            <h3>💾 BACKUP HISTORY</h3>
            <p style="margin-bottom:12px;opacity:.7;">Your garden is auto-saved to IndexedDB every 5 seconds. Choose a snapshot to restore.</p>
            <div id="backup-list" class="backup-list">
                <div class="backup-loading">Loading backups…</div>
            </div>
            <div class="confirm-actions" style="margin-top:14px;">
                <button class="tool-btn confirm-no">CLOSE</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-no').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Load backup list
    getBackupList().then(list => {
        const container = overlay.querySelector('#backup-list');
        if (list.length === 0) {
            container.innerHTML = '<div class="backup-empty">No backups yet. Backups are created automatically as you work.</div>';
            return;
        }
        container.innerHTML = list.map(b => {
            const ago = getTimeAgo(b.timestamp);
            return `
                <div class="backup-entry" data-backup-id="${b.id}">
                    <div class="backup-info">
                        <span class="backup-date">${b.dateStr}</span>
                        <span class="backup-ago">${ago}</span>
                    </div>
                    <div class="backup-stats">
                        ${b.containerCount} container${b.containerCount !== 1 ? 's' : ''} · ${b.plantCount} plant${b.plantCount !== 1 ? 's' : ''}
                    </div>
                    <button class="tool-btn backup-restore-btn" data-backup-id="${b.id}">RESTORE</button>
                </div>
            `;
        }).join('');

        // Wire restore buttons
        container.querySelectorAll('.backup-restore-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.backupId);
                const entry = list.find(b => b.id === id);
                showConfirm('RESTORE BACKUP',
                    `Restore backup from <strong>${entry ? entry.dateStr : 'unknown'}</strong>?<br>This replaces your current garden.`,
                    () => {
                        restoreFromBackup(id).then(snapshot => {
                            overlay.remove();
                            showToast(`Restored backup: ${snapshot.dateStr}`);
                        }).catch(err => {
                            showToast('Restore failed: ' + err.message);
                        });
                    }
                );
            });
        });
    }).catch(err => {
        const container = overlay.querySelector('#backup-list');
        container.innerHTML = `<div class="backup-empty">Failed to load backups: ${err.message}</div>`;
    });
}

// ---- TIME AGO HELPER ----
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ---- INIT ----
function initBackupSystem() {
    // Wire restore button
    const restoreBtn = document.getElementById('btn-restore-backup');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', showBackupBrowser);
    }

    // Kick off an initial backup after a short delay
    setTimeout(() => {
        if (state.containers.length > 0) {
            backupToIDB().then(() => {
                console.log('[GardenSync] Initial backup saved');
            });
        }
    }, 3000);
}
