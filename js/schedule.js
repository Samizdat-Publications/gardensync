/* GardenSync — Grow Schedule & Task Tracker */

function updateSchedule() {
    const allPlants = [];
    state.containers.forEach((container, idx) => {
        const unique = [...new Set(container.plants.map(p => p.plantId))];
        unique.forEach(pid => {
            if (!allPlants.find(ap => ap.plantId === pid)) {
                allPlants.push({ plantId: pid, beds: [idx], containerNames: [container.name] });
            } else {
                const existing = allPlants.find(ap => ap.plantId === pid);
                if (!existing.beds.includes(idx)) {
                    existing.beds.push(idx);
                    existing.containerNames.push(container.name);
                }
            }
        });
    });

    const emptyEl = document.getElementById('schedule-empty');
    const contentEl = document.getElementById('schedule-content');

    if (allPlants.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
    }
    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    buildTimeline(allPlants);
    buildTaskTracker(allPlants);
    buildInstructions(allPlants);
}

function getPlantDates(plant) {
    // Last frost: April 18 (month index 3, day 18)
    const lastFrostDate = new Date(new Date().getFullYear(), 3, 18);
    const dates = {};

    if (plant.sowIndoors !== null && plant.sowIndoors !== undefined) {
        const startD = new Date(lastFrostDate);
        startD.setDate(startD.getDate() + plant.sowIndoors * 7);
        const endD = new Date(startD);
        endD.setDate(endD.getDate() + 14); // 2-week window
        dates.seedIndoor = { start: startD, end: endD };
    }
    if (plant.transplantAfterFrost !== null && plant.transplantAfterFrost !== undefined) {
        const startD = new Date(lastFrostDate);
        startD.setDate(startD.getDate() + plant.transplantAfterFrost * 7);
        const endD = new Date(startD);
        endD.setDate(endD.getDate() + 14);
        dates.transplant = { start: startD, end: endD };
    }
    if (plant.directSow !== null && plant.directSow !== undefined) {
        const startD = new Date(lastFrostDate);
        startD.setDate(startD.getDate() + plant.directSow * 7);
        const endD = new Date(startD);
        endD.setDate(endD.getDate() + 21); // 3-week window for direct sow
        dates.directSow = { start: startD, end: endD };
    }
    // Harvest dates
    const growStart = dates.transplant?.start || dates.directSow?.start || dates.seedIndoor?.start;
    if (growStart) {
        const harvestStart = new Date(growStart);
        harvestStart.setDate(harvestStart.getDate() + plant.daysToHarvest);
        const harvestEnd = new Date(harvestStart);
        harvestEnd.setDate(harvestEnd.getDate() + (plant.harvestWeeks || 4) * 7);
        dates.harvestStart = { start: harvestStart, end: harvestEnd };
    }

    return dates;
}

function formatDateRange(range) {
    if (!range) return '';
    const opts = { month: 'short', day: 'numeric' };
    return `${range.start.toLocaleDateString('en-US', opts)} \u2013 ${range.end.toLocaleDateString('en-US', opts)}`;
}

function formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildTimeline(allPlants) {
    const container = document.getElementById('schedule-timeline');
    let html = `<div class="timeline-legend">
        <div class="legend-item"><div class="legend-swatch" style="background:#7c3aed"></div>START INDOORS</div>
        <div class="legend-item"><div class="legend-swatch" style="background:#059669"></div>TRANSPLANT</div>
        <div class="legend-item"><div class="legend-swatch" style="background:#0d9488"></div>DIRECT SOW</div>
        <div class="legend-item"><div class="legend-swatch" style="background:#92400e"></div>HARVEST</div>
    </div>`;

    const months = [0,1,2,3,4,5,6,7,8,9,10,11];
    months.forEach(m => {
        let bars = '';
        allPlants.forEach(ap => {
            const plant = PLANT_LIBRARY.find(p => p.id === ap.plantId);
            if (!plant) return;
            const dates = getPlantDates(plant);

            if (dates.seedIndoor && dates.seedIndoor.start.getMonth() === m) {
                bars += `<div class="timeline-plant-bar seed-indoor">${plant.emoji} ${plant.name} \u2014 start indoors (${formatDateRange(dates.seedIndoor)})</div>`;
            }
            if (dates.transplant && dates.transplant.start.getMonth() === m) {
                bars += `<div class="timeline-plant-bar transplant">${plant.emoji} ${plant.name} \u2014 transplant (${formatDateRange(dates.transplant)})</div>`;
            }
            if (dates.directSow && dates.directSow.start.getMonth() === m) {
                bars += `<div class="timeline-plant-bar direct-sow">${plant.emoji} ${plant.name} \u2014 direct sow (${formatDateRange(dates.directSow)})</div>`;
            }
            if (dates.harvestStart) {
                const harvestStartMonth = dates.harvestStart.start.getMonth();
                const harvestEndMonth = dates.harvestStart.end.getMonth();
                if (m >= harvestStartMonth && m <= harvestEndMonth && m === harvestStartMonth) {
                    bars += `<div class="timeline-plant-bar harvest">${plant.emoji} ${plant.name} \u2014 harvest (${formatDateRange(dates.harvestStart)})</div>`;
                }
            }
        });

        if (bars) {
            html += `<div class="timeline-month-row">
                <div class="timeline-month-label">${MONTH_NAMES[m]}</div>
                <div class="timeline-bar-area">${bars}</div>
            </div>`;
        }
    });

    container.innerHTML = html;
}

