/* GardenSync — Harvest Log & Analytics */

function initHarvestLog() {
    // Populate plant dropdown
    const plantSelect = document.getElementById('harvest-plant');
    plantSelect.innerHTML = PLANT_LIBRARY
        .filter(p => p.type === 'vegetable' || p.type === 'fruit' || p.type === 'herb')
        .map(p => `<option value="${p.id}">${p.emoji} ${p.name}</option>`)
        .join('');

    // Set default date to today
    document.getElementById('harvest-date').valueAsDate = new Date();

    document.getElementById('btn-log-harvest').addEventListener('click', logHarvest);
}

function getHarvestData() {
    return JSON.parse(localStorage.getItem('gardensync_harvests') || '[]');
}

function saveHarvestData(data) {
    localStorage.setItem('gardensync_harvests', JSON.stringify(data));
}

/**
 * Append a harvest entry directly (used by stage 2d harvest-burst yoink and
 * any other code path that needs to log a harvest without the form UI).
 * Re-renders the harvest log if it's currently mounted.
 */
function harvestPlantDirect(plantId, weight, bed, notes, donated) {
    if (!plantId) return;
    const harvests = getHarvestData();
    harvests.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000),
        plantId: plantId,
        bed: bed || '',
        weight: parseFloat(weight) || 0,
        date: new Date().toISOString().slice(0, 10),
        notes: notes || '',
        donated: donated || 'no',
        timestamp: new Date().toISOString()
    });
    saveHarvestData(harvests);
    if (document.getElementById('harvest-entries')) {
        try { renderHarvestLog(); } catch (e) { /* tab not mounted yet */ }
    }
}

window.harvestPlantDirect = harvestPlantDirect;

function logHarvest() {
    const plantId = document.getElementById('harvest-plant').value;
    const bed = document.getElementById('harvest-bed').value;
    const weight = parseFloat(document.getElementById('harvest-weight').value) || 0;
    const date = document.getElementById('harvest-date').value;
    const notes = document.getElementById('harvest-notes').value.trim();
    const donated = document.getElementById('harvest-donated').value;

    if (!plantId || !date) {
        showToast('Please select a plant and date!');
        return;
    }

    const harvests = getHarvestData();
    harvests.unshift({
        id: Date.now(),
        plantId,
        bed: parseInt(bed),
        weight,
        date,
        notes,
        donated,
        timestamp: new Date().toISOString()
    });

    saveHarvestData(harvests);

    // Reset form
    document.getElementById('harvest-weight').value = '';
    document.getElementById('harvest-notes').value = '';
    document.getElementById('harvest-date').valueAsDate = new Date();

    renderHarvestLog();
    showToast('Harvest logged!');
}

