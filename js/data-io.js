/* GardenSync — Data Import/Export, Sharing & Demo Loader */

function initDataExportImport() {
    document.getElementById('btn-export-data').addEventListener('click', exportAllData);
    document.getElementById('btn-import-data').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importAllData);

    // Demo data loader
    document.getElementById('btn-load-demo').addEventListener('click', loadDemoData);

    // New garden (clear everything)
    document.getElementById('btn-new-garden').addEventListener('click', newGarden);

    // Visual style toggle (enhanced container visuals)
    initVisualStyleToggle();
}

// ---- ENHANCED VISUAL STYLE TOGGLE ----
function initVisualStyleToggle() {
    const btn = document.getElementById('btn-visual-style');
    const canvas = document.getElementById('garden-canvas');
    if (!btn || !canvas) return;

    // Restore saved preference
    const saved = localStorage.getItem('gardensync_enhanced_visuals');
    if (saved === 'true') {
        canvas.classList.add('enhanced-visuals');
        btn.innerHTML = '&#x1F3A8; STYLED';
    } else {
        btn.innerHTML = '&#x1F3A8; BASIC';
    }

    btn.addEventListener('click', () => {
        const isOn = canvas.classList.toggle('enhanced-visuals');
        localStorage.setItem('gardensync_enhanced_visuals', isOn ? 'true' : 'false');
        btn.innerHTML = isOn ? '&#x1F3A8; STYLED' : '&#x1F3A8; BASIC';
        showToast(isOn ? 'Enhanced container styles ON' : 'Basic container styles');
    });
}

