/* GardenSync — Export (PNG, Print) */

function exportPNG() {
    // Calculate bounding box of all containers using canvas positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.containers.forEach(container => {
        const dims = getContainerPixelDims(container);
        const needsBoost = dims.width < 100 || dims.height < 100;
        const bf = needsBoost ? 2 : 1;
        const w = Math.max(70, dims.width * bf);
        const h = Math.max(70, dims.height * bf);
        const cx = container.canvasX || 0;
        const cy = container.canvasY || 0;
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx + w);
        maxY = Math.max(maxY, cy + h);
    });

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 400; maxY = 300; }
    const pad = 30;
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2 + 20; // extra for title

    // Create a temp canvas
    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // 2x for retina
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // Draw dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw each container using canvasX/canvasY
    state.containers.forEach(container => {
        const dims = getContainerPixelDims(container);
        const needsBoost = dims.width < 100 || dims.height < 100;
        const bf = needsBoost ? 2 : 1;
        const w = Math.max(70, dims.width * bf);
        const h = Math.max(70, dims.height * bf);
        const x = (container.canvasX || 0) - minX + pad;
        const y = (container.canvasY || 0) - minY + pad;

        // Container background
        const cType = CONTAINER_TYPES[container.type] || CONTAINER_TYPES['raised-bed'];
        ctx.fillStyle = cType.soilColor || '#1a1208';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = cType.borderColor || '#3d2b0f';
        ctx.lineWidth = cType.borderWidth || 2;
        ctx.strokeRect(x, y, w, h);

        // Container label
        ctx.fillStyle = '#5c4a2a';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(container.name, x + 6, y + 14);

        // Plants
        container.plants.forEach(placement => {
            const plant = PLANT_LIBRARY.find(p => p.id === placement.plantId);
            if (!plant) return;
            ctx.font = '20px serif';
            ctx.fillText(plant.emoji, x + placement.x + 6, y + placement.y + 26);
        });
    });

    // Title
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('GARDENSYNC // CANTON, OHIO', 10, height - 10);

    // Download
    const link = document.createElement('a');
    link.download = `gardensync-layout-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Garden layout exported as PNG!');
}

// ---- PRINT BED MAP ----
function printBedMap() {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    // Build plant legend (all unique plants across all containers)
    const allPlantIds = new Set();
    state.containers.forEach(c => c.plants.forEach(p => allPlantIds.add(p.plantId)));
    const legendPlants = [...allPlantIds].map(id => PLANT_LIBRARY.find(p => p.id === id)).filter(Boolean);

    // Build container HTML
    let bedsHTML = '';
    state.containers.forEach(container => {
        if (container.plants.length === 0) return;
        const plantCounts = {};
        container.plants.forEach(p => {
            plantCounts[p.plantId] = (plantCounts[p.plantId] || 0) + 1;
        });
        const plantList = Object.entries(plantCounts).map(([id, count]) => {
            const plant = PLANT_LIBRARY.find(p => p.id === id);
            return plant ? `${plant.emoji} ${plant.name} x${count}` : `${id} x${count}`;
        }).join(', ');

        const cType = CONTAINER_TYPES[container.type] || CONTAINER_TYPES['raised-bed'];
        const dimStr = cType.shape === 'circle'
            ? `${container.diameter || cType.defaultDiameter}' dia`
            : `${container.w || cType.defaultW}' x ${container.h || cType.defaultH}'`;

        // Build an SVG bed representation
        const svgW = 300, svgH = 166;
        let plantDots = '';
        container.plants.forEach(p => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            const px = (p.x / 400) * svgW;
            const py = (p.y / 220) * svgH;
            plantDots += `<text x="${px + 12}" y="${py + 14}" font-size="14" text-anchor="middle">${plant?.emoji || '?'}</text>`;
        });

        bedsHTML += `
            <div class="print-bed">
                <h3>${container.name} <span class="bed-dim">(${dimStr})</span></h3>
                <svg viewBox="0 0 ${svgW} ${svgH}" class="bed-svg">
                    <rect x="0" y="0" width="${svgW}" height="${svgH}" fill="#f5f0e8" stroke="#333" stroke-width="2" rx="4"/>
                    ${plantDots}
                </svg>
                <p class="bed-contents">${plantList}</p>
            </div>
        `;
    });

    // Legend
    let legendHTML = legendPlants.map(p =>
        `<span class="legend-item">${p.emoji} ${p.name} <small>(${p.spacing}" spacing, ${p.daysToHarvest}d)</small></span>`
    ).join('');

    const printHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>GardenSync Bed Map</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 0.5in; color: #111; background: #fff; }
    h1 { font-size: 18pt; margin-bottom: 2px; }
    .subtitle { font-size: 9pt; color: #666; margin-bottom: 16px; }
    .beds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .print-bed h3 { font-size: 11pt; margin-bottom: 4px; }
    .bed-dim { font-weight: normal; color: #666; font-size: 9pt; }
    .bed-svg { width: 100%; border: 1px solid #ccc; }
    .bed-contents { font-size: 8pt; color: #444; margin-top: 4px; line-height: 1.4; }
    .legend { border-top: 1px solid #ccc; padding-top: 10px; }
    .legend h3 { font-size: 10pt; margin-bottom: 6px; }
    .legend-grid { display: flex; flex-wrap: wrap; gap: 4px 16px; }
    .legend-item { font-size: 8pt; white-space: nowrap; }
    .legend-item small { color: #888; }
    .footer { margin-top: 16px; font-size: 7pt; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
    @media print {
        body { padding: 0.25in; }
        @page { size: landscape; margin: 0.25in; }
    }
</style>
</head><body>
    <h1>GardenSync // Canton, Ohio</h1>
    <div class="subtitle">Garden Bed Map &mdash; ${today} &mdash; Zone 6a</div>
    <div class="beds-grid">${bedsHTML}</div>
    <div class="legend">
        <h3>PLANT KEY</h3>
        <div class="legend-grid">${legendHTML}</div>
    </div>
    <div class="footer">GardenSync &mdash; No Copyright, No Gods, No Masters &mdash; Share Freely</div>
    <script>window.onload = function() { window.print(); }</script>
</body></html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) {
        showToast('Popup blocked! Please allow popups for this site.');
        return;
    }
    printWin.document.write(printHTML);
    printWin.document.close();
    showToast('Print map opened in new window!');
}

// ---- GROW SCHEDULE ----
