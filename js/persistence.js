/* GardenSync — Save / Load / State Persistence */

// ---- PLANTING LOG DATA HELPERS (moved from planting-log.js) ----
function getPlantingLogData() {
    return JSON.parse(localStorage.getItem('gardensync_plantlog') || '{}');
}
function savePlantingLogData(data) {
    localStorage.setItem('gardensync_plantlog', JSON.stringify(data));
}

// ---- WEEK KEY HELPER (moved from planting-log.js) ----
function getWeekKey(date) {
    // Get Monday of the week
    var d = new Date(date);
    var day = d.getDay();
    var diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

// ---- DEBOUNCED SAVE (for rapid-fire operations) ----
let _saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 300;

/** Debounced save — batches rapid calls (zoom wheel, keyboard nudge, etc.) */
function debouncedSave() {
    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);
    _saveDebounceTimer = setTimeout(() => {
        _saveDebounceTimer = null;
        saveState();
    }, SAVE_DEBOUNCE_MS);
}

/** Flush any pending debounced save immediately (call before page unload, etc.) */
function flushSave() {
    if (_saveDebounceTimer) {
        clearTimeout(_saveDebounceTimer);
        _saveDebounceTimer = null;
        saveState();
    }
}

function saveState() {
    const data = {
        version: 2,
        containers: state.containers,
        volunteers: state.volunteers,
        canvasZoom: state.canvasZoom,
        canvasOffsetX: state.canvasOffsetX,
        canvasOffsetY: state.canvasOffsetY,
    };
    try {
        localStorage.setItem('gardensync_state', JSON.stringify(data));
    } catch (e) {
        console.warn('[GardenSync] localStorage write failed:', e);
    }
    // Schedule debounced IndexedDB backup
    if (typeof scheduleBackup === 'function') {
        scheduleBackup();
    }
    // Schedule debounced Supabase cloud sync
    if (typeof scheduleSyncDebounced === 'function') {
        scheduleSyncDebounced();
    }
    // Notify listeners (rainfall deficit calc, etc.)
    window.dispatchEvent(new CustomEvent('gardenStateChanged'));
}

function createDefaultGarden() {
    // Create 4 default raised beds in a 2x2 arrangement
    state.containers = [];
    const names = ['BED 1', 'BED 2', 'BED 3', 'BED 4'];
    for (let i = 0; i < 4; i++) {
        state.containers.push({
            id: `container-default-${i}-${Date.now()}`,
            type: 'raised-bed',
            name: names[i],
            canvasX: 40 + (i % 2) * 450,
            canvasY: 40 + Math.floor(i / 2) * 280,
            w: 5, h: 10,
            diameter: null,
            plants: [],
            notes: '',
            volunteer: null
        });
    }
    if (state.containers.length > 0) {
        state.selectedContainer = state.containers[0].id;
    }
}

function applyLoadedState(validated, extras) {
    state.containers = validated.containers;
    state.volunteers = validated.volunteers;
    state.canvasZoom = validated.canvasZoom;
    state.canvasOffsetX = validated.canvasOffsetX;
    state.canvasOffsetY = validated.canvasOffsetY;
    if (state.containers.length > 0 && !state.selectedContainer) {
        state.selectedContainer = state.containers[0].id;
    }
    if (extras) {
        if (extras.plantingLog) savePlantingLogData(extras.plantingLog);
        if (extras.harvests) saveHarvestData(extras.harvests);
        if (extras.journal) saveJournalData(extras.journal);
        if (extras.completedTasks) {
            localStorage.setItem('gardensync_completed_tasks', JSON.stringify(extras.completedTasks));
        }
    }
    renderAllContainers();
    updateContainerSelector();
    updateBedDetails();
    updateToolbarSublabel();
}

function loadSavedState() {
    // Try Supabase first (if available and online)
    if (typeof loadFromSupabase === 'function') {
        loadFromSupabase().then(remote => {
            if (remote && remote.state_data) {
                const localTs = parseInt(localStorage.getItem('gardensync_last_sync_ts') || '0');
                const remoteTs = new Date(remote.updated_at).getTime();
                // Use remote if it's newer than last sync, or if localStorage is empty
                const localSaved = localStorage.getItem('gardensync_state');
                if (!localSaved || remoteTs > localTs) {
                    console.log('[GardenSync] Loading from Supabase (remote is newer)');
                    const validated = validateLoadedState(remote.state_data);
                    if (validated) {
                        applyLoadedState(validated, remote.extras);
                        saveState(); // cache to localStorage
                        setTimeout(() => zoomToFit(), 100);
                        showToast('Garden restored from cloud!');
                        return;
                    }
                }
            }
            // Fall through to local load
            loadSavedStateLocal();
        }).catch(() => {
            loadSavedStateLocal();
        });
        return;
    }
    loadSavedStateLocal();
}

