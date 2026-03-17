/* GardenSync — Planting Log & Task Tracking */

function initPlantingLog() {
    document.querySelectorAll('[data-plantlog-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-plantlog-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPlantingLog(btn.dataset.plantlogFilter);
        });
    });

    document.getElementById('btn-plantlog-reset').addEventListener('click', () => {
        if (!confirm('Reset all planting log progress? This cannot be undone.')) return;
        localStorage.removeItem('gardensync_plantlog');
        renderPlantingLog('all');
        showToast('Planting log reset!');
    });
}

function getPlantingLogData() {
    return JSON.parse(localStorage.getItem('gardensync_plantlog') || '{}');
}

function savePlantingLogData(data) {
    localStorage.setItem('gardensync_plantlog', JSON.stringify(data));
}

function generateAllPlantingTasks() {
    const lastFrostDate = new Date(new Date().getFullYear(), 3, 18); // April 18
    const tasks = [];

    PLANT_LIBRARY.forEach(plant => {
        // Indoor seed starting
        if (plant.sowIndoors !== null) {
            const startDate = new Date(lastFrostDate);
            startDate.setDate(startDate.getDate() + plant.sowIndoors * 7);
            tasks.push({
                id: `${plant.id}-seed-indoor`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'seed-indoor',
                typeLabel: 'START INDOORS',
                title: `Start ${plant.name} seeds indoors`,
                detail: plant.seedStartInstructions,
                date: startDate,
                weekKey: getWeekKey(startDate)
            });
        }

        // Transplant
        if (plant.transplantAfterFrost !== null) {
            const startDate = new Date(lastFrostDate);
            startDate.setDate(startDate.getDate() + plant.transplantAfterFrost * 7);
            tasks.push({
                id: `${plant.id}-transplant`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'transplant',
                typeLabel: 'TRANSPLANT',
                title: `Transplant ${plant.name} outdoors`,
                detail: plant.careNotes,
                date: startDate,
                weekKey: getWeekKey(startDate)
            });
        }

        // Direct sow
        if (plant.directSow !== null) {
            const startDate = new Date(lastFrostDate);
            startDate.setDate(startDate.getDate() + plant.directSow * 7);
            tasks.push({
                id: `${plant.id}-direct-sow`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'direct-sow',
                typeLabel: 'DIRECT SOW',
                title: `Direct sow ${plant.name}`,
                detail: plant.seedStartInstructions,
                date: startDate,
                weekKey: getWeekKey(startDate)
            });
        }

        // Harvest
        const growStart = plant.transplantAfterFrost !== null
            ? new Date(lastFrostDate.getTime() + plant.transplantAfterFrost * 7 * 86400000)
            : plant.directSow !== null
                ? new Date(lastFrostDate.getTime() + plant.directSow * 7 * 86400000)
                : plant.sowIndoors !== null
                    ? new Date(lastFrostDate.getTime() + plant.sowIndoors * 7 * 86400000)
                    : null;

        if (growStart) {
            const harvestDate = new Date(growStart);
            harvestDate.setDate(harvestDate.getDate() + plant.daysToHarvest);
            tasks.push({
                id: `${plant.id}-harvest`,
                plantId: plant.id,
                plantName: plant.name,
                emoji: plant.emoji,
                type: 'harvest',
                typeLabel: 'HARVEST',
                title: `Begin harvesting ${plant.name}`,
                detail: plant.careNotes,
                date: harvestDate,
                weekKey: getWeekKey(harvestDate)
            });
        }
    });

    // Sort by date
    tasks.sort((a, b) => a.date - b.date);
    return tasks;
}

