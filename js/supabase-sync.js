/* GardenSync — Supabase Cloud Sync */

const SUPABASE_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SUPABASE_SYNC_DEBOUNCE_MS = 2000;           // 2 seconds

let _supabaseClient = null;
let _gardenId = null;
let _syncTimer = null;
let _syncDebounceTimer = null;
let _lastSyncedHash = null;
let _isSyncing = false;

// ---- GARDEN ID ----
function getOrCreateGardenId() {
    _gardenId = localStorage.getItem('gardensync_garden_id');
    if (!_gardenId) {
        _gardenId = 'garden-' + crypto.randomUUID();
        localStorage.setItem('gardensync_garden_id', _gardenId);
    }
    return _gardenId;
}

// ---- PAYLOAD ----
function buildSyncPayload() {
    return {
        state_data: {
            version: 2,
            containers: state.containers,
            volunteers: state.volunteers,
            canvasZoom: state.canvasZoom,
            canvasOffsetX: state.canvasOffsetX,
            canvasOffsetY: state.canvasOffsetY,
        },
        extras: {
            plantingLog: typeof getPlantingLogData === 'function' ? getPlantingLogData() : {},
            harvests: typeof getHarvestData === 'function' ? getHarvestData() : {},
            journal: typeof getJournalData === 'function' ? getJournalData() : {},
            completedTasks: JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}'),
        }
    };
}

function computePayloadHash(payload) {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

// ---- SYNC TO SUPABASE ----
async function syncToSupabase() {
    if (!_supabaseClient || _isSyncing) return;

    const payload = buildSyncPayload();
    const hash = computePayloadHash(payload);
    if (hash === _lastSyncedHash) return; // no changes

    _isSyncing = true;
    updateSyncIndicator('syncing');

    try {
        const { error } = await _supabaseClient
            .from('garden_state')
            .upsert({
                garden_id: _gardenId,
                state_data: payload.state_data,
                extras: payload.extras,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'garden_id' });

        if (error) throw error;

        _lastSyncedHash = hash;
        localStorage.setItem('gardensync_last_sync_ts', Date.now().toString());
        updateSyncIndicator('synced');
        console.log('[GardenSync] Synced to Supabase');
    } catch (err) {
        console.warn('[GardenSync] Supabase sync failed:', err);
        updateSyncIndicator('offline');
    } finally {
        _isSyncing = false;
    }
}

// ---- LOAD FROM SUPABASE ----
async function loadFromSupabase() {
    if (!_supabaseClient || !_gardenId) return null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const { data, error } = await _supabaseClient
            .from('garden_state')
            .select('*')
            .eq('garden_id', _gardenId)
            .single()
            .abortSignal(controller.signal);

        clearTimeout(timeout);

        if (error) {
            if (error.code === 'PGRST116') return null; // no row found
            throw error;
        }
        return data;
    } catch (err) {
        console.warn('[GardenSync] Supabase load failed (will use localStorage):', err.message);
        return null;
    }
}

// ---- DEBOUNCED SYNC ----
function scheduleSyncDebounced() {
    if (!_supabaseClient) return;
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => {
        _syncDebounceTimer = null;
        syncToSupabase();
    }, SUPABASE_SYNC_DEBOUNCE_MS);
}

// ---- FLUSH (for page unload) ----
function flushSync() {
    if (!_supabaseClient || !_gardenId) return;

    // Clear any pending debounce
    if (_syncDebounceTimer) {
        clearTimeout(_syncDebounceTimer);
        _syncDebounceTimer = null;
    }

    const payload = buildSyncPayload();
    const hash = computePayloadHash(payload);
    if (hash === _lastSyncedHash) return;

    // Mark pending so next session picks it up
    localStorage.setItem('gardensync_pending_sync', 'true');

    // Attempt sendBeacon as fire-and-forget
    try {
        const url = SUPABASE_URL + '/rest/v1/garden_state?on_conflict=garden_id';
        const body = JSON.stringify({
            garden_id: _gardenId,
            state_data: payload.state_data,
            extras: payload.extras,
            updated_at: new Date().toISOString(),
        });
        const headers = {
            type: 'application/json',
        };
        // sendBeacon can't set custom headers, so we use fetch with keepalive
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Prefer': 'resolution=merge-duplicates',
            },
            body: body,
            keepalive: true,
        }).catch(() => {}); // fire-and-forget
    } catch (e) {
        // Worst case: pending_sync flag ensures next load syncs
    }
}

// ---- UI INDICATOR ----
function updateSyncIndicator(status) {
    let el = document.getElementById('cloud-sync-indicator');
    if (!el) {
        // Create indicator next to save indicator
        const saveInd = document.getElementById('save-indicator');
        if (!saveInd) return;
        el = document.createElement('span');
        el.id = 'cloud-sync-indicator';
        el.style.cssText = 'margin-left:8px;font-size:11px;opacity:0.7;';
        saveInd.parentNode.insertBefore(el, saveInd.nextSibling);
    }
    switch (status) {
        case 'syncing':
            el.textContent = '☁ syncing...';
            el.style.color = 'var(--accent, #10b981)';
            break;
        case 'synced':
            el.textContent = '☁ synced';
            el.style.color = 'var(--accent, #10b981)';
            break;
        case 'offline':
            el.textContent = '☁ offline';
            el.style.color = '#f59e0b';
            break;
    }
}

// ---- INIT ----
function initSupabaseSync() {
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
        console.warn('[GardenSync] Supabase config missing, remote sync disabled');
        return;
    }

    try {
        _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.warn('[GardenSync] Supabase client init failed:', e);
        return;
    }

    getOrCreateGardenId();

    // Start periodic sync (every 5 minutes)
    _syncTimer = setInterval(() => syncToSupabase(), SUPABASE_SYNC_INTERVAL_MS);

    // If we had a pending sync from last session, sync now
    if (localStorage.getItem('gardensync_pending_sync') === 'true') {
        localStorage.removeItem('gardensync_pending_sync');
        setTimeout(() => syncToSupabase(), 3000);
    }

    // Initial sync after startup settles
    setTimeout(() => syncToSupabase(), 10000);

    console.log('[GardenSync] Supabase sync initialized, garden ID:', _gardenId);
}
