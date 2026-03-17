/* GardenSync — Dashboard & Stats */

function updateStatsDashboard() {
    const allPlacements = state.containers.flatMap(c => c.plants);
    const totalPlants = allPlacements.length;
    const varieties = new Set(allPlacements.map(p => p.plantId)).size;
    const containersUsed = state.containers.filter(c => c.plants.length > 0).length;
    const totalContainers = state.containers.length;

    // Average coverage
    let totalCoverage = 0;
    state.containers.forEach(container => {
        let used = 0;
        container.plants.forEach(p => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            if (plant) used += Math.PI * Math.pow(plant.spacing / 2, 2);
        });
        const area = getContainerArea(container);
        totalCoverage += Math.min(100, Math.round((used / area) * 100));
    });
    const avgCoverage = containersUsed > 0 ? Math.round(totalCoverage / totalContainers) : 0;

    // Companion/conflict counts
    let companions = 0, conflicts = 0;
    state.containers.forEach(container => {
        const unique = [...new Set(container.plants.map(p => p.plantId))];
        for (let i = 0; i < unique.length; i++) {
            for (let j = i + 1; j < unique.length; j++) {
                const p1 = PLANT_LIBRARY.find(p => p.id === unique[i]);
                const p2 = PLANT_LIBRARY.find(p => p.id === unique[j]);
                if (p1 && p2) {
                    if (p1.companions.includes(p2.id) || p2.companions.includes(p1.id)) companions++;
                    if (p1.enemies.includes(p2.id) || p2.enemies.includes(p1.id)) conflicts++;
                }
            }
        }
    });

    // Average water need
    const waterLevels = { low: 1, medium: 2, high: 3 };
    const waterLabels = ['--', 'LOW', 'MEDIUM', 'HIGH'];
    let avgWater = 0;
    if (totalPlants > 0) {
        avgWater = allPlacements.reduce((sum, p) => {
            const plant = PLANT_LIBRARY.find(pl => pl.id === p.plantId);
            return sum + (plant ? waterLevels[plant.waterNeed] : 0);
        }, 0) / totalPlants;
    }

    // Days to first harvest
    let minDays = '--';
    if (totalPlants > 0) {
        const days = allPlacements.map(p => PLANT_LIBRARY.find(pl => pl.id === p.plantId)?.daysToHarvest).filter(Boolean);
        if (days.length > 0) minDays = Math.min(...days) + 'd';
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('stat-total-plants', totalPlants);
    el('stat-varieties', varieties);
    el('stat-beds-used', containersUsed + '/' + totalContainers);
    el('stat-avg-coverage', avgCoverage + '%');
    el('stat-companions', companions);
    el('stat-conflicts', conflicts);
    el('stat-water-avg', waterLabels[Math.round(avgWater)] || '--');
    el('stat-harvest-days', minDays);
}