// ---- NEW GARDEN (blank canvas with export safety net) ----
function newGarden() {
    if (state.containers.length === 0) {
        showToast('Garden is already empty!');
        return;
    }

    const count = state.containers.length;
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    overlay.innerHTML = `
        <div class="confirm-modal">
            <h3>\u26A0\uFE0F NEW GARDEN</h3>
            <p>This will remove <strong>all ${count} container${count !== 1 ? 's' : ''}</strong> and start with a blank canvas.<br>
            Do you want to export your current garden first?</p>
            <div class="confirm-actions" style="flex-wrap:wrap;gap:8px;">
                <button class="tool-btn accent new-garden-export">EXPORT &amp; CLEAR</button>
                <button class="tool-btn danger new-garden-clear">CLEAR WITHOUT SAVING</button>
                <button class="tool-btn new-garden-cancel">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    function doClear() {
        pushUndo();
        state.containers = [];
        state.selectedContainer = null;
        state.canvasZoom = 1;
        state.canvasOffsetX = 0;
        state.canvasOffsetY = 0;
        renderAllContainers();
        updateContainerSelector();
        updateBedDetails();
        updateToolbarSublabel();
        applyCanvasTransform();
        saveState();
        showToast('New blank garden ready!');
    }

    overlay.querySelector('.new-garden-export').addEventListener('click', () => {
        overlay.remove();
        exportAllData();
        setTimeout(doClear, 300);
    });
    overlay.querySelector('.new-garden-clear').addEventListener('click', () => {
        overlay.remove();
        doClear();
    });
    overlay.querySelector('.new-garden-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

const DEMO_REGISTRY = [
    { key: 'classic',   source: () => DEMO_CLASSIC,       icon: '🌿', title: 'FNB Classic',
      desc: '4 raised beds • 5 volunteers • harvest log & journal',
      toast: 'FNB Classic loaded! Explore all tabs to see it in action.' },
    { key: 'showcase',  source: () => DEMO_SHOWCASE,      icon: '🏡', title: 'Container Showcase',
      desc: 'All 7 container types • 11 containers • 60+ plants',
      toast: 'Container Showcase loaded! 11 containers across all 7 types.' },
    { key: 'sisters',   source: () => DEMO_THREE_SISTERS,  icon: '🌽', title: 'Three Sisters Companion',
      desc: '2 in-ground mounds + 2 raised beds • traditional companion planting',
      toast: 'Three Sisters loaded! Corn, beans & squash in classic companion groups.' },
    { key: 'herbs',     source: () => DEMO_HERB_PATIO,     icon: '🌿', title: 'Kitchen Herb Patio',
      desc: '2 window boxes • 3 pots • planter + grow bag • all cooking herbs',
      toast: 'Herb Patio loaded! Fresh herbs right outside your door.' },
    { key: 'beginner',  source: () => DEMO_BEGINNER,       icon: '🌱', title: 'Beginner Starter',
      desc: '2 small beds + pot + planter + grow bag • easy fast-growing crops',
      toast: 'Beginner garden loaded! All easy-to-grow plants with companion flowers.' },
    { key: 'salsa',     source: () => DEMO_SALSA_PIZZA,    icon: '🍕', title: 'Salsa & Pizza Garden',
      desc: 'Salsa bed + pizza bed + herb planter • grow your own toppings',
      toast: 'Salsa & Pizza garden loaded! Everything for fresh salsa and homemade pizza.' },
    { key: 'mygarden-empty', source: () => DEMO_OUR_GARDEN_EMPTY, icon: '🏠', title: 'Our Garden (Empty)',
      desc: '20 containers matching real layout • all empty, ready to plan',
      toast: 'Your real garden layout loaded! All 20 containers are empty — drag plants from the library to start planning.' },
    { key: 'mygarden-planted', source: () => DEMO_OUR_GARDEN_PLANTED, icon: '🍅', title: 'Our Garden (Planted)',
      desc: '20 containers • tomatoes, melons, peas, root veg & blueberries • companion groups',
      toast: 'Your garden loaded! All plants placed as planned. Check with your fiancée and tweak as needed.' }
];

function loadDemoData() {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    const btnStyle = 'padding:10px 14px;text-align:left;line-height:1.35;';
    const buttons = DEMO_REGISTRY.map(d =>
        `<button class="tool-btn demo-pick" data-demo="${d.key}" style="${btnStyle}">
            <span style="font-size:1.05em;font-weight:bold;">${d.icon} ${d.title}</span><br>
            <span style="opacity:.6;font-size:.82em;">${d.desc}</span>
        </button>`
    ).join('');
    overlay.innerHTML = `
        <div class="confirm-modal" style="max-width:500px;max-height:85vh;overflow-y:auto;">
            <h3>\u{1F331} LOAD DEMO GARDEN</h3>
            <p style="margin-bottom:12px;opacity:.7;">Choose a demo to replace your current garden. This cannot be undone.</p>
            <div style="display:flex;flex-direction:column;gap:8px;">${buttons}</div>
            <div style="margin-top:14px;text-align:right;">
                <button class="tool-btn confirm-no">CANCEL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.demo-pick').forEach(btn => {
        btn.addEventListener('click', () => {
            const entry = DEMO_REGISTRY.find(d => d.key === btn.dataset.demo);
            if (!entry) return;
            overlay.remove();
            applyDemoData(entry.source(), entry.toast);
        });
    });
    overlay.querySelector('.confirm-no').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function applyDemoData(demoSource, toastMsg) {
    try {
        const data = JSON.parse(JSON.stringify(demoSource));

        // Restore state - handle both V1 and V2 demo data
        if (data.state.containers) {
            // V2 demo data
            state.containers = data.state.containers;
        } else if (data.state.beds) {
            // V1 demo data - migrate
            const migrated = migrateV1ToV2(data.state);
            state.containers = migrated.containers;
            // Apply bed names from demo data
            if (data.bedNames) {
                data.bedNames.forEach((name, i) => {
                    if (state.containers[i]) state.containers[i].name = name;
                });
            }
        }
        if (data.state.volunteers) state.volunteers = data.state.volunteers;
        // Handle volunteer assignments
        if (data.state.bedAssignments && Array.isArray(data.state.bedAssignments)) {
            data.state.bedAssignments.forEach((volId, i) => {
                if (state.containers[i]) state.containers[i].volunteer = volId;
            });
        }

        if (state.containers.length > 0) {
            state.selectedContainer = state.containers[0].id;
        }

        // Restore localStorage items
        if (data.plantingLog) savePlantingLogData(data.plantingLog);
        if (data.harvests) saveHarvestData(data.harvests);
        if (data.journal) saveJournalData(data.journal);
        if (data.completedTasks) localStorage.setItem('gardensync_completed_tasks', JSON.stringify(data.completedTasks));

        // Harvest goal
        if (data.harvestGoal) {
            localStorage.setItem('gardensync_harvest_goal', data.harvestGoal);
            const goalInput = document.getElementById('harvest-goal-weight');
            if (goalInput) goalInput.value = data.harvestGoal;
        }

        // Inject custom seeds if the demo includes them
        if (data.customSeeds && Array.isArray(data.customSeeds)) {
            const existing = JSON.parse(localStorage.getItem('gardenSyncCustomPlants') || '[]');
            const existingIds = new Set(existing.map(p => p.id));
            let added = 0;
            data.customSeeds.forEach(seed => {
                if (!existingIds.has(seed.id)) {
                    existing.push(seed);
                    added++;
                }
            });
            if (added > 0) {
                localStorage.setItem('gardenSyncCustomPlants', JSON.stringify(existing));
            }
            // Re-merge custom plants into PLANT_LIBRARY so they're available immediately
            if (typeof mergeCustomPlantsIntoLibrary === 'function') mergeCustomPlantsIntoLibrary();
        }

        renderAllContainers();
        // Auto-organize all containers so plants are properly positioned
        state.containers.forEach(c => {
            if (c.plants.length > 0) autoOrganizeBed(c.id, true);
        });
        updateContainerSelector();
        updateToolbarSublabel();
        saveState();
        updateBedDetails();
        updateHarvestGoalDisplay();
        showToast(toastMsg);
        // Auto-fit view to show all loaded containers
        setTimeout(() => zoomToFit(), 150);
    } catch (err) {
        showToast('Failed to load demo: ' + err.message);
        console.error('[GardenSync] Demo load error:', err);
    }
}

