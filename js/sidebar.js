/* GardenSync — Sidebar (Container Selector, BED_TEMPLATES Data) */

function initBedSelector() {
    initContainerSelector();
}

function initContainerSelector() {
    updateContainerSelector();
}

function updateContainerSelector() {
    const selector = document.getElementById('bed-selector');
    if (!selector) return;
    selector.innerHTML = '';
    state.containers.forEach(container => {
        const typeDef = CONTAINER_TYPES[container.type];
        const btn = document.createElement('button');
        btn.className = 'bed-tab' + (state.selectedContainer === container.id ? ' active' : '');
        btn.dataset.containerId = container.id;
        const plantCount = container.plants.length;
        btn.innerHTML = `<span class="bed-tab-icon">${typeDef.icon}</span> ${container.name} <span class="bed-tab-count">${plantCount}</span>`;
        btn.title = `${typeDef.label} — ${plantCount} plant${plantCount !== 1 ? 's' : ''}`;
        btn.addEventListener('click', () => {
            selectContainer(container.id);
            highlightActiveContainer(container.id);
        });
        selector.appendChild(btn);
    });
}

function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    // Restore saved theme
    const saved = localStorage.getItem('gardensync_theme') || 'dark';
    if (saved === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        btn.textContent = 'DARK';
    }
    btn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.documentElement.removeAttribute('data-theme');
            btn.textContent = 'LIGHT';
            localStorage.setItem('gardensync_theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            btn.textContent = 'DARK';
            localStorage.setItem('gardensync_theme', 'light');
        }
    });
}

function initQuickAdd() {
    const select = document.getElementById('quick-add-select');
    if (!select) return;
    // Populate with all plants sorted alphabetically
    PLANT_LIBRARY.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.emoji} ${p.name}`;
        select.appendChild(opt);
    });
    document.getElementById('btn-quick-add').addEventListener('click', () => {
        const plantId = select.value;
        if (!plantId) { showToast('Select a plant first'); return; }
        const containerId = state.selectedContainer;
        const container = getContainer(containerId);
        if (!container) { showToast('Select a container first'); return; }
        const pos = findNextOpenPosition(containerId, plantId);
        placePlant(containerId, plantId, pos.x, pos.y);
        showToast(`${PLANT_LIBRARY.find(p => p.id === plantId)?.emoji} planted in ${container.name}`);
    });
    document.getElementById('btn-fill-row').addEventListener('click', () => {
        const plantId = select.value;
        if (!plantId) { showToast('Select a plant first'); return; }
        const containerId = state.selectedContainer;
        const container = getContainer(containerId);
        if (!container) { showToast('Select a container first'); return; }
        const plant = PLANT_LIBRARY.find(p => p.id === plantId);
        if (!plant) return;
        const positions = findRowPositions(containerId, plant);
        if (positions.length === 0) { showToast('No room for a row!'); return; }
        pushUndo();
        positions.forEach(pos => {
            const placement = {
                id: `${plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                plantId, x: pos.x, y: pos.y
            };
            container.plants.push(placement);
        });
        renderPlacedPlants(containerId);
        updateBedDetails();
        updateSpacingWarnings(containerId);
        saveState();
        showToast(`${plant.emoji} x${positions.length} row planted in ${container.name}`);
    });
}

function findRowPositions(containerId, plant) {
    const bedW = 400, bedH = 220;
    const container = getContainer(containerId);
    const containerIdx = getContainerIndex(containerId);
    const pxPerInch = getBedPxPerInch(containerIdx);
    const spacingPx = Math.max(20, Math.round(plant.spacing * pxPerInch));
    const existing = container ? container.plants.map(p => ({ x: p.x + 18, y: p.y + 18 })) : [];
    for (let y = 14; y < bedH - 20; y += spacingPx) {
        const rowPositions = [];
        let rowClear = true;
        for (let x = 14; x < bedW - 20; x += spacingPx) {
            const tooClose = existing.some(e => Math.hypot(e.x - x, e.y - y) < spacingPx * 0.6);
            if (tooClose) { rowClear = false; break; }
            rowPositions.push({ x: snapToGrid(x - 18), y: snapToGrid(y - 18) });
        }
        if (rowClear && rowPositions.length >= 2) return rowPositions;
    }
    return [];
}

