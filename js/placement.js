/* GardenSync — Plant Placement, Spacing & Companion Lines */

function snapToGrid(val, gridSize) {
    gridSize = gridSize || 20;
    return Math.round(val / gridSize) * gridSize;
}

function placePlant(containerId, plantId, x, y) {
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    if (!plant) return;
    const container = getContainer(containerId);
    if (!container) return;

    x = snapToGrid(x);
    y = snapToGrid(y);

    pushUndo();
    const placement = {
        id: `${plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
        plantId,
        x, y
    };
    container.plants.push(placement);

    renderPlacedPlants(containerId); // includes updateSpacingWarnings()
    if (typeof triggerBloom === 'function') {
        triggerBloom(x + 18, y + 18, document.querySelector('.garden-bed[data-container-id="' + containerId + '"]'));
    }
    updateBedDetails();
    saveState();
}

function renderPlacedPlants(containerId) {
    const container = getContainer(containerId);
    if (!container) return;
    const bedEl = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
    if (!bedEl) return;

    bedEl.querySelectorAll('.placed-plant, .spacing-warning, .spacing-radius, .companion-svg').forEach(el => el.remove());

    const hint = bedEl.querySelector('.bed-empty-hint');
    if (hint) hint.style.display = container.plants.length === 0 ? '' : 'none';

    const countBadge = bedEl.querySelector('.bed-count-badge');
    if (countBadge) {
        const cnt = container.plants.length;
        countBadge.textContent = cnt > 0 ? `${cnt} plant${cnt !== 1 ? 's' : ''}` : '';
        countBadge.style.display = cnt > 0 ? '' : 'none';
    }

    // Coverage visualization
    const containerArea = getContainerArea(container);
    let usedArea = 0;
    container.plants.forEach(p => {
        const pl = PLANT_LIBRARY.find(lib => lib.id === p.plantId);
        if (pl) usedArea += Math.PI * Math.pow(pl.spacing / 2, 2);
    });
    const coveragePct = Math.min(100, Math.round((usedArea / containerArea) * 100));
    bedEl.classList.remove('coverage-low', 'coverage-med', 'coverage-high', 'coverage-full');
    if (coveragePct >= 70) bedEl.classList.add('coverage-full');
    else if (coveragePct >= 40) bedEl.classList.add('coverage-high');
    else if (coveragePct >= 15) bedEl.classList.add('coverage-med');
    else if (coveragePct > 0) bedEl.classList.add('coverage-low');

    drawCompanionLines(containerId, bedEl);

    container.plants.forEach((placement) => {
        const plant = PLANT_LIBRARY.find(p => p.id === placement.plantId);
        if (!plant) return;

        const el = document.createElement('div');
        el.className = 'placed-plant';
        el.dataset.water = plant.waterNeed;
        if (isPlacementSelected(placement.id)) {
            el.classList.add('selected');
            if (state.selectedPlacements.length > 1) el.classList.add('multi-selected');
        }
        el.style.left = placement.x + 'px';
        el.style.top = placement.y + 'px';
        el.dataset.placementId = placement.id;
        // Keyboard accessibility: focusable via JS (not Tab) with ARIA
        el.setAttribute('tabindex', '-1');
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', `${plant.name}, position ${Math.round(placement.x)},${Math.round(placement.y)}`);
        el.innerHTML = `${plant.emoji}<span class="plant-tooltip">${plant.name}</span>`;

        // Drag to reposition (supports multi-select group drag, mouse + touch)
        function onPlantDragStart(e) {
            if (e.type === 'mousedown' && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation(); // Prevent container drag or canvas pan

            const { clientX, clientY } = _pointerXY(e);
            const startX = clientX;
            const startY = clientY;
            let hasMoved = false;
            const isShift = e.shiftKey || false;
            const thisIsSelected = isPlacementSelected(placement.id);

            // Determine selection state before drag
            if (!thisIsSelected && !isShift) {
                // Regular click on unselected — select just this one
                selectPlacement(containerId, placement.id, false);
            } else if (!thisIsSelected && isShift) {
                // Shift+click on unselected — add to group
                selectPlacement(containerId, placement.id, true);
            }
            // else: already selected, we'll drag the whole group

            // Build drag group from all selected placements
            const dragGroup = state.selectedPlacements.map(sel => {
                const p = container.plants.find(pp => pp.id === sel.placementId);
                return p ? { placement: p, origX: p.x, origY: p.y } : null;
            }).filter(Boolean);

            pushUndo();

            // Get actual (unscaled) container dimensions for bounds checking
            const bedW = parseFloat(bedEl.style.width) || bedEl.getBoundingClientRect().width / state.canvasZoom;
            const bedH = parseFloat(bedEl.style.height) || bedEl.getBoundingClientRect().height / state.canvasZoom;
            const isCircleContainer = bedEl.classList.contains('container-circle');

            function clampPos(nx, ny) {
                nx = Math.max(0, Math.min(nx, bedW - 36));
                ny = Math.max(0, Math.min(ny, bedH - 36));
                if (isCircleContainer) {
                    const cx = bedW / 2, cy = bedH / 2;
                    const r = Math.min(cx, cy) - 20;
                    const pcx = nx + 18 - cx, pcy = ny + 18 - cy;
                    const dist = Math.sqrt(pcx * pcx + pcy * pcy);
                    if (dist > r) {
                        nx = cx + pcx * r / dist - 18;
                        ny = cy + pcy * r / dist - 18;
                    }
                }
                return { x: nx, y: ny };
            }

            function onMove(me) {
                hasMoved = true;
                const { clientX: mx, clientY: my } = _pointerXY(me);
                const dx = (mx - startX) / state.canvasZoom;
                const dy = (my - startY) / state.canvasZoom;
                dragGroup.forEach(({ placement: p, origX, origY }) => {
                    const clamped = clampPos(origX + dx, origY + dy);
                    p.x = clamped.x;
                    p.y = clamped.y;
                    const pEl = bedEl.querySelector(`.placed-plant[data-placement-id="${p.id}"]`);
                    if (pEl) {
                        pEl.style.left = p.x + 'px';
                        pEl.style.top = p.y + 'px';
                    }
                });
                // Show spacing radii for dragged plants during drag
                removeSpacingRadii(bedEl);
                dragGroup.forEach(({ placement: p }) => {
                    var pl = PLANT_LIBRARY.find(function(lib) { return lib.id === p.plantId; });
                    if (pl) showSpacingRadius(bedEl, p, pl, true);
                });
                // Redraw companion lines live during drag
                bedEl.querySelectorAll('.companion-svg').forEach(function(el) { el.remove(); });
                drawCompanionLines(containerId, bedEl);
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
                if (!hasMoved) {
                    // Click without drag
                    state.undoStack.pop(); // Remove unused undo snapshot
                    if (!isShift) {
                        // Regular click: select just this plant, show info
                        selectPlacement(containerId, placement.id, false);
                        showPlantInfo(placement.plantId);
                    }
                    // Shift+click toggle already handled above
                } else {
                    // Snap all dragged plants to grid
                    dragGroup.forEach(({ placement: p }) => {
                        p.x = snapToGrid(p.x);
                        p.y = snapToGrid(p.y);
                    });
                    renderPlacedPlants(containerId); // includes updateSpacingWarnings()
                    updateBedDetails();
                }
                saveState();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }
        el.addEventListener('mousedown', onPlantDragStart);
        el.addEventListener('touchstart', onPlantDragStart, { passive: false });

        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Preserve multi-selection if right-clicking an already-selected plant
            if (!isPlacementSelected(placement.id)) {
                selectPlacement(containerId, placement.id, false);
            }
            showContextMenu(e.clientX, e.clientY, containerId, placement);
        });

        el.addEventListener('mouseenter', () => showSpacingRadius(bedEl, placement, plant));
        el.addEventListener('mouseleave', () => removeSpacingRadii(bedEl));

        bedEl.appendChild(el);
    });

    updateSpacingWarnings(containerId);
    if (typeof applyLivingClass === 'function') applyLivingClass(containerId);
}

// ---- COMPANION ID MATCHING (prefix-aware for variety IDs) ----
// Companion arrays use generic IDs ("basil", "tomato") but seed packet plants
// have variety IDs ("basil-sweet", "tomato-cherokee-purple"). This helper
// checks if a plantId matches any entry in a companion/enemy list using
// prefix matching: "basil-sweet" matches "basil", "tomato-cherokee-purple" matches "tomato".
function matchesCompanionId(plantId, companionList) {
    if (!companionList || !companionList.length) return false;
    return companionList.some(function(c) {
        return c === plantId || plantId.startsWith(c + '-');
    });
}

// ---- COMPANION LINES ----
// Lines are drawn as SVG inside each bed. Because the canvas CSS transform scales
// everything down (e.g., 34% zoom), strokes get sub-pixel. We compensate by making
// stroke-width inversely proportional to canvasZoom so lines look ~2-3px on screen always.
function drawCompanionLines(containerId, bedEl) {
    const container = getContainer(containerId);
    if (!container) return;

    // Global gates: master toggle + tweak
    if (state.companionNetworkOn === false) return;
    if (state.tweaks && state.tweaks.companionAlways === false) return;

    const plants = container.plants;
    if (plants.length < 2) return;

    // Zoom-compensated stroke widths so lines stay visible at any canvas zoom
    var zoom = Math.max(0.2, state.canvasZoom || 1);
    var goodStroke = Math.max(2, 2.5 / zoom);
    var badStroke  = Math.max(2.5, 3 / zoom);
    var dashOn     = Math.max(6, 8 / zoom);
    var dashOff    = Math.max(3, 4 / zoom);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('companion-svg');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;';
    svg.setAttribute('viewBox', `0 0 ${bedEl.offsetWidth} ${bedEl.offsetHeight}`);

    var maxPx = (typeof PROXIMITY_MAX_PX !== 'undefined') ? PROXIMITY_MAX_PX : 70;

    for (let i = 0; i < plants.length; i++) {
        for (let j = i + 1; j < plants.length; j++) {
            const p1 = PLANT_LIBRARY.find(p => p.id === plants[i].plantId);
            const p2 = PLANT_LIBRARY.find(p => p.id === plants[j].plantId);
            if (!p1 || !p2) continue;

            // Proximity gate — only connect nearby plants
            const dx = (plants[i].x + 18) - (plants[j].x + 18);
            const dy = (plants[i].y + 18) - (plants[j].y + 18);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxPx) continue;

            const isCompanion = matchesCompanionId(p2.id, p1.companions) || matchesCompanionId(p1.id, p2.companions);
            const isEnemy = matchesCompanionId(p2.id, p1.enemies) || matchesCompanionId(p1.id, p2.enemies);

            if (isCompanion || isEnemy) {
                // Foe wins if both
                const asFoe = isEnemy;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', plants[i].x + 18);
                line.setAttribute('y1', plants[i].y + 18);
                line.setAttribute('x2', plants[j].x + 18);
                line.setAttribute('y2', plants[j].y + 18);
                const cls = asFoe
                    ? 'companion-line-bad thread-persistent thread-foe'
                    : 'companion-line-good thread-persistent thread-friend';
                line.setAttribute('class', cls);
                line.setAttribute('stroke-width', asFoe ? badStroke : goodStroke);
                line.setAttribute('stroke-dasharray', dashOn + ' ' + dashOff);
                svg.appendChild(line);
            }
        }
    }

    bedEl.appendChild(svg);
}

// ---- REDRAW ALL COMPANION NETWORKS ----
// Called when the master toggle or companionAlways tweak changes, so every
// currently-rendered bed refreshes its SVG overlay in place.
function redrawAllCompanionNetworks() {
    document.querySelectorAll('.garden-bed[data-container-id]').forEach(function(bedEl){
        bedEl.querySelectorAll('.companion-svg').forEach(function(svg){ svg.remove(); });
        var containerId = bedEl.getAttribute('data-container-id');
        if (containerId) drawCompanionLines(containerId, bedEl);
    });
}

// ---- UPDATE COMPANION LINE STROKES ON ZOOM ----
// Called from applyCanvasTransform() so that when zoom changes, existing
// companion line stroke-widths and dash-arrays adapt to stay ~2-3px on screen.
function updateCompanionLineZoom() {
    var zoom = Math.max(0.2, state.canvasZoom || 1);
    // Thinner lines at high zoom so they don't dominate the view
    var baseFactor = zoom > 2 ? 0.6 : zoom > 1.5 ? 0.8 : 1;
    var goodStroke = Math.max(1, 2.5 / zoom * baseFactor);
    var badStroke  = Math.max(1.2, 3 / zoom * baseFactor);
    var dashOn     = Math.max(6, 8 / zoom);
    var dashOff    = Math.max(3, 4 / zoom);
    var goodDash   = dashOn + ' ' + dashOff;
    var badDash    = dashOn + ' ' + dashOff;

    document.querySelectorAll('.companion-line-good').forEach(function(line) {
        line.setAttribute('stroke-width', goodStroke);
        line.setAttribute('stroke-dasharray', goodDash);
    });
    document.querySelectorAll('.companion-line-bad').forEach(function(line) {
        line.setAttribute('stroke-width', badStroke);
        line.setAttribute('stroke-dasharray', badDash);
    });
}

// ---- SPACING RADIUS on hover/drag ----
function showSpacingRadius(bedEl, placement, plant, skipRemove) {
    if (!skipRemove) removeSpacingRadii(bedEl);
    const pxPerInch = CANVAS_PX_PER_FOOT / 12; // universal px-per-inch conversion
    const radiusPx = (plant.spacing / 2) * pxPerInch;

    const circle = document.createElement('div');
    circle.className = 'spacing-radius';
    circle.style.width = (radiusPx * 2) + 'px';
    circle.style.height = (radiusPx * 2) + 'px';
    circle.style.left = (placement.x + 18 - radiusPx) + 'px';
    circle.style.top = (placement.y + 18 - radiusPx) + 'px';
    bedEl.appendChild(circle);
}

function removeSpacingRadii(bedEl) {
    bedEl.querySelectorAll('.spacing-radius').forEach(el => el.remove());
}

// ---- SPACING VALIDATION & OVERLAP WARNINGS ----
// Only flags each plant's WORST violation (closest neighbor that's too close).
// Shows one ⚠ per crowded plant instead of one per pair → much less noise.
function updateSpacingWarnings(containerId) {
    const bedEl = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
    if (!bedEl) return;
    bedEl.querySelectorAll('.spacing-warning').forEach(el => el.remove());

    const container = getContainer(containerId);
    if (!container) return;
    const plants = container.plants;
    if (plants.length < 2) return;
    const pxPerInch = CANVAS_PX_PER_FOOT / 12;

    // Build lookup: plantId -> library entry
    const libCache = {};
    plants.forEach(p => {
        if (!libCache[p.plantId]) libCache[p.plantId] = PLANT_LIBRARY.find(lp => lp.id === p.plantId);
    });

    // For each plant, find its worst (closest) spacing violation
    // Key: pair key "i-j" (lower first) → { severity, data }
    const violations = new Map();

    for (let i = 0; i < plants.length; i++) {
        const p1 = plants[i];
        const lib1 = libCache[p1.plantId];
        if (!lib1) continue;

        let worstJ = -1;
        let worstSeverity = 0; // how far under the threshold (higher = worse)

        for (let j = 0; j < plants.length; j++) {
            if (i === j) continue;
            const p2 = plants[j];
            const lib2 = libCache[p2.plantId];
            if (!lib2) continue;

            const minInches = (lib1.spacing + lib2.spacing) / 2;
            const minPx = minInches * pxPerInch;
            const dx = (p1.x + 18) - (p2.x + 18);
            const dy = (p1.y + 18) - (p2.y + 18);
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Warn when significantly crowded (<65% of recommended spacing)
            if (dist < minPx * 0.65) {
                const severity = 1 - (dist / minPx); // 0..1, higher = worse
                if (severity > worstSeverity) {
                    worstSeverity = severity;
                    worstJ = j;
                }
            }
        }

        if (worstJ >= 0) {
            // Deduplicate: store by sorted pair key
            const pairKey = Math.min(i, worstJ) + '-' + Math.max(i, worstJ);
            const existing = violations.get(pairKey);
            if (!existing || worstSeverity > existing.severity) {
                violations.set(pairKey, {
                    severity: worstSeverity,
                    i: Math.min(i, worstJ),
                    j: Math.max(i, worstJ)
                });
            }
        }
    }

    // Render one ⚠ per unique pair
    violations.forEach(v => {
        const p1 = plants[v.i];
        const p2 = plants[v.j];
        const lib1 = libCache[p1.plantId];
        const lib2 = libCache[p2.plantId];
        const midX = (p1.x + p2.x) / 2 + 18;
        const midY = (p1.y + p2.y) / 2 + 18;
        const actualInches = Math.round(Math.sqrt(
            Math.pow((p1.x + 18) - (p2.x + 18), 2) +
            Math.pow((p1.y + 18) - (p2.y + 18), 2)
        ) / pxPerInch);
        const needInches = Math.round((lib1.spacing + lib2.spacing) / 2);

        const warn = document.createElement('div');
        warn.className = 'spacing-warning';
        warn.style.left = midX + 'px';
        warn.style.top = midY + 'px';
        warn.title = `${lib1.emoji} ${lib1.name} ↔ ${lib2.emoji} ${lib2.name}: ${actualInches}" apart, need ${needInches}"`;
        warn.textContent = '\u26A0';
        bedEl.appendChild(warn);
    });
}

// ---- CONTEXT MENU ----
function showContextMenu(x, y, containerId, placement) {
    hideContextMenu();
    const plant = PLANT_LIBRARY.find(p => p.id === placement.plantId);
    if (!plant) return;

    const menu = document.createElement('div');
    menu.id = 'plant-context-menu';
    menu.className = 'context-menu';

    const otherContainers = state.containers.filter(c => c.id !== containerId);
    menu.innerHTML = `
        <div class="context-menu-header">${plant.emoji} ${plant.name}</div>
        <button class="context-menu-item" data-action="info">\u2139\uFE0F Plant Info</button>
        <button class="context-menu-item" data-action="duplicate">\uD83D\uDCCB Duplicate</button>
        ${otherContainers.length > 0 ? `<button class="context-menu-item" data-action="move-pick">\u27A1\uFE0F Move to\u2026</button>` : ''}
        <div class="context-menu-divider"></div>
        <button class="context-menu-item context-menu-danger" data-action="remove">\uD83D\uDDD1\uFE0F Remove</button>
    `;

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    // Clamp to viewport — ensure menu stays fully visible
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = Math.max(4, x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = Math.max(4, y - rect.height) + 'px';
    // Final safety: never let top go above viewport
    const rect2 = menu.getBoundingClientRect();
    if (rect2.top < 0) menu.style.top = '4px';

    menu.querySelectorAll('.context-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const srcContainer = getContainer(containerId);
            if (action === 'info') {
                showPlantInfo(placement.plantId);
            } else if (action === 'duplicate') {
                pushUndo();
                const bedEl = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
                const newPlacement = {
                    id: `${placement.plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                    plantId: placement.plantId,
                    x: Math.min(placement.x + 40, bedEl ? bedEl.offsetWidth - 36 : 364),
                    y: placement.y
                };
                srcContainer.plants.push(newPlacement);
                renderPlacedPlants(containerId);
                updateBedDetails();
                saveState();
                showToast(`Duplicated ${plant.name}`);
            } else if (action === 'remove') {
                pushUndo();
                srcContainer.plants = srcContainer.plants.filter(p => p.id !== placement.id);
                renderPlacedPlants(containerId);
                updateBedDetails();
                saveState();
                showToast(`Removed ${plant.name}`);
            } else if (action === 'move-pick') {
                hideContextMenu();
                showMovePicker(containerId, placement, plant);
                return; // don't clearSelection yet
            }
            hideContextMenu();
            clearSelection();
        });
    });

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', _closeContextMenuHandler);
        document.addEventListener('contextmenu', _closeContextMenuHandler);
    }, 10);
}

