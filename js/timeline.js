/* GardenSync — Season Timeline Scrubber (stage 2c)
   Plants visually grow seed -> harvest as state.seasonDay (0-365) advances.
   Scrubber DOM is built once, hidden until body.tweak-timeline-on. CSS in
   styles.css drives the scaling/glow per data-stage attribute. */

// Canton, OH (Zone 6a) frost-date day-of-year — matches dashboard.js
//   last spring frost  = Apr 18 -> DOY 108
//   first fall frost   = Oct 28 -> DOY 301
const TIMELINE_LAST_FROST_DOY = 108;
const TIMELINE_FIRST_FROST_DOY = 301;

const TIMELINE_MONTH_TICKS = [
    { d: 0,   l: 'JAN' },
    { d: 31,  l: 'FEB' },
    { d: 59,  l: 'MAR' },
    { d: 90,  l: 'APR' },
    { d: 120, l: 'MAY' },
    { d: 151, l: 'JUN' },
    { d: 181, l: 'JUL' },
    { d: 212, l: 'AUG' },
    { d: 243, l: 'SEP' },
    { d: 273, l: 'OCT' },
    { d: 304, l: 'NOV' },
    { d: 334, l: 'DEC' }
];

function _timelineHash(str) {
    var h = 0;
    if (!str) return 0;
    for (var i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function _timelineSeedStartDOY(plant) {
    // Pick the earliest applicable start. Indoor-sown plants "exist" from
    // the indoor sow week; direct-sown plants from the outdoor sow week.
    var weeks = null;
    if (typeof plant.sowIndoors === 'number') weeks = plant.sowIndoors;
    if (weeks === null && typeof plant.directSow === 'number') weeks = plant.directSow;
    if (weeks === null && typeof plant.transplantAfterFrost === 'number') weeks = plant.transplantAfterFrost - 4;
    if (weeks === null) weeks = -2; // safe default: 2 weeks before frost
    return TIMELINE_LAST_FROST_DOY + weeks * 7;
}

function getGrowthStage(placement, plant) {
    if (!plant) return 'mature';
    var offset = _timelineHash(placement.id) % 30; // 0..29 day per-plant offset
    var seedStart = _timelineSeedStartDOY(plant) + offset;
    var growDays = (typeof plant.daysToHarvest === 'number' && plant.daysToHarvest > 0)
        ? plant.daysToHarvest : 60;
    var harvestWindow = (typeof plant.harvestWeeks === 'number' && plant.harvestWeeks > 0)
        ? plant.harvestWeeks * 7 : 14;
    var day = state.seasonDay;
    if (day < seedStart) return 'seed';
    var progress = (day - seedStart) / growDays;
    if (progress < 0.35) return 'seed';
    if (progress < 0.55) return 'sprout';
    if (progress < 0.80) return 'leaf';
    if (progress < 1.0)  return 'mature';
    if (day < seedStart + growDays + harvestWindow) return 'harvest';
    return 'mature'; // post-harvest fall-back: render as mature, no amber glow
}

function applyGrowthStages() {
    if (!(state.tweaks && state.tweaks.timeline)) {
        // Tweak off — clear all data-stage attrs so CSS doesn't apply
        document.querySelectorAll('.placed-plant[data-stage]').forEach(function(el) {
            el.removeAttribute('data-stage');
        });
        return;
    }
    document.querySelectorAll('.garden-bed[data-container-id]').forEach(function(bedEl) {
        var cid = bedEl.getAttribute('data-container-id');
        var container = (typeof getContainer === 'function') ? getContainer(cid) : null;
        if (!container) return;
        container.plants.forEach(function(p) {
            var pl = PLANT_LIBRARY.find(function(lib) { return lib.id === p.plantId; });
            if (!pl) return;
            var el = bedEl.querySelector('.placed-plant[data-placement-id="' + p.id + '"]');
            if (!el) return;
            el.setAttribute('data-stage', getGrowthStage(p, pl));
        });
    });
}

function _doyToLabel(doy) {
    var d = new Date(new Date().getFullYear(), 0, 1);
    d.setDate(d.getDate() + Math.max(0, Math.min(365, doy)));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function _setSeasonDay(d) {
    var day = Math.max(0, Math.min(365, parseInt(d, 10) || 0));
    state.seasonDay = day;
    try { localStorage.setItem('gardensync.seasonDay', String(day)); } catch (e) {}
    var input = document.getElementById('timeline-range');
    if (input && input.value !== String(day)) input.value = day;
    var label = document.getElementById('timeline-date-label');
    if (label) label.textContent = _doyToLabel(day);
    applyGrowthStages();
}

function _makeTimelineEl(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
}

function buildTimelineScrubber() {
    if (document.getElementById('timeline-scrubber')) return;

    // Mount the scrubber as a SIBLING of #garden-viewport (i.e., inside
    // <main> next to the viewport, not inside it). Inserting it inside the
    // viewport eats viewport height, which clips bed canvas positions and
    // breaks container drag.
    var viewport = document.getElementById('garden-viewport');
    if (!viewport || !viewport.parentNode) return;

    var bar = _makeTimelineEl('div', 'timeline-scrubber');
    bar.id = 'timeline-scrubber';

    var headRow = _makeTimelineEl('div', 'timeline-head');
    headRow.appendChild(_makeTimelineEl('span', 'timeline-title', '\u{1F33F} SEASON'));
    var dateLabel = _makeTimelineEl('span', 'timeline-date', _doyToLabel(state.seasonDay));
    dateLabel.id = 'timeline-date-label';
    headRow.appendChild(dateLabel);
    var todayBtn = _makeTimelineEl('button', 'timeline-today-btn', 'TODAY');
    todayBtn.addEventListener('click', function() {
        var now = new Date();
        var start = new Date(now.getFullYear(), 0, 0);
        var doy = Math.floor((now - start) / 86400000);
        _setSeasonDay(doy);
    });
    headRow.appendChild(todayBtn);
    bar.appendChild(headRow);

    var trackWrap = _makeTimelineEl('div', 'timeline-track-wrap');
    var range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '365';
    range.step = '1';
    range.value = String(state.seasonDay);
    range.id = 'timeline-range';
    range.className = 'timeline-range';
    range.setAttribute('aria-label', 'Season day-of-year scrubber');
    range.addEventListener('input', function() { _setSeasonDay(range.value); });
    trackWrap.appendChild(range);

    var ticks = _makeTimelineEl('div', 'timeline-ticks');
    TIMELINE_MONTH_TICKS.forEach(function(t) {
        var tick = _makeTimelineEl('span', 'timeline-tick', t.l);
        tick.style.left = ((t.d / 365) * 100).toFixed(2) + '%';
        ticks.appendChild(tick);
    });
    trackWrap.appendChild(ticks);

    // Frost-date markers
    var frostA = _makeTimelineEl('span', 'timeline-frost timeline-frost-spring', '❄ LAST FROST');
    frostA.style.left = ((TIMELINE_LAST_FROST_DOY / 365) * 100).toFixed(2) + '%';
    trackWrap.appendChild(frostA);
    var frostB = _makeTimelineEl('span', 'timeline-frost timeline-frost-fall', '❄ FIRST FROST');
    frostB.style.left = ((TIMELINE_FIRST_FROST_DOY / 365) * 100).toFixed(2) + '%';
    trackWrap.appendChild(frostB);

    bar.appendChild(trackWrap);

    // Mount as a sibling above #garden-viewport in <main>
    viewport.parentNode.insertBefore(bar, viewport);
}

function showTimelineScrubber() {
    buildTimelineScrubber();
    var bar = document.getElementById('timeline-scrubber');
    if (bar) bar.classList.remove('hidden');
}

function hideTimelineScrubber() {
    var bar = document.getElementById('timeline-scrubber');
    if (bar) bar.classList.add('hidden');
}

function initTimeline() {
    // Build the scrubber on init so it's available when the user flips
    // the toggle. Visibility is gated by body.tweak-timeline-on (CSS).
    buildTimelineScrubber();
    // Apply current stages so freshly-loaded gardens show correct sizes if
    // the tweak is already on at startup.
    applyGrowthStages();
}

window.initTimeline = initTimeline;
window.applyGrowthStages = applyGrowthStages;
window.getGrowthStage = getGrowthStage;
window.showTimelineScrubber = showTimelineScrubber;
window.hideTimelineScrubber = hideTimelineScrubber;
