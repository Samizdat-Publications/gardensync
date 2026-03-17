/* GardenSync — Garden Containers (CRUD, Rendering, Context Menu) */

// ---- GARDEN BEDS (now container-based) ----
function initGardenBeds() {
    // This now delegates to renderAllContainers
    renderAllContainers();

    // Click on empty area to deselect (but not during Shift+click to preserve multi-select)
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.placed-plant') && !e.target.closest('.context-menu') && !e.target.closest('.bed-plant-entry') && !e.shiftKey) {
            clearSelection();
        }
    });
}

function renderAllContainers() {
    ensureContainerPositions();
    const canvas = document.getElementById('garden-canvas');
    canvas.innerHTML = '';
    state.containers.forEach(container => {
        renderContainer(container, canvas);
    });
    applyCanvasTransform();
}

/** Add a single container to canvas without wiping all DOM. */
function addContainerToCanvas(container) {
    ensureContainerPositions();
    const canvas = document.getElementById('garden-canvas');
    if (!canvas) return;
    renderContainer(container, canvas);
}

/** Remove a single container from canvas without wiping all DOM. */
function removeContainerFromCanvas(containerId) {
    const el = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
    if (el) el.remove();
}

function renderContainer(container, parentEl) {
    const typeDef = CONTAINER_TYPES[container.type];

    // Dimension label text — show in visual order (visual width × visual height)
    let dimText;
    if (typeDef.shape === 'circle') {
        dimText = `${container.diameter || typeDef.defaultDiameter}' dia`;
    } else {
        const dims0 = getContainerPixelDims(container);
        const visualWFt = Math.round(dims0.width / CANVAS_PX_PER_FOOT);
        const visualHFt = Math.round(dims0.height / CANVAS_PX_PER_FOOT);
        dimText = `${visualWFt}' \u00D7 ${visualHFt}'`;
    }

    // Calculate pixel dimensions from real-world feet
    // Consistent 1:1 scale — no boost multiplier so relative sizes are always correct
    const dims = getContainerPixelDims(container);
    const isCircle = dims.isCircle;
    const MIN_PX = 50;
    const displayW = Math.max(MIN_PX, dims.width);
    const displayH = Math.max(MIN_PX, dims.height);
    const isSmall = displayW < 140 || displayH < 140;

    const el = document.createElement('div');
    // Build class list: base + type-specific + shape + size
    let classes = `garden-bed container-type-${container.type}`;
    if (isCircle) classes += ' container-circle';
    if (isSmall) classes += ' container-small';
    el.className = classes;
    el.dataset.containerId = container.id;

    // Apply inline styles for dimensions, position, and per-type colors
    el.style.width = displayW + 'px';
    el.style.height = displayH + 'px';
    el.style.left = (container.canvasX || 0) + 'px';
    el.style.top = (container.canvasY || 0) + 'px';
    el.style.background = typeDef.soilColor || '#1a1208';
    el.style.borderColor = typeDef.borderColor || '#3d2b0f';

    // Keyboard accessibility: make container focusable with ARIA
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', `${typeDef.label}: ${container.name}, ${container.plants.length} plant${container.plants.length !== 1 ? 's' : ''}`);

    el.innerHTML = `
        <span class="bed-label" data-container-id="${container.id}" title="Click to rename">${container.name}</span>
        <span class="bed-count-badge" style="display:none;"></span>
        <span class="bed-dimensions" data-container-id="${container.id}" title="Click to resize">${dimText}</span>
        <div class="bed-empty-hint">
            <span class="hint-icon">\u{1F331}</span>
            <span class="hint-text">${isSmall ? 'plant' : 'drag or double-click to plant'}</span>
        </div>
    `;

    // Focus handler: select container when focused via keyboard
    el.addEventListener('focus', () => {
        selectContainer(container.id);
    });

    // Resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'container-resize-handle';
    resizeHandle.title = 'Drag to resize';
    resizeHandle.innerHTML = '⤡';
    el.appendChild(resizeHandle);

    // Resize drag handler (mouse + touch)
    // Free-drag: user drags to set visual width/height. Orientation auto-adjusts.
    // Uses live DOM lookup to avoid stale closure references after re-render.
    function onResizeStart(e) {
        e.stopPropagation();
        e.preventDefault();
        const { clientX, clientY } = _pointerXY(e);
        const startX = clientX;
        const startY = clientY;
        const typeDef2 = CONTAINER_TYPES[container.type];

        // Store original display dimensions (in pixels) and real-world dims
        const origDims = getContainerPixelDims(container);
        const origVisualW = origDims.width;  // current pixel width (before boost)
        const origVisualH = origDims.height; // current pixel height (before boost)
        let origDia;
        if (typeDef2.shape === 'circle') {
            origDia = container.diameter || typeDef2.defaultDiameter;
        }

        pushUndo();
        let _resizeRafId = null;

        function onMove(me) {
            const { clientX: mx, clientY: my } = _pointerXY(me);
            const dx = (mx - startX) / state.canvasZoom;
            const dy = (my - startY) / state.canvasZoom;

            if (typeDef2.shape === 'circle') {
                const delta = Math.max(dx, dy) / CANVAS_PX_PER_FOOT;
                const newDia = Math.max(typeDef2.minDiameter, Math.min(typeDef2.maxDiameter,
                    Math.round((origDia + delta) * 2) / 2));
                container.diameter = newDia;
            } else {
                // Free drag: compute desired visual size in feet
                const desiredVisualWFt = (origVisualW + dx) / CANVAS_PX_PER_FOOT;
                const desiredVisualHFt = (origVisualH + dy) / CANVAS_PX_PER_FOOT;

                // Clamp to valid range (using min/max of both w/h since either could be either)
                const minFt = Math.min(typeDef2.minW, typeDef2.minH);
                const maxFt = Math.max(typeDef2.maxW, typeDef2.maxH);
                const clampedVisW = Math.max(minFt, Math.min(maxFt, Math.round(desiredVisualWFt)));
                const clampedVisH = Math.max(minFt, Math.min(maxFt, Math.round(desiredVisualHFt)));

                // Auto-orientation: visual width ≥ visual height → landscape, else portrait
                // In landscape (vertical=false): w = max(dims), h = min(dims)
                // In portrait  (vertical=true):  w = max(dims), h = min(dims) but display is swapped
                const bigDim = Math.max(clampedVisW, clampedVisH);
                const smallDim = Math.min(clampedVisW, clampedVisH);

                // Store the bigger value as w, smaller as h (canonical form)
                container.w = Math.max(typeDef2.minW, Math.min(typeDef2.maxW, bigDim));
                container.h = Math.max(typeDef2.minH, Math.min(typeDef2.maxH, smallDim));

                // Set orientation based on which visual axis is bigger
                container.vertical = (clampedVisH > clampedVisW);
            }

            // Throttle visual updates to animation frames — just update styles, no full re-render
            if (_resizeRafId) return;
            _resizeRafId = requestAnimationFrame(() => {
                _resizeRafId = null;
                const currentEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
                if (!currentEl) return;
                // Recalculate display dims — consistent 1:1 scale, no boost
                const newDims = getContainerPixelDims(container);
                const dw = Math.max(50, newDims.width);
                const dh = Math.max(50, newDims.height);
                currentEl.style.width = dw + 'px';
                currentEl.style.height = dh + 'px';
                // Update dimension label — show in visual order
                const dimLabel2 = currentEl.querySelector('.bed-dimensions');
                if (dimLabel2) {
                    if (typeDef2.shape === 'circle') {
                        dimLabel2.textContent = `${container.diameter}' dia`;
                    } else {
                        const vW = Math.round(newDims.width / CANVAS_PX_PER_FOOT);
                        const vH = Math.round(newDims.height / CANVAS_PX_PER_FOOT);
                        dimLabel2.textContent = `${vW}' × ${vH}'`;
                    }
                }
            });
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            if (_resizeRafId) {
                cancelAnimationFrame(_resizeRafId);
                _resizeRafId = null;
            }
            // Full re-render on mouseup using live DOM lookup
            const currentEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
            const parent = (currentEl && currentEl.parentElement) || document.getElementById('garden-canvas');
            if (currentEl) currentEl.remove();
            renderContainer(container, parent);
            renderPlacedPlants(container.id);
            saveState();
            updateBedDetails();
            updateToolbarSublabel();
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }
    resizeHandle.addEventListener('mousedown', onResizeStart);
    resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });

    // Name editing
    const label = el.querySelector('.bed-label');
    label.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.querySelector('.bed-label-input')) return;
        const input = document.createElement('input');
        input.className = 'bed-label-input';
        input.value = container.name;
        input.maxLength = 20;
        label.style.display = 'none';
        el.appendChild(input);
        input.focus();
        input.select();

        function finishEdit() {
            const newName = input.value.trim() || typeDef.label.toUpperCase();
            container.name = newName;
            label.textContent = newName;
            label.style.display = '';
            input.remove();
            saveState();
            updateContainerSelector();
        }
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') input.blur();
            if (ke.key === 'Escape') { input.value = container.name; input.blur(); }
        });
    });

    // Dimension editing
    const dimLabel = el.querySelector('.bed-dimensions');
    dimLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.querySelector('.dim-edit-row')) return;
        const row = document.createElement('div');
        row.className = 'dim-edit-row';

        if (typeDef.shape === 'circle') {
            const d = container.diameter || typeDef.defaultDiameter;
            row.innerHTML = `<input type="number" class="dim-input" value="${d}" min="${typeDef.minDiameter}" max="${typeDef.maxDiameter}" step="0.5">
                <span style="color:var(--text-muted);font-size:0.55rem;">ft dia</span>`;
        } else {
            row.innerHTML = `<input type="number" class="dim-input" value="${container.w}" min="${typeDef.minW}" max="${typeDef.maxW}" step="1">
                <span style="color:var(--text-muted);font-size:0.6rem;">x</span>
                <input type="number" class="dim-input" value="${container.h}" min="${typeDef.minH}" max="${typeDef.maxH}" step="1">
                <span style="color:var(--text-muted);font-size:0.55rem;">ft</span>`;
        }

        dimLabel.style.display = 'none';
        el.appendChild(row);
        const inputs = row.querySelectorAll('input');
        inputs[0].focus();
        inputs[0].select();

        let dimEditDone = false; // Guard against double-call from overlapping blur timeouts
        function finishDimEdit() {
            if (dimEditDone) return;
            dimEditDone = true;
            pushUndo();
            if (typeDef.shape === 'circle') {
                container.diameter = Math.max(typeDef.minDiameter, Math.min(typeDef.maxDiameter, parseFloat(inputs[0].value) || typeDef.defaultDiameter));
            } else {
                // First input = desired visual width, second = desired visual height
                const inputW = Math.max(typeDef.minW, Math.min(typeDef.maxW, parseInt(inputs[0].value) || typeDef.defaultW));
                const inputH = Math.max(typeDef.minH, Math.min(typeDef.maxH, parseInt(inputs[1].value) || typeDef.defaultH));
                // Store bigger dim as w, smaller as h (canonical form)
                container.w = Math.max(inputW, inputH);
                container.h = Math.min(inputW, inputH);
                // Auto-set orientation: if visual height > width → portrait
                container.vertical = (inputH > inputW);
            }
            dimLabel.style.display = '';
            row.remove();
            // Re-render at new size — use live DOM lookup to avoid stale reference
            const currentEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
            const parent = (currentEl && currentEl.parentElement) || document.getElementById('garden-canvas');
            if (currentEl) currentEl.remove();
            renderContainer(container, parent);
            renderPlacedPlants(container.id);
            updateBedDetails();
            saveState();
            updateToolbarSublabel();
        }
        inputs.forEach(inp => {
            inp.addEventListener('blur', () => {
                setTimeout(() => { if (!row.contains(document.activeElement)) finishDimEdit(); }, 100);
            });
            inp.addEventListener('keydown', (ke) => {
                if (ke.key === 'Enter') finishDimEdit();
                if (ke.key === 'Escape') { row.remove(); dimLabel.style.display = ''; }
            });
        });
    });

    // Drag & drop plant onto container
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        if (!state.dragData || !state.dragData.plantId) return;
        const rect = el.getBoundingClientRect();
        // Divide by zoom to convert screen coords to container-local coords
        const x = (e.clientX - rect.left) / state.canvasZoom - 18;
        const y = (e.clientY - rect.top) / state.canvasZoom - 18;
        const elW = parseFloat(el.style.width) || rect.width / state.canvasZoom;
        const elH = parseFloat(el.style.height) || rect.height / state.canvasZoom;
        placePlant(container.id, state.dragData.plantId, Math.max(0, Math.min(x, elW - 36)), Math.max(0, Math.min(y, elH - 36)));
        state.dragData = null;
    });

    // Click-to-place and container selection
    el.addEventListener('click', (e) => {
        if (!state.clickPlaceMode) {
            selectContainer(container.id);
            return;
        }
        if (e.target.closest('.placed-plant')) return;
        const rect = el.getBoundingClientRect();
        // Divide by zoom to convert screen coords to container-local coords
        const x = (e.clientX - rect.left) / state.canvasZoom - 18;
        const y = (e.clientY - rect.top) / state.canvasZoom - 18;
        const elW = parseFloat(el.style.width) || rect.width / state.canvasZoom;
        const elH = parseFloat(el.style.height) || rect.height / state.canvasZoom;
        placePlant(container.id, state.clickPlaceMode.plantId, Math.max(0, Math.min(x, elW - 36)), Math.max(0, Math.min(y, elH - 36)));
    });

    // Container drag-to-reposition on canvas (mouse + touch)
    function onContainerDragStart(e) {
        // Don't start container drag if clicking on a plant, label, input, or resize handle
        if (e.target.closest('.placed-plant') || e.target.closest('.bed-label') ||
            e.target.closest('.bed-label-input') || e.target.closest('.bed-dimensions') ||
            e.target.closest('.dim-edit-row') || e.target.closest('.bed-count-badge') ||
            e.target.closest('.container-resize-handle')) return;
        if (e.type === 'mousedown' && e.button !== 0) return;

        e.stopPropagation(); // Prevent canvas pan
        e.preventDefault();
        const { clientX, clientY } = _pointerXY(e);
        const startX = clientX;
        const startY = clientY;
        const origCanvasX = container.canvasX || 0;
        const origCanvasY = container.canvasY || 0;
        let hasMoved = false;

        function onMove(me) {
            const { clientX: mx, clientY: my } = _pointerXY(me);
            const dx = (mx - startX) / state.canvasZoom;
            const dy = (my - startY) / state.canvasZoom;
            if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                hasMoved = true;
            }
            if (hasMoved) {
                container.canvasX = Math.max(0, origCanvasX + dx);
                container.canvasY = Math.max(0, origCanvasY + dy);
                el.style.left = container.canvasX + 'px';
                el.style.top = container.canvasY + 'px';
            }
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            if (hasMoved) {
                // Snap to grid (20px increments)
                container.canvasX = Math.round(container.canvasX / 20) * 20;
                container.canvasY = Math.round(container.canvasY / 20) * 20;
                el.style.left = container.canvasX + 'px';
                el.style.top = container.canvasY + 'px';
                saveState();
            }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }
    el.addEventListener('mousedown', onContainerDragStart);
    el.addEventListener('touchstart', onContainerDragStart, { passive: false });

    // Container right-click context menu
    el.addEventListener('contextmenu', (e) => {
        // Don't show container menu if clicking on a plant (plant has its own menu)
        if (e.target.closest('.placed-plant')) return;
        e.preventDefault();
        e.stopPropagation();
        showContainerContextMenu(e.clientX, e.clientY, container);
    });

    parentEl.appendChild(el);

    // Render plants inside
    renderPlacedPlants(container.id);
}

