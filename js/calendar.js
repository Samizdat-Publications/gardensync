/* GardenSync — Calendar Export (.ics) */

function initCalendarExport() {
    document.getElementById('btn-export-calendar').addEventListener('click', exportCalendar);
}

function exportCalendar() {
    const tasks = generateAllPlantingTasks();
    const logData = getPlantingLogData();

    // Only export undone tasks
    const undoneTasks = tasks.filter(t => !logData[t.id]?.done);

    if (undoneTasks.length === 0) {
        showToast('All tasks are done! Nothing to export.');
        return;
    }

    function formatICSDate(date) {
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }

    function escapeICS(str) {
        return str.replace(/[,;\\]/g, c => '\\' + c).replace(/\n/g, '\\n');
    }

    let ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//GardenSync//Food Not Bombs Canton//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:GardenSync Planting Schedule',
        'X-WR-TIMEZONE:America/New_York'
    ];

    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

    undoneTasks.forEach(task => {
        const startDate = formatICSDate(task.date);
        const endDate = formatICSDate(new Date(task.date.getTime() + 86400000));
        const uid = `${task.id}-${startDate}@gardensync`;

        ics.push(
            'BEGIN:VEVENT',
            `DTSTAMP:${dtstamp}`,
            `DTSTART;VALUE=DATE:${startDate}`,
            `DTEND;VALUE=DATE:${endDate}`,
            `SUMMARY:${escapeICS(task.emoji + ' ' + task.title)}`,
            `DESCRIPTION:${escapeICS(task.detail)}`,
            `UID:${uid}`,
            `CATEGORIES:${task.typeLabel}`,
            'BEGIN:VALARM',
            'TRIGGER:-P1D',
            'ACTION:DISPLAY',
            `DESCRIPTION:Tomorrow: ${escapeICS(task.title)}`,
            'END:VALARM',
            'END:VEVENT'
        );
    });

    ics.push('END:VCALENDAR');

    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gardensync-planting-schedule.ics';
    a.click();
    URL.revokeObjectURL(url);

    showToast(`Exported ${undoneTasks.length} tasks to calendar!`);
}

// ---- HARVEST LOG ----
