/* GardenSync — Application State & Undo/Redo */

/** Escape HTML special characters to prevent XSS when inserting into innerHTML */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getContainerPixelDims(container) {
    const type = CONTAINER_TYPES[container.type];
    if (type.shape === 'circle') {
        const d = container.diameter || type.defaultDiameter;
        const px = d * CANVAS_PX_PER_FOOT;
        return { width: px, height: px, isCircle: true };
    } else {
        const rawW = (container.w || type.defaultW) * CANVAS_PX_PER_FOOT;
        const rawH = (container.h || type.defaultH) * CANVAS_PX_PER_FOOT;
        // Default (landscape): longer dimension horizontal
        // When container.vertical is true (portrait): shorter dimension horizontal
        const width = container.vertical ? Math.min(rawW, rawH) : Math.max(rawW, rawH);
        const height = container.vertical ? Math.max(rawW, rawH) : Math.min(rawW, rawH);
        return { width, height, isCircle: false };
    }
}

function getContainerPxPerInch(container) {
    return CANVAS_PX_PER_FOOT / 12;
}

function getContainerArea(container) {
    const type = CONTAINER_TYPES[container.type];
    if (type.shape === 'circle') {
        const r = ((container.diameter || type.defaultDiameter) * 12) / 2;
        return Math.PI * r * r; // sq inches
    }
    return (container.w || type.defaultW) * (container.h || type.defaultH) * 144;
}

// ---- APP STATE ----
const state = {
    containers: [],                 // array of container objects
    selectedContainer: null,        // ID of selected container
    canvasZoom: 1,
    canvasOffsetX: 0,
    canvasOffsetY: 0,
    volunteers: [],
    geminiKey: localStorage.getItem('gardensync_gemini_key') || '',
    dragData: null,
    undoStack: [],
    redoStack: [],
    clickPlaceMode: null,
    selectedPlacements: [],
    _infoPanelDismiss: null,
    companionNetworkOn: (function(){
        var v = localStorage.getItem('gardensync.companionNetworkOn');
        return v === null ? true : v === 'true';
    })(),
    tweaks: (function(){
        var defaults = {
            bloom: true,
            living: true,
            timeline: false,
            companion: true,
            companionAlways: true,
            heatmap: false,
            harvestBurst: true,
            tickerStats: true,
            pageTurn: true,
        };
        var out = {};
        Object.keys(defaults).forEach(function(k){
            var v = localStorage.getItem('gardensync.tweaks.' + k);
            out[k] = v === null ? defaults[k] : v === 'true';
        });
        return out;
    })(),
};

// ---- CONTAINER HELPERS ----
function getContainer(id) {
    return state.containers.find(c => c.id === id);
}

function getSelectedContainer() {
    return state.containers.find(c => c.id === state.selectedContainer);
}

function getContainerIndex(id) {
    return state.containers.findIndex(c => c.id === id);
}

function selectContainer(id) {
    state.selectedContainer = id;
    document.querySelectorAll('.garden-bed').forEach(el => el.classList.remove('selected'));
    const el = document.querySelector(`.garden-bed[data-container-id="${id}"]`);
    if (el) el.classList.add('selected');
    updateContainerSelector();
    updateBedDetails();
}

// ---- STATE VALIDATION ----
// Ensures loaded data has all required fields with correct types.
// Fills in defaults for missing properties, removes corrupt entries.

function validatePlacement(p) {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.plantId !== 'string' || !p.plantId) return null;

    // Ensure required fields
    if (!p.id || typeof p.id !== 'string') {
        p.id = `${p.plantId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }
    if (typeof p.x !== 'number' || isNaN(p.x)) p.x = 0;
    if (typeof p.y !== 'number' || isNaN(p.y)) p.y = 0;

    // Clamp to non-negative
    p.x = Math.max(0, p.x);
    p.y = Math.max(0, p.y);

    return p;
}

function validateContainer(c) {
    if (!c || typeof c !== 'object') return null;

    // Must have an id
    if (!c.id || typeof c.id !== 'string') {
        c.id = `container-repair-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    }

    // Type must be valid
    if (!c.type || !CONTAINER_TYPES[c.type]) {
        c.type = 'raised-bed'; // default fallback
    }

    const typeDef = CONTAINER_TYPES[c.type];

    // Name
    if (typeof c.name !== 'string' || !c.name) {
        c.name = typeDef.label || 'Container';
    }

    // Canvas position
    if (typeof c.canvasX !== 'number' || isNaN(c.canvasX)) c.canvasX = 40;
    if (typeof c.canvasY !== 'number' || isNaN(c.canvasY)) c.canvasY = 40;

    // Dimensions — rect containers
    if (typeDef.shape === 'rect') {
        if (typeof c.w !== 'number' || isNaN(c.w)) c.w = typeDef.defaultW;
        if (typeof c.h !== 'number' || isNaN(c.h)) c.h = typeDef.defaultH;
        c.w = Math.max(typeDef.minW, Math.min(typeDef.maxW, c.w));
        c.h = Math.max(typeDef.minH, Math.min(typeDef.maxH, c.h));
    }

    // Dimensions — circle containers
    if (typeDef.shape === 'circle') {
        if (typeof c.diameter !== 'number' || isNaN(c.diameter)) c.diameter = typeDef.defaultDiameter;
        c.diameter = Math.max(typeDef.minDiameter, Math.min(typeDef.maxDiameter, c.diameter));
    }

    // Plants array — validate each placement, remove corrupt ones
    if (!Array.isArray(c.plants)) {
        c.plants = [];
    } else {
        c.plants = c.plants.map(validatePlacement).filter(Boolean);
    }

    // Optional fields
    if (typeof c.notes !== 'string') c.notes = '';
    if (c.volunteer !== null && typeof c.volunteer !== 'string') c.volunteer = null;

    return c;
}

