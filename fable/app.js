/* ============================================================
   GardenSync — A Quiet Almanac
   One state object, SVG plots, a scrubbable year.
   XSS note: every dynamic string that reaches markup is either
   static plant-library data or passed through escapeHtml();
   chat and other free text use textContent.
   ============================================================ */

'use strict';

/* ---------- calendar ---------- */

const MONTH_DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
const MONTH_CUM  = [0,31,59,90,120,151,181,212,243,273,304,334];
const MONTH_AB   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

/* ---------- geometry & plot kinds ---------- */

const CELL = 46;
const TYPE_FILL = { vegetable:'#DCE5CB', herb:'#E4E8CE', flower:'#F0DBD3', fruit:'#F3E4C0' };

/* Every plot is a grid of square feet; vessels are small grids with
   container rules (everything fits one square — roots make do). */
const KINDS = {
  bed:     { label:'raised bed',   shape:'rect',   vessel:false },
  pot:     { label:'terracotta pot', shape:'round', vessel:true, w:1, h:1 },
  treepot: { label:'tree pot',     shape:'round',  vessel:true, w:2, h:2 },
  barrel:  { label:'half barrel',  shape:'round',  vessel:true, w:2, h:2 },
  bag:     { label:'grow bag',     shape:'bag',    vessel:true, w:2, h:2 },
  window:  { label:'window box',   shape:'window', vessel:true, w:4, h:1 },
  trough:  { label:'steel trough', shape:'trough', vessel:true, w:6, h:2 },
};
const kindOf = bed => KINDS[bed.kind] || KINDS.bed;
const isVessel = bed => kindOf(bed).vessel;

function spanOf(p)  { return p.spacing <= 12 ? 1 : p.spacing <= 26 ? 2 : 3; }
function plantSpan(bed, p) { return isVessel(bed) ? 1 : spanOf(p); }
function perSquare(p) {
  if (p.spacing <= 3) return 16;
  if (p.spacing <= 4) return 9;
  if (p.spacing <= 6) return 4;
  return 1;
}
/* plants that resent life in a container */
function sulksInVessel(p) {
  return p.spacing >= 30 || /corn|pumpkin|watermelon|cantaloupe/.test(p.id);
}

/* svg geometry: vessels get chrome around the soil grid */
function geomOf(bed) {
  const W = bed.w * CELL, H = bed.h * CELL;
  const shape = kindOf(bed).shape;
  let ext = 0;
  if (shape === 'round') {
    const rIn = Math.sqrt((W/2)**2 + (H/2)**2) + 4;
    ext = Math.ceil(rIn + 10 - Math.max(W, H) / 2);
  }
  else if (shape === 'bag') ext = 14;
  else if (shape === 'window' || shape === 'trough') ext = 10;
  return { W, H, ext, svgW: W + ext*2, svgH: H + ext*2 };
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

/* ---------- yields (lbs per planting, rough field estimates) ---------- */

function yieldOf(p) {
  const id = p.id;
  if (/pumpkin/.test(id)) return 15;
  if (/tomato/.test(id)) return 11;
  if (/watermelon|cantaloupe|melon/.test(id)) return 10;
  if (/squash|zucchini/.test(id)) return 9;
  if (/cucumber/.test(id)) return 5;
  if (/pepper/.test(id)) return 4;
  if (/blueberry/.test(id)) return 4;
  if (/potato/.test(id)) return 2.5;
  if (/kale|chard|collard|cabbage|broccoli|cauliflower/.test(id)) return 2.5;
  if (/bean|pea/.test(id)) return 2;
  if (/carrot/.test(id)) return 1.6;
  if (/lettuce|spinach|arugula|greens/.test(id)) return 1.2;
  if (/beet|turnip|radish|kohlrabi/.test(id)) return 1.2;
  if (/onion|garlic|leek|shallot|corn|strawberry|eggplant/.test(id)) return 1;
  if (p.type === 'herb') return 0.4;
  if (p.type === 'flower') return 0;
  return 1.5;
}
const HARVEST_GOAL = 500;   // lbs — the FNB season goal

function harvestOutlook() {
  let total = 0;
  const byMonth = new Array(12).fill(0);
  for (const bed of state.beds) {
    const factor = isVessel(bed) ? 0.8 : 1;
    for (const pl of bed.plants) {
      const p = PLANT_BY_ID[pl.pid];
      if (!p) continue;
      const lbs = yieldOf(p) * factor;
      total += lbs;
      const w = windowsOf(p);
      const m0 = doyToMD(w.hStart).m, m1 = doyToMD(w.hEnd).m;
      const span = Math.max(1, m1 - m0 + 1);
      for (let m = m0; m <= m1; m++) byMonth[m] += lbs / span;
    }
  }
  return { total, byMonth };
}

/* ---------- state ---------- */

const LS_KEY = 'gardensync-almanac-v1';

const state = {
  beds: [],                 // {id, name, w, h, kind, notes, caretaker, plants:[{uid,pid,c,r}]}
  harvests: [],             // {date:'YYYY-MM-DD', pid, lbs} — what actually came in
  viewDoy: todayDoy(),
  armed: null,              // plant id from the drawer
  sel: null,                // {bedId, uid}
  search: '',
  undoStack: [],
  redoStack: [],
  openNotes: new Set(),     // bed ids with field notes open (not persisted)
  chat: [],
};

let uidCounter = 1;
const newUid = () => 'p' + (uidCounter++) + '-' + Math.random().toString(36).slice(2, 7);

function snapshot() { return JSON.stringify(state.beds); }
function pushUndo(snap) {
  state.undoStack.push(snap || snapshot());
  if (state.undoStack.length > 60) state.undoStack.shift();
  state.redoStack.length = 0;
}
function undo() {
  const prev = state.undoStack.pop();
  if (!prev) { whisper('Nothing to undo — the garden is as it was.'); return; }
  state.redoStack.push(snapshot());
  state.beds = JSON.parse(prev);
  state.sel = null;
  renderBeds(); renderAlmanac(); save();
}
function redo() {
  const next = state.redoStack.pop();
  if (!next) { whisper('Nothing to redo.'); return; }
  state.undoStack.push(snapshot());
  state.beds = JSON.parse(next);
  state.sel = null;
  renderBeds(); renderAlmanac(); save();
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ app:'gardensync-almanac', version:2, beds: state.beds, harvests: state.harvests })); }
    catch (e) { /* storage full or unavailable — the garden lives on in memory */ }
  }, 350);
}