function exportAllData() {
    const exportData = {
        version: 2,
        exportDate: new Date().toISOString(),
        app: 'GardenSync // Food Not Bombs Canton',
        state: {
            containers: state.containers,
            volunteers: state.volunteers,
        },
        plantingLog: getPlantingLogData(),
        harvests: getHarvestData(),
        journal: getJournalData(),
        completedTasks: JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}'),
        // API keys intentionally excluded from exports for security
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gardensync-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('All data exported!');
}

// ---- SHARE VIA URL ----
function generateShareURL() {
    // Compact encoding: containers -> array of container objects with plant data
    const usedIds = new Set();
    state.containers.forEach(c => c.plants.forEach(p => usedIds.add(p.plantId)));
    const idList = [...usedIds].sort();
    const idMap = {};
    idList.forEach((id, i) => idMap[id] = i);

    const compact = {
        v: 2,
        k: idList,
        c: state.containers.map(container => {
            const cType = CONTAINER_TYPES[container.type] || CONTAINER_TYPES['raised-bed'];
            return {
                t: container.type,
                n: container.name,
                w: container.w || null,
                h: container.h || null,
                d: container.diameter || null,
                p: container.plants.map(p => [idMap[p.plantId], Math.round(p.x), Math.round(p.y)])
            };
        })
    };

    const json = JSON.stringify(compact);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return window.location.origin + window.location.pathname + '#plan=' + encoded;
}

function loadSharedPlan(encoded) {
    try {
        const json = decodeURIComponent(escape(atob(encoded)));
        const compact = JSON.parse(json);

        let containers;
        if (compact.v === 2 && compact.c) {
            // V2 share format
            const idList = compact.k;
            containers = compact.c.map((cData, i) => ({
                id: `container-share-${i}-${Date.now()}`,
                type: cData.t || 'raised-bed',
                name: escapeHtml(cData.n || `Container ${i + 1}`),
                canvasX: (i % 2) * 450,
                canvasY: Math.floor(i / 2) * 280,
                w: cData.w, h: cData.h,
                diameter: cData.d,
                plants: cData.p.map(([idIdx, x, y]) => ({
                    id: `${idList[idIdx]}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                    plantId: idList[idIdx],
                    x, y
                })),
                notes: '', volunteer: null
            }));
        } else if (compact.v === 1 && compact.b) {
            // V1 share format - migrate
            const idList = compact.k;
            const names = (compact.n || ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4']).map(n => escapeHtml(n));
            const sizes = compact.s || [{ w: 5, h: 10 }, { w: 5, h: 10 }, { w: 5, h: 10 }, { w: 5, h: 10 }];
            containers = compact.b.map((bed, i) => ({
                id: `container-share-${i}-${Date.now()}`,
                type: 'raised-bed',
                name: names[i] || `Bed ${i + 1}`,
                canvasX: (i % 2) * 450,
                canvasY: Math.floor(i / 2) * 280,
                w: sizes[i]?.w || 5, h: sizes[i]?.h || 10,
                diameter: null,
                plants: bed.map(([idIdx, x, y]) => ({
                    id: `${idList[idIdx]}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                    plantId: idList[idIdx],
                    x, y
                })),
                notes: '', volunteer: null
            }));
        } else {
            throw new Error('Invalid share format');
        }

        const totalPlants = containers.reduce((s, c) => s + c.plants.length, 0);
        const desc = containers.map(c => c.name).join(', ') + ` (${totalPlants} plants)`;

        showConfirm('LOAD SHARED PLAN', `Load shared garden plan? This replaces your current layouts.<br><br><strong>${desc}</strong>`, () => {
            pushUndo();
            state.containers = containers;
            if (state.containers.length > 0) {
                state.selectedContainer = state.containers[0].id;
            }
            renderAllContainers();
            updateContainerSelector();
            updateBedDetails();
            saveState();
            history.replaceState(null, '', window.location.pathname);
            showToast(`Shared plan loaded! ${totalPlants} plants across ${containers.length} containers.`);
            setTimeout(() => zoomToFit(), 150);
        });
    } catch (err) {
        showToast('Invalid share link: ' + err.message);
        console.error('[GardenSync] Share load error:', err);
    }
}

