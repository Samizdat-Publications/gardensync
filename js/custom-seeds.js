/* GardenSync — Custom Seeds & Seed Packet OCR */

function getCustomPlants() {
    try { return JSON.parse(localStorage.getItem('gardenSyncCustomPlants') || '[]'); }
    catch { return []; }
}

function saveCustomPlants(plants) {
    localStorage.setItem('gardenSyncCustomPlants', JSON.stringify(plants));
}

function mergeCustomPlantsIntoLibrary() {
    // Remove previously merged custom plants
    PLANT_LIBRARY = PLANT_LIBRARY.filter(p => !p.isCustom);
    const custom = getCustomPlants();
    custom.forEach(cp => {
        PLANT_LIBRARY.push({
            id: cp.id,
            name: cp.name,
            emoji: cp.emoji || '\u{1F331}',
            type: cp.type || 'vegetable',
            spacing: cp.spacing || 12,
            daysToHarvest: cp.daysToHarvest || 60,
            waterNeed: cp.waterNeed || 'medium',
            sunNeed: cp.sunNeed || 'full',
            sowIndoors: null,
            transplantAfterFrost: 2,
            directSow: 0,
            harvestWeeks: cp.harvestWeeks || 8,
            companions: [],
            enemies: [],
            notes: cp.notes || '',
            seedStartInstructions: cp.seedStartInstructions || '',
            careNotes: cp.careNotes || '',
            lowMaintenance: false,
            isCustom: true,
            plantingDepth: cp.plantingDepth || ''
        });
    });
}