function renderHarvestLog() {
    const harvests = getHarvestData();

    // Stats
    const totalCount = harvests.length;
    const totalWeight = harvests.reduce((sum, h) => sum + (parseFloat(h.weight) || 0), 0);
    const donatedWeight = harvests
        .filter(h => h.donated === 'yes')
        .reduce((sum, h) => sum + (parseFloat(h.weight) || 0), 0)
        + harvests
        .filter(h => h.donated === 'partial')
        .reduce((sum, h) => sum + (parseFloat(h.weight) || 0) * 0.5, 0);
    const varieties = new Set(harvests.map(h => h.plantId || h.plant)).size;

    document.getElementById('harvest-total-count').textContent = totalCount;
    document.getElementById('harvest-total-weight').textContent = totalWeight.toFixed(1) + ' lbs';
    document.getElementById('harvest-total-donated').textContent = donatedWeight.toFixed(1) + ' lbs';
    document.getElementById('harvest-total-varieties').textContent = varieties;

    // Entries
    const container = document.getElementById('harvest-entries');
    if (harvests.length === 0) {
        container.innerHTML = '<div class="harvest-empty">No harvests logged yet. Start picking and logging!</div>';
        return;
    }

    container.innerHTML = harvests.map(h => {
        const plant = PLANT_LIBRARY.find(p => p.id === (h.plantId || h.plant));
        const dateStr = new Date(h.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const donatedLabels = { yes: 'DONATED', partial: 'PARTIAL', no: 'PERSONAL' };
        return `
            <div class="harvest-entry">
                <span class="harvest-emoji">${plant?.emoji || '\u{1F33F}'}</span>
                <div class="harvest-entry-info">
                    <div class="harvest-entry-title">${plant?.name || h.plantId || h.plant}</div>
                    <div class="harvest-entry-meta">${dateStr} &bull; Bed ${h.bed}</div>
                    ${h.notes ? `<div class="harvest-entry-notes">${escapeHtml(h.notes)}</div>` : ''}
                </div>
                <div class="harvest-entry-weight">${parseFloat(h.weight) > 0 ? parseFloat(h.weight).toFixed(1) + ' lbs' : '--'}</div>
                <span class="harvest-entry-donated ${h.donated}">${donatedLabels[h.donated] || 'N/A'}</span>
                <button class="harvest-entry-delete" data-harvest-id="${h.id}" title="Delete entry">\u00D7</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.harvest-entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const harvests = getHarvestData().filter(h => h.id !== parseInt(btn.dataset.harvestId));
            saveHarvestData(harvests);
            renderHarvestLog();
        });
    });

    updateHarvestInsights(harvests);
}

function updateHarvestInsights(harvests) {
    const panel = document.getElementById('harvest-insights');
    if (!panel) return;
    if (!harvests || harvests.length < 2) {
        panel.hidden = true;
        return;
    }
    panel.hidden = false;

    // Top producer by weight (handle both plantId and plant field names)
    const byPlant = {};
    harvests.forEach(h => {
        const pid = h.plantId || h.plant;
        byPlant[pid] = (byPlant[pid] || 0) + (parseFloat(h.weight) || 0);
    });
    const topPlantId = Object.keys(byPlant).sort((a, b) => byPlant[b] - byPlant[a])[0];
    const topPlant = PLANT_LIBRARY.find(p => p.id === topPlantId);
    document.getElementById('insight-top-plant').textContent = topPlant
        ? `${topPlant.emoji} ${topPlant.name} (${byPlant[topPlantId].toFixed(1)} lbs)`
        : '--';

    // Best bed by total harvest weight
    const byBed = {};
    harvests.forEach(h => {
        const key = h.bed !== undefined ? h.bed : 0;
        byBed[key] = (byBed[key] || 0) + (parseFloat(h.weight) || 0);
    });
    const bestBedIdx = Object.keys(byBed).sort((a, b) => byBed[b] - byBed[a])[0];
    const bedName = typeof bedNames !== 'undefined' && bedNames[bestBedIdx] ? bedNames[bestBedIdx] : `Bed ${parseInt(bestBedIdx) + 1}`;
    document.getElementById('insight-best-bed').textContent = `${bedName} (${byBed[bestBedIdx].toFixed(1)} lbs)`;

    // Average days between harvests
    const dates = harvests.map(h => new Date(h.date + 'T12:00:00')).sort((a, b) => a - b);
    if (dates.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < dates.length; i++) {
            totalGap += (dates[i] - dates[i - 1]) / 86400000;
        }
        const avgGap = Math.round(totalGap / (dates.length - 1));
        document.getElementById('insight-avg-gap').textContent = `${avgGap} days`;
    } else {
        document.getElementById('insight-avg-gap').textContent = '--';
    }

    // Donation rate
    const totalWeight = harvests.reduce((s, h) => s + (parseFloat(h.weight) || 0), 0);
    const donatedWeight = harvests
        .filter(h => h.donated === 'yes').reduce((s, h) => s + (parseFloat(h.weight) || 0), 0)
        + harvests.filter(h => h.donated === 'partial').reduce((s, h) => s + (parseFloat(h.weight) || 0) * 0.5, 0);
    const rate = totalWeight > 0 ? Math.round((donatedWeight / totalWeight) * 100) : 0;
    document.getElementById('insight-donation-rate').textContent = `${rate}%`;
}

// ---- PLANTING LOG ----
