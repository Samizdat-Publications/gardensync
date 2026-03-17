/* GardenSync — Click-to-Place Mode & Selection Engine */

function enterClickPlaceMode(plantId) {
    state.clickPlaceMode = { plantId };
    document.body.classList.add('click-place-mode');
    document.querySelectorAll('.garden-bed').forEach(c => c.classList.add('click-place-target'));
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    showToast(`Click on a container to place ${plant.emoji} ${plant.name} (ESC to cancel)`);
    showCompanionIndicators(plantId);
}

function exitClickPlaceMode() {
    state.clickPlaceMode = null;
    document.body.classList.remove('click-place-mode');
    document.querySelectorAll('.garden-bed').forEach(c => c.classList.remove('click-place-target'));
    document.querySelectorAll('.plant-item').forEach(item => item.classList.remove('click-place-active'));
    hideCompanionIndicators();
}

function showCompanionIndicators(plantId) {
    hideCompanionIndicators();
    const plant = PLANT_LIBRARY.find(p => p.id === plantId);
    if (!plant) return;
    document.querySelectorAll('.garden-bed').forEach(el => {
        const containerId = el.dataset.containerId;
        const container = getContainer(containerId);
        if (!container) return;
        const uniqueIds = [...new Set(container.plants.map(p => p.plantId))];
        let friends = 0, foes = 0;
        uniqueIds.forEach(id => {
            if (plant.companions.includes(id)) friends++;
            if (plant.enemies.includes(id)) foes++;
        });
        if (friends === 0 && foes === 0 && uniqueIds.length === 0) return;
        const badge = document.createElement('div');
        badge.className = 'companion-badge' + (foes > 0 ? ' has-foes' : friends > 0 ? ' has-friends' : '');
        if (foes > 0) {
            badge.textContent = `${foes} foe${foes > 1 ? 's' : ''}`;
        } else if (friends > 0) {
            badge.textContent = `${friends} friend${friends > 1 ? 's' : ''}`;
        } else {
            badge.textContent = 'neutral';
        }
        el.appendChild(badge);
    });
}

function hideCompanionIndicators() {
    document.querySelectorAll('.companion-badge').forEach(b => b.remove());
}

// ---- SELECTION ENGINE (multi-select aware) ----
function selectPlacement(containerId, placementId, additive) {
    if (additive) {
        // Shift+Click: toggle in/out of multi-selection
        const idx = state.selectedPlacements.findIndex(s => s.placementId === placementId);
        if (idx !== -1) {
            // Already selected — remove from set
            state.selectedPlacements.splice(idx, 1);
            const el = document.querySelector(`.placed-plant[data-placement-id="${placementId}"]`);
            if (el) el.classList.remove('selected');
        } else {
            // Cross-container guard: if selection exists in different container, clear first
            if (state.selectedPlacements.length > 0 && state.selectedPlacements[0].containerId !== containerId) {
                clearSelection();
            }
            state.selectedPlacements.push({ containerId, placementId });
            const el = document.querySelector(`.placed-plant[data-placement-id="${placementId}"]`);
            if (el) el.classList.add('selected');
        }
    } else {
        // Regular click: clear all, select just this one
        clearSelection();
        state.selectedPlacements = [{ containerId, placementId }];
        const el = document.querySelector(`.placed-plant[data-placement-id="${placementId}"]`);
        if (el) el.classList.add('selected');
    }
    updateMultiSelectIndicators();
}

function clearSelection() {
    state.selectedPlacements = [];
    document.querySelectorAll('.placed-plant.selected, .placed-plant.multi-selected').forEach(el => {
        el.classList.remove('selected', 'multi-selected');
    });
    hideContextMenu();
}

function isPlacementSelected(placementId) {
    return state.selectedPlacements.some(s => s.placementId === placementId);
}

function getSelectedContainerId() {
    return state.selectedPlacements.length > 0 ? state.selectedPlacements[0].containerId : null;
}

function updateMultiSelectIndicators() {
    // Add/remove .multi-selected class for visual indicator when >1 selected
    const isMulti = state.selectedPlacements.length > 1;
    document.querySelectorAll('.placed-plant.selected').forEach(el => {
        el.classList.toggle('multi-selected', isMulti);
    });
}

