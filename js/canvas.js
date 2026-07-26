/* GardenSync — Canvas (Pan, Zoom, Transform, Resize Panels) */

function updateToolbarSublabel() {
    const sublabel = document.querySelector('.toolbar-sublabel');
    if (!sublabel) return;
    const count = state.containers.length;
    const types = [...new Set(state.containers.map(c => CONTAINER_TYPES[c.type]?.label || c.type))];
    if (count === 0) {
        sublabel.textContent = 'No containers yet';
    } else {
        sublabel.textContent = `${count} container${count !== 1 ? 's' : ''} \u00B7 ${types.length} type${types.length !== 1 ? 's' : ''}`;
    }
    // Total plant count
    const totalPlants = state.containers.reduce((sum, c) => sum + c.plants.length, 0);
    const totalEl = document.getElementById('total-plant-count');
    if (totalEl) totalEl.innerHTML = `<span class="count-num">${totalPlants}</span> PLANTS`;
}

// ---- CANVAS: Position, Transform, Pan, Zoom ----

function ensureContainerPositions() {
    // Give positions to any containers missing canvasX/canvasY
    let nextX = 40, nextY = 40;
    const padding = 30;
    state.containers.forEach(c => {
        if (c.canvasX == null || c.canvasY == null) {
            c.canvasX = nextX;
            c.canvasY = nextY;
            const dims = getContainerPixelDims(c);
            const needsBoost = dims.width < 100 || dims.height < 100;
            const boostFactor = needsBoost ? 2 : 1;
            const displayW = Math.max(70, dims.width * boostFactor);
            const displayH = Math.max(70, dims.height * boostFactor);
            nextX += displayW + padding;
            if (nextX > 1200) {
                nextX = 40;
                nextY += displayH + padding;
            }
        }
    });
}

function applyCanvasTransform() {
    const canvas = document.getElementById('garden-canvas');
    if (!canvas) return;
    canvas.style.transform = `translate(${state.canvasOffsetX}px, ${state.canvasOffsetY}px) scale(${state.canvasZoom})`;
    // Update zoom display
    const zoomDisplay = document.getElementById('zoom-level');
    if (zoomDisplay) zoomDisplay.textContent = Math.round(state.canvasZoom * 100) + '%';
    // Update companion line strokes so they stay consistent at any zoom level
    if (typeof updateCompanionLineZoom === 'function') updateCompanionLineZoom();
    // Progressive disclosure: multi-level zoom classes
    const wrapper = document.getElementById('garden-canvas-wrapper') || canvas.parentElement;
    if (wrapper) {
        // Level 1 (>=150%): show plant name labels
        wrapper.classList.toggle('canvas-zoomed-in', state.canvasZoom >= 1.5);
        // Level 2 (>=200%): detail mode — hide companion lines, reposition labels
        wrapper.classList.toggle('canvas-zoomed-detail', state.canvasZoom >= 2.0);
    }
}

// ---- RESIZABLE PANELS (mouse + touch) ----

// Shared helper: normalize mouse or touch event to { clientX, clientY }
function _pointerXY(e) {
    if (e.touches && e.touches.length) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length) return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    return { clientX: e.clientX, clientY: e.clientY };
}

// Helper: read current palette width from DOM
function _getPaletteWidth() {
    const el = document.querySelector('.plant-palette');
    return el ? Math.round(el.getBoundingClientRect().width) : 240;
}
// Helper: read current sidebar width from DOM
function _getSidebarWidth() {
    const el = document.querySelector('.bed-details');
    return el ? Math.round(el.getBoundingClientRect().width) : 260;
}

/* Below 900px the stylesheet collapses .planner-layout to a single column and
   the two side panels become slide-up overlays. The resize handles must not
   write an inline grid-template-columns there — inline styles outrank the media
   query, which left a phantom 240px palette track squeezing the garden into
   ~240px of a 390px phone screen. */