/* ---------- occupancy & companions ---------- */

function bedById(id) { return state.beds.find(b => b.id === id); }

function cellsFree(bed, c, r, span, ignoreUid) {
  if (c < 0 || r < 0 || c + span > bed.w || r + span > bed.h) return false;
  for (const pl of bed.plants) {
    if (pl.uid === ignoreUid) continue;
    const s = plantSpan(bed, PLANT_BY_ID[pl.pid]);
    if (c < pl.c + s && pl.c < c + span && r < pl.r + s && pl.r < r + span) return false;
  }
  return true;
}

/* gap in feet between two footprints; 0 = touching/overlap, 1 = one square apart */
function footprintGap(bed, a, b) {
  const sa = plantSpan(bed, PLANT_BY_ID[a.pid]), sb = plantSpan(bed, PLANT_BY_ID[b.pid]);
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
      if (footprintGap(bed, bed.plants[i], bed.plants[j]) > 1) continue;
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

function makeBed(name, w, h, kind = 'bed') {
  const k = KINDS[kind];
  return {
    id: 'bed-' + Math.random().toString(36).slice(2, 8),
    name, kind,
    w: k.vessel ? k.w : w,
    h: k.vessel ? k.h : h,
    notes: '', caretaker: '',
    plants: [],
  };
}
function fillBed(bed, recipe) {
  const items = recipe
    .map(([pid, n]) => ({ p: PLANT_BY_ID[pid], n }))
    .filter(x => x.p)
    .sort((a, b) => plantSpan(bed, b.p) - plantSpan(bed, a.p));
  for (const { p, n } of items) {
    const span = plantSpan(bed, p);
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
    fillBed(makeBed('Spud Sack', 0, 0, 'bag'), [['potato',4]]),
    fillBed(makeBed('Blueberry Pot', 0, 0, 'treepot'), [['blueberry',1],['strawberry',3]]),
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
    ${state.pinHint ? `<circle class="pin-hint" cx="${vx}" cy="${RIB.bandY+RIB.bandH/2}" r="9" fill="none" stroke="#B5613D" stroke-width="2"/>` : ''}
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
  /* scrubbing re-renders every plot — coalesce to one render per frame */
  let raf = null, pendingX = 0;
  const move = e => {
    pendingX = e.clientX;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const rect = svg.getBoundingClientRect();
      const x = (pendingX - rect.left) / rect.width * RIB.W;
      state.viewDoy = xToDoy(x);
      renderRibbon(); renderBeds(); renderAlmanac();
    });
  };
  svg.addEventListener('pointerdown', e => { dragging = true; state.pinHint = false; svg.setPointerCapture(e.pointerId); move(e); });
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
  const present = new Set(state.beds.flatMap(b => b.plants.map(pl => pl.pid)));
  let html = '';
  for (const type of TYPE_ORDER) {
    const items = PLANTS.filter(p => p.type === type && (!q || p.name.toLowerCase().includes(q)));
    if (!items.length) continue;
    html += `<div class="drawer-group-title">${TYPE_LABEL[type]}</div>`;
    for (const p of items) {
      html += `<button class="packet ${state.armed === p.id ? 'armed' : ''}" data-pid="${p.id}" data-type="${p.type}">
        <span class="pk-emoji">${p.emoji}</span>
        <span><span class="pk-name">${escapeHtml(p.name)}${present.has(p.id) ? '<span class="pk-here" title="already growing in your garden"></span>' : ''}</span><br><span class="pk-meta">${packetMeta(p)}</span></span>
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

/* ---------- plot chrome (the vessel around the soil) ---------- */

function chromeSvg(bed) {
  const { W, H, ext, svgW, svgH } = geomOf(bed);
  const shape = kindOf(bed).shape;
  const cx = svgW / 2, cy = svgH / 2;

  if (shape === 'round') {
    const rIn = Math.sqrt((W/2)**2 + (H/2)**2) + 4;
    const rOut = rIn + 9;
    const tones = bed.kind === 'barrel'
      ? { body:'#8B6748', edge:'#6E4F35', band:'#5B544C' }
      : bed.kind === 'treepot'
        ? { body:'#7E8E6F', edge:'#5F7053', band:null }
        : { body:'#C97B54', edge:'#A95F3D', band:null };
    let s = `<circle cx="${cx}" cy="${cy}" r="${rOut}" fill="${tones.body}" stroke="${tones.edge}" stroke-width="2"/>`;
    if (bed.kind === 'barrel') {
      for (let a = 0; a < 12; a++) {
        const ang = a * Math.PI / 6;
        s += `<line x1="${cx + Math.cos(ang)*rIn}" y1="${cy + Math.sin(ang)*rIn}" x2="${cx + Math.cos(ang)*rOut}" y2="${cy + Math.sin(ang)*rOut}" stroke="${tones.edge}" stroke-width="1" stroke-opacity=".55"/>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="${rOut-2.5}" fill="none" stroke="${tones.band}" stroke-width="1.6" stroke-opacity=".7"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${rIn}" fill="url(#soil-${bed.id})"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${rIn-1.5}" fill="none" stroke="#FFFFFF" stroke-opacity=".18" stroke-width="1.5"/>`;
    return s;
  }

  if (shape === 'bag') {
    let s = `<rect x="2" y="2" width="${svgW-4}" height="${svgH-4}" rx="26" fill="#6F675C" stroke="#575047" stroke-width="2"/>`;
    s += `<rect x="7" y="7" width="${svgW-14}" height="${svgH-14}" rx="21" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="4 5"/>`;
    s += `<rect x="${ext}" y="${ext}" width="${W}" height="${H}" rx="14" fill="url(#soil-${bed.id})"/>`;
    return s;
  }

  if (shape === 'window') {
    let s = `<rect x="1.5" y="1.5" width="${svgW-3}" height="${svgH-3}" rx="8" fill="#D9D3BF" stroke="#B9B098" stroke-width="2"/>`;
    s += `<rect x="${ext}" y="${ext}" width="${W}" height="${H}" rx="6" fill="url(#soil-${bed.id})"/>`;
    return s;
  }

  if (shape === 'trough') {
    let s = `<rect x="1.5" y="1.5" width="${svgW-3}" height="${svgH-3}" rx="12" fill="#C2C8CC" stroke="#9AA2A8" stroke-width="2"/>`;
    for (let i = 1; i < bed.w; i++)
      s += `<line x1="${ext + i*CELL}" y1="4" x2="${ext + i*CELL}" y2="${svgH-4}" stroke="#9AA2A8" stroke-width="1" stroke-opacity=".4"/>`;
    s += `<rect x="${ext}" y="${ext}" width="${W}" height="${H}" rx="8" fill="url(#soil-${bed.id})"/>`;
    return s;
  }

  /* plain raised bed */
  let s = `<rect x="0" y="0" width="${W}" height="${H}" rx="18" fill="url(#soil-${bed.id})"/>`;
  s += `<rect x="3" y="3" width="${W-6}" height="${H-6}" rx="15" fill="none" stroke="#FFFFFF" stroke-opacity=".25" stroke-width="1.5"/>`;
  return s;
}

/* ---------- plot rendering ---------- */

function chipCenter(bed, pl) {
  const { ext } = geomOf(bed);
  const span = plantSpan(bed, PLANT_BY_ID[pl.pid]);
  return { x: ext + (pl.c + span / 2) * CELL, y: ext + (pl.r + span / 2) * CELL };
}

function chipSvg(bed, pl) {
  const p = PLANT_BY_ID[pl.pid];
  if (!p) return '';
  const span = plantSpan(bed, p);
  const { x, y } = chipCenter(bed, pl);
  const stage = stageAt(p, state.viewDoy);
  const baseR = (span * CELL) / 2 - 6;
  const R = Math.max(8, baseR * STAGE_SCALE[stage]);
  const fill = TYPE_FILL[p.type] || TYPE_FILL.vegetable;
  const selected = state.sel && state.sel.uid === pl.uid;
  const per = span === 1 ? perSquare(p) : 1;
  const fontSize = Math.max(11, R * 1.05);
  const stageWord = { planned:'planned', sprout:'sprouting', growing:'growing', harvest:'ready to harvest', rest:'done for the year' }[stage];

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
    <title>${escapeHtml(p.name)} — ${stageWord}</title>
    ${halo}<g class="swayer" ${sway}>${body}</g>
  </g>`;
}

function arcsSvg(bed) {
  if (!state.sel || state.sel.bedId !== bed.id) return '';
  const selPl = bed.plants.find(pl => pl.uid === state.sel.uid);
  if (!selPl) return '';
  const a = chipCenter(bed, selPl);
  let s = '';
  for (const other of bed.plants) {
    if (other.uid === selPl.uid || footprintGap(bed, selPl, other) > 1) continue;
    const rel = relation(selPl.pid, other.pid);
    if (rel === 'neutral') continue;
    const b = chipCenter(bed, other);
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
    const { W, H, ext, svgW, svgH } = geomOf(bed);
    const mood = bedMood(bed);
    const kindLabel = isVessel(bed) ? ` · ${kindOf(bed).label}` : '';
    let dots = '';
    for (let c = 1; c < bed.w; c++) for (let r = 1; r < bed.h; r++)
      dots += `<circle cx="${ext + c*CELL}" cy="${ext + r*CELL}" r="1.4" fill="#2C3527" fill-opacity=".14"/>`;
    const noteOpen = state.openNotes.has(bed.id);
    const hasNote = (bed.notes || '').trim() || (bed.caretaker || '').trim();
    html += `<div class="bed-card" data-bed="${bed.id}">
      <div class="bed-head">
        <h3 class="bed-name" contenteditable="true" spellcheck="false">${escapeHtml(bed.name)}</h3>
        <span class="bed-mood ${mood.cls}"><span class="dot"></span>${mood.label}${kindLabel}</span>
        <button class="bed-note-btn ${hasNote ? 'has-note' : ''}" title="Field notes & caretaker">✎</button>
        <button class="bed-del" title="Remove this plot">×</button>
      </div>
      <svg class="bed-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" data-bed="${bed.id}">
        <defs>
          <linearGradient id="soil-${bed.id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#BCA481"/><stop offset="1" stop-color="#A98F6B"/>
          </linearGradient>
        </defs>
        ${chromeSvg(bed)}
        ${dots}
        <g class="ghost-layer"></g>
        ${bed.plants.map(pl => chipSvg(bed, pl)).join('')}
        <g class="arc-layer">${arcsSvg(bed)}</g>
      </svg>
      <div class="bed-note" ${noteOpen ? '' : 'hidden'}>
        <label class="bn-caretaker">tended by
          <input type="text" class="bn-caretaker-input" placeholder="anyone yet?" value="${escapeHtml(bed.caretaker || '')}">
        </label>
        <textarea class="bn-notes" placeholder="field notes — what was planted when, what the soil wants, what worked…">${escapeHtml(bed.notes || '')}</textarea>
      </div>
      ${!noteOpen && (bed.caretaker || '').trim() ? `<p class="bed-tended">tended by ${escapeHtml(bed.caretaker)}</p>` : ''}
    </div>`;
  }
  wrap.innerHTML = html;
  wireBeds();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- plot interaction ---------- */

function svgCell(svg, bed, e) {
  const { ext } = geomOf(bed);
  const rect = svg.getBoundingClientRect();
  const { svgW } = geomOf(bed);
  const scale = rect.width / svgW;
  const x = (e.clientX - rect.left) / scale - ext;
  const y = (e.clientY - rect.top) / scale - ext;
  return { c: Math.floor(x / CELL), r: Math.floor(y / CELL) };
}

let drag = null; // {bedId, uid, startX, startY, moved, snap}

function wireBeds() {
  document.querySelectorAll('.bed-card').forEach(card => {
    const bedId = card.dataset.bed;
    const bed = bedById(bedId);
    const svg = card.querySelector('.bed-svg');
    const ghost = svg.querySelector('.ghost-layer');
    const { ext } = geomOf(bed);

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

    /* field notes & caretaker */
    card.querySelector('.bed-note-btn').addEventListener('click', () => {
      if (state.openNotes.has(bedId)) state.openNotes.delete(bedId);
      else state.openNotes.add(bedId);
      renderBeds();
    });
    const noteEl = card.querySelector('.bn-notes');
    const careEl = card.querySelector('.bn-caretaker-input');
    let noteSnap = null;
    for (const el of [noteEl, careEl]) {
      el.addEventListener('focus', () => { noteSnap = snapshot(); });
      el.addEventListener('blur', () => {
        const notes = noteEl.value, caretaker = careEl.value.trim();
        if (notes !== (bed.notes || '') || caretaker !== (bed.caretaker || '')) {
          pushUndo(noteSnap);
          bed.notes = notes; bed.caretaker = caretaker;
          save();
        }
      });
    }

    /* delete plot */
    card.querySelector('.bed-del').addEventListener('click', () => {
      pushUndo();
      state.beds = state.beds.filter(b => b.id !== bedId);
      if (state.sel && state.sel.bedId === bedId) state.sel = null;
      renderBeds(); renderAlmanac(); save();
      whisper(`${bed.name} returned to the shed. Ctrl+Z to undo.`);
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
      const span = plantSpan(bed, p);
      let { c, r } = svgCell(svg, bed, e);
      c = Math.min(Math.max(0, c - Math.floor(span / 2)), bed.w - span);
      r = Math.min(Math.max(0, r - Math.floor(span / 2)), bed.h - span);
      const ok = cellsFree(bed, c, r, span, drag ? drag.uid : null);
      const col = ok ? '#5E7350' : '#B5613D';
      ghost.innerHTML = `
        <rect x="${ext + c*CELL+3}" y="${ext + r*CELL+3}" width="${span*CELL-6}" height="${span*CELL-6}" rx="10"
          fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 4"/>
        <text x="${ext + (c+span/2)*CELL}" y="${ext + (r+span/2)*CELL}" font-size="${span*16}" text-anchor="middle"
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
        const p = PLANT_BY_ID[state.armed];
        renderBeds(); renderAlmanac(); save();
        const justEl = document.querySelector(`.chip[data-uid="${uid}"]`);
        if (justEl) justEl.classList.add('just-planted');
        if (isVessel(bed) && sulksInVessel(p))
          whisper(`${p.name} really wants open ground — it may sulk in a ${kindOf(bed).label}.`, 4200);
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

    /* quick direct-sown vegetables with short harvest windows earn succession
       rounds while they can still mature; long producers (kale, chard) don't need them */
    if (p.directSow != null && p.type === 'vegetable' && p.daysToHarvest <= 55 && (p.harvestWeeks || 9) <= 6) {
      for (let round = 1; round <= 3; round++) {
        const doy = w.inBed + round * 21;
        if (doy + p.daysToHarvest > FIRST_FROST + 7) break;
        events.push({ doy, kind:'sow', text:`Sow another round of ${p.name}`, emoji: p.emoji });
      }
    }
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

function outlookSvg(byMonth) {
  const W = 264, H = 46, pad = 2;
  const max = Math.max(1, ...byMonth);
  const bw = (W - pad * 2) / 12;
  let s = `<svg viewBox="0 0 ${W} ${H}">`;
  for (let m = 0; m < 12; m++) {
    const h = Math.round(byMonth[m] / max * 28);
    const x = pad + m * bw;
    if (h > 0)
      s += `<rect x="${x + 2}" y="${34 - h}" width="${bw - 4}" height="${h}" rx="2.5" fill="#C09A2C" fill-opacity=".8"/>`;
    s += `<text x="${x + bw/2}" y="${H - 2}" text-anchor="middle" font-size="6.5" fill="#8B927E" font-family="Karla,sans-serif" font-weight="700">${MONTH_AB[m][0]}</text>`;
  }
  return s + '</svg>';
}

function renderAlmanac() {
  const el = document.getElementById('almanac-body');
  const pid = state.armed || (state.sel && bedById(state.sel.bedId)?.plants.find(pl => pl.uid === state.sel.uid)?.pid);
  if (pid) { el.innerHTML = plantPage(pid); wireAlmanac(el); return; }

  /* the garden today */
  const plantings = state.beds.reduce((n, b) => n + b.plants.length, 0);
  const varieties = new Set(state.beds.flatMap(b => b.plants.map(pl => pl.pid))).size;
  const sqUsed = state.beds.reduce((n, b) => n + b.plants.reduce((m, pl) => m + plantSpan(b, PLANT_BY_ID[pl.pid]) ** 2, 0), 0);
  const sqTotal = state.beds.reduce((n, b) => n + b.w * b.h, 0);
  const tasks = tasksNear(state.viewDoy);
  const t = todayDoy();
  const { total, byMonth } = harvestOutlook();
  const lbs = Math.round(total);
  const bags = Math.round(total / 10);
  const pct = Math.min(100, Math.round(total / HARVEST_GOAL * 100));
  const picked = Math.round(state.harvests.reduce((n, h) => n + (+h.lbs || 0), 0) * 10) / 10;
  const pickedPct = Math.min(100, Math.round(picked / HARVEST_GOAL * 100));

  el.innerHTML = `
    <h2>The garden on ${fmtDoy(state.viewDoy)}</h2>
    <p class="alm-sub">${Math.round(state.viewDoy)===t ? 'as it stands today' : 'as the almanac imagines it'}</p>
    <div class="alm-stats">
      <div class="alm-stat"><div class="n">${state.beds.length}</div><div class="l">plots</div></div>
      <div class="alm-stat"><div class="n">${plantings}</div><div class="l">plantings</div></div>
      <div class="alm-stat"><div class="n">${varieties}</div><div class="l">varieties</div></div>
      <div class="alm-stat"><div class="n">${sqTotal ? Math.round(sqUsed / sqTotal * 100) : 0}%</div><div class="l">soil in use</div></div>
    </div>
    ${(() => {
      const ready = {};
      for (const b of state.beds) for (const pl of b.plants) {
        const p = PLANT_BY_ID[pl.pid];
        if (p && stageAt(p, state.viewDoy) === 'harvest') ready[p.id] = (ready[p.id] || 0) + 1;
      }
      const names = Object.entries(ready).map(([id, n]) => `${PLANT_BY_ID[id].emoji} ${escapeHtml(PLANT_BY_ID[id].name)}${n > 1 ? ' ×' + n : ''}`);
      return names.length
        ? `<p class="ready-line">Ready to pick: ${names.slice(0, 6).join(' · ')}${names.length > 6 ? ' · …' : ''}</p>`
        : '';
    })()}
    <div class="alm-section">harvest outlook</div>
    <p class="plant-notes" style="margin:4px 0 6px">
      ${picked > 0 ? `<strong>${picked} lbs</strong> brought in so far · ` : ''}≈ <strong>${lbs} lbs</strong> expected this season — about <strong>${bags} grocery bags</strong> for neighbors.
    </p>
    <div class="goal-bar" title="${picked} lbs picked, ≈${lbs} lbs projected, of the ${HARVEST_GOAL} lb goal">
      <div class="goal-fill proj" style="width:${pct}%"></div>
      <div class="goal-fill" style="width:${pickedPct}%"></div>
      <span class="goal-label">${picked > 0 ? `${pickedPct}% picked · ` : ''}${pct}% of ${HARVEST_GOAL} lbs in sight</span>
    </div>
    <div class="year-strip">${outlookSvg(byMonth)}</div>
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
  let vesselNote = '';
  if (planted) {
    const bed = bedById(state.sel.bedId);
    const selPl = bed?.plants.find(x => x.uid === state.sel.uid);
    if (selPl) {
      let f = 0, e = 0;
      for (const o of bed.plants) {
        if (o.uid === selPl.uid || footprintGap(bed, selPl, o) > 1) continue;
        const rel = relation(selPl.pid, o.pid);
        if (rel === 'friend') f++; else if (rel === 'foe') e++;
      }
      neighborNote = e > 0
        ? `<p class="plant-notes">⚠ <strong>${e} unhappy neighbor${e>1?'s':''}</strong> nearby — consider a gentle move.</p>`
        : f > 0 ? `<p class="plant-notes">☺ ${f} good neighbor${f>1?'s':''} within reach. This plant is content.</p>` : '';
      if (isVessel(bed)) {
        vesselNote = sulksInVessel(p)
          ? `<p class="plant-notes">🪴 Living in a ${kindOf(bed).label} — honestly, it would rather have open ground. Expect a modest crop.</p>`
          : `<p class="plant-notes">🪴 Living in a ${kindOf(bed).label} — water more often than the beds, feed it every few weeks, and it will do fine.</p>`;
      }
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
      ${yieldOf(p) > 0 ? `<span class="fact">⚖ ≈${yieldOf(p)} lb each</span>` : ''}
      ${p.lowMaintenance ? '<span class="fact">🌿 easygoing</span>' : ''}
    </div>
    <div class="year-strip">${yearStrip(p)}</div>
    <p class="plant-notes" style="font-size:11px;color:var(--ink-faint);margin-top:0">
      ${p.directSow != null ? `sow ${fmtDoy(w.inBed)}` : `transplant ${fmtDoy(w.inBed)}`}
      · harvest ${fmtDoy(w.hStart)}–${fmtDoy(w.hEnd)}
      ${w.indoor != null ? `· start indoors ${fmtDoy(w.indoor)}` : ''}
    </p>
    ${neighborNote}
    ${vesselNote}
    <p class="plant-notes">${escapeHtml(p.notes || '')}</p>
    <div class="alm-section">grows well beside</div>
    ${mates(p.companions, false)}
    <div class="alm-section">keep away from</div>
    ${mates(p.enemies, true)}
    <details class="howto"><summary>Seed starting</summary><p>${escapeHtml(p.seedStart || '—')}</p></details>
    <details class="howto"><summary>Care through the season</summary><p>${escapeHtml(p.care || '—')}</p></details>
    ${planted ? (() => {
      const sum = Math.round(state.harvests.filter(h => h.pid === p.id).reduce((n, h) => n + (+h.lbs || 0), 0) * 10) / 10;
      return `<div class="alm-section">harvest log</div>
      <form class="log-form" id="log-form">
        <input type="number" min="0" step="0.5" inputmode="decimal" placeholder="lbs" id="log-lbs" required>
        <button type="submit">Log a pick</button>
      </form>
      ${sum > 0 ? `<p class="plant-notes" style="font-size:12px;margin-top:6px">${sum} lbs of ${escapeHtml(p.name)} brought in so far this season.</p>` : ''}`;
    })() : ''}
    <div class="alm-actions">
      ${planted
        ? `<button class="alm-btn danger" id="alm-remove">Remove plant</button>
           <button class="alm-btn" id="alm-close">Done</button>`
        : `<button class="alm-btn" id="alm-close">Put packet back</button>`}
    </div>`;
}

function wireAlmanac(el) {
  el.querySelector('#alm-close')?.addEventListener('click', disarm);
  el.querySelector('#log-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const lbs = +el.querySelector('#log-lbs').value;
    if (!(lbs > 0)) return;
    const pid = bedById(state.sel.bedId)?.plants.find(pl => pl.uid === state.sel.uid)?.pid;
    if (!pid) return;
    state.harvests.push({ date: new Date().toISOString().slice(0, 10), pid, lbs });
    save(); renderAlmanac();
    whisper(`${lbs} lbs of ${PLANT_BY_ID[pid].name} toward the table. Well picked.`);
  });
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

/* ---------- sharing: compact garden ↔ URL hash ---------- */

function encodeGarden() {
  const compact = state.beds.map(b => [
    b.name, b.kind || 'bed', b.w, b.h, b.caretaker || '',
    b.plants.map(pl => [pl.pid, pl.c, pl.r]),
  ]);
  const json = JSON.stringify(compact);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeGarden(s) {
  const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const compact = JSON.parse(json);
  if (!Array.isArray(compact)) throw new Error('shape');
  return compact.map(([name, kind, w, h, caretaker, plants]) => ({
    id: 'bed-' + Math.random().toString(36).slice(2, 8),
    name: String(name).slice(0, 80),
    kind: KINDS[kind] ? kind : 'bed',
    w: Math.max(1, Math.min(20, +w || 4)), h: Math.max(1, Math.min(20, +h || 4)),
    caretaker: String(caretaker || '').slice(0, 60), notes: '',
    plants: (plants || []).filter(x => PLANT_BY_ID[x[0]]).map(([pid, c, r]) => ({
      uid: newUid(), pid, c: +c || 0, r: +r || 0,
    })),
  }));
}

function copyShareLink() {
  const url = location.origin + location.pathname + '#g=' + encodeGarden();
  navigator.clipboard.writeText(url)
    .then(() => whisper('Share link copied — anyone who opens it sees this garden.'))
    .catch(() => { prompt('Copy this link:', url); });
}

/* ---------- a picture of the garden (PNG) ---------- */

function savePoster() {
  const sel = state.sel; state.sel = null;
  const armed = state.armed; state.armed = null;
  renderBeds();   // clean svgs: no selection rings, no halos

  const PADX = 48, GAP = 34, TITLE_H = 120;
  const items = state.beds.map(bed => {
    const g = geomOf(bed);
    const svgEl = document.querySelector(`.bed-svg[data-bed="${bed.id}"]`);
    return { bed, g, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svgEl)) };
  });
  const maxW = Math.max(420, ...items.map(i => i.g.svgW));
  const totalH = TITLE_H + items.reduce((n, i) => n + i.g.svgH + 30 + GAP, 0) + 30;
  const canvas = document.createElement('canvas');
  const SCALE = 2;
  canvas.width = (maxW + PADX * 2) * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // paper
  ctx.fillStyle = '#F5EFDF';
  ctx.fillRect(0, 0, maxW + PADX * 2, totalH);

  // masthead
  const { total } = harvestOutlook();
  ctx.fillStyle = '#2C3527';
  ctx.font = '600 30px Fraunces, Georgia, serif';
  ctx.fillText('GardenSync', PADX, 52);
  ctx.font = 'italic 14px Fraunces, Georgia, serif';
  ctx.fillStyle = '#5C6553';
  ctx.fillText(`Food Not Bombs · Canton, Ohio · Zone 6a · pressed ${fmtDoy(todayDoy())}`, PADX, 76);
  ctx.fillText(`${state.beds.length} plots · ≈${Math.round(total)} lbs for neighbors this season`, PADX, 96);

  const imgs = items.map(i => new Promise(res => {
    const img = new Image();
    img.onload = () => res({ ...i, img });
    img.onerror = () => res(null);
    img.src = i.src;
  }));

  Promise.all(imgs).then(loaded => {
    let y = TITLE_H;
    for (const it of loaded.filter(Boolean)) {
      ctx.fillStyle = '#2C3527';
      ctx.font = 'italic 600 17px Fraunces, Georgia, serif';
      ctx.fillText(it.bed.name, PADX + 2, y + 14);
      if (it.bed.caretaker) {
        ctx.font = 'italic 12px Fraunces, Georgia, serif';
        ctx.fillStyle = '#8B927E';
        ctx.fillText('tended by ' + it.bed.caretaker, PADX + 2 + ctx.measureText(it.bed.name).width + 70, y + 14);
      }
      ctx.drawImage(it.img, PADX, y + 24, it.g.svgW, it.g.svgH);
      y += it.g.svgH + 30 + GAP;
    }
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gardensync-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      whisper('A picture of the garden, pressed and saved.');
      state.sel = sel; state.armed = armed;
      renderBeds(); renderDrawer(); renderPlantingNote();
    }, 'image/png');
  });
}

