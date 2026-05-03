/* GardenSync — Container Shelf & Keyboard Shortcuts */

function initContainerShelf() {
    const shelf = document.getElementById('container-shelf');
    if (!shelf) return;

    // Replace the 7-button bar with a single "+ ADD CONTAINER" dropdown
    // picker — same visual pattern as the FILE menu. The 7 type choices
    // live inside the popup so they stop competing for top-level real estate.
    shelf.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'menu-wrap';
    wrap.id = 'container-menu';

    const trigger = document.createElement('button');
    trigger.id = 'btn-container-menu';
    trigger.className = 'tool-btn accent menu-trigger';
    trigger.textContent = '+ ADD CONTAINER';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'container-menu-popup');
    trigger.setAttribute('title', 'Add a new garden container');
    wrap.appendChild(trigger);

    const popup = document.createElement('div');
    popup.id = 'container-menu-popup';
    popup.className = 'menu-popup';
    popup.setAttribute('role', 'menu');
    popup.setAttribute('aria-labelledby', 'btn-container-menu');

    Object.entries(CONTAINER_TYPES).forEach(([typeKey, typeDef]) => {
        const item = document.createElement('button');
        item.className = 'menu-item';
        item.setAttribute('role', 'menuitem');
        item.setAttribute('title', typeDef.description || '');

        const icon = document.createElement('span');
        icon.className = 'menu-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = typeDef.icon || '';
        item.appendChild(icon);

        item.appendChild(document.createTextNode(typeDef.label));

        item.addEventListener('click', () => {
            addNewContainer(typeKey);
        });
        popup.appendChild(item);
    });
    wrap.appendChild(popup);
    shelf.appendChild(wrap);

    // Wire menu open/close (mirrors menus.js _initMenu — kept inline so this
    // stays a one-shot init even if menus.js loads later).
    function close() {
        wrap.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', _onOutside, true);
        document.removeEventListener('keydown', _onEsc, true);
    }
    function _onOutside(e) { if (!wrap.contains(e.target)) close(); }
    function _onEsc(e) { if (e.key === 'Escape') { close(); trigger.focus(); } }

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrap.classList.contains('open')) {
            close();
        } else {
            // Close any other open menus
            document.querySelectorAll('.menu-wrap.open').forEach(w => {
                if (w !== wrap) {
                    w.classList.remove('open');
                    const t = w.querySelector('.menu-trigger');
                    if (t) t.setAttribute('aria-expanded', 'false');
                }
            });
            wrap.classList.add('open');
            trigger.setAttribute('aria-expanded', 'true');
            setTimeout(() => {
                document.addEventListener('click', _onOutside, true);
                document.addEventListener('keydown', _onEsc, true);
            }, 0);
        }
    });
    popup.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => setTimeout(close, 0));
    });
}