function buildInstructions(allPlants) {
    const container = document.getElementById('schedule-instructions');
    container.innerHTML = '<h3 class="subsection-title" style="font-size:1rem;margin-top:0;">DETAILED GROWING REFERENCE</h3>';

    const monthActions = {};
    allPlants.forEach(ap => {
        const plant = PLANT_LIBRARY.find(p => p.id === ap.plantId);
        if (!plant) return;
        const dates = getPlantDates(plant);

        function addAction(dateRange, action, detail) {
            if (!dateRange) return;
            const key = dateRange.start.getMonth();
            if (!monthActions[key]) monthActions[key] = [];
            monthActions[key].push({ plant, dateRange, action, detail });
        }

        addAction(dates.seedIndoor, 'START INDOORS', plant.seedStartInstructions);
        addAction(dates.transplant, 'TRANSPLANT', `Transplant ${plant.name} outdoors. ${plant.careNotes}`);
        addAction(dates.directSow, 'DIRECT SOW', plant.seedStartInstructions);
        addAction(dates.harvestStart, 'BEGIN HARVEST', `${plant.name} should be ready to harvest! ${plant.careNotes}`);
    });

    const sortedMonths = Object.keys(monthActions).sort((a,b) => a - b);
    sortedMonths.forEach(m => {
        const actions = monthActions[m];
        let stepsHtml = actions.map(a =>
            `<li><strong>${a.plant.emoji} ${a.plant.name} \u2014 ${a.action} (${formatDateRange(a.dateRange)}):</strong> ${a.detail}</li>`
        ).join('');

        container.innerHTML += `
            <div class="instruction-card">
                <h4><span class="month-tag">${MONTH_FULL[m].toUpperCase()}</span> ${MONTH_FULL[m]} Tasks</h4>
                <ul class="instruction-steps">${stepsHtml}</ul>
            </div>
        `;
    });
}