const DESKTOP_PANELS_QUERY = '(min-width: 901px)';
function _desktopPanels() {
    return window.matchMedia(DESKTOP_PANELS_QUERY).matches;
}
// Write the three-column track, but only when the desktop layout is in play.
function _setLayoutColumns(layout, cols) {
    if (!layout) return;
    if (_desktopPanels()) layout.style.gridTemplateColumns = cols;
    else layout.style.removeProperty('grid-template-columns');
}
/* Crossing the breakpoint in either direction: drop the inline track on the way
   down, restore the saved widths on the way back up. */
function initLayoutBreakpointSync() {
    const layout = document.querySelector('.planner-layout');
    if (!layout) return;
    const mq = window.matchMedia(DESKTOP_PANELS_QUERY);
    const apply = () => {
        if (!mq.matches) {
            layout.style.removeProperty('grid-template-columns');
            return;
        }
        const palette = parseInt(localStorage.getItem('gardensync_palette_width')) || 240;
        const sidebar = parseInt(localStorage.getItem('gardensync_sidebar_width')) || 260;
        layout.style.gridTemplateColumns = `${palette}px minmax(0, 1fr) ${sidebar}px`;
    };
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
}

function initSidebarResize() {
    const handle = document.querySelector('.sidebar-resize-handle');
    const layout = document.querySelector('.planner-layout');
    const sidebar = document.querySelector('.bed-details');
    if (!handle || !layout || !sidebar) return;

    const MIN_WIDTH = 200;
    const MAX_WIDTH = 500;
    const DEFAULT_WIDTH = 260;
    const STORAGE_KEY = 'gardensync_sidebar_width';

    const saved = parseInt(localStorage.getItem(STORAGE_KEY));
    const initialWidth = (saved && saved >= MIN_WIDTH && saved <= MAX_WIDTH) ? saved : DEFAULT_WIDTH;
    _setLayoutColumns(layout, `${_getPaletteWidth()}px minmax(0, 1fr) ${initialWidth}px`);

    function onStart(e) {
        e.preventDefault();
        e.stopPropagation();
        const { clientX } = _pointerXY(e);
        const startX = clientX;
        const startWidth = sidebar.getBoundingClientRect().width;
        document.body.classList.add('sidebar-resizing');
        handle.classList.add('active');

        function onMove(me) {
            const { clientX: cx } = _pointerXY(me);
            const dx = startX - cx;
            let newWidth = Math.round(startWidth + dx);
            newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
            _setLayoutColumns(layout, `${_getPaletteWidth()}px minmax(0, 1fr) ${newWidth}px`);
        }

        function onUp() {
            document.body.classList.remove('sidebar-resizing');
            handle.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            localStorage.setItem(STORAGE_KEY, Math.round(sidebar.getBoundingClientRect().width));
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function initPaletteResize() {
    const handle = document.querySelector('.palette-resize-handle');
    const layout = document.querySelector('.planner-layout');
    const palette = document.querySelector('.plant-palette');
    if (!handle || !layout || !palette) return;

    const MIN_WIDTH = 180;
    const MAX_WIDTH = 450;
    const DEFAULT_WIDTH = 240;
    const STORAGE_KEY = 'gardensync_palette_width';

    const saved = parseInt(localStorage.getItem(STORAGE_KEY));
    const initialWidth = (saved && saved >= MIN_WIDTH && saved <= MAX_WIDTH) ? saved : DEFAULT_WIDTH;
    _setLayoutColumns(layout, `${initialWidth}px minmax(0, 1fr) ${_getSidebarWidth()}px`);

    function onStart(e) {
        e.preventDefault();
        e.stopPropagation();
        const { clientX } = _pointerXY(e);
        const startX = clientX;
        const startWidth = palette.getBoundingClientRect().width;
        document.body.classList.add('palette-resizing');
        handle.classList.add('active');

        function onMove(me) {
            const { clientX: cx } = _pointerXY(me);
            const dx = cx - startX;
            let newWidth = Math.round(startWidth + dx);
            newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
            _setLayoutColumns(layout, `${newWidth}px minmax(0, 1fr) ${_getSidebarWidth()}px`);
        }

        function onUp() {
            document.body.classList.remove('palette-resizing');
            handle.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            localStorage.setItem(STORAGE_KEY, Math.round(palette.getBoundingClientRect().width));
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function initSectionResize() {
    const handles = document.querySelectorAll('.section-resize-handle');
    if (!handles.length) return;

    const STORAGE_KEY = 'gardensync_section_heights';
    const sections = {
        planted: document.getElementById('bed-plant-list'),
        companion: document.getElementById('companion-alerts'),
        journal: document.getElementById('journal-entries'),
    };
    if (!sections.planted || !sections.companion || !sections.journal) return;

    const MIN_HEIGHT = 40;

    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (saved) {
            if (saved.planted >= MIN_HEIGHT) sections.planted.style.height = saved.planted + 'px';
            if (saved.companion >= MIN_HEIGHT) sections.companion.style.height = saved.companion + 'px';
            if (saved.journal >= MIN_HEIGHT) sections.journal.style.height = saved.journal + 'px';
        }
    } catch (e) { /* ignore corrupt data */ }

    function saveHeights() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            planted: Math.round(sections.planted.getBoundingClientRect().height),
            companion: Math.round(sections.companion.getBoundingClientRect().height),
            journal: Math.round(sections.journal.getBoundingClientRect().height),
        }));
    }

    handles.forEach(handle => {
        const pairKey = handle.dataset.sections;
        let upperSection, lowerSection;
        if (pairKey === 'planted-companion') {
            upperSection = sections.planted;
            lowerSection = sections.companion;
        } else if (pairKey === 'companion-journal') {
            upperSection = sections.companion;
            lowerSection = sections.journal;
        } else {
            return;
        }

        function onStart(e) {
            e.preventDefault();
            e.stopPropagation();
            const { clientY } = _pointerXY(e);
            const startY = clientY;
            const startUpperH = upperSection.getBoundingClientRect().height;
            const startLowerH = lowerSection.getBoundingClientRect().height;
            const totalH = startUpperH + startLowerH;
            document.body.classList.add('section-resizing');
            handle.classList.add('active');

            function onMove(me) {
                const { clientY: cy } = _pointerXY(me);
                const dy = cy - startY;
                let newUpperH = Math.round(startUpperH + dy);
                let newLowerH = Math.round(totalH - newUpperH);
                if (newUpperH < MIN_HEIGHT) { newUpperH = MIN_HEIGHT; newLowerH = totalH - MIN_HEIGHT; }
                if (newLowerH < MIN_HEIGHT) { newLowerH = MIN_HEIGHT; newUpperH = totalH - MIN_HEIGHT; }
                upperSection.style.height = newUpperH + 'px';
                lowerSection.style.height = newLowerH + 'px';
            }

            function onUp() {
                document.body.classList.remove('section-resizing');
                handle.classList.remove('active');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);
                saveHeights();
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        }

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
    });
}

function initCanvasPan() {
    const viewport = document.getElementById('garden-viewport');
    if (!viewport) return;
    let isPanning = false;
    let panStartX, panStartY, startOffsetX, startOffsetY;

    function onPanStart(e) {
        // Only pan on empty canvas (not on containers)
        if (e.target.closest('.garden-bed') || e.target.closest('.placed-plant')) return;
        if (e.type === 'mousedown' && e.button !== 0) return;
        isPanning = true;
        const { clientX, clientY } = _pointerXY(e);
        panStartX = clientX;
        panStartY = clientY;
        startOffsetX = state.canvasOffsetX;
        startOffsetY = state.canvasOffsetY;
        viewport.classList.add('panning');
        e.preventDefault();
    }

    function onPanMove(e) {
        if (!isPanning) return;
        const { clientX, clientY } = _pointerXY(e);
        const dx = clientX - panStartX;
        const dy = clientY - panStartY;
        state.canvasOffsetX = startOffsetX + dx;
        state.canvasOffsetY = startOffsetY + dy;
        applyCanvasTransform();
    }

    function onPanEnd() {
        if (isPanning) {
            isPanning = false;
            viewport.classList.remove('panning');
            saveState();
        }
    }

    viewport.addEventListener('mousedown', onPanStart);
    viewport.addEventListener('touchstart', onPanStart, { passive: false });
    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('touchmove', onPanMove, { passive: false });
    document.addEventListener('mouseup', onPanEnd);
    document.addEventListener('touchend', onPanEnd);
}

function initCanvasZoom() {
    const viewport = document.getElementById('garden-viewport');
    if (!viewport) return;

    viewport.addEventListener('wheel', (e) => {
        e.preventDefault();

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.2, Math.min(3, state.canvasZoom * zoomFactor));

        // Zoom toward mouse position
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate the canvas point under the mouse before zoom
        const canvasX = (mouseX - state.canvasOffsetX) / state.canvasZoom;
        const canvasY = (mouseY - state.canvasOffsetY) / state.canvasZoom;

        state.canvasZoom = newZoom;

        // Adjust offset so the same canvas point stays under the mouse
        state.canvasOffsetX = mouseX - canvasX * newZoom;
        state.canvasOffsetY = mouseY - canvasY * newZoom;

        applyCanvasTransform();
        debouncedSave(); // debounce rapid wheel events
    }, { passive: false });
}

