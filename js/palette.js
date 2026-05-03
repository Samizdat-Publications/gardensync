/* GardenSync — Plant Palette (Search, Filter, Render) */

// ---- PLANT PALETTE ----
function matchPlantSearch(plant, q) {
    // Direct name/type match
    if (plant.name.toLowerCase().includes(q) || plant.type.includes(q)) return true;

    // Water need: "low water", "high water", "dry", "thirsty"
    const waterAliases = { low: ['low water', 'dry', 'drought'], medium: ['medium water', 'moderate water'], high: ['high water', 'thirsty', 'wet'] };
    if (waterAliases[plant.waterNeed]?.some(a => a.includes(q))) return true;

    // Sun: "full sun", "full", "partial", "shade", "part sun"
    if (plant.sunNeed.includes(q) || (q === 'shade' && plant.sunNeed === 'partial')
        || (q === 'full sun' && plant.sunNeed === 'full')
        || (q === 'part sun' && plant.sunNeed === 'partial')
        || (q === 'partial sun' && plant.sunNeed === 'partial')) return true;

    // Harvest speed: "fast", "quick", "slow"
    if ((q === 'fast' || q === 'quick') && plant.daysToHarvest <= 50) return true;
    if (q === 'slow' && plant.daysToHarvest > 80) return true;

    // Maintenance: "easy", "easy care", "low maintenance"
    if ((q === 'easy' || q === 'easy care' || q === 'low maintenance') && plant.lowMaintenance) return true;

    // Companion search: "companion to X", "companion X", "friend of X", "goes with X"
    const companionMatch = q.match(/(?:companion(?:\s+to)?|friend(?:\s+of)?|goes\s+with|pair(?:\s+with)?)\s+(\w+)/);
    if (companionMatch) {
        const target = companionMatch[1].toLowerCase();
        return plant.companions.some(c => c.includes(target));
    }

    // Enemy search: "enemy of X", "foe of X", "avoid with X"
    const enemyMatch = q.match(/(?:enemy(?:\s+of)?|foe(?:\s+of)?|avoid(?:\s+with)?|bad\s+with)\s+(\w+)/);
    if (enemyMatch) {
        const target = enemyMatch[1].toLowerCase();
        return plant.enemies.some(c => c.includes(target));
    }

    // Search in notes and care notes
    if (plant.notes?.toLowerCase().includes(q)) return true;
    if (plant.careNotes?.toLowerCase().includes(q)) return true;

    // Season badge: "in season", "soon", "off season"
    if (q === 'in season' || q === 'ready') {
        const badge = getPlantSeasonBadge(plant);
        return badge.cls === 'in-season';
    }
    if (q === 'soon' || q === 'upcoming') {
        const badge = getPlantSeasonBadge(plant);
        return badge.cls === 'upcoming';
    }

    return false;
}

function getFilteredSortedPlants() {
    const searchQ = (document.getElementById('plant-search')?.value || '').toLowerCase();
    const activeFilter = document.querySelector('.filter-btn[data-filter].active')?.dataset.filter || 'all';
    const sortBy = document.getElementById('plant-sort')?.value || 'in-season';

    let plants = [...PLANT_LIBRARY];

    // Filter by type (or by custom/seedPacket flag)
    if (activeFilter === 'custom') plants = plants.filter(p => p.isCustom || p.seedPacket);
    else if (activeFilter !== 'all') plants = plants.filter(p => p.type === activeFilter);

    // Filter by search (supports name, type, and trait keywords)
    if (searchQ) plants = plants.filter(p => matchPlantSearch(p, searchQ));

    // Sort. 'in-season' groups by season-relevance (in season > soon > off),
    // then alphabetically within each group — what gardeners actually want
    // when planning today vs. searching by name.
    const seasonRank = { 'in-season': 0, 'upcoming': 1, 'off-season': 2 };
    const sorters = {
        'in-season': (a, b) => {
            const ra = seasonRank[getPlantSeasonBadge(a).cls] ?? 3;
            const rb = seasonRank[getPlantSeasonBadge(b).cls] ?? 3;
            return ra - rb || a.name.localeCompare(b.name);
        },
        'name': (a, b) => a.name.localeCompare(b.name),
        'name-desc': (a, b) => b.name.localeCompare(a.name),
        'spacing': (a, b) => a.spacing - b.spacing,
        'days': (a, b) => a.daysToHarvest - b.daysToHarvest,
        'water': (a, b) => { const w = {low:1,medium:2,high:3}; return w[a.waterNeed] - w[b.waterNeed]; },
        'type': (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
    };
    if (sorters[sortBy]) plants.sort(sorters[sortBy]);

    return { plants, searchQ };
}

function getPlantSeasonBadge(plant) {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    const lastFrost = new Date(now.getFullYear(), CANTON_CLIMATE.lastFrost.month, CANTON_CLIMATE.lastFrost.day);
    const firstFrost = new Date(now.getFullYear(), CANTON_CLIMATE.firstFrost.month, CANTON_CLIMATE.firstFrost.day);

    // Determine activity window
    let startWeek = null, endWeek = null;
    if (plant.sowIndoors) {
        startWeek = new Date(lastFrost);
        startWeek.setDate(startWeek.getDate() + plant.sowIndoors * 7);
    } else if (plant.directSow !== null) {
        startWeek = new Date(lastFrost);
        startWeek.setDate(startWeek.getDate() + plant.directSow * 7);
    } else if (plant.transplantAfterFrost !== null) {
        startWeek = new Date(lastFrost);
        startWeek.setDate(startWeek.getDate() + plant.transplantAfterFrost * 7);
    }
    if (startWeek) {
        endWeek = new Date(startWeek);
        endWeek.setDate(endWeek.getDate() + (plant.harvestWeeks || 10) * 7 + plant.daysToHarvest);
    }

    if (!startWeek || !endWeek) return { cls: 'off-season', text: 'N/A' };

    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 21);

    if (now >= startWeek && now <= endWeek) return { cls: 'in-season', text: 'IN SEASON' };
    if (now < startWeek && twoWeeksFromNow >= startWeek) return { cls: 'upcoming', text: 'SOON' };
    return { cls: 'off-season', text: 'OFF SEASON' };
}