function showContainerContextMenu(x, y, container) {
    hideContextMenu(); // close any existing context menu
    const typeDef = CONTAINER_TYPES[container.type];

    const menu = document.createElement('div');
    menu.id = 'plant-context-menu';  // reuse same ID for cleanup
    menu.className = 'context-menu';
    const rotateBtn = typeDef.shape !== 'circle'
        ? `<button class="context-menu-item" data-action="rotate">↻ Rotate${container.vertical ? ' → landscape' : ' → portrait'}</button>`
        : '';
    menu.innerHTML = `
        <div class="context-menu-header">${typeDef.icon} ${container.name}</div>
        <button class="context-menu-item" data-action="rename">✏️ Rename</button>
        <button class="context-menu-item" data-action="resize">📐 Resize</button>
        ${rotateBtn}
        <button class="context-menu-item" data-action="organize">🔄 Auto-Organize</button>
        <button class="context-menu-item" data-action="clear">🧹 Clear Plants</button>
        <button class="context-menu-item" data-action="duplicate">📋 Duplicate</button>
        <div class="context-menu-divider"></div>
        <button class="context-menu-item danger" data-action="delete">🗑️ Delete Container</button>
    `;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    // Keep menu in viewport
    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
    });

    menu.querySelectorAll('.context-menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            hideContextMenu();

            switch (action) {
                case 'rename': {
                    const bedEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
                    if (bedEl) bedEl.querySelector('.bed-label')?.click();
                    break;
                }
                case 'resize': {
                    const bedEl = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
                    if (bedEl) bedEl.querySelector('.bed-dimensions')?.click();
                    break;
                }
                case 'rotate':
                    rotateContainer(container);
                    break;
                case 'organize':
                    autoOrganizeBed(container.id);
                    break;
                case 'clear':
                    if (container.plants.length === 0) {
                        showToast('Container is already empty');
                        return;
                    }
                    pushUndo();
                    container.plants = [];
                    renderPlacedPlants(container.id);
                    updateBedDetails();
                    saveState();
                    showToast(`Cleared ${container.name}`);
                    break;
                case 'duplicate': {
                    pushUndo();
                    const dupe = JSON.parse(JSON.stringify(container));
                    dupe.id = `container-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
                    dupe.name = container.name + ' COPY';
                    dupe.canvasX = (container.canvasX || 0) + 40;
                    dupe.canvasY = (container.canvasY || 0) + 40;
                    // Give plants new IDs
                    dupe.plants.forEach(p => {
                        p.id = `${p.plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
                    });
                    state.containers.push(dupe);
                    addContainerToCanvas(dupe);
                    selectContainer(dupe.id);
                    updateBedDetails();
                    updateToolbarSublabel();
                    saveState();
                    showToast(`Duplicated → ${dupe.name}`);
                    break;
                }
                case 'delete':
                    deleteContainer(container.id);
                    break;
            }
        });
    });

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function _close(e) {
            if (!menu.contains(e.target)) {
                hideContextMenu();
                document.removeEventListener('click', _close);
            }
        });
    }, 10);
}

