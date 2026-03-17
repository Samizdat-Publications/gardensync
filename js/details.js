/* GardenSync — Bed Details Panel & Journal */

function updateBedDetails() {
    const container = getSelectedContainer();
    const plants = container ? container.plants : [];
    const containerId = container ? container.id : null;
    const uniquePlants = [...new Set(plants.map(p => p.plantId))];

    document.getElementById('bed-plant-count').textContent = plants.length;

    // Show container type
    const typeDef = container ? CONTAINER_TYPES[container.type] : null;
    const typeLabel = document.getElementById('bed-type-label');
    if (typeLabel) {
        typeLabel.textContent = typeDef ? `${typeDef.icon} ${typeDef.label}` : '';
    }

    // Update total plant count in toolbar
    const totalPlants = state.containers.reduce((sum, c) => sum + c.plants.length, 0);
    const totalCountEl = document.getElementById('total-plant-count');
    if (totalCountEl) {
        totalCountEl.innerHTML = `<span class="count-num">${totalPlants}</span> PLANT${totalPlants !== 1 ? 'S' : ''}`;
    }

    // Coverage estimate (rough)
    const bedArea = container ? getContainerArea(container) : 1;
    let usedArea = 0;
    plants.forEach(p => {
        const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
        if (plant) usedArea += Math.PI * Math.pow(plant.spacing / 2, 2);
    });
    const coverage = Math.min(100, Math.round((usedArea / bedArea) * 100));
    document.getElementById('bed-coverage').textContent = coverage + '%';

    // Water need
    const waterLevels = { low: 1, medium: 2, high: 3 };
    if (plants.length === 0) {
        document.getElementById('bed-water').textContent = '--';
    } else {
        const avgWater = plants.reduce((sum, p) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            return sum + (plant ? waterLevels[plant.waterNeed] : 0);
        }, 0) / plants.length;
        const waterLabel = avgWater < 1.5 ? 'LOW' : avgWater < 2.5 ? 'MEDIUM' : 'HIGH';
        document.getElementById('bed-water').textContent = waterLabel;
    }

    // Plant list with +/- quantity controls
    const listEl = document.getElementById('bed-plant-list');
    if (plants.length === 0) {
        listEl.innerHTML = '<p class="muted-text">No plants yet \u2014 drag from the library!</p>';
    } else {
        const counts = {};
        plants.forEach(p => { counts[p.plantId] = (counts[p.plantId] || 0) + 1; });
        listEl.innerHTML = Object.entries(counts).map(([pid, count]) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === pid);
            if (!plant) return '';
            return `<div class="bed-plant-entry">
                <span class="bed-plant-emoji">${plant.emoji}</span>
                <span class="bed-plant-name">${plant.name}</span>
                <div class="qty-controls">
                    <button class="qty-btn qty-minus" data-plant-id="${pid}" title="Remove one ${plant.name}">\u2212</button>
                    <span class="qty-value">${count}</span>
                    <button class="qty-btn qty-plus" data-plant-id="${pid}" title="Add one ${plant.name}">+</button>
                </div>
                <button class="remove-plant" data-plant-id="${pid}" title="Remove all ${plant.name}">\u00D7</button>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!container) return;
                pushUndo();
                const pid = btn.dataset.plantId;
                const idx = container.plants.findLastIndex(p => p.plantId === pid);
                if (idx !== -1) {
                    showQtyFlyup(btn, '-1', true);
                    container.plants.splice(idx, 1);
                    renderPlacedPlants(containerId);
                    updateBedDetails();
                    saveState();
                }
            });
        });

        listEl.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!container) return;
                showQtyFlyup(btn, '+1', false);
                const pid = btn.dataset.plantId;
                const bedEl = document.querySelector(`.garden-bed[data-container-id="${containerId}"]`);
                const bedW = bedEl ? bedEl.offsetWidth : 400;
                const bedH = bedEl ? bedEl.offsetHeight : 220;
                const existing = container.plants.filter(p => p.plantId === pid);
                let x, y;
                if (existing.length > 0) {
                    const last = existing[existing.length - 1];
                    x = last.x + 40;
                    y = last.y;
                    if (x >= bedW - 36) { x = 10; y = Math.min(last.y + 40, bedH - 36); }
                    x = Math.min(x, bedW - 36);
                } else {
                    x = Math.random() * (bedW - 40) + 2;
                    y = Math.random() * (bedH - 40) + 2;
                }
                placePlant(containerId, pid, x, y);
            });
        });

        listEl.querySelectorAll('.remove-plant').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!container) return;
                pushUndo();
                container.plants = container.plants.filter(p => p.plantId !== btn.dataset.plantId);
                renderPlacedPlants(containerId);
                updateBedDetails();
                saveState();
            });
        });
    }

    // Companion alerts
    const alertsEl = document.getElementById('companion-alerts');
    const alerts = [];
    for (let i = 0; i < uniquePlants.length; i++) {
        for (let j = i + 1; j < uniquePlants.length; j++) {
            const p1 = PLANT_LIBRARY.find(pl => pl.id === uniquePlants[i]);
            const p2 = PLANT_LIBRARY.find(pl => pl.id === uniquePlants[j]);
            if (!p1 || !p2) continue;
            if (p1.companions.includes(p2.id)) {
                alerts.push({ type: 'good', text: `${p1.emoji} ${p1.name} + ${p2.emoji} ${p2.name} = great companions!` });
            }
            if (p1.enemies.includes(p2.id) || p2.enemies.includes(p1.id)) {
                alerts.push({ type: 'bad', text: `${p1.emoji} ${p1.name} + ${p2.emoji} ${p2.name} = avoid together!` });
            }
        }
    }
    if (alerts.length === 0) {
        alertsEl.innerHTML = '<p class="muted-text">Place plants to see companion tips</p>';
    } else {
        alertsEl.innerHTML = alerts.map(a =>
            `<div class="companion-${a.type}">${a.type === 'good' ? '\u2714' : '\u26A0'} ${a.text}</div>`
        ).join('');
    }

    // Update journal entries for this bed
    renderJournalEntries();

    // Update stats dashboard if visible
    if (!document.getElementById('stats-dashboard')?.classList.contains('hidden')) {
        updateStatsDashboard();
    }

    // Refresh today's tasks (shows/hides dashboard based on planted status)
    updateTodayDashboard();
}

// ---- BED JOURNAL ----
function initBedJournal() {
    document.getElementById('btn-add-journal').addEventListener('click', addJournalEntry);
    document.getElementById('journal-entry-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addJournalEntry();
    });
}

function getJournalData() {
    return JSON.parse(localStorage.getItem('gardensync_journal') || '{}');
}

function saveJournalData(data) {
    localStorage.setItem('gardensync_journal', JSON.stringify(data));
}

function addJournalEntry() {
    const input = document.getElementById('journal-entry-input');
    const text = input.value.trim();
    if (!text) return;

    const selectedContainer = getSelectedContainer();
    const bedKey = selectedContainer ? `container-${selectedContainer.id}` : 'container-none';
    const journal = getJournalData();
    if (!journal[bedKey]) journal[bedKey] = [];
    journal[bedKey].unshift({
        id: Date.now(),
        text: text,
        date: new Date().toISOString()
    });
    saveJournalData(journal);
    input.value = '';
    renderJournalEntries();
    showToast('Note added to ' + (selectedContainer ? selectedContainer.name : 'garden'));
    // Scroll entries into view
    const containerEl = document.getElementById('journal-entries');
    containerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderJournalEntries() {
    const selectedContainer = getSelectedContainer();
    const bedKey = selectedContainer ? `container-${selectedContainer.id}` : 'container-none';
    // Also check legacy key format for migration
    const containerIdx = selectedContainer ? getContainerIndex(selectedContainer.id) : -1;
    const legacyKey = containerIdx >= 0 ? `bed-${containerIdx}` : null;
    const journal = getJournalData();
    const entries = journal[bedKey] || (legacyKey ? journal[legacyKey] : null) || [];
    const containerEl = document.getElementById('journal-entries');

    if (entries.length === 0) {
        containerEl.innerHTML = '<p class="muted-text">No notes yet</p>';
        return;
    }

    containerEl.innerHTML = entries.map(e => {
        const dateStr = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `
            <div class="journal-entry">
                <span class="journal-entry-date">${dateStr}</span>
                <span class="journal-entry-text">${e.text}</span>
                <button class="journal-entry-delete" data-entry-id="${e.id}">\u00D7</button>
            </div>
        `;
    }).join('');

    containerEl.querySelectorAll('.journal-entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const journal = getJournalData();
            const activeKey = journal[bedKey] ? bedKey : (legacyKey && journal[legacyKey] ? legacyKey : bedKey);
            if (journal[activeKey]) {
                journal[activeKey] = journal[activeKey].filter(e => e.id !== parseInt(btn.dataset.entryId));
                saveJournalData(journal);
                renderJournalEntries();
            }
        });
    });
}

// ---- TOOLBAR BUTTONS ----