/* ---------- the year calendar overlay ---------- */

function openCalendar() {
  const overlay = document.getElementById('calendar-overlay');
  const grid = document.getElementById('calendar-months');
  const events = gardenEvents();
  const { total } = harvestOutlook();
  document.getElementById('calendar-sub').textContent =
    `Food Not Bombs · Canton, Ohio · Zone 6a · ${state.beds.length} plots · ≈${Math.round(total)} lbs projected`;

  let html = '';
  for (let m = 0; m < 12; m++) {
    const inMonth = events.filter(e => doyToMD(e.doy).m === m);
    html += `<div class="cal-month">
      <h3>${MONTH_FULL[m]}</h3>
      ${inMonth.length ? inMonth.map(e => `
        <div class="task k-${e.kind}">
          <span class="t-date">${fmtDoy(e.doy)}</span><span class="t-dot"></span>
          <span class="t-text">${e.emoji} ${e.text}</span>
        </div>`).join('')
        : '<p class="calm-empty">rest.</p>'}
    </div>`;
  }
  grid.innerHTML = html;
  overlay.hidden = false;
}

/* ---------- header tools ---------- */

function setupTools() {
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  /* plans menu */
  const menu = document.getElementById('plans-menu');
  document.getElementById('btn-plans').addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', () => { menu.hidden = true; });
  document.getElementById('menu-share').addEventListener('click', copyShareLink);
  document.getElementById('menu-poster').addEventListener('click', savePoster);
  menu.querySelectorAll('button[data-plan]').forEach(b => b.addEventListener('click', () => {
    pushUndo();
    state.beds = TEMPLATES[b.dataset.plan]();
    state.sel = null; state.armed = null;
    renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote(); save();
    whisper(b.dataset.plan === 'fnb-easy'
      ? 'The FNB Easy Start plan is laid out — five beds, a spud sack, and a blueberry pot.'
      : 'Three blank beds, raked smooth.');
  }));

  /* calendar */
  document.getElementById('btn-calendar').addEventListener('click', openCalendar);
  document.getElementById('btn-close-calendar').addEventListener('click', () => {
    document.getElementById('calendar-overlay').hidden = true;
  });
  document.getElementById('btn-print-calendar').addEventListener('click', () => window.print());

  /* help */
  document.getElementById('btn-help').addEventListener('click', () => {
    document.getElementById('help-overlay').hidden = false;
  });
  document.getElementById('btn-close-help').addEventListener('click', () => {
    document.getElementById('help-overlay').hidden = true;
  });

  /* export */
  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app:'gardensync-almanac', version:2, exported:new Date().toISOString(), beds: state.beds, harvests: state.harvests }, null, 2)], { type:'application/json' });
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
      state.beds = migrateBeds(data.beds);
      if (Array.isArray(data.harvests)) state.harvests = data.harvests;
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

  /* add plot */
  document.querySelectorAll('.add-plot').forEach(b => b.addEventListener('click', () => {
    const kind = b.dataset.kind;
    pushUndo();
    if (kind === 'bed') {
      const [w, h] = b.dataset.size.split('x').map(Number);
      state.beds.push(makeBed('New bed', w, h));
    } else {
      state.beds.push(makeBed('New ' + KINDS[kind].label, 0, 0, kind));
    }
    renderBeds(); renderAlmanac(); save();
  }));

  /* keys */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const cal = document.getElementById('calendar-overlay');
      const help = document.getElementById('help-overlay');
      if (!cal.hidden) { cal.hidden = true; return; }
      if (!help.hidden) { help.hidden = true; return; }
    }
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
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
  });
}