function getWeekKey(date) {
    // Get Monday of the week
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

function getWeekRange(weekKey) {
    const monday = new Date(weekKey + 'T12:00:00');
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const opts = { month: 'short', day: 'numeric' };
    return {
        monday,
        sunday,
        label: `${monday.toLocaleDateString('en-US', opts)} \u2013 ${sunday.toLocaleDateString('en-US', opts)}`,
        monthYear: monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
}

function getCurrentWeekKey() {
    return getWeekKey(new Date());
}

function renderPlantingLog(filter = 'all') {
    const tasks = generateAllPlantingTasks();
    const logData = getPlantingLogData();
    const currentWeekKey = getCurrentWeekKey();
    const now = new Date();

    // Group tasks by week
    const weekMap = {};
    tasks.forEach(task => {
        if (!weekMap[task.weekKey]) weekMap[task.weekKey] = [];
        weekMap[task.weekKey].push(task);
    });

    const sortedWeeks = Object.keys(weekMap).sort();

    // Calculate totals
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => logData[t.id]?.done).length;

    // Update progress bar
    const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    document.getElementById('plantlog-progress-fill').style.width = pct + '%';
    document.getElementById('plantlog-progress-text').textContent = `${doneTasks} / ${totalTasks} tasks done (${pct}%)`;

    // Current week highlight
    const currentWeekEl = document.getElementById('plantlog-current-week');
    const currentWeekTasks = weekMap[currentWeekKey] || [];
    if (currentWeekTasks.length > 0) {
        const range = getWeekRange(currentWeekKey);
        const cwDone = currentWeekTasks.filter(t => logData[t.id]?.done).length;
        currentWeekEl.innerHTML = `
            <div class="plantlog-current-week-card">
                <h3>\u{1F449} THIS WEEK'S TASKS</h3>
                <div class="plantlog-week-hint">${range.label} &bull; ${cwDone}/${currentWeekTasks.length} complete</div>
                ${currentWeekTasks.map(task => renderPlantlogTask(task, logData)).join('')}
            </div>
        `;
        attachPlantlogCheckHandlers(currentWeekEl, logData, filter);
    } else {
        const range = getWeekRange(currentWeekKey);
        currentWeekEl.innerHTML = `
            <div class="plantlog-current-week-card">
                <h3>\u{1F449} THIS WEEK (${range.label})</h3>
                <div class="plantlog-empty-week">No planting tasks scheduled this week. Check the timeline below for upcoming tasks.</div>
            </div>
        `;
    }

    // Full timeline
    const timelineEl = document.getElementById('plantlog-timeline');
    let timelineHtml = '';

    sortedWeeks.forEach(weekKey => {
        const weekTasks = weekMap[weekKey];
        const range = getWeekRange(weekKey);
        const isCurrent = weekKey === currentWeekKey;
        const isPast = range.sunday < now;
        const weekDone = weekTasks.filter(t => logData[t.id]?.done).length;
        const allDone = weekDone === weekTasks.length;

        // Apply filter
        if (filter === 'done' && weekDone === 0) return;
        if (filter === 'upcoming' && (isPast || isCurrent)) return;
        if (filter === 'overdue') {
            const hasOverdue = weekTasks.some(t => isPast && !logData[t.id]?.done);
            if (!hasOverdue) return;
        }

        let badge = '';
        if (isCurrent) badge = '<span class="plantlog-week-badge current">THIS WEEK</span>';
        else if (isPast && !allDone) badge = '<span class="plantlog-week-badge overdue">OVERDUE</span>';
        else if (!isPast) badge = '<span class="plantlog-week-badge future">UPCOMING</span>';

        const classes = [
            'plantlog-week',
            weekTasks.length > 0 ? 'has-tasks' : '',
            allDone ? 'all-done' : '',
            isCurrent ? 'is-current' : ''
        ].filter(Boolean).join(' ');

        // Collapse past completed weeks and far future weeks by default
        const collapsed = (isPast && allDone) || (!isCurrent && !isPast && range.monday > new Date(now.getTime() + 30 * 86400000));

        timelineHtml += `
            <div class="${classes}" data-week="${weekKey}">
                <div class="plantlog-week-header">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span class="plantlog-week-title">${allDone ? '\u2705 ' : ''}${range.monthYear.toUpperCase()} \u2014 WEEK OF ${range.label}</span>
                        ${badge}
                    </div>
                    <span class="plantlog-week-progress"><span class="done-count">${weekDone}</span>/${weekTasks.length}</span>
                </div>
                <div class="plantlog-week-body ${collapsed ? 'collapsed' : ''}">
                    ${weekTasks.map(task => {
                        if (filter === 'done' && !logData[task.id]?.done) return '';
                        if (filter === 'overdue' && (logData[task.id]?.done || !isPast)) return '';
                        return renderPlantlogTask(task, logData);
                    }).join('')}
                </div>
            </div>
        `;
    });

    timelineEl.innerHTML = timelineHtml;

    // Attach event handlers
    timelineEl.querySelectorAll('.plantlog-week-header').forEach(header => {
        header.addEventListener('click', () => {
            header.nextElementSibling.classList.toggle('collapsed');
        });
    });

    attachPlantlogCheckHandlers(timelineEl, logData, filter);

    // Scroll current week into view if it exists in timeline
    const currentEl = timelineEl.querySelector('.is-current');
    if (currentEl) {
        setTimeout(() => currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
}

function renderPlantlogTask(task, logData) {
    const entry = logData[task.id] || {};
    const done = entry.done || false;
    const completedDate = entry.completedAt ? new Date(entry.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

    return `
        <div class="plantlog-task" data-task-id="${task.id}">
            <div class="plantlog-task-check ${done ? 'done' : ''}" data-task-id="${task.id}">${done ? '\u2714' : ''}</div>
            <div class="plantlog-task-content">
                <div class="plantlog-task-title ${done ? 'done' : ''}">${task.emoji} ${task.title}</div>
                <div class="plantlog-task-subtitle ${done ? 'done' : ''}">${task.detail}</div>
                ${done && completedDate ? `<div class="plantlog-task-date-completed">\u2714 Completed ${completedDate}</div>` : ''}
            </div>
            <span class="plantlog-task-type ${task.type}">${task.typeLabel}</span>
        </div>
    `;
}

function attachPlantlogCheckHandlers(container, logData, filter) {
    container.querySelectorAll('.plantlog-task-check').forEach(chk => {
        chk.addEventListener('click', (e) => {
            e.stopPropagation();
            const taskId = chk.dataset.taskId;
            if (logData[taskId]?.done) {
                delete logData[taskId];
            } else {
                logData[taskId] = {
                    done: true,
                    completedAt: new Date().toISOString()
                };
            }
            savePlantingLogData(logData);
            renderPlantingLog(filter);
            if (typeof updateTodayDashboard === 'function') updateTodayDashboard();
        });
    });
}