// ---- TASK TRACKER SYSTEM ----
function buildTaskTracker(allPlants) {
    const container = document.getElementById('schedule-tasks');
    if (!container) return;

    // Load completed tasks from localStorage
    const completedTasks = JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}');

    // Generate all tasks with specific dates
    const allTasks = [];
    allPlants.forEach(ap => {
        const plant = PLANT_LIBRARY.find(p => p.id === ap.plantId);
        if (!plant) return;
        const dates = getPlantDates(plant);
        const beds = (ap.containerNames || ap.beds.map(b => `Bed ${b + 1}`)).join(', ');

        if (dates.seedIndoor) {
            allTasks.push({
                id: `${plant.id}-seed-indoor`,
                month: dates.seedIndoor.start.getMonth(),
                sortDate: dates.seedIndoor.start,
                type: 'seed-indoor',
                typeLabel: 'START INDOORS',
                title: `${plant.emoji} Start ${plant.name} seeds indoors`,
                dateStr: `${formatDate(dates.seedIndoor.start)} \u2013 ${formatDate(dates.seedIndoor.end)}`,
                detail: plant.seedStartInstructions,
                beds
            });
        }
        if (dates.transplant) {
            allTasks.push({
                id: `${plant.id}-transplant`,
                month: dates.transplant.start.getMonth(),
                sortDate: dates.transplant.start,
                type: 'transplant',
                typeLabel: 'TRANSPLANT',
                title: `${plant.emoji} Transplant ${plant.name} outdoors (${beds})`,
                dateStr: `${formatDate(dates.transplant.start)} \u2013 ${formatDate(dates.transplant.end)}`,
                detail: `Move hardened-off ${plant.name} transplants to ${beds}. ${plant.careNotes}`,
                beds
            });
        }
        if (dates.directSow) {
            allTasks.push({
                id: `${plant.id}-direct-sow`,
                month: dates.directSow.start.getMonth(),
                sortDate: dates.directSow.start,
                type: 'direct-sow',
                typeLabel: 'DIRECT SOW',
                title: `${plant.emoji} Direct sow ${plant.name} in ${beds}`,
                dateStr: `${formatDate(dates.directSow.start)} \u2013 ${formatDate(dates.directSow.end)}`,
                detail: plant.seedStartInstructions,
                beds
            });
        }
        if (dates.harvestStart) {
            allTasks.push({
                id: `${plant.id}-harvest`,
                month: dates.harvestStart.start.getMonth(),
                sortDate: dates.harvestStart.start,
                type: 'harvest',
                typeLabel: 'HARVEST',
                title: `${plant.emoji} Begin harvesting ${plant.name} from ${beds}`,
                dateStr: `${formatDate(dates.harvestStart.start)} \u2013 ${formatDate(dates.harvestStart.end)}`,
                detail: plant.careNotes,
                beds
            });
        }
    });

    // Sort by date
    allTasks.sort((a, b) => a.sortDate - b.sortDate);

    // Group by month
    const byMonth = {};
    allTasks.forEach(t => {
        if (!byMonth[t.month]) byMonth[t.month] = [];
        byMonth[t.month].push(t);
    });

    container.innerHTML = '';
    const sortedMonths = Object.keys(byMonth).sort((a, b) => a - b);

    sortedMonths.forEach(m => {
        const tasks = byMonth[m];
        const completedCount = tasks.filter(t => completedTasks[t.id]).length;
        const totalCount = tasks.length;
        const allDone = completedCount === totalCount;
        const now = new Date();
        const isCurrentMonth = now.getMonth() === parseInt(m);
        const isPast = now.getMonth() > parseInt(m);

        const group = document.createElement('div');
        group.className = 'task-month-group';
        if (allDone) group.style.borderLeftColor = '#525252';

        group.innerHTML = `
            <div class="task-month-header">
                <span class="task-month-name">${allDone ? '\u2705 ' : isCurrentMonth ? '\u{1F449} ' : ''}${MONTH_FULL[m].toUpperCase()}</span>
                <span class="task-month-progress"><span class="done-count">${completedCount}</span>/${totalCount} complete</span>
            </div>
            <div class="task-month-body ${isPast && allDone ? 'collapsed' : ''}">
                ${tasks.map(t => {
                    const done = completedTasks[t.id] || false;
                    return `
                        <div class="sched-task-item" data-task-id="${t.id}">
                            <div class="sched-task-check ${done ? 'done' : ''}" data-task-id="${t.id}">${done ? '\u2714' : ''}</div>
                            <div class="sched-task-content">
                                <div class="sched-task-title ${done ? 'done' : ''}">${t.title}</div>
                                <div class="sched-task-date">${t.dateStr}</div>
                                <div class="sched-task-detail ${done ? 'done' : ''}">${t.detail}</div>
                            </div>
                            <span class="sched-task-type ${t.type}">${t.typeLabel}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Toggle month collapse
        group.querySelector('.task-month-header').addEventListener('click', () => {
            group.querySelector('.task-month-body').classList.toggle('collapsed');
        });

        // Task checkoff
        group.querySelectorAll('.sched-task-check').forEach(chk => {
            chk.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = chk.dataset.taskId;
                completedTasks[taskId] = !completedTasks[taskId];
                localStorage.setItem('gardensync_completed_tasks', JSON.stringify(completedTasks));
                // Re-render
                buildTaskTracker(allPlants);
            });
        });

        container.appendChild(group);
    });
}

// ---- VOLUNTEERS ----