// ---- TODAY'S TASKS DASHBOARD ----
function updateTodayDashboard() {
    const dashboard = document.getElementById('today-dashboard');
    const totalPlantsInBeds = state.containers.reduce((s, c) => s + c.plants.length, 0);

    // If no plants are placed, hide the entire dashboard — nothing useful to show
    if (dashboard && totalPlantsInBeds === 0) {
        dashboard.style.display = 'none';
        return;
    }
    if (dashboard) dashboard.style.display = '';

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const dateEl = document.getElementById('today-date');
    if (dateEl) dateEl.textContent = todayStr.toUpperCase();

    // Season progress
    const lastFrostDate = new Date(today.getFullYear(), 3, 18);
    const firstFrostDate = new Date(today.getFullYear(), 9, 28);
    const seasonStartDate = new Date(today.getFullYear(), 1, 15); // Feb 15  -  indoor seeds start
    const seasonEndDate = new Date(today.getFullYear(), 10, 15); // Nov 15  -  cleanup
    const seasonTotal = seasonEndDate - seasonStartDate;
    const seasonElapsed = Math.max(0, Math.min(today - seasonStartDate, seasonTotal));
    const seasonPct = Math.round((seasonElapsed / seasonTotal) * 100);
    const weekNum = Math.max(1, Math.ceil(seasonElapsed / (7 * 86400000)));
    const totalWeeks = Math.ceil(seasonTotal / (7 * 86400000));

    let seasonPhase = 'PRE-SEASON';
    if (today < seasonStartDate) seasonPhase = 'OFF-SEASON';
    else if (today < lastFrostDate) seasonPhase = 'EARLY START';
    else if (today < new Date(today.getFullYear(), 5, 15)) seasonPhase = 'PLANTING';
    else if (today < new Date(today.getFullYear(), 7, 15)) seasonPhase = 'PEAK GROWING';
    else if (today < firstFrostDate) seasonPhase = 'HARVEST TIME';
    else if (today < seasonEndDate) seasonPhase = 'LATE SEASON';
    else seasonPhase = 'OFF-SEASON';

    const progressFill = document.getElementById('season-progress-fill');
    const progressLabel = document.getElementById('season-progress-label');
    if (progressFill) progressFill.style.width = Math.min(100, seasonPct) + '%';
    if (progressLabel) progressLabel.textContent = `WK ${weekNum}/${totalWeeks} \u2014 ${seasonPhase}`;

    // Build task chips
    const tasks = [];
    // Check BOTH task-tracking stores — schedule uses gardensync_completed_tasks,
    // planting log uses gardensync_plantlog (with {done:true} objects)
    const plantlogData = JSON.parse(localStorage.getItem('gardensync_plantlog') || '{}');
    const completedTasksData = JSON.parse(localStorage.getItem('gardensync_completed_tasks') || '{}');
    const currentWeek = getWeekKey(today);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

    // Only show tasks for plants actually placed in beds
    const plantedIds = new Set(state.containers.flatMap(c => c.plants.map(p => p.plantId)));
    const plantsToCheck = PLANT_LIBRARY.filter(p => plantedIds.has(p.id));

    // Check placed plants for upcoming/overdue tasks
    plantsToCheck.forEach(plant => {
        const dates = getPlantDates(plant);

        // Seed indoor
        if (dates.seedIndoor) {
            const taskId = `${plant.id}-seed-indoor`;
            const done = plantlogData[taskId]?.done || completedTasksData[taskId];
            if (!done && dates.seedIndoor.end >= oneWeekAgo && dates.seedIndoor.start <= twoWeeksOut) {
                const overdue = today > dates.seedIndoor.end;
                tasks.push({
                    emoji: plant.emoji,
                    label: `Start ${plant.name} indoors`,
                    type: 'seed-indoor',
                    overdue,
                    date: dates.seedIndoor.start
                });
            }
        }
        // Transplant
        if (dates.transplant) {
            const taskId = `${plant.id}-transplant`;
            const done = plantlogData[taskId]?.done || completedTasksData[taskId];
            if (!done && dates.transplant.end >= oneWeekAgo && dates.transplant.start <= twoWeeksOut) {
                const overdue = today > dates.transplant.end;
                tasks.push({
                    emoji: plant.emoji,
                    label: `Transplant ${plant.name}`,
                    type: 'transplant',
                    overdue,
                    date: dates.transplant.start
                });
            }
        }
        // Direct sow
        if (dates.directSow) {
            const taskId = `${plant.id}-direct-sow`;
            const done = plantlogData[taskId]?.done || completedTasksData[taskId];
            if (!done && dates.directSow.end >= oneWeekAgo && dates.directSow.start <= twoWeeksOut) {
                const overdue = today > dates.directSow.end;
                tasks.push({
                    emoji: plant.emoji,
                    label: `Direct sow ${plant.name}`,
                    type: 'direct-sow',
                    overdue,
                    date: dates.directSow.start
                });
            }
        }
        // Harvest ready (only for plants actually in beds)
        if (dates.harvestStart) {
            const inBeds = state.containers.some(c => c.plants.some(p => p.plantId === plant.id));
            if (inBeds && today >= dates.harvestStart.start && today <= dates.harvestStart.end) {
                tasks.push({
                    emoji: plant.emoji,
                    label: `Harvest ${plant.name}`,
                    type: 'harvest',
                    overdue: false,
                    date: dates.harvestStart.start
                });
            }
        }
    });

    // Sort: overdue first, then by date
    tasks.sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return a.date - b.date;
    });

    // Render
    const container = document.getElementById('today-tasks-list');
    if (!container) return;

    if (tasks.length === 0) {
        if (plantedIds.size === 0) {
            container.innerHTML = '<p class="today-no-tasks"><span class="all-good">No plants yet</span> \u2014 drag plants into beds to see planting tasks.</p>';
        } else if (seasonPhase === 'OFF-SEASON') {
            container.innerHTML = '<p class="today-no-tasks">Nothing to do right now \u2014 <span class="all-good">enjoy the off-season!</span></p>';
        } else {
            container.innerHTML = '<p class="today-no-tasks"><span class="all-good">All caught up!</span> No urgent tasks this week.</p>';
        }
        return;
    }

    container.innerHTML = tasks.map(t => {
        const chipClass = `today-task-chip chip-${t.type}${t.overdue ? ' chip-overdue' : ''}`;
        const overdueTag = t.overdue ? ' <span class="chip-type">OVERDUE</span>' : '';
        return `<div class="${chipClass}"><span class="chip-emoji">${t.emoji}</span><span class="chip-label">${t.label}</span>${overdueTag}</div>`;
    }).join('');
}

