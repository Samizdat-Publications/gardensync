/* GardenSync — Volunteer Management */

function initVolunteers() {
    document.getElementById('btn-add-volunteer').addEventListener('click', addVolunteer);
    document.getElementById('btn-auto-assign').addEventListener('click', autoAssign);

    // Load defaults if empty
    if (state.volunteers.length === 0) {
        state.volunteers = [
            { id: 1, name: 'Volunteer 1', phone: '', availability: 'medium' },
            { id: 2, name: 'Volunteer 2', phone: '', availability: 'medium' },
            { id: 3, name: 'Volunteer 3', phone: '', availability: 'low' },
            { id: 4, name: 'Volunteer 4', phone: '', availability: 'high' },
            { id: 5, name: 'Volunteer 5', phone: '', availability: 'low' },
        ];
    }
    renderVolunteers();
}

function addVolunteer() {
    const name = document.getElementById('vol-name').value.trim();
    if (!name) return;
    const phone = document.getElementById('vol-phone').value.trim();
    const availability = document.getElementById('vol-availability').value;
    state.volunteers.push({
        id: Date.now(),
        name, phone, availability
    });
    document.getElementById('vol-name').value = '';
    document.getElementById('vol-phone').value = '';
    renderVolunteers();
    saveState();
}

function renderVolunteers() {
    // Volunteer list
    const listEl = document.getElementById('volunteer-list');
    const avatars = ['\u270A','\u{1F331}','\u{1F33F}','\u{1F33B}','\u{1F345}','\u{1F955}','\u{1F952}','\u{1F96C}'];
    listEl.innerHTML = state.volunteers.map((v, i) => `
        <div class="vol-card">
            <div class="vol-avatar">${avatars[i % avatars.length]}</div>
            <div class="vol-info">
                <div class="vol-name">${escapeHtml(v.name)}</div>
                <div class="vol-contact">${escapeHtml(v.phone) || 'no contact info'}</div>
            </div>
            <span class="vol-avail ${v.availability}">${v.availability.toUpperCase()}</span>
            <button class="vol-remove" data-vol-id="${v.id}">\u00D7</button>
        </div>
    `).join('');

    listEl.querySelectorAll('.vol-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            state.volunteers = state.volunteers.filter(v => v.id !== parseInt(btn.dataset.volId));
            renderVolunteers();
            saveState();
        });
    });

    // Container assignments
    const assignEl = document.getElementById('bed-assignments');
    assignEl.innerHTML = state.containers.map(c => `
        <div class="assignment-row">
            <div class="assignment-bed-label">${escapeHtml(c.name)} ${c.plants.length > 0 ? `(${[...new Set(c.plants.map(p=>p.plantId))].map(pid => PLANT_LIBRARY.find(pl=>pl.id===pid)?.emoji || '').join(' ')})` : '(empty)'}</div>
            <select class="assignment-select" data-container-id="${c.id}">
                <option value="">Unassigned</option>
                ${state.volunteers.map(v => `<option value="${v.id}" ${c.volunteer === v.id ? 'selected' : ''}>${escapeHtml(v.name)} (${v.availability})</option>`).join('')}
            </select>
        </div>
    `).join('');

    assignEl.querySelectorAll('.assignment-select').forEach(sel => {
        sel.addEventListener('change', () => {
            const container = getContainer(sel.dataset.containerId);
            if (container) {
                container.volunteer = sel.value ? parseInt(sel.value) : null;
            }
            saveState();
            renderWeeklyTasks();
        });
    });

    renderWeeklyTasks();
}

function autoAssign() {
    const sorted = [...state.volunteers].sort((a,b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.availability] - order[b.availability];
    });
    state.containers.forEach((c, i) => {
        c.volunteer = sorted[i % sorted.length]?.id || null;
    });
    renderVolunteers();
    saveState();
    showToast('Auto-assigned by availability!');
}

function renderWeeklyTasks() {
    const container = document.getElementById('current-week-tasks');
    const now = new Date();
    const monthName = MONTH_FULL[now.getMonth()];

    const tasks = [];
    // Generate tasks based on current month and planted items
    state.containers.forEach(container => {
        if (container.plants.length === 0) return;
        const vol = state.volunteers.find(v => v.id === container.volunteer);
        const volName = vol ? vol.name : 'Unassigned';
        tasks.push({ text: `[${container.name}] Water check \u2014 ${volName}`, done: false });
        tasks.push({ text: `[${container.name}] Weed patrol \u2014 ${volName}`, done: false });
    });

    if (now.getMonth() >= 3 && now.getMonth() <= 5) {
        tasks.push({ text: `Check watering schedule \u2014 rainfall vs plant needs`, done: false });
    }
    tasks.push({ text: `Harvest any ripe produce for distribution`, done: false });
    tasks.push({ text: `Update garden log / take photos`, done: false });

    container.innerHTML = `<h4 style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);letter-spacing:1px;margin-bottom:0.75rem;">WEEK OF ${monthName.toUpperCase()} ${now.getDate()}</h4>` +
        tasks.map((t, i) => `
        <div class="task-item">
            <div class="task-check ${t.done ? 'done' : ''}" data-task="${i}">${t.done ? '\u2714' : ''}</div>
            <span class="task-text ${t.done ? 'done' : ''}">${t.text}</span>
        </div>
    `).join('');

    container.querySelectorAll('.task-check').forEach(chk => {
        chk.addEventListener('click', () => {
            chk.classList.toggle('done');
            const span = chk.nextElementSibling;
            span.classList.toggle('done');
            chk.textContent = chk.classList.contains('done') ? '\u2714' : '';
        });
    });
}

// ---- CLIMATE CHARTS (Canvas based, no dependencies) ----
