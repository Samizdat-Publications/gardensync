/* ============================================================
   GardenSync — A Quiet Almanac
   One state object, SVG beds, a scrubbable year.
   XSS note: every dynamic string that reaches markup is either
   static plant-library data or passed through escapeHtml();
   chat and other free text use textContent.
   ============================================================ */

'use strict';

/* ---------- calendar ---------- */

const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
const MONTH_CUM  = [0,31,59,90,120,151,181,212,243,273,304,334];
const MONTH_AB   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DOY = (m, d) => MONTH_CUM[m] + d - 1;          // 0-indexed month
const LAST_FROST  = DOY(3, 18);                       // Apr 18
const FIRST_FROST = DOY(9, 28);                       // Oct 28

function todayDoy() {
  const n = new Date();
  return DOY(n.getMonth(), n.getDate());
}
function doyToMD(doy) {
  doy = ((Math.round(doy) % 365) + 365) % 365;
  let m = 11;
  while (m > 0 && MONTH_CUM[m] > doy) m--;
  return { m, d: doy - MONTH_CUM[m] + 1 };
}
function fmtDoy(doy) {
  const { m, d } = doyToMD(doy);
  return `${MONTH_AB[m]} ${d}`;
}

/* ---------- geometry ---------- */

const CELL = 46;
const TYPE_FILL = { vegetable:'#DCE5CB', herb:'#E4E8CE', flower:'#F0DBD3', fruit:'#F3E4C0' };

function spanOf(p)  { return p.spacing <= 12 ? 1 : p.spacing <= 26 ? 2 : 3; }
function perSquare(p) {
  if (spanOf(p) > 1) return 1;
  if (p.spacing <= 3) return 16;
  if (p.spacing <= 4) return 9;
  if (p.spacing <= 6) return 4;
  return 1;
}

/* growth windows, in day-of-year, from Zone 6a frost dates */
function windowsOf(p) {
  const indoor = p.sowIndoors != null ? LAST_FROST + p.sowIndoors * 7 : null;
  let inBed;
  if (p.directSow != null) inBed = LAST_FROST + p.directSow * 7;
  else if (p.transplantAfterFrost != null) inBed = LAST_FROST + p.transplantAfterFrost * 7;
  else inBed = LAST_FROST;
  const hStart = inBed + p.daysToHarvest;
  const hEnd = Math.min(hStart + (p.harvestWeeks || 3) * 7, 364);
  return { indoor, inBed, hStart, hEnd };
}
function stageAt(p, doy) {
  const w = windowsOf(p);
  if (doy < w.inBed) return 'planned';
  const sproutEnd = w.inBed + Math.max(10, (w.hStart - w.inBed) * 0.3);
  if (doy < sproutEnd) return 'sprout';
  if (doy < w.hStart) return 'growing';
  if (doy <= w.hEnd) return 'harvest';
  return 'rest';
}
const STAGE_SCALE = { planned:.42, sprout:.52, growing:.8, harvest:1, rest:.7 };

/* ---------- state ---------- */

const LS_KEY = 'gardensync-almanac-v1';

const state = {
  beds: [],                 // {id, name, w, h, plants:[{uid,pid,c,r}]}
  viewDoy: todayDoy(),
  armed: null,              // plant id from the drawer
  sel: null,                // {bedId, uid}
  search: '',
  undoStack: [],
  chat: [],
};

let uidCounter = 1;
const newUid = () => 'p' + (uidCounter++) + '-' + Math.random().toString(36).slice(2, 7);

function snapshot() { return JSON.stringify(state.beds); }
function pushUndo(snap) {
  state.undoStack.push(snap || snapshot());
  if (state.undoStack.length > 60) state.undoStack.shift();
}
function undo() {
  const prev = state.undoStack.pop();
  if (!prev) { whisper('Nothing to undo — the garden is as it was.'); return; }
  state.beds = JSON.parse(prev);
  state.sel = null;
  renderBeds(); renderAlmanac(); save();
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ app:'gardensync-almanac', version:1, beds: state.beds })); }
    catch (e) { /* storage full or unavailable — the garden lives on in memory */ }
  }, 350);
}

/* ---------- occupancy & companions ---------- */

function bedById(id) { return state.beds.find(b => b.id === id); }

function cellsFree(bed, c, r, span, ignoreUid) {
  if (c < 0 || r < 0 || c + span > bed.w || r + span > bed.h) return false;
  for (const pl of bed.plants) {
    if (pl.uid === ignoreUid) continue;
    const s = spanOf(PLANT_BY_ID[pl.pid]);
    if (c < pl.c + s && pl.c < c + span && r < pl.r + s && pl.r < r + span) return false;
  }
  return true;
}

/* gap in feet between two footprints; 0 = touching/overlap, 1 = one square apart */
function footprintGap(a, b) {
  const sa = spanOf(PLANT_BY_ID[a.pid]), sb = spanOf(PLANT_BY_ID[b.pid]);
  const gx = Math.max(0, b.c - (a.c + sa), a.c - (b.c + sb));
  const gy = Math.max(0, b.r - (a.r + sa), a.r - (b.r + sb));
  return Math.max(gx, gy);
}
function relation(pidA, pidB) {
  const A = PLANT_BY_ID[pidA], B = PLANT_BY_ID[pidB];
  if (!A || !B) return 'neutral';
  if ((A.enemies||[]).includes(B.id) || (B.enemies||[]).includes(A.id)) return 'foe';
  if ((A.companions||[]).includes(B.id) || (B.companions||[]).includes(A.id)) return 'friend';
  return 'neutral';
}