// ---- TODAY'S TASKS COLLAPSE TOGGLE ----
function initTasksToggle() {
    const btn = document.getElementById('btn-toggle-tasks');
    const dashboard = document.getElementById('today-dashboard');
    if (!btn || !dashboard) return;

    // Restore saved preference
    const collapsed = localStorage.getItem('gardensync_tasks_collapsed') === 'true';
    if (collapsed) {
        dashboard.classList.add('tasks-collapsed');
        btn.textContent = '\u25B8'; // ▸ right arrow
    }

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = dashboard.classList.toggle('tasks-collapsed');
        localStorage.setItem('gardensync_tasks_collapsed', isCollapsed ? 'true' : 'false');
        btn.textContent = isCollapsed ? '\u25B8' : '\u25BE'; // ▸ or ▾
    });
}

// ---- HARVEST GOAL TRACKER ----
function initHarvestGoals() {
    const goalInput = document.getElementById('harvest-goal-weight');
    const setBtn = document.getElementById('btn-set-goal');
    const goalDisplay = document.getElementById('goal-display');
    const progressWrap = document.getElementById('goal-progress-bar');

    const savedGoal = localStorage.getItem('gardensync_harvest_goal');
    if (savedGoal) {
        goalInput.value = savedGoal;
        updateHarvestGoalDisplay();
    }

    setBtn.addEventListener('click', () => {
        const goal = parseFloat(goalInput.value);
        if (!goal || goal <= 0) { showToast('Enter a valid weight goal'); return; }
        localStorage.setItem('gardensync_harvest_goal', goal);
        updateHarvestGoalDisplay();
        showToast(`Harvest goal set: ${goal} lbs!`);
    });
}

function updateHarvestGoalDisplay() {
    const goal = parseFloat(localStorage.getItem('gardensync_harvest_goal'));
    const goalDisplay = document.getElementById('goal-display');
    const progressWrap = document.getElementById('goal-progress-bar');
    const progressFill = document.getElementById('goal-progress-fill');
    const progressText = document.getElementById('goal-progress-text');

    if (!goal) {
        if (goalDisplay) goalDisplay.textContent = 'No goal set';
        if (progressWrap) progressWrap.classList.add('hidden');
        return;
    }

    // Get total harvested weight
    const harvests = getHarvestData();
    const totalWeight = harvests.reduce((sum, h) => sum + (parseFloat(h.weight) || 0), 0);
    const pct = Math.min(100, Math.round((totalWeight / goal) * 100));

    if (goalDisplay) goalDisplay.textContent = `GOAL: ${goal} lbs (${totalWeight.toFixed(1)} / ${goal} lbs)`;
    if (progressWrap) progressWrap.classList.remove('hidden');
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressText) progressText.textContent = pct + '% of goal';
}

// ---- EXPORT PNG (canvas snapshot) ----
