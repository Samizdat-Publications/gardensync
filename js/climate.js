/* GardenSync — Climate Charts & Rainfall Deficit Calculator */

function initClimateCharts() {
    drawRainfallChart();
    drawTempChart();
}

function drawRainfallChart() {
    const canvas = document.getElementById('rainfall-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const data = Object.values(CANTON_CLIMATE.monthlyRainfall);
    const maxVal = 6;
    const barW = chartW / 12 - 4;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Bars
    data.forEach((val, i) => {
        const x = padding.left + (chartW / 12) * i + 2;
        const barH = (val / maxVal) * chartH;
        const y = padding.top + chartH - barH;

        const grad = ctx.createLinearGradient(x, y + barH, x, y);
        grad.addColorStop(0, '#0d9488');
        grad.addColorStop(1, '#14b8a6');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);

        // Value
        ctx.fillStyle = '#a3a3a3';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(val + '"', x + barW/2, y - 4);

        // Month label
        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.fillText(MONTH_NAMES[i], x + barW/2, h - 8);
    });

    // Y-axis
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
        const y = padding.top + chartH - (i / 6) * chartH;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(i + '"', padding.left - 4, y + 3);
    }
}

function drawTempChart() {
    const canvas = document.getElementById('temp-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const highs = Object.values(CANTON_CLIMATE.monthlyAvgHigh);
    const lows = Object.values(CANTON_CLIMATE.monthlyAvgLow);
    const maxT = 90;
    const minT = 10;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    function tempY(t) {
        return padding.top + chartH - ((t - minT) / (maxT - minT)) * chartH;
    }

    // Growing season band
    ctx.fillStyle = 'rgba(16,185,129,0.08)';
    const aprilX = padding.left + (chartW / 12) * 3;
    const octX = padding.left + (chartW / 12) * 10;
    ctx.fillRect(aprilX, padding.top, octX - aprilX, chartH);

    // Grid lines
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    for (let t = 20; t <= 80; t += 20) {
        const y = tempY(t);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(t + '\u00B0F', padding.left - 4, y + 3);
    }

    // Frost line at 32F
    ctx.strokeStyle = '#3b82f688';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, tempY(32));
    ctx.lineTo(w - padding.right, tempY(32));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3b82f6';
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('32\u00B0F FROST', padding.left + 4, tempY(32) - 4);

    // Lines
    function drawLine(data, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = padding.left + (chartW / 12) * i + (chartW / 24);
            const y = tempY(val);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        data.forEach((val, i) => {
            const x = padding.left + (chartW / 12) * i + (chartW / 24);
            const y = tempY(val);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawLine(highs, '#dc2626');
    drawLine(lows, '#3b82f6');

    // Month labels
    MONTH_NAMES.forEach((name, i) => {
        const x = padding.left + (chartW / 12) * i + (chartW / 24);
        ctx.fillStyle = '#525252';
        ctx.font = '9px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, h - 8);
    });

    // Legend
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(w - 130, 8, 10, 10);
    ctx.fillStyle = '#a3a3a3';
    ctx.font = '9px "Space Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AVG HIGH', w - 115, 17);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(w - 130, 22, 10, 10);
    ctx.fillStyle = '#a3a3a3';
    ctx.fillText('AVG LOW', w - 115, 31);
}

// ---- RAINFALL vs PLANT NEEDS DEFICIT CALCULATOR ----
function initRainfallDeficitCalc() {
    const areaEl = document.getElementById('deficit-area');
    const needEl = document.getElementById('deficit-need');
    const rainfallEl = document.getElementById('deficit-rainfall');
    const balanceEl = document.getElementById('deficit-balance');
    const barsEl = document.getElementById('deficit-month-bars');
    const verdictEl = document.getElementById('deficit-verdict');
    if (!areaEl || !verdictEl) return;

    // Water need multipliers (inches per week)
    const WATER_INCHES = { low: 0.5, medium: 1.0, high: 1.5 };
    // Growing months: Apr(3) - Oct(9)
    const GROW_MONTHS = [3, 4, 5, 6, 7, 8, 9];
    const MONTH_LABELS = ['APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT'];
    const rainfallKeys = [3, 4, 5, 6, 7, 8, 9]; // numeric month indices matching CANTON_CLIMATE

    function calcDeficit() {
        if (!state || !state.containers || state.containers.length === 0) {
            areaEl.textContent = '0 sq ft';
            needEl.textContent = '--';
            rainfallEl.textContent = '--';
            balanceEl.textContent = '--';
            if (barsEl) barsEl.innerHTML = '';
            verdictEl.innerHTML = '\u26A0\uFE0F <strong>No containers yet.</strong> Add containers and plants in the Bed Planner to see rainfall analysis.';
            verdictEl.style.borderColor = '#525252';
            return;
        }

        // Calculate total garden area (sq ft) and weighted water need
        let totalAreaSqFt = 0;
        let weightedNeedSum = 0;
        let totalPlants = 0;

        state.containers.forEach(c => {
            let areaSqFt = 0;
            if (c.diameter) {
                areaSqFt = Math.PI * Math.pow(c.diameter / 2, 2);
            } else if (c.w && c.h) {
                areaSqFt = c.w * c.h;
            }
            totalAreaSqFt += areaSqFt;

            c.plants.forEach(p => {
                const plantDef = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
                if (plantDef) {
                    const need = WATER_INCHES[plantDef.waterNeed] || 1.0;
                    weightedNeedSum += need;
                    totalPlants++;
                }
            });
        });

        const avgNeedInchPerWeek = totalPlants > 0 ? (weightedNeedSum / totalPlants) : 1.0;
        // Gallons per month: area(sqft) × inches/week × 4.3 weeks × 0.623 gal per inch per sqft
        const galPerMonth = totalAreaSqFt * avgNeedInchPerWeek * 4.3 * 0.623;

        areaEl.textContent = Math.round(totalAreaSqFt) + ' sq ft';
        needEl.textContent = `~${Math.round(galPerMonth)} gal/mo`;

        // Avg growing season rainfall
        const rainfallData = CANTON_CLIMATE.monthlyRainfall;
        const growRainfall = rainfallKeys.map(k => rainfallData[k]);
        const avgGrowRain = growRainfall.reduce((s, v) => s + v, 0) / growRainfall.length;
        const avgRainGal = Math.round(totalAreaSqFt * avgGrowRain * 0.623);
        rainfallEl.textContent = `~${avgRainGal} gal/mo`;

        // Monthly breakdown bars
        let surplusMonths = 0;
        let deficitMonths = 0;
        let totalSurplus = 0;
        let totalDeficit = 0;

        let barsHTML = '<div class="deficit-bars-row">';
        growRainfall.forEach((rain, i) => {
            const rainGal = Math.round(totalAreaSqFt * rain * 0.623);
            const needGal = Math.round(galPerMonth);
            const diff = rainGal - needGal;
            const pct = needGal > 0 ? Math.min(100, Math.round((rainGal / needGal) * 100)) : 100;
            const isDeficit = diff < 0;

            if (isDeficit) { deficitMonths++; totalDeficit += Math.abs(diff); }
            else { surplusMonths++; totalSurplus += diff; }

            const barColor = isDeficit ? '#ef4444' : '#10b981';
            const diffLabel = isDeficit ? `\u2212${Math.abs(diff)}` : `+${diff}`;

            barsHTML += `<div class="deficit-bar-col">
                <span class="deficit-bar-diff" style="color:${barColor}">${diffLabel}</span>
                <div class="deficit-bar-track">
                    <div class="deficit-bar-fill" style="height:${pct}%;background:${barColor}"></div>
                </div>
                <span class="deficit-bar-label">${MONTH_LABELS[i]}</span>
            </div>`;
        });
        barsHTML += '</div>';
        if (barsEl) barsEl.innerHTML = barsHTML;

        // Season balance
        const seasonNet = totalSurplus - totalDeficit;
        if (seasonNet >= 0) {
            balanceEl.innerHTML = `<span style="color:#10b981">+${Math.round(seasonNet)} gal</span>`;
        } else {
            balanceEl.innerHTML = `<span style="color:#ef4444">\u2212${Math.abs(Math.round(seasonNet))} gal</span>`;
        }

        // Verdict
        if (deficitMonths === 0) {
            verdictEl.innerHTML = `\u2705 <strong>All good!</strong> Canton's rainfall fully covers your garden's water needs across all ${surplusMonths} growing months. Season surplus: ~${Math.round(totalSurplus)} gal. Natural rainfall handles everything \u2014 just watch for dry spells.`;
            verdictEl.style.borderColor = '#059669';
        } else if (deficitMonths <= 2) {
            verdictEl.innerHTML = `\u26A0\uFE0F <strong>Minor shortfall.</strong> ${deficitMonths} month${deficitMonths > 1 ? 's' : ''} may need supplemental watering (~${Math.round(totalDeficit)} gal total deficit). Mulch heavily and prioritize low-water plants to minimize hand-watering.`;
            verdictEl.style.borderColor = '#f59e0b';
        } else {
            verdictEl.innerHTML = `\u{1F6B0} <strong>Plan for watering.</strong> ${deficitMonths} months show deficits totaling ~${Math.round(totalDeficit)} gal. Consider drip irrigation, heavy mulch, and grouping high-water plants together for efficient watering.`;
            verdictEl.style.borderColor = '#ef4444';
        }
    }

    calcDeficit();
    // Re-calculate when state changes (listen for custom event or poll)
    window.addEventListener('gardenStateChanged', calcDeficit);
    // Also expose for manual refresh
    window.refreshRainfallDeficit = calcDeficit;
}

// ---- VISUALIZER (Gemini Integration) ----