function _closeContextMenuHandler(e) {
    const menu = document.getElementById('plant-context-menu');
    if (menu && !menu.contains(e.target)) {
        hideContextMenu();
        clearSelection();
    }
}

function hideContextMenu() {
    const menu = document.getElementById('plant-context-menu');
    if (menu) menu.remove();
    document.removeEventListener('click', _closeContextMenuHandler);
    document.removeEventListener('contextmenu', _closeContextMenuHandler);
}

// ---- MOVE PICKER MODAL ----
function showMovePicker(srcContainerId, placement, plant) {
    // Remove any existing picker
    const old = document.getElementById('move-picker-overlay');
    if (old) old.remove();

    const otherContainers = state.containers.filter(c => c.id !== srcContainerId);
    if (otherContainers.length === 0) return;

    const overlay = document.createElement('div');
    overlay.id = 'move-picker-overlay';
    overlay.className = 'move-picker-overlay';
    overlay.innerHTML = `
        <div class="move-picker-modal">
            <div class="move-picker-header">
                <span>\u27A1\uFE0F MOVE ${plant.emoji} ${plant.name}</span>
                <button class="move-picker-close">\u00D7</button>
            </div>
            <div class="move-picker-list">
                ${otherContainers.map(c => {
                    const typeDef = CONTAINER_TYPES[c.type];
                    const icon = typeDef ? typeDef.icon : '\uD83D\uDFE9';
                    return `<button class="move-picker-item" data-target="${c.id}">
                        <span class="move-picker-icon">${icon}</span>
                        <span class="move-picker-name">${c.name}</span>
                        <span class="move-picker-count">${c.plants.length} plant${c.plants.length !== 1 ? 's' : ''}</span>
                    </button>`;
                }).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Handle pick
    overlay.querySelectorAll('.move-picker-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const targetContainer = getContainer(targetId);
            const srcContainer = getContainer(srcContainerId);
            if (!targetContainer || !srcContainer) return;
            pushUndo();
            srcContainer.plants = srcContainer.plants.filter(p => p.id !== placement.id);
            const targetEl = document.querySelector(`.garden-bed[data-container-id="${targetId}"]`);
            placement.x = Math.min(placement.x, targetEl ? targetEl.offsetWidth - 36 : 364);
            placement.y = Math.min(placement.y, targetEl ? targetEl.offsetHeight - 36 : 184);
            targetContainer.plants.push(placement);
            renderPlacedPlants(srcContainerId);
            renderPlacedPlants(targetId);
            updateBedDetails();
            saveState();
            showToast(`Moved ${plant.name} to ${targetContainer.name}`);
            overlay.remove();
            clearSelection();
        });
    });

    // Close handlers
    overlay.querySelector('.move-picker-close').addEventListener('click', () => {
        overlay.remove();
        clearSelection();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); clearSelection(); }
    });
}

// ---- PLANT INFO PANEL ----
function showPlantInfo(plantId) {
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    if (!plant) return;
    const panel = document.getElementById('plant-info-panel');
    const content = document.getElementById('plant-info-content');

    const waterColors = { low: '#10b981', medium: '#f59e0b', high: '#dc2626' };
    content.innerHTML = `
        <h3 class="info-title">${plant.emoji} ${plant.name}</h3>
        <p style="color:var(--text-secondary);margin:0.5rem 0;font-size:0.9rem;">${plant.notes}</p>
        <div class="plant-info-grid">
            <div class="info-item"><span class="info-label">TYPE</span><span class="info-value">${plant.type.toUpperCase()}</span></div>
            <div class="info-item"><span class="info-label">DAYS TO HARVEST</span><span class="info-value">${plant.daysToHarvest} days</span></div>
            <div class="info-item"><span class="info-label">SPACING</span><span class="info-value">${plant.spacing}" apart</span></div>
            <div class="info-item"><span class="info-label">WATER NEED</span><span class="info-value" style="color:${waterColors[plant.waterNeed]}">${plant.waterNeed.toUpperCase()}</span></div>
            <div class="info-item"><span class="info-label">SUN</span><span class="info-value">${plant.sunNeed.toUpperCase()}</span></div>
            <div class="info-item"><span class="info-label">LOW MAINTENANCE</span><span class="info-value">${plant.lowMaintenance ? '\u2705 YES' : '\u26A0\uFE0F NEEDS ATTENTION'}</span></div>
            <div class="info-item"><span class="info-label">COMPANIONS</span><span class="info-value">${plant.companions.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji + ' ' + cp.name : c; }).join(', ') || 'None specific'}</span></div>
            <div class="info-item"><span class="info-label">ENEMIES</span><span class="info-value" style="color:var(--red-accent)">${plant.enemies.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji + ' ' + cp.name : c; }).join(', ') || 'None'}</span></div>
        </div>
    `;

    panel.classList.remove('hidden');
    document.getElementById('close-info').onclick = () => panel.classList.add('hidden');

    // Click outside to dismiss
    function dismissOnOutsideClick(e) {
        if (!panel.contains(e.target) && !e.target.closest('.placed-plant') && !e.target.closest('.context-menu')) {
            panel.classList.add('hidden');
            document.removeEventListener('mousedown', dismissOnOutsideClick);
        }
    }
    // Remove old listener if any, add new
    document.removeEventListener('mousedown', state._infoPanelDismiss);
    state._infoPanelDismiss = dismissOnOutsideClick;
    setTimeout(() => document.addEventListener('mousedown', dismissOnOutsideClick), 100);
}

// ---- BED SELECTOR & DETAILS ----