/* ---------- weather & frost watch ---------- */

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
  fetch('https://api.open-meteo.com/v1/forecast?latitude=40.80&longitude=-81.38&current=temperature_2m,weather_code&daily=temperature_2m_min&forecast_days=7&temperature_unit=fahrenheit&timezone=America%2FNew_York')
    .then(r => r.json())
    .then(d => {
      const chip = document.getElementById('weather-chip');
      chip.textContent = `${Math.round(d.current.temperature_2m)}° and ${weatherWord(d.current.weather_code)} in Canton`;
      chip.hidden = false;

      /* frost watch: a cold night coming during the growing season */
      const mins = d.daily?.temperature_2m_min || [];
      const days = d.daily?.time || [];
      const month = new Date().getMonth();
      if (month >= 2 && month <= 10) {
        for (let i = 0; i < mins.length; i++) {
          if (mins[i] <= 36) {
            const night = new Date(days[i] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
            chip.textContent += ` · ❄ ${Math.round(mins[i])}° ${night} night`;
            chip.classList.add('frosty');
            whisper(`Frost watch — down to ${Math.round(mins[i])}° ${night} night. Blanket the tender ones.`, 6000);
            break;
          }
        }
      }
    })
    .catch(() => {});
}

/* ---------- ask the almanac ---------- */

