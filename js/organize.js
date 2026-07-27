/* GardenSync — Auto-Organize & Preset Gardens */

function autoOrganizeBed(containerId, silent) {
    // Support both containerId string and legacy bedIndex number
    const container = typeof containerId === 'number' ? state.containers[containerId] : getContainer(containerId);
    if (!container) return;
    const cId = container.id;
    const plants = container.plants;
    if (plants.length === 0) {
        if (!silent) showToast('No plants to organize in this container!');
        return;
    }

    const bedEl = document.querySelector(`.garden-bed[data-container-id="${cId}"]`);
    if (!bedEl) return;
    const bedW = bedEl.offsetWidth;
    const bedH = bedEl.offsetHeight;

    const typeDef = CONTAINER_TYPES[container.type];
    const isCircle = typeDef && typeDef.shape === 'circle';
    const PLANT_SIZE = 36; // px per plant icon

    if (isCircle) {
        autoOrganizeCircle(plants, bedW, bedH, PLANT_SIZE);
    } else {
        autoOrganizeRect(plants, bedW, bedH, PLANT_SIZE);
    }

    renderPlacedPlants(cId);
    updateBedDetails();
    saveState();
    if (!silent) showToast(`${container.name} auto-organized!`);
}

// Circular container layout: concentric rings from center outward
function autoOrganizeCircle(plants, w, h, plantSize) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2;
    // Usable radius (inset from border and labels)
    const labelInset = 20; // top label zone
    const usable = radius - plantSize / 2 - 6;
    const half = plantSize / 2;
    const n = plants.length;

    if (n === 0) return;

    // Build positions: center, then concentric rings
    const positions = [];

    // Center position
    positions.push({ x: cx - half, y: cy - half });

    // Rings
    let ringIdx = 1;
    while (positions.length < n) {
        const ringR = usable * (ringIdx / Math.ceil(n <= 1 ? 1 : Math.sqrt(n) * 0.8));
        const actualR = Math.min(ringR, usable);
        // How many fit on this ring? Circumference / plantSize with some spacing
        const circumference = 2 * Math.PI * actualR;
        const perRing = Math.max(1, Math.floor(circumference / (plantSize + 4)));

        for (let i = 0; i < perRing && positions.length < n; i++) {
            // Start from top, go clockwise, offset to avoid label overlap
            const angle = (2 * Math.PI * i / perRing) - Math.PI / 2 + 0.3;
            const px = cx + actualR * Math.cos(angle) - half;
            const py = cy + actualR * Math.sin(angle) - half;
            positions.push({ x: px, y: py });
        }
        ringIdx++;
        if (ringIdx > 10) break; // safety
    }

    // Clamp all positions inside the circle
    plants.forEach((p, i) => {
        if (i < positions.length) {
            const pos = positions[i];
            // Ensure the plant center is inside the circle
            const pcx = pos.x + half;
            const pcy = pos.y + half;
            const dx = pcx - cx;
            const dy = pcy - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > usable) {
                const scale = usable / dist;
                p.x = cx + dx * scale - half;
                p.y = cy + dy * scale - half;
            } else {
                p.x = pos.x;
                p.y = pos.y;
            }
        } else {
            // Overflow: scatter inside circle
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.random() * usable * 0.8;
            p.x = cx + r * Math.cos(angle) - half;
            p.y = cy + r * Math.sin(angle) - half;
        }
        // Final clamp to element bounds
        p.x = Math.max(2, Math.min(p.x, w - plantSize - 2));
        p.y = Math.max(2, Math.min(p.y, h - plantSize - 2));
    });
}