function bedMood(bed) {
  let friends = 0, foes = 0;
  for (let i = 0; i < bed.plants.length; i++)
    for (let j = i + 1; j < bed.plants.length; j++) {
      if (footprintGap(bed.plants[i], bed.plants[j]) > 1) continue;
      const rel = relation(bed.plants[i].pid, bed.plants[j].pid);
      if (rel === 'friend') friends++;
      else if (rel === 'foe') foes++;
    }
  if (foes > 0)      return { cls:'uneasy',  label:`uneasy — ${foes} quarrel${foes>1?'s':''}` };
  if (friends >= 4)  return { cls:'thriving',label:'thriving — friends all around' };
  if (friends >= 1)  return { cls:'content', label:'content — good company' };
  if (!bed.plants.length) return { cls:'quiet', label:'empty, full of possibility' };
  return { cls:'quiet', label:'quiet' };
}

/* ---------- templates ---------- */

function makeBed(name, w, h) {
  return { id: 'bed-' + Math.random().toString(36).slice(2, 8), name, w, h, plants: [] };
}
function fillBed(bed, recipe) {
  const items = recipe
    .map(([pid, n]) => ({ p: PLANT_BY_ID[pid], n }))
    .filter(x => x.p)
    .sort((a, b) => spanOf(b.p) - spanOf(a.p));
  for (const { p, n } of items) {
    const span = spanOf(p);
    let placed = 0;
    for (let r = 0; r <= bed.h - span && placed < n; r++)
      for (let c = 0; c <= bed.w - span && placed < n; c++)
        if (cellsFree(bed, c, r, span)) {
          bed.plants.push({ uid: newUid(), pid: p.id, c, r });
          placed++;
        }
  }
  return bed;
}

const TEMPLATES = {
  'blank': () => [makeBed('North bed', 8, 4), makeBed('Middle bed', 8, 4), makeBed('South bed', 8, 4)],
  'fnb-easy': () => [
    fillBed(makeBed('The Greens Bed', 8, 4), [['kale',3],['swiss-chard',12],['lettuce',2],['parsley',4]]),
    fillBed(makeBed('Root Cellar', 8, 4),    [['onion',12],['carrot',10],['beet',8],['chive',2]]),
    fillBed(makeBed('Potato Patch', 8, 4),   [['potato',32]]),
    fillBed(makeBed('Bean Machine', 8, 4),   [['green-beans',28],['nasturtium',4]]),
    fillBed(makeBed('Garlic & Herbs', 8, 4), [['garlic',16],['chive',6],['oregano',4],['basil',4]]),
  ],
};

/* ---------- whisper ---------- */