function openCustomSeedModal(editId) {
    const modal = document.getElementById('custom-seed-modal');
    modal.classList.remove('hidden');
    // Reset form
    ['cs-name', 'cs-emoji', 'cs-spacing', 'cs-days', 'cs-depth',
     'cs-harvest-weeks', 'cs-seed-instructions', 'cs-care-notes', 'cs-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('cs-type').value = 'vegetable';
    document.getElementById('cs-sun').value = 'full';
    document.getElementById('cs-water').value = 'medium';
    document.getElementById('cs-emoji').value = '\u{1F331}';
    document.getElementById('cs-edit-id').textContent = '';

    // Reset photo state
    const preview = document.getElementById('photo-preview');
    preview.classList.add('hidden');
    document.querySelector('.upload-prompt').classList.remove('hidden');
    document.getElementById('btn-extract-ocr').disabled = true;
    document.getElementById('ocr-status').classList.add('hidden');
    document.getElementById('ocr-raw').classList.add('hidden');

    // Switch to manual tab
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.modal-tab[data-tab="manual"]').classList.add('active');
    document.getElementById('tab-manual').hidden = false;
    document.getElementById('tab-photo').hidden = true;

    // If editing, populate fields
    if (editId) {
        const custom = getCustomPlants();
        const plant = custom.find(p => p.id === editId);
        if (plant) {
            document.getElementById('cs-name').value = plant.name || '';
            document.getElementById('cs-emoji').value = plant.emoji || '\u{1F331}';
            document.getElementById('cs-type').value = plant.type || 'vegetable';
            document.getElementById('cs-spacing').value = plant.spacing || '';
            document.getElementById('cs-days').value = plant.daysToHarvest || '';
            document.getElementById('cs-sun').value = plant.sunNeed || 'full';
            document.getElementById('cs-water').value = plant.waterNeed || 'medium';
            document.getElementById('cs-depth').value = plant.plantingDepth || '';
            document.getElementById('cs-harvest-weeks').value = plant.harvestWeeks || '';
            document.getElementById('cs-seed-instructions').value = plant.seedStartInstructions || '';
            document.getElementById('cs-care-notes').value = plant.careNotes || '';
            document.getElementById('cs-notes').value = plant.notes || '';
            document.getElementById('cs-edit-id').textContent = editId;
            document.querySelector('.modal-title').textContent = '\u{1F331} EDIT CUSTOM SEED';
        }
    } else {
        document.querySelector('.modal-title').textContent = '\u{1F331} ADD CUSTOM SEED';
    }
}

function closeCustomSeedModal() {
    document.getElementById('custom-seed-modal').classList.add('hidden');
}

function saveCustomSeed() {
    const name = document.getElementById('cs-name').value.trim();
    const spacing = parseInt(document.getElementById('cs-spacing').value);
    const days = parseInt(document.getElementById('cs-days').value);

    if (!name) { showToast('Plant name is required'); return; }
    if (!spacing || spacing < 1) { showToast('Valid spacing is required'); return; }
    if (!days || days < 1) { showToast('Valid days to harvest is required'); return; }

    const editId = document.getElementById('cs-edit-id').textContent;
    const custom = getCustomPlants();

    const plantData = {
        id: editId || ('custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()),
        name,
        emoji: document.getElementById('cs-emoji').value || '\u{1F331}',
        type: document.getElementById('cs-type').value,
        spacing,
        daysToHarvest: days,
        sunNeed: document.getElementById('cs-sun').value,
        waterNeed: document.getElementById('cs-water').value,
        plantingDepth: document.getElementById('cs-depth').value.trim(),
        harvestWeeks: parseInt(document.getElementById('cs-harvest-weeks').value) || 8,
        seedStartInstructions: document.getElementById('cs-seed-instructions').value.trim(),
        careNotes: document.getElementById('cs-care-notes').value.trim(),
        notes: document.getElementById('cs-notes').value.trim(),
        isCustom: true
    };

    if (editId) {
        const idx = custom.findIndex(p => p.id === editId);
        if (idx !== -1) custom[idx] = plantData;
        else custom.push(plantData);
    } else {
        custom.push(plantData);
    }

    saveCustomPlants(custom);
    mergeCustomPlantsIntoLibrary();
    refreshPlantList();
    closeCustomSeedModal();
    showToast(`${editId ? 'Updated' : 'Added'} custom seed: ${name}`);
}

function deleteCustomSeed(plantId) {
    const custom = getCustomPlants();
    const plant = custom.find(p => p.id === plantId);
    if (!plant) return;
    showConfirm('DELETE CUSTOM SEED', `Remove "${plant.name}" from your custom seeds? Plants already placed in beds will remain but show as unknown.`, () => {
        const updated = custom.filter(p => p.id !== plantId);
        saveCustomPlants(updated);
        mergeCustomPlantsIntoLibrary();
        refreshPlantList();
        showToast(`Deleted custom seed: ${plant.name}`);
    });
}

/* ---- AI Vision Seed Packet Extraction (replaces Tesseract OCR) ---- */

function resizeImageForAPI(dataUrl, maxDim = 1568) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width <= maxDim && height <= maxDim) {
                resolve(dataUrl);
                return;
            }
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = dataUrl;
    });
}

const SEED_PACKET_PROMPT = `You are reading a seed packet photo. Extract every planting detail you can find and return a JSON object with these fields:
{
  "name": "Plant variety name (e.g. 'Cherokee Purple Tomato')",
  "emoji": "Best matching single emoji for this plant",
  "type": "One of: vegetable, herb, flower, fruit",
  "spacing": plant spacing in inches as a number,
  "daysToHarvest": days to maturity/harvest as a number (midpoint if range given),
  "sunNeed": "One of: full, partial, shade",
  "waterNeed": "One of: low, medium, high",
  "plantingDepth": "Planting depth string like 1/4 inch or 1/2 inch",
  "harvestWeeks": estimated harvest window in weeks as a number,
  "seedStartInstructions": "All seed starting and planting instructions from the packet",
  "careNotes": "Care, maintenance, and growing tips from the packet",
  "notes": "Brand, UPC, special traits, companion planting hints, or any other info"
}
Return ONLY valid JSON — no markdown, no code fences, no extra text. Use null for any field you cannot determine from the image. For spacing, prefer plant spacing over row spacing. Use your horticultural knowledge to fill in sunNeed and waterNeed if not explicit on the packet.`;