function zoomIn() {
    const viewport = document.getElementById('garden-viewport');
    const vpW = viewport ? viewport.clientWidth : 800;
    const vpH = viewport ? viewport.clientHeight : 600;
    // Zoom toward center of viewport
    const centerX = vpW / 2;
    const centerY = vpH / 2;
    const canvasX = (centerX - state.canvasOffsetX) / state.canvasZoom;
    const canvasY = (centerY - state.canvasOffsetY) / state.canvasZoom;
    state.canvasZoom = Math.min(3, state.canvasZoom * 1.2);
    state.canvasOffsetX = centerX - canvasX * state.canvasZoom;
    state.canvasOffsetY = centerY - canvasY * state.canvasZoom;
    applyCanvasTransform();
    saveState();
}

function zoomOut() {
    const viewport = document.getElementById('garden-viewport');
    const vpW = viewport ? viewport.clientWidth : 800;
    const vpH = viewport ? viewport.clientHeight : 600;
    const centerX = vpW / 2;
    const centerY = vpH / 2;
    const canvasX = (centerX - state.canvasOffsetX) / state.canvasZoom;
    const canvasY = (centerY - state.canvasOffsetY) / state.canvasZoom;
    state.canvasZoom = Math.max(0.2, state.canvasZoom / 1.2);
    state.canvasOffsetX = centerX - canvasX * state.canvasZoom;
    state.canvasOffsetY = centerY - canvasY * state.canvasZoom;
    applyCanvasTransform();
    saveState();
}