function initPlantPalette() {
    refreshPlantList();

    document.getElementById('plant-search').addEventListener('input', refreshPlantList);

    document.getElementById('plant-sort').addEventListener('change', refreshPlantList);

    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            refreshPlantList();
        });
    });

    // Create hover card element
    const hoverCard = document.createElement('div');
    hoverCard.className = 'plant-hover-card';
    hoverCard.id = 'plant-hover-card';
    document.body.appendChild(hoverCard);
}

function refreshPlantList() {
    const { plants, searchQ } = getFilteredSortedPlants();
    renderPlantList(plants, searchQ);
}

function renderPlantList(plants, searchQ) {
    const container = document.getElementById('plant-list');
    searchQ = searchQ || '';

    container.innerHTML = plants.map(p => {
        // Search highlight
        let displayName = p.name;
        if (searchQ) {
            const idx = p.name.toLowerCase().indexOf(searchQ);
            if (idx !== -1) {
                displayName = p.name.substring(0, idx) + '<span class="search-match">' + p.name.substring(idx, idx + searchQ.length) + '</span>' + p.name.substring(idx + searchQ.length);
            }
        }
        // Season badge
        const badge = getPlantSeasonBadge(p);
        // Companion/enemy info for expanded view
        const waterColors = { low: '#10b981', medium: '#f59e0b', high: '#dc2626' };
        const companions = p.companions.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji + ' ' + cp.name : c; }).join(', ') || 'None';
        const enemies = p.enemies.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji + ' ' + cp.name : c; }).join(', ') || 'None';
        const dates = getPlantDates(p);
        let scheduleHTML = '';
        if (dates.seedIndoor) scheduleHTML += `<span class="pex-sched-item">SEED INDOORS: ${formatDateRange(dates.seedIndoor)}</span>`;
        if (dates.transplant) scheduleHTML += `<span class="pex-sched-item">TRANSPLANT: ${formatDateRange(dates.transplant)}</span>`;
        if (dates.directSow) scheduleHTML += `<span class="pex-sched-item">DIRECT SOW: ${formatDateRange(dates.directSow)}</span>`;
        return `
        <div class="plant-item-wrap" data-plant-id="${p.id}">
            <div class="plant-item" draggable="true" data-plant-id="${p.id}" data-type="${p.type}">
                <span class="plant-emoji">${p.emoji}</span>
                <span class="plant-name">${displayName}</span>
                ${p.isCustom ? '<span class="custom-badge">CUSTOM</span>' : p.seedPacket ? '<span class="custom-badge seed-pkt-badge">SEED PKT</span>' : ''}
                <span class="season-badge ${badge.cls}">${badge.text}</span>
                <span class="plant-type-badge">${p.type.toUpperCase()}</span>
                ${p.isCustom ? `<span class="custom-actions"><button class="custom-action-btn" data-custom-edit="${p.id}" title="Edit">&#x270E;</button><button class="custom-action-btn" data-custom-delete="${p.id}" title="Delete">&#x2715;</button></span>` : ''}
                <span class="plant-expand-icon">&#x25BC;</span>
            </div>
            <div class="plant-expand-panel" hidden>
                <div class="pex-stats">
                    <span class="pex-stat">${p.spacing}" spacing</span>
                    <span class="pex-stat">${p.daysToHarvest}d harvest</span>
                    <span class="pex-stat" style="color:${waterColors[p.waterNeed]}">${p.waterNeed} water</span>
                    <span class="pex-stat">${p.sunNeed} sun</span>
                    ${p.lowMaintenance ? '<span class="pex-stat pex-easy">easy care</span>' : ''}
                </div>
                ${p.seedStartInstructions ? `<p class="pex-note"><strong>SEED START:</strong> ${escapeHtml(p.seedStartInstructions)}</p>` : ''}
                ${p.careNotes ? `<p class="pex-note"><strong>CARE:</strong> ${escapeHtml(p.careNotes)}</p>` : ''}
                ${scheduleHTML ? `<div class="pex-schedule">${scheduleHTML}</div>` : ''}
                <div class="pex-relations">
                    <span class="pex-companions">FRIENDS: ${companions}</span>
                    <span class="pex-enemies">FOES: ${enemies}</span>
                </div>
            </div>
        </div>
    `}).join('');

    const hoverCard = document.getElementById('plant-hover-card');
    let hoverTimeout;

    container.querySelectorAll('.plant-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            // Clear palette hover highlights before drag so they don't collide with indicator badges
            state.hoveredPaletteId = null;
            if (typeof clearPaletteHoverHighlights === 'function') clearPaletteHoverHighlights();
            state.dragData = { plantId: item.dataset.plantId, source: 'palette' };
            e.dataTransfer.setData('text/plain', item.dataset.plantId);
            e.dataTransfer.effectAllowed = 'copy';
            item.style.opacity = '0.5';
            // Custom drag ghost with plant emoji
            const plant = PLANT_LIBRARY.find(p => p.id === item.dataset.plantId);
            if (plant) {
                const ghost = document.createElement('div');
                ghost.className = 'drag-ghost';
                ghost.textContent = plant.emoji;
                ghost.style.position = 'absolute';
                ghost.style.top = '-100px';
                ghost.style.left = '-100px';
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 18, 18);
                setTimeout(() => ghost.remove(), 0);
            }
            // Hide hover card on drag, show companion indicators
            if (hoverCard) { hoverCard.classList.remove('visible'); clearTimeout(hoverTimeout); }
            showCompanionIndicators(item.dataset.plantId);
        });
        item.addEventListener('dragend', () => {
            item.style.opacity = '1';
            hideCompanionIndicators();
        });
        item.addEventListener('click', () => {
            const wrap = item.closest('.plant-item-wrap');
            const panel = wrap ? wrap.querySelector('.plant-expand-panel') : null;
            if (!panel) return;
            const isOpen = !panel.hidden;
            // Close all other open panels
            container.querySelectorAll('.plant-expand-panel:not([hidden])').forEach(p => {
                p.hidden = true;
                p.closest('.plant-item-wrap').querySelector('.plant-expand-icon').textContent = '\u25BC';
            });
            if (!isOpen) {
                panel.hidden = false;
                wrap.querySelector('.plant-expand-icon').textContent = '\u25B2';
            }
        });
        // Double-click to enter click-to-place mode
        item.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (state.clickPlaceMode && state.clickPlaceMode.plantId === item.dataset.plantId) {
                exitClickPlaceMode();
            } else {
                exitClickPlaceMode();
                item.classList.add('click-place-active');
                enterClickPlaceMode(item.dataset.plantId);
            }
        });

        // Palette hover → highlight placed friend/foe instances + draw hover-thread
        // overlay across beds. Fires immediately (the hover-card setTimeout only
        // gates the info card, not the companion highlights).
        item.addEventListener('mouseenter', () => {
            state.hoveredPaletteId = item.dataset.plantId;
            if (typeof applyPaletteHoverHighlights === 'function') applyPaletteHoverHighlights();
        });
        item.addEventListener('mouseleave', () => {
            state.hoveredPaletteId = null;
            if (typeof clearPaletteHoverHighlights === 'function') clearPaletteHoverHighlights();
        });

        // Hover card on mouseenter
        item.addEventListener('mouseenter', (e) => {
            if (!hoverCard) return;
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                const plant = PLANT_LIBRARY.find(p => p.id === item.dataset.plantId);
                if (!plant) return;
                const waterColors = { low: '#10b981', medium: '#f59e0b', high: '#dc2626' };
                const companions = plant.companions.map(c => { const cp = PLANT_LIBRARY.find(pl=>pl.id===c); return cp ? cp.emoji : c; }).join(' ');
                hoverCard.innerHTML = `
                    <div class="hover-title">${plant.emoji} ${plant.name}</div>
                    <div class="hover-stats">
                        <div class="hover-stat">SPACE: <span>${plant.spacing}"</span></div>
                        <div class="hover-stat">DAYS: <span>${plant.daysToHarvest}d</span></div>
                        <div class="hover-stat">WATER: <span style="color:${waterColors[plant.waterNeed]}">${plant.waterNeed.toUpperCase()}</span></div>
                        <div class="hover-stat">SUN: <span>${plant.sunNeed.toUpperCase()}</span></div>
                    </div>
                    ${companions ? `<div class="hover-companions">COMPANIONS: ${companions}</div>` : ''}
                `;
                const rect = item.getBoundingClientRect();
                hoverCard.style.left = (rect.right + 8) + 'px';
                hoverCard.style.top = rect.top + 'px';
                // Keep in viewport
                const cardRect = hoverCard.getBoundingClientRect();
                if (rect.right + 8 + 220 > window.innerWidth) {
                    hoverCard.style.left = (rect.left - 228) + 'px';
                }
                hoverCard.classList.add('visible');
            }, 350);
        });
        item.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            if (hoverCard) hoverCard.classList.remove('visible');
        });
    });

    // Custom seed edit/delete handlers (event delegation)
    container.querySelectorAll('[data-custom-edit]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCustomSeedModal(btn.dataset.customEdit);
        });
    });
    container.querySelectorAll('[data-custom-delete]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCustomSeed(btn.dataset.customDelete);
        });
    });
}

// ---- BED NAMES & SIZES (legacy compat - now derived from containers) ----
// These are computed proxies for code that still references the old globals.
// They read/write from state.containers for backward compatibility during the refactor.
function _getContainerNames() {
    return state.containers.map(c => c.name);
}
function _getContainerSizes() {
    return state.containers.map(c => ({ w: c.w || 5, h: c.h || 10 }));
}
// Legacy references - these must still work for functions not yet fully refactored
const bedNames = new Proxy([], {
    get(target, prop) {
        if (prop === 'length') return state.containers.length;
        if (prop === 'slice') return (...args) => _getContainerNames().slice(...args);
        if (prop === 'forEach') return (fn) => _getContainerNames().forEach(fn);
        if (prop === 'map') return (fn) => _getContainerNames().map(fn);
        if (prop === 'join') return (sep) => _getContainerNames().join(sep);
        if (typeof prop === 'string' && !isNaN(prop)) {
            const idx = parseInt(prop);
            return state.containers[idx] ? state.containers[idx].name : `BED ${idx + 1}`;
        }
        return Reflect.get(_getContainerNames(), prop);
    },
    set(target, prop, value) {
        if (typeof prop === 'string' && !isNaN(prop)) {
            const idx = parseInt(prop);
            if (state.containers[idx]) state.containers[idx].name = value;
            return true;
        }
        return true;
    }
});
const bedSizes = new Proxy([], {
    get(target, prop) {
        if (prop === 'length') return state.containers.length;
        if (prop === 'slice') return (...args) => _getContainerSizes().slice(...args);
        if (prop === 'every') return (fn) => _getContainerSizes().every(fn);
        if (prop === 'forEach') return (fn) => _getContainerSizes().forEach(fn);
        if (prop === 'map') return (fn) => _getContainerSizes().map(fn);
        if (typeof prop === 'string' && !isNaN(prop)) {
            const idx = parseInt(prop);
            return state.containers[idx] ? { w: state.containers[idx].w || 5, h: state.containers[idx].h || 10 } : { w: 5, h: 10 };
        }
        return Reflect.get(_getContainerSizes(), prop);
    },
    set(target, prop, value) {
        if (typeof prop === 'string' && !isNaN(prop)) {
            const idx = parseInt(prop);
            if (state.containers[idx]) {
                state.containers[idx].w = value.w;
                state.containers[idx].h = value.h;
            }
            return true;
        }
        return true;
    }
});
function getBedArea(i) {
    const c = state.containers[i];
    return c ? getContainerArea(c) : 5 * 10 * 144;
}
function getBedPxPerInch(i) {
    const c = state.containers[i];
    return c ? getContainerPxPerInch(c) : 400 / (5 * 12);
}
function saveBedSizes() { saveState(); }
function saveBedNames() { saveState(); }