async function runOCR(imageDataUrl) {
    const statusEl = document.getElementById('ocr-status');
    const progressEl = document.getElementById('ocr-progress');
    const statusText = document.getElementById('ocr-status-text');
    const rawEl = document.getElementById('ocr-raw');
    const rawText = document.getElementById('ocr-raw-text');
    const extractBtn = document.getElementById('btn-extract-ocr');

    statusEl.classList.remove('hidden');
    extractBtn.disabled = true;
    progressEl.style.width = '20%';
    statusText.textContent = 'Preparing image...';

    // Get Claude API key (shared with Garden Buddy)
    const apiKey = localStorage.getItem('gardensync_claude_key') || '';
    if (!apiKey) {
        statusText.textContent = 'No API key — save your Claude key in Garden Buddy first.';
        progressEl.style.width = '0%';
        extractBtn.disabled = false;
        return;
    }

    try {
        // Resize to keep API payload reasonable
        const resizedUrl = await resizeImageForAPI(imageDataUrl);

        const match = resizedUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (!match) {
            statusText.textContent = 'Invalid image data. Try uploading again.';
            extractBtn.disabled = false;
            return;
        }
        const mediaType = match[1];
        const base64Data = match[2];

        progressEl.style.width = '40%';
        statusText.textContent = 'Reading seed packet with AI...';

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: mediaType, data: base64Data }
                        },
                        { type: 'text', text: SEED_PACKET_PROMPT }
                    ]
                }]
            })
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData?.error?.message || `API error ${resp.status}`);
        }

        progressEl.style.width = '85%';
        statusText.textContent = 'Processing results...';

        const result = await resp.json();
        const content = result.content?.[0]?.text || '';

        // Parse structured JSON from Claude
        let parsed;
        try {
            const jsonStr = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
            parsed = JSON.parse(jsonStr);
        } catch {
            // If JSON parsing fails, show raw and let user use manual entry
            rawText.value = content;
            rawEl.classList.remove('hidden');
            statusText.textContent = 'Could not parse response — use "USE & EDIT BELOW" to enter manually.';
            extractBtn.disabled = false;
            return;
        }

        // Show human-readable summary in the text area
        rawText.value = formatExtractionSummary(parsed);
        rawEl.classList.remove('hidden');

        progressEl.style.width = '100%';
        statusText.textContent = 'Extraction complete!';
        extractBtn.disabled = false;

        // Store parsed data for "USE & EDIT BELOW" button
        rawText.dataset.parsedJson = JSON.stringify(parsed);

        applyParsedToForm(parsed);
    } catch (err) {
        statusText.textContent = 'Extraction failed: ' + err.message;
        progressEl.style.width = '0%';
        extractBtn.disabled = false;
        console.error('[GardenSync] AI extraction error:', err);
    }
}

function formatExtractionSummary(p) {
    const lines = [];
    if (p.name) lines.push(`✓ ${p.name}${p.emoji ? ' ' + p.emoji : ''}`);
    const meta = [];
    if (p.type) meta.push(`Type: ${p.type}`);
    if (p.spacing) meta.push(`Spacing: ${p.spacing}"`);
    if (p.daysToHarvest) meta.push(`Days: ${p.daysToHarvest}`);
    if (meta.length) lines.push(meta.join(' · '));
    const env = [];
    if (p.sunNeed) env.push(`Sun: ${p.sunNeed}`);
    if (p.waterNeed) env.push(`Water: ${p.waterNeed}`);
    if (p.plantingDepth) env.push(`Depth: ${p.plantingDepth}`);
    if (p.harvestWeeks) env.push(`Harvest: ${p.harvestWeeks} wks`);
    if (env.length) lines.push(env.join(' · '));
    if (p.seedStartInstructions) lines.push('\nInstructions: ' + p.seedStartInstructions);
    if (p.careNotes) lines.push('\nCare: ' + p.careNotes);
    if (p.notes) lines.push('\nNotes: ' + p.notes);
    return lines.join('\n');
}