function rotateContainer(container) {
    const typeDef = CONTAINER_TYPES[container.type];
    if (typeDef.shape === 'circle') return; // circles can't rotate
    pushUndo();
    container.vertical = !container.vertical;
    const el = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
    if (el) {
        const parent = el.parentElement || document.getElementById('garden-canvas');
        el.remove();
        renderContainer(container, parent);
        renderPlacedPlants(container.id);
    }
    updateBedDetails();
    saveState();
    showToast(`Rotated → ${container.vertical ? 'portrait' : 'landscape'}`);
}

function deleteContainer(containerId) {
    const container = getContainer(containerId);
    if (!container) return;

    const plantCount = container.plants.length;
    const msg = plantCount > 0
        ? `Delete "${container.name}" and its ${plantCount} plant${plantCount !== 1 ? 's' : ''}? This cannot be undone.`
        : `Delete empty container "${container.name}"?`;

    // Use the existing confirm modal pattern
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal">
            <h3>🗑️ DELETE CONTAINER</h3>
            <p>${msg}</p>
            <div class="confirm-actions">
                <button class="tool-btn confirm-yes danger">DELETE</button>
                <button class="tool-btn confirm-no">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-yes').addEventListener('click', () => {
        overlay.remove();
        pushUndo();
        state.containers = state.containers.filter(c => c.id !== containerId);
        if (state.selectedContainer === containerId) {
            state.selectedContainer = state.containers.length > 0 ? state.containers[0].id : null;
        }
        removeContainerFromCanvas(containerId);
        updateContainerSelector();
        updateBedDetails();
        updateToolbarSublabel();
        saveState();
        showToast(`Deleted ${container.name}`);
    });
    overlay.querySelector('.confirm-no').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