function gardenSummary() {
  return state.beds.map(b => {
    const counts = {};
    for (const pl of b.plants) counts[pl.pid] = (counts[pl.pid] || 0) + 1;
    const list = Object.entries(counts).map(([pid, n]) => `${PLANT_BY_ID[pid]?.name || pid} ×${n}`).join(', ');
    const kind = isVessel(b) ? kindOf(b).label : `${b.w}×${b.h} ft bed`;
    return `- ${b.name} (${kind}${b.caretaker ? ', tended by ' + b.caretaker : ''}): ${list || 'empty'}`;
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

function migrateBeds(beds) {
  for (const b of beds) {
    if (!b.kind) b.kind = 'bed';
    if (b.notes == null) b.notes = '';
    if (b.caretaker == null) b.caretaker = '';
  }
  return beds;
}

function boot() {
  let fresh = false, shared = false;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.beds)) state.beds = migrateBeds(data.beds);
      if (Array.isArray(data.harvests)) state.harvests = data.harvests;
    }
  } catch (e) { /* corrupted save — start anew */ }

  /* a shared garden arriving by link */
  if (location.hash.startsWith('#g=')) {
    try {
      const beds = decodeGarden(location.hash.slice(3));
      if (beds.length) {
        if (state.beds.length) pushUndo();   // the old garden is one Ctrl+Z away
        state.beds = beds;
        shared = true;
      }
    } catch (e) { /* not a garden — ignore quietly */ }
    history.replaceState(null, '', location.pathname);
  }

  if (!state.beds.length) {
    state.beds = TEMPLATES['fnb-easy']();
    fresh = true;
  }
  state.pinHint = fresh || shared;

  renderRibbon(); setupRibbon();
  renderDrawer(); renderBeds(); renderAlmanac(); renderPlantingNote();
  setupTools(); setupAsk(); loadWeather();

  if (shared) whisper('A shared garden, unfolded and laid out. Your old one is a Ctrl+Z away.', 5200);
  else if (fresh) whisper('Welcome. The FNB Easy Start plan is laid out — drag the year above to watch it grow.', 5200);
}

boot();
