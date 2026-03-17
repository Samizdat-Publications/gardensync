/* GardenSync — Toolbar Buttons & Copy Bed */

function initToolbarButtons() {
    document.getElementById('btn-clear-all').addEventListener('click', () => {
        const totalPlants = state.containers.reduce((s, c) => s + c.plants.length, 0);
        if (totalPlants === 0) { showToast('All containers are already empty!'); return; }
        showConfirm('CLEAR ALL', `Remove all ${totalPlants} plant(s) from every container? This can be undone with Ctrl+Z.`, () => {
            pushUndo();
            state.containers.forEach(c => { c.plants = []; });
            state.containers.forEach(c => renderPlacedPlants(c.id));
            updateBedDetails();
            saveState();
            showToast('All containers cleared');
        });
    });

    document.getElementById('btn-save').addEventListener('click', () => {
        saveState();
        showToast('Garden plan saved!');
    });

    document.getElementById('btn-load').addEventListener('click', () => {
        showPresetModal();
    });

    document.getElementById('btn-export').addEventListener('click', exportPNG);
    document.getElementById('btn-print-map').addEventListener('click', printBedMap);

    // Stats toggle
    document.getElementById('btn-stats-toggle').addEventListener('click', () => {
        const dash = document.getElementById('stats-dashboard');
        const btn = document.getElementById('btn-stats-toggle');
        const isHidden = dash.classList.toggle('hidden');
        btn.classList.toggle('accent', !isHidden);
        if (!isHidden) updateStatsDashboard();
    });

    // Grid toggle
    let gridOn = false;
    document.getElementById('btn-grid-toggle').addEventListener('click', () => {
        gridOn = !gridOn;
        document.querySelectorAll('.garden-bed').forEach(bed => {
            bed.classList.toggle('show-grid', gridOn);
        });
        document.getElementById('btn-grid-toggle').textContent = gridOn ? 'GRID: ON' : 'GRID: OFF';
        document.getElementById('btn-grid-toggle').classList.toggle('accent', gridOn);
    });

    // Auto-organize
    document.getElementById('btn-auto-organize').addEventListener('click', () => {
        const container = getSelectedContainer();
        if (!container) return;
        pushUndo();
        autoOrganizeBed(container.id);
    });

    // Undo / Redo
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);

    // Clear this bed
    document.getElementById('btn-clear-bed').addEventListener('click', () => {
        const container = getSelectedContainer();
        if (!container) return;
        if (container.plants.length === 0) { showToast('Container is already empty!'); return; }
        showConfirm('CLEAR CONTAINER', `Remove all ${container.plants.length} plant(s) from ${container.name}? This can be undone with Ctrl+Z.`, () => {
            pushUndo();
            container.plants = [];
            renderPlacedPlants(container.id);
            updateBedDetails();
            saveState();
            showToast(`${container.name} cleared`);
        });
    });

    // Copy bed to another bed
    document.getElementById('btn-copy-bed').addEventListener('click', () => {
        showCopyBedModal();
    });

    // Zoom buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomFit = document.getElementById('btn-zoom-fit');
    if (btnZoomIn) btnZoomIn.addEventListener('click', zoomIn);
    if (btnZoomOut) btnZoomOut.addEventListener('click', zoomOut);
    if (btnZoomFit) btnZoomFit.addEventListener('click', zoomToFit);

    updateUndoRedoButtons();
}

// ---- COPY BED MODAL ----
function showCopyBedModal() {
    const srcContainer = getSelectedContainer();
    if (!srcContainer) { showToast('No container selected'); return; }
    if (srcContainer.plants.length === 0) { showToast('No plants to copy'); return; }

    const targets = state.containers.filter(c => c.id !== srcContainer.id);
    if (targets.length === 0) { showToast('No other containers to copy to'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal" style="max-width:400px;">
            <h3 style="font-family:var(--font-heading);color:var(--emerald);margin:0 0 0.75rem;">📋 COPY PLANTS TO...</h3>
            <p style="margin:0 0 0.75rem;color:var(--text-secondary);font-size:0.8rem;">Copy ${srcContainer.plants.length} plant${srcContainer.plants.length !== 1 ? 's' : ''} from <strong>${srcContainer.name}</strong> to:</p>
            <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
                ${targets.map(t => {
                    const td = CONTAINER_TYPES[t.type];
                    return `<button class="tool-btn copy-target" data-target-id="${t.id}">${td.icon} ${t.name} (${t.plants.length} plants)</button>`;
                }).join('')}
            </div>
            <div style="margin-top:12px;"><button class="tool-btn confirm-no">CANCEL</button></div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.copy-target').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.targetId;
            const targetContainer = getContainer(targetId);
            if (!targetContainer) return;
            pushUndo();
            const copiedPlants = srcContainer.plants.map(p => ({
                id: `${p.plantId}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                plantId: p.plantId,
                x: p.x,
                y: p.y
            }));
            targetContainer.plants.push(...copiedPlants);
            autoOrganizeBed(targetId, true);
            renderPlacedPlants(targetId);
            updateBedDetails();
            saveState();
            overlay.remove();
            showToast(`Copied ${copiedPlants.length} plants to ${targetContainer.name}`);
        });
    });

    overlay.querySelector('.confirm-no').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ---- AUTO-ORGANIZE (Shape-Aware) ----