function zoomToFit() {
    if (state.containers.length === 0) return;
    const viewport = document.getElementById('garden-viewport');
    if (!viewport) return;
    const vpW = viewport.clientWidth;
    const vpH = viewport.clientHeight;

    // Find bounding box of all containers
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.containers.forEach(c => {
        const dims = getContainerPixelDims(c);
        const needsBoost = dims.width < 100 || dims.height < 100;
        const bf = needsBoost ? 2 : 1;
        const w = Math.max(70, dims.width * bf);
        const h = Math.max(70, dims.height * bf);
        const x = c.canvasX || 0;
        const y = c.canvasY || 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    });

    const contentW = maxX - minX + 60;  // padding
    const contentH = maxY - minY + 60;

    const zoom = Math.min(vpW / contentW, vpH / contentH, 1.5);
    state.canvasZoom = Math.max(0.2, Math.min(zoom, 1.5));

    // Center the content
    state.canvasOffsetX = (vpW - contentW * state.canvasZoom) / 2 - minX * state.canvasZoom + 30 * state.canvasZoom;
    state.canvasOffsetY = (vpH - contentH * state.canvasZoom) / 2 - minY * state.canvasZoom + 30 * state.canvasZoom;

    applyCanvasTransform();
    saveState();
}

// ---- CONTAINER SHELF (add new containers from toolbar) ----