function initShareURL() {
    const btn = document.getElementById('btn-share-url');
    if (btn) {
        btn.addEventListener('click', () => {
            const totalPlants = state.containers.reduce((s, c) => s + c.plants.length, 0);
            if (totalPlants === 0) { showToast('Nothing to share \u2014 plant some seeds first!'); return; }
            const url = generateShareURL();
            navigator.clipboard.writeText(url).then(() => {
                showToast('Share link copied to clipboard!');
            }).catch(() => {
                // Fallback: show in a prompt
                prompt('Copy this share link:', url);
            });
        });
    }

    // Check for shared plan in URL on load
    const hash = window.location.hash;
    if (hash.startsWith('#plan=')) {
        const encoded = hash.substring(6);
        // Small delay to let the app finish loading
        setTimeout(() => loadSharedPlan(encoded), 500);
    }
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reject files over 10 MB to prevent memory exhaustion
    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large (max 10 MB)');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!data.version || !data.state) {
                showToast('Invalid backup file!');
                return;
            }

            // Count containers for summary
            let importContainers = data.state.containers || [];
            if (!data.state.containers && data.state.beds) {
                importContainers = data.state.beds;
            }
            const importCount = Array.isArray(importContainers) ? importContainers.length : 0;
            const summary = `${importCount} container${importCount !== 1 ? 's' : ''}, exported ${data.exportDate ? new Date(data.exportDate).toLocaleDateString() : 'unknown date'}`;

            showConfirm('IMPORT DATA', `Import this backup? This will replace all current data.<br><br><strong>${summary}</strong>`, () => {
                // Restore state - handle V1 and V2
                let rawState;
                if (data.state.containers) {
                    rawState = {
                        containers: data.state.containers,
                        volunteers: data.state.volunteers || [],
                        canvasZoom: data.state.canvasZoom,
                        canvasOffsetX: data.state.canvasOffsetX,
                        canvasOffsetY: data.state.canvasOffsetY,
                    };
                } else if (data.state.beds) {
                    const migrated = migrateV1ToV2(data.state);
                    rawState = {
                        containers: migrated.containers,
                        volunteers: data.state.volunteers || [],
                    };
                    if (data.state.bedAssignments) {
                        data.state.bedAssignments.forEach((volId, i) => {
                            if (rawState.containers[i]) rawState.containers[i].volunteer = volId;
                        });
                    }
                } else {
                    showToast('Import failed: no container data found');
                    return;
                }

                // Run through validation to sanitize imported data
                const validated = validateLoadedState(rawState);
                if (!validated) {
                    showToast('Import failed: data validation error');
                    return;
                }

                state.containers = validated.containers;
                state.volunteers = validated.volunteers;
                state.canvasZoom = validated.canvasZoom;
                state.canvasOffsetX = validated.canvasOffsetX;
                state.canvasOffsetY = validated.canvasOffsetY;

                if (state.containers.length > 0) {
                    state.selectedContainer = state.containers[0].id;
                }

                // Restore localStorage items
                if (data.plantingLog) savePlantingLogData(data.plantingLog);
                if (data.harvests) saveHarvestData(data.harvests);
                if (data.journal) saveJournalData(data.journal);
                if (data.completedTasks) localStorage.setItem('gardensync_completed_tasks', JSON.stringify(data.completedTasks));
                // API keys from imports are intentionally ignored for security

                renderAllContainers();
                updateContainerSelector();
                saveState();
                updateBedDetails();
                updateToolbarSublabel();
                showToast(`Imported ${validated.containers.length} containers successfully!`);
                setTimeout(() => zoomToFit(), 150);
            });
        } catch (err) {
            showToast('Error reading backup: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ---- WINDOW RESIZE FOR CHARTS ----
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        drawRainfallChart();
        drawTempChart();
    }, 250);
});

// ==================== GARDEN BUDDY AI CHAT ====================

// Strip lone surrogates that break JSON serialization (emoji from Claude responses, OCR, etc.)
function safeStringify(obj) {
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'string') {
            return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
                        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
        }
        return value;
    });
}