// Rectangular container layout: spacing-aware placement that fills the full bed
function autoOrganizeRect(plants, bedW, bedH, plantSize) {
    if (plants.length === 0) return;

    const pxPerInch = CANVAS_PX_PER_FOOT / 12;
    const half = plantSize / 2;
    const edgePad = half + 2; // keep icons inside bed border

    // Group plants by type and enrich with spacing data
    const groups = {};
    plants.forEach(p => {
        if (!groups[p.plantId]) {
            const lib = PLANT_LIBRARY.find(lp => lp.id === p.plantId);
            const spacingIn = lib ? lib.spacing : 12;
            groups[p.plantId] = {
                lib, spacingPx: Math.max(spacingIn * pxPerInch, plantSize),
                placements: []
            };
        }
        groups[p.plantId].placements.push(p);
    });

    // Sort groups by spacing descending (big plants first)
    const sorted = Object.values(groups).sort((a, b) => b.spacingPx - a.spacingPx);

    const usableH = bedH - edgePad * 2;
    const usableW = bedW - edgePad * 2;

    // Choose band direction based on container aspect ratio:
    // Wide containers -> vertical bands (columns), tall/square -> horizontal bands (rows)
    const useVerticalBands = bedW > bedH * 1.5;

    const primarySize = useVerticalBands ? usableW : usableH; // band axis
    const crossSize = useVerticalBands ? usableH : usableW;   // within-band axis

    // Each group's weight based on estimated band consumption
    let totalWeight = 0;
    const groupMeta = sorted.map(g => {
        const n = g.placements.length;
        const estCross = Math.max(1, Math.floor(crossSize / g.spacingPx));
        const estPrimary = Math.ceil(n / estCross);
        const weight = estPrimary * g.spacingPx;
        totalWeight += weight;
        return { ...g, weight };
    });

    // Compute band sizes proportionally, guaranteed to sum to primarySize
    const bandSizes = groupMeta.map(g => (g.weight / totalWeight) * primarySize);
    bandSizes.forEach((s, i) => { bandSizes[i] = Math.max(plantSize, s); });
    const bandSum = bandSizes.reduce((a, b) => a + b, 0);
    const scale = primarySize / bandSum;
    bandSizes.forEach((s, i) => { bandSizes[i] = s * scale; });

    let cursor = edgePad; // current position along primary axis

    groupMeta.forEach((group, gIdx) => {
        const { placements, spacingPx } = group;
        const n = placements.length;
        const bandSize = bandSizes[gIdx];

        // Calculate grid within this band
        const aspectRatio = useVerticalBands ? (bandSize / crossSize) : (crossSize / bandSize);
        let cols, rows;
        if (useVerticalBands) {
            // Band runs along X axis, cross is Y
            cols = Math.max(1, Math.round(Math.sqrt(n * aspectRatio)));
            rows = Math.max(1, Math.ceil(n / cols));
            while (cols > 1 && rows * (cols - 1) >= n) cols--;
            rows = Math.ceil(n / cols);
        } else {
            // Band runs along Y axis, cross is X
            cols = Math.max(1, Math.round(Math.sqrt(n * aspectRatio)));
            rows = Math.max(1, Math.ceil(n / cols));
            while (cols > 1 && rows * (cols - 1) >= n) cols--;
            rows = Math.ceil(n / cols);
        }

        if (useVerticalBands) {
            // Bands are vertical columns: cols along X (band axis), rows along Y (cross axis)
            const cellW = bandSize / cols;
            const cellH = crossSize / rows;
            placements.forEach((p, idx) => {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const cx = cursor + col * cellW + cellW / 2;
                const cy = edgePad + row * cellH + cellH / 2;
                p.x = Math.max(0, Math.min(cx - half, bedW - plantSize));
                p.y = Math.max(0, Math.min(cy - half, bedH - plantSize));
            });
        } else {
            // Bands are horizontal rows: cols along X (cross axis), rows along Y (band axis)
            const cellW = crossSize / cols;
            const cellH = bandSize / rows;
            placements.forEach((p, idx) => {
                const col = idx % cols;
                const row = Math.floor(idx / cols);
                const cx = edgePad + col * cellW + cellW / 2;
                const cy = cursor + row * cellH + cellH / 2;
                p.x = Math.max(0, Math.min(cx - half, bedW - plantSize));
                p.y = Math.max(0, Math.min(cy - half, bedH - plantSize));
            });
        }

        cursor += bandSize;
    });

    // Post-process: repulsion pass to push overlapping plants apart
    // This fixes inter-band spacing violations
    const enriched = plants.map(p => {
        const lib = PLANT_LIBRARY.find(lp => lp.id === p.plantId);
        const spacingIn = lib ? lib.spacing : 12;
        return { p, spacingPx: Math.max(spacingIn * pxPerInch, plantSize) };
    });

    for (let iter = 0; iter < 20; iter++) {
        let moved = false;
        for (let i = 0; i < enriched.length; i++) {
            for (let j = i + 1; j < enriched.length; j++) {
                const a = enriched[i], b = enriched[j];
                const ax = a.p.x + half, ay = a.p.y + half;
                const bx = b.p.x + half, by = b.p.y + half;
                let dx = bx - ax, dy = by - ay;
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
                const minDist = (a.spacingPx + b.spacingPx) / 2 * 0.8;
                if (dist < minDist) {
                    // If plants are at same position, push in a random direction
                    if (dist < 1) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; }
                    const push = (minDist - dist) * 0.6; // push 60% of overlap each iteration
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = (dx / len) * push;
                    const ny = (dy / len) * push;
                    a.p.x = Math.max(0, Math.min(a.p.x - nx, bedW - plantSize));
                    a.p.y = Math.max(0, Math.min(a.p.y - ny, bedH - plantSize));
                    b.p.x = Math.max(0, Math.min(b.p.x + nx, bedW - plantSize));
                    b.p.y = Math.max(0, Math.min(b.p.y + ny, bedH - plantSize));
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }

    // Snap all to grid
    plants.forEach(p => {
        p.x = snapToGrid(p.x);
        p.y = snapToGrid(p.y);
    });
}

// ---- PRESET GARDENS ----
const GARDEN_PRESETS = [
    {
        name: '\u{1F33F} HERB GARDEN',
        desc: 'A fragrant herb garden perfect for cooking and tea. Low maintenance, drought tolerant, and perennial favorites.',
        beds: [
            [
                { plantId: 'basil', count: 4 },
                { plantId: 'thyme', count: 3 },
                { plantId: 'chive', count: 4 },
                { plantId: 'dill', count: 3 },
                { plantId: 'mint', count: 2 },
            ],
            [
                { plantId: 'basil', count: 3 },
                { plantId: 'nasturtium', count: 4 },
                { plantId: 'marigold', count: 4 },
                { plantId: 'chive', count: 3 },
            ],
            [],
            []
        ]
    },
    {
        name: '\u{1F338} BLOOMING POLLINATOR GARDEN',
        desc: 'Attract bees, butterflies, and beneficial insects. Bright colors for community engagement. All low-water selections.',
        beds: [
            [
                { plantId: 'sunflower', count: 3 },
                { plantId: 'marigold', count: 6 },
                { plantId: 'nasturtium', count: 4 },
            ],
            [
                { plantId: 'sweet-peas', count: 5 },
                { plantId: 'marigold', count: 4 },
                { plantId: 'sunflower', count: 2 },
                { plantId: 'nasturtium', count: 3 },
            ],
            [
                { plantId: 'dill', count: 3 },
                { plantId: 'basil', count: 3 },
                { plantId: 'thyme', count: 4 },
                { plantId: 'chive', count: 4 },
            ],
            []
        ]
    },
    {
        name: '\u{1F345} COMMUNITY HARVEST',
        desc: 'Maximum food production for community distribution. Stewart\'s original plan with high-yield, low-maintenance crops for Canton Zone 6a.',
        beds: [
            [
                { plantId: 'tomato', count: 3 },
                { plantId: 'basil', count: 3 },
                { plantId: 'marigold', count: 4 },
            ],
            [
                { plantId: 'green-beans', count: 6 },
                { plantId: 'cucumber', count: 2 },
                { plantId: 'lettuce', count: 4 },
            ],
            [
                { plantId: 'strawberry', count: 4 },
                { plantId: 'spinach', count: 5 },
                { plantId: 'radish', count: 6 },
            ],
            [
                { plantId: 'cantaloupe', count: 2 },
                { plantId: 'sweet-peas', count: 4 },
                { plantId: 'marigold', count: 3 },
                { plantId: 'zucchini', count: 2 },
            ]
        ]
    }
];

function showPresetModal() {
    const modal = document.getElementById('preset-modal');
    const list = document.getElementById('preset-list');

    list.innerHTML = GARDEN_PRESETS.map((preset, i) => {
        const plantNames = preset.beds.flat().map(p => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            return plant ? plant.emoji : '';
        }).join(' ');
        return `
            <div class="preset-card" data-preset="${i}">
                <h3>${preset.name}</h3>
                <div class="preset-desc">${preset.desc}</div>
                <div class="preset-plants">${plantNames}</div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => {
            loadPreset(parseInt(card.dataset.preset));
            modal.classList.add('hidden');
        });
    });

    document.getElementById('btn-load-saved').onclick = () => {
        loadSavedState();
        modal.classList.add('hidden');
        showToast('Saved plan loaded!');
    };

    document.getElementById('close-preset-modal').onclick = () => {
        modal.classList.add('hidden');
    };

    modal.classList.remove('hidden');
}

function loadPreset(presetIndex) {
    const preset = GARDEN_PRESETS[presetIndex];
    // Ensure we have at least as many containers as preset beds
    while (state.containers.length < preset.beds.length) {
        state.containers.push({
            id: `container-preset-${state.containers.length}-${Date.now()}`,
            type: 'raised-bed',
            name: `BED ${state.containers.length + 1}`,
            canvasX: (state.containers.length % 2) * 450,
            canvasY: Math.floor(state.containers.length / 2) * 280,
            w: 5, h: 10, diameter: null,
            plants: [], notes: '', volunteer: null
        });
    }
    // Clear existing plants in the containers we'll use
    for (let i = 0; i < preset.beds.length; i++) {
        state.containers[i].plants = [];
    }

    preset.beds.forEach((bedPlants, bedIdx) => {
        const container = state.containers[bedIdx];
        const bedEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
        const bedW = bedEl ? bedEl.offsetWidth : 400;
        const bedH = bedEl ? bedEl.offsetHeight : 220;
        bedPlants.forEach(({ plantId, count }) => {
            for (let i = 0; i < count; i++) {
                container.plants.push({
                    id: `${plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                    plantId,
                    x: Math.random() * (bedW - 40) + 2,
                    y: Math.random() * (bedH - 40) + 2,
                });
            }
        });
    });

    // Re-render all and auto-organize containers with plants
    renderAllContainers();
    state.containers.forEach(c => {
        if (c.plants.length > 0) {
            autoOrganizeBed(c.id);
        }
    });

    updateContainerSelector();
    updateBedDetails();
    saveState();
    showToast(`Loaded: ${preset.name}`);
    setTimeout(() => zoomToFit(), 150);
}

// ---- SAVE / LOAD ----