function applyParsedToForm(parsed) {
    if (parsed.name) document.getElementById('cs-name').value = parsed.name;
    if (parsed.emoji) document.getElementById('cs-emoji').value = parsed.emoji;
    if (parsed.type) document.getElementById('cs-type').value = parsed.type;
    if (parsed.daysToHarvest) document.getElementById('cs-days').value = parsed.daysToHarvest;
    if (parsed.spacing) document.getElementById('cs-spacing').value = parsed.spacing;
    if (parsed.plantingDepth) document.getElementById('cs-depth').value = parsed.plantingDepth;
    if (parsed.sunNeed) document.getElementById('cs-sun').value = parsed.sunNeed;
    if (parsed.waterNeed) document.getElementById('cs-water').value = parsed.waterNeed;
    if (parsed.harvestWeeks) document.getElementById('cs-harvest-weeks').value = parsed.harvestWeeks;
    if (parsed.seedStartInstructions) document.getElementById('cs-seed-instructions').value = parsed.seedStartInstructions;
    if (parsed.careNotes) document.getElementById('cs-care-notes').value = parsed.careNotes;
    if (parsed.notes) document.getElementById('cs-notes').value = parsed.notes;

    // Switch to manual tab to show filled fields
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.modal-tab[data-tab="manual"]').classList.add('active');
    document.getElementById('tab-manual').hidden = false;
    document.getElementById('tab-photo').hidden = true;
    showToast('Seed packet analyzed — review and save!');
}

function initCustomSeeds() {
    // Merge stored custom plants into PLANT_LIBRARY
    mergeCustomPlantsIntoLibrary();

    // + CUSTOM button: first click filters to custom, second click (already active) opens add modal
    const addBtn = document.getElementById('btn-add-custom-seed');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (addBtn.classList.contains('active')) {
                openCustomSeedModal();
            }
            // Filter toggling is handled by initPlantPalette's filter-btn listener
        });
    }

    // Modal close / cancel
    document.getElementById('custom-seed-close')?.addEventListener('click', closeCustomSeedModal);
    document.getElementById('btn-cs-cancel')?.addEventListener('click', closeCustomSeedModal);
    document.getElementById('custom-seed-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'custom-seed-modal') closeCustomSeedModal();
    });

    // Save
    document.getElementById('btn-cs-save')?.addEventListener('click', saveCustomSeed);

    // Tab switching
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            document.getElementById('tab-manual').hidden = target !== 'manual';
            document.getElementById('tab-photo').hidden = target !== 'photo';
        });
    });

    // Photo upload
    const photoInput = document.getElementById('seed-photo-input');
    const dropZone = document.getElementById('photo-drop-zone');
    const chooseBtn = document.getElementById('btn-choose-photo');

    chooseBtn?.addEventListener('click', () => photoInput.click());

    photoInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleSeedPhoto(e.target.files[0]);
    });

    dropZone?.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length > 0) handleSeedPhoto(e.dataTransfer.files[0]);
    });

    document.getElementById('btn-clear-photo')?.addEventListener('click', () => {
        document.getElementById('photo-preview').classList.add('hidden');
        document.querySelector('.upload-prompt').classList.remove('hidden');
        document.getElementById('btn-extract-ocr').disabled = true;
        document.getElementById('ocr-status').classList.add('hidden');
        document.getElementById('ocr-raw').classList.add('hidden');
    });

    // Extract OCR
    document.getElementById('btn-extract-ocr')?.addEventListener('click', () => {
        const img = document.getElementById('photo-preview-img');
        if (img.src) runOCR(img.src);
    });

    // Use extracted text button — re-applies parsed data to form
    document.getElementById('btn-use-extracted')?.addEventListener('click', () => {
        const rawEl = document.getElementById('ocr-raw-text');
        // Try stored JSON first (from AI extraction)
        if (rawEl.dataset.parsedJson) {
            try {
                const parsed = JSON.parse(rawEl.dataset.parsedJson);
                applyParsedToForm(parsed);
                return;
            } catch { /* fall through */ }
        }
        // Fallback: show toast directing to manual entry
        showToast('Switch to Manual Entry tab to fill in fields');
    });

}

function handleSeedPhoto(file) {
    if (!file.type.startsWith('image/')) { showToast('Please upload an image file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('photo-preview');
        const img = document.getElementById('photo-preview-img');
        img.src = e.target.result;
        preview.classList.remove('hidden');
        document.querySelector('.upload-prompt').classList.add('hidden');
        document.getElementById('btn-extract-ocr').disabled = false;
    };
    reader.readAsDataURL(file);
}