function addNewContainer(typeKey) {
    const typeDef = CONTAINER_TYPES[typeKey];
    if (!typeDef) return;

    pushUndo();

    // Calculate center of current viewport
    const viewport = document.getElementById('garden-viewport');
    const vpW = viewport ? viewport.clientWidth : 800;
    const vpH = viewport ? viewport.clientHeight : 600;
    const centerCanvasX = (vpW / 2 - state.canvasOffsetX) / state.canvasZoom;
    const centerCanvasY = (vpH / 2 - state.canvasOffsetY) / state.canvasZoom;

    const container = {
        id: `container-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
        type: typeKey,
        name: typeDef.label.toUpperCase(),
        canvasX: Math.round(centerCanvasX / 20) * 20,
        canvasY: Math.round(centerCanvasY / 20) * 20,
        plants: [],
        notes: '',
        volunteer: null
    };

    if (typeDef.shape === 'circle') {
        container.diameter = typeDef.defaultDiameter;
    } else {
        container.w = typeDef.defaultW;
        container.h = typeDef.defaultH;
    }

    state.containers.push(container);
    state.selectedContainer = container.id;

    addContainerToCanvas(container);
    updateContainerSelector();
    updateBedDetails();
    updateToolbarSublabel();
    saveState();
    showToast(`Added ${typeDef.label}: ${container.name}`);
}

// ---- KEYBOARD SHORTCUTS ----
let _nudgeUndoPushed = false;
let _nudgeUndoTimer = null;
let _nudgeRenderTimer = null;

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC to cancel click-place mode or deselect
        if (e.key === 'Escape') {
            if (state.clickPlaceMode) {
                exitClickPlaceMode();
                showToast('Placement cancelled');
            } else {
                clearSelection();
            }
            return;
        }

        // Delete/Backspace to remove selected plant(s) — supports multi-select
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedPlacements.length > 0) {
            // Don't intercept if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            pushUndo();
            const containerId = getSelectedContainerId();
            const selectedIds = new Set(state.selectedPlacements.map(s => s.placementId));
            const removedCount = selectedIds.size;
            const container = getContainer(containerId);
            if (container) {
                container.plants = container.plants.filter(p => !selectedIds.has(p.id));
            }
            clearSelection();
            renderPlacedPlants(containerId);
            updateBedDetails();
            saveState();
            showToast(`Removed ${removedCount} plant${removedCount !== 1 ? 's' : ''}`);
            return;
        }

        // Delete key to remove selected container (when no plant is selected)
        if (e.key === 'Delete' && state.selectedContainer && state.selectedPlacements.length === 0) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            e.preventDefault();
            deleteContainer(state.selectedContainer);
            return;
        }

        // R = Rotate selected container (portrait ↔ landscape)
        if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && state.selectedContainer) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            const container = getContainer(state.selectedContainer);
            if (container) {
                rotateContainer(container);
            }
            return;
        }

        // Ctrl+Z / Cmd+Z = Undo
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            undo();
            return;
        }

        // Ctrl+Y / Cmd+Shift+Z = Redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z') || (e.shiftKey && e.key === 'Z'))) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            redo();
            return;
        }

        // Ctrl+= / Ctrl++ = Zoom in
        if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            zoomIn();
            return;
        }
        // Ctrl+- = Zoom out
        if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            zoomOut();
            return;
        }
        // Ctrl+0 = Fit all
        if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            zoomToFit();
            return;
        }

        // ---- KEYBOARD ACCESSIBILITY ----

        // Arrow keys: nudge selected plants or selected container
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.ctrlKey || e.metaKey) return; // Don't interfere with Ctrl+arrow

            if (state.selectedPlacements.length > 0) {
                // Nudge selected plants within container
                e.preventDefault();
                const step = e.shiftKey ? 1 : 4; // Shift = pixel-perfect (1px), normal = nudge (4px)
                const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;

                const containerId = getSelectedContainerId();
                const container = getContainer(containerId);
                if (!container) return;

                const bedEl = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
                if (!bedEl) return;
                const bedW = parseFloat(bedEl.style.width) || bedEl.offsetWidth;
                const bedH = parseFloat(bedEl.style.height) || bedEl.offsetHeight;
                const isCircle = bedEl.classList.contains('container-circle');

                // Debounced undo — only push once per nudge burst
                if (!_nudgeUndoPushed) {
                    pushUndo();
                    _nudgeUndoPushed = true;
                }
                if (_nudgeUndoTimer) clearTimeout(_nudgeUndoTimer);
                _nudgeUndoTimer = setTimeout(() => { _nudgeUndoPushed = false; }, 500);

                state.selectedPlacements.forEach(sel => {
                    const p = container.plants.find(pp => pp.id === sel.placementId);
                    if (!p) return;
                    let nx = p.x + dx;
                    let ny = p.y + dy;
                    // Clamp to rect bounds
                    nx = Math.max(0, Math.min(nx, bedW - 36));
                    ny = Math.max(0, Math.min(ny, bedH - 36));
                    // Clamp to circle bounds
                    if (isCircle) {
                        const cx = bedW / 2, cy = bedH / 2;
                        const r = Math.min(cx, cy) - 20;
                        const pcx = nx + 18 - cx, pcy = ny + 18 - cy;
                        const dist = Math.sqrt(pcx * pcx + pcy * pcy);
                        if (dist > r) {
                            nx = cx + pcx * r / dist - 18;
                            ny = cy + pcy * r / dist - 18;
                        }
                    }
                    p.x = Math.round(nx);
                    p.y = Math.round(ny);
                    // Direct DOM update (skip full re-render)
                    const pEl = bedEl.querySelector(`.placed-plant[data-placement-id="${p.id}"]`);
                    if (pEl) {
                        pEl.style.left = p.x + 'px';
                        pEl.style.top = p.y + 'px';
                    }
                });
                // Redraw companion lines live during nudge
                bedEl.querySelectorAll('.companion-svg').forEach(el => el.remove());
                drawCompanionLines(containerId, bedEl);
                // Debounced spacing warnings (heavier, can lag if too frequent)
                if (_nudgeRenderTimer) clearTimeout(_nudgeRenderTimer);
                _nudgeRenderTimer = setTimeout(() => {
                    updateSpacingWarnings(containerId);
                }, 300);
                debouncedSave();
                return;
            }

            if (state.selectedContainer) {
                // Nudge selected container on canvas
                e.preventDefault();
                const container = getSelectedContainer();
                if (!container) return;
                const step = e.shiftKey ? 1 : 5; // Shift = pixel-perfect (1px), normal = nudge (5px)
                const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;

                // Debounced undo — only push once per nudge burst
                if (!_nudgeUndoPushed) {
                    pushUndo();
                    _nudgeUndoPushed = true;
                }
                if (_nudgeUndoTimer) clearTimeout(_nudgeUndoTimer);
                _nudgeUndoTimer = setTimeout(() => { _nudgeUndoPushed = false; }, 500);

                container.canvasX = Math.max(0, (container.canvasX || 0) + dx);
                container.canvasY = Math.max(0, (container.canvasY || 0) + dy);

                const el = document.querySelector(`.garden-bed[data-container-id="${container.id}"]`);
                if (el) {
                    el.style.left = container.canvasX + 'px';
                    el.style.top = container.canvasY + 'px';
                }
                debouncedSave();
                return;
            }
        }

        // ] / [ — cycle through containers or plants within container
        if (e.key === ']' || e.key === '[') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.ctrlKey || e.metaKey) return;

            if (state.selectedPlacements.length > 0) {
                // Cycle plants within selected container
                const container = getSelectedContainer();
                if (!container || container.plants.length === 0) return;
                e.preventDefault();

                const currentPlantIdx = container.plants.findIndex(
                    p => p.id === state.selectedPlacements[0].placementId
                );
                let nextIdx;
                if (e.key === ']') {
                    nextIdx = currentPlantIdx >= container.plants.length - 1 ? 0 : currentPlantIdx + 1;
                } else {
                    nextIdx = currentPlantIdx <= 0 ? container.plants.length - 1 : currentPlantIdx - 1;
                }

                const nextPlant = container.plants[nextIdx];
                selectPlacement(container.id, nextPlant.id, false);
                const plantEl = document.querySelector(`.placed-plant[data-placement-id="${nextPlant.id}"]`);
                if (plantEl) plantEl.focus();
                const plantDef = PLANT_LIBRARY.find(p => p.id === nextPlant.plantId);
                if (plantDef) showToast(`${plantDef.emoji} ${plantDef.name} (${nextIdx + 1}/${container.plants.length})`);
                return;
            }

            // Cycle containers
            if (state.containers.length === 0) return;
            e.preventDefault();
            const currentIdx = state.selectedContainer
                ? state.containers.findIndex(c => c.id === state.selectedContainer)
                : -1;
            let nextIdx;
            if (e.key === ']') {
                nextIdx = currentIdx >= state.containers.length - 1 ? 0 : currentIdx + 1;
            } else {
                nextIdx = currentIdx <= 0 ? state.containers.length - 1 : currentIdx - 1;
            }
            clearSelection();
            selectContainer(state.containers[nextIdx].id);
            const el = document.querySelector(`.garden-bed[data-container-id="${state.containers[nextIdx].id}"]`);
            if (el) el.focus();
            showToast(`${state.containers[nextIdx].name}`);
            return;
        }

        // Enter — show info for selected plant
        if (e.key === 'Enter' && state.selectedPlacements.length > 0) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            const sel = state.selectedPlacements[0];
            const container = getContainer(sel.containerId);
            if (container) {
                const placement = container.plants.find(p => p.id === sel.placementId);
                if (placement) showPlantInfo(placement.plantId);
            }
            return;
        }
    });
}


// Snap-to-grid helper (20px grid cells)