function validateLoadedState(data) {
    if (!data || typeof data !== 'object') return null;

    const result = {
        version: 2,
        containers: [],
        volunteers: [],
        canvasZoom: 1,
        canvasOffsetX: 0,
        canvasOffsetY: 0,
    };

    // Containers
    if (Array.isArray(data.containers)) {
        result.containers = data.containers.map(validateContainer).filter(Boolean);
    }

    // Deduplicate container IDs (keep first occurrence)
    const seenIds = new Set();
    result.containers = result.containers.filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
    });

    // Volunteers
    if (Array.isArray(data.volunteers)) {
        result.volunteers = data.volunteers.filter(v => v && typeof v === 'object');
    }

    // Canvas state
    if (typeof data.canvasZoom === 'number' && !isNaN(data.canvasZoom)) {
        result.canvasZoom = Math.max(0.2, Math.min(3, data.canvasZoom));
    }
    if (typeof data.canvasOffsetX === 'number' && !isNaN(data.canvasOffsetX)) {
        result.canvasOffsetX = data.canvasOffsetX;
    }
    if (typeof data.canvasOffsetY === 'number' && !isNaN(data.canvasOffsetY)) {
        result.canvasOffsetY = data.canvasOffsetY;
    }

    return result;
}

// ---- MIGRATION V1 -> V2 ----
function migrateV1ToV2(oldData) {
    const oldBedNames = JSON.parse(localStorage.getItem('gardensync_bed_names') || 'null') || ['BED 1','BED 2','BED 3','BED 4'];
    const oldBedSizes = JSON.parse(localStorage.getItem('gardensync_bed_sizes') || 'null') || [{w:5,h:10},{w:5,h:10},{w:5,h:10},{w:5,h:10}];

    const containers = [];
    for (let i = 0; i < 4; i++) {
        const plants = (oldData.beds && oldData.beds[i]) ? oldData.beds[i] : [];
        containers.push({
            id: `bed-migrated-${i}`,
            type: 'raised-bed',
            name: oldBedNames[i],
            canvasX: 50 + (i % 2) * 450,
            canvasY: 50 + Math.floor(i / 2) * 280,
            w: oldBedSizes[i].w,
            h: oldBedSizes[i].h,
            diameter: null,
            plants: plants,
            notes: '',
            volunteer: oldData.bedAssignments ? oldData.bedAssignments[i] : null,
        });
    }
    return { containers };
}

// ---- UNDO / REDO ENGINE ----
function pushUndo() {
    state.undoStack.push(JSON.parse(JSON.stringify(state.containers)));
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (state.undoStack.length === 0) return;
    clearSelection(); // Clear stale selection refs before swapping state
    state.redoStack.push(JSON.parse(JSON.stringify(state.containers)));
    state.containers = state.undoStack.pop();
    renderAllContainers();
    updateContainerSelector();
    updateBedDetails();
    updateToolbarSublabel();
    saveState();
    updateUndoRedoButtons();
    showToast('Undo');
}

function redo() {
    if (state.redoStack.length === 0) return;
    clearSelection(); // Clear stale selection refs before swapping state
    state.undoStack.push(JSON.parse(JSON.stringify(state.containers)));
    state.containers = state.redoStack.pop();
    renderAllContainers();
    updateContainerSelector();
    updateBedDetails();
    updateToolbarSublabel();
    saveState();
    updateUndoRedoButtons();
    showToast('Redo');
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.classList.toggle('disabled', state.undoStack.length === 0);
    if (redoBtn) redoBtn.classList.toggle('disabled', state.redoStack.length === 0);
}

// ---- CLICK-TO-PLACE ENGINE ----