function loadSavedStateLocal() {
    const saved = localStorage.getItem('gardensync_state');
    if (!saved) {
        // Try IndexedDB fallback before creating default garden
        if (typeof loadLatestBackup === 'function') {
            loadLatestBackup().then(snapshot => {
                if (snapshot && snapshot.data) {
                    console.log('[GardenSync] Restoring from IndexedDB backup (localStorage empty)');
                    const validated = validateLoadedState(snapshot.data);
                    if (validated) {
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
                        setTimeout(() => zoomToFit(), 100);
                        showToast('Restored from backup — your garden is safe!');
                        return;
                    }
                }
                // No usable backup — create default
                createDefaultGarden();
                renderAllContainers();
                updateBedDetails();
                updateToolbarSublabel();
                setTimeout(() => zoomToFit(), 100);
            }).catch(() => {
                createDefaultGarden();
                renderAllContainers();
                updateBedDetails();
                updateToolbarSublabel();
                setTimeout(() => zoomToFit(), 100);
            });
            return;
        }
        // No backup system available
        createDefaultGarden();
        renderAllContainers();
        updateBedDetails();
        updateToolbarSublabel();
        // Auto-fit on fresh start
        setTimeout(() => zoomToFit(), 100);
        return;
    }
    try {
        const data = JSON.parse(saved);
        let hadSavedZoom = false;

        let loaded;
        if (data.version === 2 && data.containers) {
            // V2 format — validate all fields
            loaded = validateLoadedState(data);
            hadSavedZoom = typeof data.canvasZoom === 'number' && !isNaN(data.canvasZoom);
        } else if (data.beds) {
            // V1 format — migrate then validate
            const migrated = migrateV1ToV2(data);
            migrated.volunteers = data.volunteers || [];
            loaded = validateLoadedState(migrated);
        } else {
            console.warn('[GardenSync] Unknown state format, starting fresh');
            createDefaultGarden();
            renderAllContainers();
            updateBedDetails();
            updateToolbarSublabel();
            return;
        }

        // Apply validated state
        state.containers = loaded.containers;
        state.volunteers = loaded.volunteers;
        state.canvasZoom = loaded.canvasZoom;
        state.canvasOffsetX = loaded.canvasOffsetX;
        state.canvasOffsetY = loaded.canvasOffsetY;

        if (state.containers.length > 0 && !state.selectedContainer) {
            state.selectedContainer = state.containers[0].id;
        }

        renderAllContainers();
        updateContainerSelector();
        updateBedDetails();
        updateToolbarSublabel();

        // Auto-fit if no saved zoom/offset (e.g. migrated data or first canvas load)
        if (!hadSavedZoom && state.containers.length > 0) {
            setTimeout(() => zoomToFit(), 100);
        }
    } catch(e) {
        console.error('[GardenSync] Failed to load state, starting fresh:', e);
        createDefaultGarden();
        renderAllContainers();
        updateBedDetails();
        updateToolbarSublabel();
    }
}

// ---- CONFIRM MODAL ----
function showConfirm(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal">
            <h3>\u26A0\uFE0F ${title}</h3>
            <p>${message}</p>
            <div class="confirm-actions">
                <button class="tool-btn danger confirm-yes">YES, DO IT</button>
                <button class="tool-btn confirm-no">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-yes').addEventListener('click', () => {
        overlay.remove();
        onConfirm();
    });
    overlay.querySelector('.confirm-no').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ---- QTY FLYUP ----
function showQtyFlyup(el, text, isMinus) {
    const rect = el.getBoundingClientRect();
    const flyup = document.createElement('div');
    flyup.className = 'qty-flyup' + (isMinus ? ' minus' : '');
    flyup.textContent = text;
    flyup.style.left = rect.left + rect.width / 2 - 8 + 'px';
    flyup.style.top = rect.top - 4 + 'px';
    document.body.appendChild(flyup);
    setTimeout(() => flyup.remove(), 600);
}

// ---- TOAST ----
function showToast(msg) {
    // Remove any existing toast
    document.querySelectorAll('.toast-notification').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-leaving');
        setTimeout(() => toast.remove(), 300);
    }, 2200);
}

// ---- GARDEN STATS DASHBOARD ----