function findNextOpenPosition(containerId, plantId) {
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    const spacing = plant ? plant.spacing : 12;
    const gridStep = Math.max(20, Math.round(spacing * 0.8));
    const bedW = 400, bedH = 220;
    const container = getContainer(containerId);
    const existing = container ? container.plants.map(p => ({ x: p.x + 18, y: p.y + 18 })) : [];
    // Scan grid positions to find the first one that doesn't overlap
    for (let y = 10; y < bedH - 20; y += gridStep) {
        for (let x = 10; x < bedW - 20; x += gridStep) {
            const cx = x, cy = y;
            const tooClose = existing.some(e =>
                Math.hypot(e.x - cx, e.y - cy) < gridStep * 0.8
            );
            if (!tooClose) return { x: snapToGrid(x - 18), y: snapToGrid(y - 18) };
        }
    }
    // Fallback: random position
    return { x: snapToGrid(Math.random() * (bedW - 60)), y: snapToGrid(Math.random() * (bedH - 60)) };
}

// ---- BED TEMPLATES ----
const BED_TEMPLATES = [
    {
        name: 'Salsa Garden',
        desc: 'Tomatoes, peppers, onion, basil & cilantro \u2014 everything for fresh salsa',
        plants: [
            { id: 'tomato', count: 4 },
            { id: 'pepper', count: 3 },
            { id: 'onion', count: 4 },
            { id: 'basil', count: 3 },
        ]
    },
    {
        name: 'Pizza Garden',
        desc: 'Tomatoes, basil, pepper & oregano \u2014 grow your own pizza toppings',
        plants: [
            { id: 'tomato', count: 4 },
            { id: 'basil', count: 4 },
            { id: 'pepper', count: 3 },
        ]
    },
    {
        name: 'Three Sisters',
        desc: 'Corn, beans & squash \u2014 classic Native American companion planting',
        plants: [
            { id: 'zucchini', count: 2 },
            { id: 'green-beans', count: 8 },
        ]
    },
    {
        name: 'Salad Bowl',
        desc: 'Lettuce, spinach, radish & carrot \u2014 quick-harvest salad greens',
        plants: [
            { id: 'lettuce', count: 8 },
            { id: 'spinach', count: 6 },
            { id: 'radish', count: 6 },
            { id: 'carrot', count: 5 },
        ]
    },
    {
        name: 'Pollinator Patch',
        desc: 'Sunflowers, marigolds, nasturtium & sweet peas \u2014 attract bees & butterflies',
        plants: [
            { id: 'sunflower', count: 3 },
            { id: 'marigold', count: 5 },
            { id: 'nasturtium', count: 4 },
            { id: 'sweet-peas', count: 4 },
        ]
    },
    {
        name: 'Herb Haven',
        desc: 'Basil, thyme, chives, dill & mint \u2014 a complete kitchen herb garden',
        plants: [
            { id: 'basil', count: 4 },
            { id: 'thyme', count: 3 },
            { id: 'chive', count: 4 },
            { id: 'dill', count: 3 },
            { id: 'mint', count: 2 },
        ]
    },
    {
        name: 'Kids Garden',
        desc: 'Sunflowers, strawberries, radish & carrots \u2014 fun, fast & easy for kids',
        plants: [
            { id: 'sunflower', count: 2 },
            { id: 'strawberry', count: 4 },
            { id: 'radish', count: 6 },
            { id: 'carrot', count: 5 },
        ]
    },
];

function applyBedTemplate(containerId, template) {
    pushUndo();
    const container = typeof containerId === 'number' ? state.containers[containerId] : getContainer(containerId);
    if (!container) return;
    const cId = container.id;
    // Clear the container first
    container.plants = [];
    // Place each plant type using grid placement
    template.plants.forEach(({ id: plantId, count }) => {
        for (let n = 0; n < count; n++) {
            const pos = findNextOpenPosition(cId, plantId);
            const placement = {
                id: `${plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                plantId, x: pos.x, y: pos.y
            };
            container.plants.push(placement);
        }
    });
    renderPlacedPlants(cId);
    updateBedDetails();
    updateSpacingWarnings(cId);
    saveState();
}

// ---- CUSTOM SEEDS ----