let whisperTimer = null;
function whisper(text, ms = 3400) {
  const el = document.getElementById('whisper');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ---------- season ribbon ---------- */

const RIB = { W: 1100, H: 70, padX: 34, bandY: 26, bandH: 18 };
const doyToX = doy => RIB.padX + (doy / 364) * (RIB.W - RIB.padX * 2);
const xToDoy = x => Math.max(0, Math.min(364, Math.round((x - RIB.padX) / (RIB.W - RIB.padX * 2) * 364)));

function renderRibbon() {
  const svg = document.getElementById('ribbon');
  const t = todayDoy();
  let s = '';
  // winter base band
  s += `<rect x="${RIB.padX}" y="${RIB.bandY}" width="${RIB.W - RIB.padX*2}" height="${RIB.bandH}" rx="9" fill="#E4DCC6"/>`;
  // growing season
  s += `<rect x="${doyToX(LAST_FROST)}" y="${RIB.bandY}" width="${doyToX(FIRST_FROST)-doyToX(LAST_FROST)}" height="${RIB.bandH}" rx="9" fill="#C9D6AF"/>`;
  // month ticks + labels
  for (let m = 0; m < 12; m++) {
    const x = doyToX(MONTH_CUM[m]);
    s += `<line x1="${x}" y1="${RIB.bandY-3}" x2="${x}" y2="${RIB.bandY+RIB.bandH+3}" stroke="#2C3527" stroke-opacity=".14"/>`;
    const xm = doyToX(MONTH_CUM[m] + MONTH_DAYS[m]/2);
    s += `<text x="${xm}" y="${RIB.bandY+RIB.bandH+16}" text-anchor="middle" font-size="10.5" letter-spacing="1.5" fill="#8B927E" font-family="Karla,sans-serif" font-weight="700">${MONTH_AB[m].toUpperCase()}</text>`;
  }
  // frost markers
  for (const [doy, lbl, anchor] of [[LAST_FROST,'last frost · Apr 18','start'],[FIRST_FROST,'first frost · Oct 28','end']]) {
    const x = doyToX(doy);
    s += `<line x1="${x}" y1="${RIB.bandY-8}" x2="${x}" y2="${RIB.bandY+RIB.bandH}" stroke="#7A93B5" stroke-width="1.4"/>`;
    s += `<text x="${x + (anchor==='start'?5:-5)}" y="${RIB.bandY-10}" text-anchor="${anchor}" font-size="10" font-style="italic" fill="#7A93B5" font-family="Fraunces,serif">❄ ${lbl}</text>`;
  }
  // today
  const tx = doyToX(t);
  s += `<line x1="${tx}" y1="${RIB.bandY-4}" x2="${tx}" y2="${RIB.bandY+RIB.bandH+4}" stroke="#B5613D" stroke-width="1.6"/>`;
  // view pin
  const vx = doyToX(state.viewDoy);
  s += `<g id="ribbon-pin" style="cursor:grab">
    <line x1="${vx}" y1="${RIB.bandY-2}" x2="${vx}" y2="${RIB.bandY+RIB.bandH+2}" stroke="#2C3527" stroke-width="2"/>
    <circle cx="${vx}" cy="${RIB.bandY+RIB.bandH/2}" r="8.5" fill="#FCF6E3" stroke="#2C3527" stroke-width="1.6"/>
    <circle cx="${vx}" cy="${RIB.bandY+RIB.bandH/2}" r="2.6" fill="#B5613D"/>
  </g>`;
  svg.innerHTML = s;

  const lbl = document.getElementById('view-date-label');
  const isToday = Math.round(state.viewDoy) === t;
  lbl.textContent = isToday
    ? `Viewing ${fmtDoy(state.viewDoy)} — today`
    : `Viewing ${fmtDoy(state.viewDoy)}`;
  document.getElementById('btn-today').hidden = isToday;
}

function setupRibbon() {
  const svg = document.getElementById('ribbon');
  let dragging = false;
  const move = e => {
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * RIB.W;
    state.viewDoy = xToDoy(x);
    renderRibbon(); renderBeds(); renderAlmanac();
  };
  svg.addEventListener('pointerdown', e => { dragging = true; svg.setPointerCapture(e.pointerId); move(e); });
  svg.addEventListener('pointermove', e => { if (dragging) move(e); });
  svg.addEventListener('pointerup',   () => { dragging = false; });
  document.getElementById('btn-today').addEventListener('click', () => {
    state.viewDoy = todayDoy();
    renderRibbon(); renderBeds(); renderAlmanac();
  });
}

/* ---------- seed drawer ---------- */

const TYPE_ORDER = ['vegetable', 'herb', 'flower', 'fruit'];
const TYPE_LABEL = { vegetable:'Vegetables', herb:'Herbs', flower:'Flowers', fruit:'Fruit' };

function packetMeta(p) {
  const per = perSquare(p), span = spanOf(p);
  const fit = span > 1 ? `${span}×${span} ft` : per > 1 ? `${per} per sq ft` : '1 per sq ft';
  return `${fit} · ${p.daysToHarvest} days`;
}

function renderDrawer() {
  const wrap = document.getElementById('drawer-groups');
  const q = state.search.trim().toLowerCase();
  let html = '';
  for (const type of TYPE_ORDER) {
    const items = PLANTS.filter(p => p.type === type && (!q || p.name.toLowerCase().includes(q)));
    if (!items.length) continue;
    html += `<div class="drawer-group-title">${TYPE_LABEL[type]}</div>`;
    for (const p of items) {
      html += `<button class="packet ${state.armed === p.id ? 'armed' : ''}" data-pid="${p.id}" data-type="${p.type}">
        <span class="pk-emoji">${p.emoji}</span>
        <span><span class="pk-name">${escapeHtml(p.name)}</span><br><span class="pk-meta">${packetMeta(p)}</span></span>
      </button>`;
    }
  }
  wrap.innerHTML = html || `<p class="calm-empty">No seeds by that name.</p>`;
  wrap.querySelectorAll('.packet').forEach(el =>
    el.addEventListener('click', () => armPacket(el.dataset.pid)));
}

function armPacket(pid) {
  state.armed = state.armed === pid ? null : pid;
  state.sel = null;
  renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote();
}
function disarm() {
  if (!state.armed && !state.sel) return;
  state.armed = null; state.sel = null;
  renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote();
}

function renderPlantingNote() {
  const el = document.getElementById('planting-note');
  if (state.armed) {
    const p = PLANT_BY_ID[state.armed];
    el.innerHTML = `Planting <strong>${p.emoji} ${escapeHtml(p.name)}</strong> — tap any open square. <span style="color:var(--ink-faint)">Esc puts the packet back.</span>`;
    el.hidden = false;
  } else el.hidden = true;
}

/* ---------- bed rendering ---------- */

function chipCenter(pl) {
  const span = spanOf(PLANT_BY_ID[pl.pid]);
  return { x: (pl.c + span / 2) * CELL, y: (pl.r + span / 2) * CELL };
}

function chipSvg(bed, pl) {
  const p = PLANT_BY_ID[pl.pid];
  if (!p) return '';
  const span = spanOf(p);
  const { x, y } = chipCenter(pl);
  const stage = stageAt(p, state.viewDoy);
  const baseR = (span * CELL) / 2 - 6;
  const R = Math.max(8, baseR * STAGE_SCALE[stage]);
  const fill = TYPE_FILL[p.type] || TYPE_FILL.vegetable;
  const selected = state.sel && state.sel.uid === pl.uid;
  const per = perSquare(p);
  const fontSize = Math.max(11, R * 1.05);

  let halo = '';
  if (state.armed && state.armed !== pl.pid) {
    const rel = relation(state.armed, pl.pid);
    if (rel === 'friend') halo = `<circle r="${baseR + 3}" fill="none" stroke="#5E7350" stroke-width="2.5" stroke-opacity=".55"/>`;
    if (rel === 'foe')    halo = `<circle r="${baseR + 3}" fill="none" stroke="#B5613D" stroke-width="2.5" stroke-dasharray="3 4" stroke-opacity=".7"/>`;
  }
  if (selected) halo += `<circle r="${baseR + 4}" fill="none" stroke="#2C3527" stroke-width="1.6" stroke-dasharray="1 4" stroke-linecap="round"/>`;

  let body;
  if (stage === 'planned') {
    body = `<circle class="body-ring" r="${R}" fill="${fill}" fill-opacity=".3" stroke="#5C6553" stroke-width="1.2" stroke-dasharray="3 4"/>
            <text font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" opacity=".4">${p.emoji}</text>`;
  } else if (stage === 'rest') {
    body = `<circle class="body-ring" r="${R}" fill="#D8CFB6" stroke="#9C9276" stroke-width="1"/>
            <text font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" opacity=".45">${p.emoji}</text>`;
  } else {
    const ring = stage === 'harvest'
      ? `<circle r="${R + 3.5}" fill="none" stroke="#C09A2C" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"/>` : '';
    body = `${ring}
            <circle class="body-ring" r="${R}" fill="${fill}" stroke="#2C3527" stroke-opacity=".18" stroke-width="1.2"/>
            <text font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">${p.emoji}</text>`;
    if (per > 1 && stage !== 'sprout')
      body += `<text x="${R * .62}" y="${R * .8}" font-size="10" font-weight="700" font-family="Karla,sans-serif" fill="#5C6553">×${per}</text>`;
  }

  const sway = stage === 'sprout' || stage === 'growing' || stage === 'harvest'
    ? `style="animation-delay:-${(pl.uid.charCodeAt(1) % 7)}s"` : '';

  return `<g class="chip stage-${stage}" data-uid="${pl.uid}" data-bed="${bed.id}" transform="translate(${x},${y})">
    ${halo}<g class="swayer" ${sway}>${body}</g>
  </g>`;
}

function arcsSvg(bed) {
  if (!state.sel || state.sel.bedId !== bed.id) return '';
  const selPl = bed.plants.find(pl => pl.uid === state.sel.uid);
  if (!selPl) return '';
  const a = chipCenter(selPl);
  let s = '';
  for (const other of bed.plants) {
    if (other.uid === selPl.uid || footprintGap(selPl, other) > 1) continue;
    const rel = relation(selPl.pid, other.pid);
    if (rel === 'neutral') continue;
    const b = chipCenter(other);
    const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18;
    const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
    s += rel === 'friend'
      ? `<path d="M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}" fill="none" stroke="#5E7350" stroke-width="2" stroke-opacity=".5" stroke-linecap="round"/>`
      : `<path d="M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}" fill="none" stroke="#B5613D" stroke-width="2" stroke-dasharray="2 5" stroke-opacity=".65" stroke-linecap="round"/>`;
  }
  return s;
}

function renderBeds() {
  const wrap = document.getElementById('beds');
  if (!state.beds.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:50px 20px">
      <p class="calm-empty" style="font-size:17px">The garden is bare ground and good intentions.</p>
      <p class="calm-empty">Add a bed below, or open <strong>Plans</strong> for a head start.</p>
    </div>`;
    return;
  }
  let html = '';
  for (const bed of state.beds) {
    const W = bed.w * CELL, H = bed.h * CELL;
    const mood = bedMood(bed);
    let dots = '';
    for (let c = 1; c < bed.w; c++) for (let r = 1; r < bed.h; r++)
      dots += `<circle cx="${c*CELL}" cy="${r*CELL}" r="1.4" fill="#2C3527" fill-opacity=".14"/>`;
    html += `<div class="bed-card" data-bed="${bed.id}">
      <div class="bed-head">
        <h3 class="bed-name" contenteditable="true" spellcheck="false">${escapeHtml(bed.name)}</h3>
        <span class="bed-mood ${mood.cls}"><span class="dot"></span>${mood.label}</span>
        <button class="bed-del" title="Remove this bed">×</button>
      </div>
      <svg class="bed-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-bed="${bed.id}">
        <defs>
          <linearGradient id="soil-${bed.id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#BCA481"/><stop offset="1" stop-color="#A98F6B"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="18" fill="url(#soil-${bed.id})"/>
        <rect x="3" y="3" width="${W-6}" height="${H-6}" rx="15" fill="none" stroke="#FFFFFF" stroke-opacity=".25" stroke-width="1.5"/>
        ${dots}
        <g class="ghost-layer"></g>
        ${bed.plants.map(pl => chipSvg(bed, pl)).join('')}
        <g class="arc-layer">${arcsSvg(bed)}</g>
      </svg>
    </div>`;
  }
  wrap.innerHTML = html;
  wireBeds();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- bed interaction ---------- */

function svgCell(svg, bed, e) {
  const rect = svg.getBoundingClientRect();
  const scale = rect.width / (bed.w * CELL);
  const x = (e.clientX - rect.left) / scale;
  const y = (e.clientY - rect.top) / scale;
  return { c: Math.floor(x / CELL), r: Math.floor(y / CELL) };
}

let drag = null; // {bedId, uid, startX, startY, moved, snap}

function wireBeds() {
  document.querySelectorAll('.bed-card').forEach(card => {
    const bedId = card.dataset.bed;
    const bed = bedById(bedId);
    const svg = card.querySelector('.bed-svg');
    const ghost = svg.querySelector('.ghost-layer');

    /* rename */
    const nameEl = card.querySelector('.bed-name');
    let nameSnap = null;
    nameEl.addEventListener('focus', () => { nameSnap = snapshot(); });
    nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
    nameEl.addEventListener('blur', () => {
      const v = nameEl.textContent.trim() || 'Unnamed bed';
      if (v !== bed.name) { pushUndo(nameSnap); bed.name = v; save(); }
      nameEl.textContent = v;
    });

    /* delete bed */
    card.querySelector('.bed-del').addEventListener('click', () => {
      pushUndo();
      state.beds = state.beds.filter(b => b.id !== bedId);
      if (state.sel && state.sel.bedId === bedId) state.sel = null;
      renderBeds(); renderAlmanac(); save();
      whisper(`${bed.name} returned to lawn. Ctrl+Z to undo.`);
    });

    /* ghost preview while a packet is armed, or while dragging a plant */
    svg.addEventListener('pointermove', e => {
      let activePid = state.armed;
      if (drag && drag.moved) {
        if (drag.bedId !== bedId) { ghost.innerHTML = ''; return; }
        activePid = bedById(drag.bedId)?.plants.find(pl => pl.uid === drag.uid)?.pid;
      }
      if (!activePid) { ghost.innerHTML = ''; return; }
      const p = PLANT_BY_ID[activePid];
      const span = spanOf(p);
      let { c, r } = svgCell(svg, bed, e);
      c = Math.min(Math.max(0, c - Math.floor(span / 2)), bed.w - span);
      r = Math.min(Math.max(0, r - Math.floor(span / 2)), bed.h - span);
      const ok = cellsFree(bed, c, r, span, drag ? drag.uid : null);
      const col = ok ? '#5E7350' : '#B5613D';
      ghost.innerHTML = `
        <rect x="${c*CELL+3}" y="${r*CELL+3}" width="${span*CELL-6}" height="${span*CELL-6}" rx="10"
          fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 4"/>
        <text x="${(c+span/2)*CELL}" y="${(r+span/2)*CELL}" font-size="${span*16}" text-anchor="middle"
          dominant-baseline="central" opacity=".5">${ok ? p.emoji : '✕'}</text>`;
      ghost.dataset.c = c; ghost.dataset.r = r; ghost.dataset.ok = ok ? '1' : '';
    });
    svg.addEventListener('pointerleave', () => { ghost.innerHTML = ''; ghost.dataset.ok = ''; });

    /* plant / select / start drag */
    svg.addEventListener('pointerdown', e => {
      const chipEl = e.target.closest('.chip');
      if (chipEl && !state.armed) {
        drag = { bedId, uid: chipEl.dataset.uid, startX: e.clientX, startY: e.clientY, moved: false, snap: snapshot() };
        svg.setPointerCapture(e.pointerId);
        return;
      }
      if (state.armed) {
        if (!ghost.dataset.ok) { whisper('That spot is taken — try an open square.', 2200); return; }
        const c = +ghost.dataset.c, r = +ghost.dataset.r;
        pushUndo();
        const uid = newUid();
        bed.plants.push({ uid, pid: state.armed, c, r });
        renderBeds(); renderAlmanac(); save();
        const justEl = document.querySelector(`.chip[data-uid="${uid}"]`);
        if (justEl) justEl.classList.add('just-planted');
      }
    });

    svg.addEventListener('pointermove', e => {
      if (!drag || drag.bedId !== bedId) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
        drag.moved = true;
        const el = svg.querySelector(`.chip[data-uid="${drag.uid}"]`);
        if (el) el.classList.add('dragging');
      }
    });

    svg.addEventListener('pointerup', () => {
      if (!drag || drag.bedId !== bedId) return;
      const d = drag; drag = null;
      const pl = bed.plants.find(x => x.uid === d.uid);
      if (!pl) return;
      if (!d.moved) {
        /* a click: select for the almanac */
        state.sel = (state.sel && state.sel.uid === d.uid) ? null : { bedId, uid: d.uid };
        renderBeds(); renderAlmanac();
        return;
      }
      if (ghost.dataset.ok) {
        pushUndo(d.snap);
        pl.c = +ghost.dataset.c;
        pl.r = +ghost.dataset.r;
        save();
      }
      ghost.innerHTML = ''; ghost.dataset.ok = '';
      renderBeds(); renderAlmanac();
    });
  });
}

/* ---------- tasks ---------- */

function gardenEvents() {
  const pids = new Set();
  for (const bed of state.beds) for (const pl of bed.plants) pids.add(pl.pid);
  const events = [];
  for (const pid of pids) {
    const p = PLANT_BY_ID[pid];
    if (!p) continue;
    const w = windowsOf(p);
    if (w.indoor != null) events.push({ doy: w.indoor, kind:'indoor', text:`Start ${p.name} seeds indoors`, emoji: p.emoji });
    if (p.directSow != null) events.push({ doy: w.inBed, kind:'sow', text:`Direct sow ${p.name}`, emoji: p.emoji });
    else if (p.transplantAfterFrost != null) events.push({ doy: w.inBed, kind:'transplant', text:`Transplant ${p.name} into the bed`, emoji: p.emoji });
    events.push({ doy: w.hStart, kind:'harvest', text:`First ${p.name} harvest`, emoji: p.emoji });
  }
  return events.sort((a, b) => a.doy - b.doy);
}

function tasksNear(doy, before = 7, ahead = 14) {
  return gardenEvents().filter(e => e.doy >= doy - before && e.doy <= doy + ahead);
}

/* ---------- almanac panel ---------- */

const PROVERBS = [
  'A garden is never finished — that is the point.',
  'Plant what you love next to what it loves.',
  'The best fertilizer is the gardener’s shadow.',
  'Sow generously; thin without guilt.',
  'Frost is a deadline, not an enemy.',
  'Weeds are opinions the soil has about your plan.',
  'Food grown for neighbors tastes twice.',
];

function renderAlmanac() {
  const el = document.getElementById('almanac-body');
  const pid = state.armed || (state.sel && bedById(state.sel.bedId)?.plants.find(pl => pl.uid === state.sel.uid)?.pid);
  if (pid) { el.innerHTML = plantPage(pid); wireAlmanac(el); return; }

  /* the garden today */
  const plantings = state.beds.reduce((n, b) => n + b.plants.length, 0);
  const varieties = new Set(state.beds.flatMap(b => b.plants.map(pl => pl.pid))).size;
  const sqUsed = state.beds.reduce((n, b) => n + b.plants.reduce((m, pl) => m + spanOf(PLANT_BY_ID[pl.pid]) ** 2, 0), 0);
  const sqTotal = state.beds.reduce((n, b) => n + b.w * b.h, 0);
  const tasks = tasksNear(state.viewDoy);
  const t = todayDoy();

  el.innerHTML = `
    <h2>The garden on ${fmtDoy(state.viewDoy)}</h2>
    <p class="alm-sub">${Math.round(state.viewDoy)===t ? 'as it stands today' : 'as the almanac imagines it'}</p>
    <div class="alm-stats">
      <div class="alm-stat"><div class="n">${state.beds.length}</div><div class="l">beds</div></div>
      <div class="alm-stat"><div class="n">${plantings}</div><div class="l">plantings</div></div>
      <div class="alm-stat"><div class="n">${varieties}</div><div class="l">varieties</div></div>
      <div class="alm-stat"><div class="n">${sqTotal ? Math.round(sqUsed / sqTotal * 100) : 0}%</div><div class="l">soil in use</div></div>
    </div>
    <div class="alm-section">around this date</div>
    ${tasks.length ? tasks.map(e => `
      <div class="task k-${e.kind} ${e.doy < state.viewDoy ? 'past' : ''}">
        <span class="t-date">${fmtDoy(e.doy)}</span><span class="t-dot"></span>
        <span class="t-text">${e.emoji} ${e.text}</span>
      </div>`).join('')
      : `<p class="calm-empty">Nothing pressing. Water if dry, wander, pull a weed or two.</p>`}
    <p class="proverb">“${PROVERBS[Math.round(state.viewDoy) % PROVERBS.length]}”</p>`;
}

function yearStrip(p) {
  const w = windowsOf(p), W = 264, H = 30, pad = 2;
  const x = doy => pad + (Math.max(0, Math.min(364, doy)) / 364) * (W - pad * 2);
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  s += `<rect x="${pad}" y="10" width="${W-pad*2}" height="8" rx="4" fill="#E4DCC6"/>`;
  s += `<rect x="${x(w.inBed)}" y="10" width="${Math.max(2, x(w.hStart)-x(w.inBed))}" height="8" rx="4" fill="#9DB380"/>`;
  s += `<rect x="${x(w.hStart)}" y="10" width="${Math.max(2, x(w.hEnd)-x(w.hStart))}" height="8" rx="4" fill="#C09A2C"/>`;
  if (w.indoor != null && w.indoor >= 0)
    s += `<circle cx="${x(w.indoor)}" cy="14" r="3.4" fill="none" stroke="#C09A2C" stroke-width="1.6"/>`;
  for (const f of [LAST_FROST, FIRST_FROST])
    s += `<line x1="${x(f)}" y1="7" x2="${x(f)}" y2="21" stroke="#7A93B5" stroke-width="1.2"/>`;
  const vx = x(state.viewDoy);
  s += `<line x1="${vx}" y1="5" x2="${vx}" y2="23" stroke="#2C3527" stroke-width="1.4"/>`;
  for (let m = 0; m < 12; m += 1)
    s += `<text x="${x(MONTH_CUM[m] + 15)}" y="${H-1}" text-anchor="middle" font-size="6.5" fill="#8B927E" font-family="Karla,sans-serif" font-weight="700">${MONTH_AB[m][0]}</text>`;
  return s + '</svg>';
}

function plantPage(pid) {
  const p = PLANT_BY_ID[pid];
  if (!p) return '';
  const w = windowsOf(p);
  const planted = state.sel && !state.armed;
  const presentPids = new Set(state.beds.flatMap(b => b.plants.map(pl => pl.pid)));
  const stage = stageAt(p, state.viewDoy);
  const stageWord = { planned:'not yet in the ground', sprout:'a hopeful sprout', growing:'growing steadily', harvest:'ready to harvest', rest:'finished for the year' }[stage];

  const mates = (list, foe) => list && list.length
    ? `<div class="mate-row">${list.map(id => {
        const m = PLANT_BY_ID[id];
        if (!m) return '';
        const here = presentPids.has(id);
        return `<span class="mate ${foe?'foe':''} ${here?'present':''}" title="${here?'growing in your garden':''}">${m.emoji} ${escapeHtml(m.name)}${here?' ✓':''}</span>`;
      }).join('')}</div>`
    : `<p class="calm-empty">none to speak of.</p>`;

  let neighborNote = '';
  if (planted) {
    const bed = bedById(state.sel.bedId);
    const selPl = bed?.plants.find(x => x.uid === state.sel.uid);
    if (selPl) {
      let f = 0, e = 0;
      for (const o of bed.plants) {
        if (o.uid === selPl.uid || footprintGap(selPl, o) > 1) continue;
        const rel = relation(selPl.pid, o.pid);
        if (rel === 'friend') f++; else if (rel === 'foe') e++;
      }
      neighborNote = e > 0
        ? `<p class="plant-notes">⚠ <strong>${e} unhappy neighbor${e>1?'s':''}</strong> nearby — consider a gentle move.</p>`
        : f > 0 ? `<p class="plant-notes">☺ ${f} good neighbor${f>1?'s':''} within reach. This plant is content.</p>` : '';
    }
  }

  return `
    <div class="plant-hero" data-type="${p.type}">
      <span class="ph-emoji">${p.emoji}</span>
      <div>
        <h2>${escapeHtml(p.name)}</h2>
        <p class="alm-sub" style="margin:0">${stageWord} on ${fmtDoy(state.viewDoy)}</p>
      </div>
    </div>
    <div class="plant-facts">
      <span class="fact">☀ ${escapeHtml(String(p.sunNeed))} sun</span>
      <span class="fact">💧 ${escapeHtml(String(p.waterNeed))} water</span>
      <span class="fact">↔ ${p.spacing}″ spacing</span>
      <span class="fact">⏳ ${p.daysToHarvest} days</span>
      ${p.lowMaintenance ? '<span class="fact">🌿 easygoing</span>' : ''}
    </div>
    <div class="year-strip">${yearStrip(p)}</div>
    <p class="plant-notes" style="font-size:11px;color:var(--ink-faint);margin-top:0">
      ${p.directSow != null ? `sow ${fmtDoy(w.inBed)}` : `transplant ${fmtDoy(w.inBed)}`}
      · harvest ${fmtDoy(w.hStart)}–${fmtDoy(w.hEnd)}
      ${w.indoor != null ? `· start indoors ${fmtDoy(w.indoor)}` : ''}
    </p>
    ${neighborNote}
    <p class="plant-notes">${escapeHtml(p.notes || '')}</p>
    <div class="alm-section">grows well beside</div>
    ${mates(p.companions, false)}
    <div class="alm-section">keep away from</div>
    ${mates(p.enemies, true)}
    <details class="howto"><summary>Seed starting</summary><p>${escapeHtml(p.seedStart || '—')}</p></details>
    <details class="howto"><summary>Care through the season</summary><p>${escapeHtml(p.care || '—')}</p></details>
    <div class="alm-actions">
      ${planted
        ? `<button class="alm-btn danger" id="alm-remove">Remove plant</button>
           <button class="alm-btn" id="alm-close">Done</button>`
        : `<button class="alm-btn" id="alm-close">Put packet back</button>`}
    </div>`;
}

function wireAlmanac(el) {
  el.querySelector('#alm-close')?.addEventListener('click', disarm);
  el.querySelector('#alm-remove')?.addEventListener('click', () => {
    const bed = bedById(state.sel.bedId);
    if (!bed) return;
    pushUndo();
    bed.plants = bed.plants.filter(pl => pl.uid !== state.sel.uid);
    state.sel = null;
    renderBeds(); renderAlmanac(); save();
    whisper('Lifted gently and set aside. Ctrl+Z to undo.');
  });
}

/* ---------- header tools ---------- */

function setupTools() {
  document.getElementById('btn-undo').addEventListener('click', undo);

  /* plans menu */
  const menu = document.getElementById('plans-menu');
  document.getElementById('btn-plans').addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    pushUndo();
    state.beds = TEMPLATES[b.dataset.plan]();
    state.sel = null; state.armed = null;
    renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote(); save();
    whisper(b.dataset.plan === 'fnb-easy'
      ? 'The FNB Easy Start plan is laid out — five beds, low fuss, high yield.'
      : 'Three blank beds, raked smooth.');
  }));

  /* export */
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app:'gardensync-almanac', version:1, exported:new Date().toISOString(), beds: state.beds }, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gardensync-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    whisper('Garden pressed between pages and saved.');
  });

  /* import */
  const input = document.getElementById('import-input');
  document.getElementById('btn-import').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (!f) return;
    f.text().then(txt => {
      const data = JSON.parse(txt);
      if (!data || !Array.isArray(data.beds)) throw new Error('shape');
      pushUndo();
      state.beds = data.beds;
      state.sel = null; state.armed = null;
      renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote(); save();
      whisper('Garden restored from file.');
    }).catch(() => whisper('That file doesn’t look like a garden, sorry.'));
    input.value = '';
  });

  /* search */
  document.getElementById('seed-search').addEventListener('input', e => {
    state.search = e.target.value;
    renderDrawer();
  });

  /* add bed */
  document.querySelectorAll('.add-bed').forEach(b => b.addEventListener('click', () => {
    const [w, h] = b.dataset.size.split('x').map(Number);
    pushUndo();
    state.beds.push(makeBed('New bed', w, h));
    renderBeds(); renderAlmanac(); save();
  }));

  /* keys */
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, [contenteditable], textarea')) return;
    if (e.key === 'Escape') disarm();
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel) {
      const bed = bedById(state.sel.bedId);
      if (bed) {
        pushUndo();
        bed.plants = bed.plants.filter(pl => pl.uid !== state.sel.uid);
        state.sel = null;
        renderBeds(); renderAlmanac(); save();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
}

/* ---------- weather ---------- */

const WMO_WORDS = [
  [0,'clear skies'],[1,'mostly clear'],[2,'a few clouds'],[3,'overcast'],
  [45,'morning fog'],[48,'rime fog'],[51,'a light drizzle'],[53,'drizzle'],[55,'steady drizzle'],
  [61,'light rain'],[63,'rain'],[65,'heavy rain'],[71,'light snow'],[73,'snow'],[75,'heavy snow'],
  [80,'passing showers'],[81,'showers'],[82,'hard showers'],[95,'a thunderstorm'],
];
function weatherWord(code) {
  let best = 'changeable skies';
  for (const [c, w] of WMO_WORDS) if (code >= c) best = w;
  return best;
}
function loadWeather() {
  fetch('https://api.open-meteo.com/v1/forecast?latitude=40.80&longitude=-81.38&current=temperature_2m,weather_code&temperature_unit=fahrenheit')
    .then(r => r.json())
    .then(d => {
      const chip = document.getElementById('weather-chip');
      chip.textContent = `${Math.round(d.current.temperature_2m)}° and ${weatherWord(d.current.weather_code)} in Canton`;
      chip.hidden = false;
    })
    .catch(() => {});
}

/* ---------- ask the almanac ---------- */

function gardenSummary() {
  return state.beds.map(b => {
    const counts = {};
    for (const pl of b.plants) counts[pl.pid] = (counts[pl.pid] || 0) + 1;
    const list = Object.entries(counts).map(([pid, n]) => `${PLANT_BY_ID[pid]?.name || pid} ×${n}`).join(', ');
    return `- ${b.name} (${b.w}×${b.h} ft): ${list || 'empty'}`;
  }).join('\n');
}

function setupAsk() {
  const toggle = document.getElementById('ask-toggle');
  const panel = document.getElementById('ask-panel');
  const msgs = document.getElementById('ask-messages');
  const form = document.getElementById('ask-form');
  const input = document.getElementById('ask-input');

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    state.chat.push({ role: 'user', content: q });
    addMsg('user', q);
    const thinking = addMsg('bot thinking', 'leafing through the almanac…');

    const system = `You are the Almanac: a calm, knowledgeable companion inside GardenSync, a community garden planner for Food Not Bombs in Canton, Ohio (USDA Zone 6a; last frost Apr 18, first frost Oct 28). Today is ${fmtDoy(todayDoy())}; the user is viewing ${fmtDoy(state.viewDoy)}.

The garden right now:
${gardenSummary() || '(no beds yet)'}

Answer briefly and warmly, like a wise neighbor over the fence — practical advice, no lists unless asked, no exclamation marks. The harvest feeds neighbors in need; honor that quietly.`;

    fetch('/api/claude/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system,
        messages: state.chat.slice(-12),
      }),
    })
      .then(r => r.json())
      .then(d => {
        thinking.remove();
        const text = d?.content?.[0]?.text || d?.error?.message || 'The almanac is silent today.';
        state.chat.push({ role: 'assistant', content: text });
        addMsg('bot', text);
      })
      .catch(() => {
        thinking.remove();
        addMsg('bot', 'The almanac is offline. Run proxy.py with an Anthropic key in .env to wake it.');
      });
  });

  function addMsg(cls, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + cls;
    div.textContent = text;   // chat is always plain text — no markup injection
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }
}

/* ---------- boot ---------- */

function boot() {
  let fresh = false;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.beds)) state.beds = data.beds;
    }
  } catch (e) { /* corrupted save — start anew */ }

  if (!state.beds.length) {
    state.beds = TEMPLATES['fnb-easy']();
    fresh = true;
  }

  renderRibbon(); setupRibbon();
  renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote();
  setupTools(); setupAsk(); loadWeather();

  if (fresh) whisper('Welcome. The FNB Easy Start plan is laid out — drag the year above to watch it grow.', 5200);
}

boot();
