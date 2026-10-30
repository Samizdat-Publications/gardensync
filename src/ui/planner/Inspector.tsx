// The inspector: details and actions for the selected planting, bed or pot (Main.dc.html, right).
// Every date comes from the schedule with its plain reason (ledger 4); every size goes through the
// gardener's units (ledger 8). Every change is one op, so it can be undone.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { toIso, type DayNum } from '../../domain/dates';
import type { Container, Planting } from '../../domain/doc/schema';
import { intervalsOverlap } from '../../domain/layout/occupancy';
import { cellsOverlap } from '../../domain/layout/patch';
import { COMPANIONS } from '../../domain/plants/library';
import type { Plant } from '../../domain/plants/schema';
import { reasonText, type PlantingPhases, type Reason } from '../../domain/schedule';
import { formatLength, formatVolume, formatWeight } from '../../domain/units';
import { garden, newId, today, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay, fmtRange, inSentence } from '../format';
import { selection, shownDay } from '../uiState';
import { intervalOfP, phasesOfP, plantLookup, plantingsByContainer, present, rotation } from './derived';
import { cellsName, cellsNear } from './geometry';
import { fromLitres, readLength, readWeight, sentence, toLitres, volumeUnit } from './measure';
import { act, selectContainer, selectPlanting } from './plannerState';
import { pastVerbOf, verbOf, windowWords } from './placement';

const KIND_WORDS: Record<Container['kind'], string> = {
  'raised-bed': 'Raised bed',
  'in-ground': 'In-ground bed',
  planter: 'Planter',
  'window-box': 'Window box',
  trough: 'Trough',
  pot: 'Pot',
  'grow-bag': 'Grow bag',
  bucket: 'Bucket',
  tower: 'Tower',
};
export { KIND_WORDS };

const BED_IN_CODES = new Set<Reason['code']>([
  'frost-offset',
  'held-to-lf90',
  'soil-warm',
  'early-for-heat',
  'heat-trimmed',
  'fall-count-back',
  'fall-heat-set',
  'after-spring',
  'overwinter-plant',
  'temp-range',
  'frost-span-avoided',
  'warmest-weeks',
  'succession',
  'succession-gap',
  'season-long',
  'pre-chill',
]);
const INDOOR_CODES = new Set<Reason['code']>(['indoor-start', 'harden-off']);

type Step = { key: string; title: string; detail: string[]; state: 'done' | 'now' | 'later'; caution?: boolean };

function stateOf(a: DayNum, b: DayNum | null, day: DayNum, done: boolean): Step['state'] {
  if (done) return 'done';
  if (day >= a && (b === null || day <= b)) return 'now';
  return day > (b ?? a) ? 'done' : 'later';
}

/** The planting's phases as a list of steps, each with the reason for its date. */
export function phaseSteps(p: Planting, plant: Plant, ph: PlantingPhases, day: DayNum): Step[] {
  const steps: Step[] = [];
  const w = ph.window;
  if (ph.indoor) {
    steps.push({
      key: 'indoor',
      title: ph.actual.indoor ? `Started indoors ${fmtDay(ph.indoor.start)}` : `Start seeds indoors ${fmtRange(ph.indoor.start, ph.indoor.end)}`,
      detail: (w?.reasons ?? []).filter((r) => INDOOR_CODES.has(r.code)).map((r) => sentence(reasonText(r, units.value))),
      state: stateOf(ph.indoor.start, ph.indoor.end, day, ph.actual.indoor),
    });
  }
  const inDetail: string[] = [];
  if (ph.actual.bedIn) {
    inDetail.push(`You marked it ${pastVerbOf(p.method).toLowerCase()}.`);
    if (w) inDetail.push(`The plan said ${fmtRange(w.bedIn.start, w.bedIn.end)}.`);
  } else if (p.anchor.kind === 'pinned') {
    inDetail.push(sentence(reasonText({ code: 'pinned-date', day: ph.bedIn }, units.value)));
  } else if (w) {
    if (ph.bedIn > w.bedIn.end) {
      inDetail.push(sentence(reasonText({ code: 'late-planting', usualEnd: w.bedIn.end }, units.value)));
    } else {
      inDetail.push(`In its ${windowWords({ kind: w.kind, nextSeason: false, anchor: p.anchor })}, ${fmtRange(w.bedIn.start, w.bedIn.end)}.`);
      for (const r of w.reasons) if (BED_IN_CODES.has(r.code)) inDetail.push(sentence(reasonText(r, units.value)));
    }
    if (p.anchor.offsetDays !== 0 && ph.bedIn <= w.bedIn.end) {
      const n = Math.abs(p.anchor.offsetDays);
      inDetail.push(`Going in ${n} ${n === 1 ? 'day' : 'days'} ${p.anchor.offsetDays > 0 ? 'after the window opens' : 'before the window opens'}.`);
    }
  }
  steps.push({
    key: 'in',
    title: `${ph.actual.bedIn ? pastVerbOf(p.method) : verbOf(p.method)} ${fmtDay(ph.bedIn)}${p.method === 'direct' ? ', straight in the bed' : ''}`,
    detail: inDetail,
    state: stateOf(ph.bedIn, ph.bedIn, day, ph.actual.bedIn),
  });
  if (ph.harvest) {
    const det: string[] = [];
    const mat = w?.reasons.find((r) => r.code === 'maturity');
    if (mat) det.push(sentence(reasonText(mat, units.value)));
    if (ph.harvestUntil) det.push(sentence(reasonText(ph.harvestUntil, units.value)));
    steps.push({ key: 'pick', title: `Pick ${fmtRange(ph.harvest.start, ph.harvest.end)}`, detail: det, state: stateOf(ph.harvest.start, ph.harvest.end, day, false) });
  } else {
    steps.push({ key: 'pick', title: 'No picking dates yet', detail: ['GardenSync could not work out a harvest for these dates here.'], state: 'later' });
  }
  if (ph.bedOut !== null) {
    steps.push({ key: 'out', title: `${p.cells ? 'Squares free' : 'Room free'} from ${fmtDay(ph.bedOut)}`, detail: [], state: stateOf(ph.bedOut, ph.bedOut, day, ph.actual.ended) });
  } else if (plant.lifecycle === 'perennial' || plant.perennial) {
    steps.push({ key: 'out', title: 'Stays from year to year', detail: [], state: 'later' });
  }
  for (const r of w?.warnings ?? []) steps.push({ key: `w${r.code}`, title: sentence(reasonText(r, units.value)), detail: [], state: 'later', caution: true });
  return steps;
}

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol class="steps">
      {steps.map((s) => (
        <li key={s.key} class={`step step-${s.state}${s.caution ? ' step-caution' : ''}`}>
          <span class="step-dot" aria-hidden="true" />
          <span class="step-title">
            {s.caution ? <span class="visually-hidden">Warning: </span> : null}
            {s.title}
            {s.state === 'done' && !s.caution ? <span class="visually-hidden"> (done)</span> : null}
          </span>
          {s.detail.length > 0 ? <span class="step-detail">{s.detail.join(' ')}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Mark({ good }: { good: boolean }) {
  return (
    <span class={`mark ${good ? 'mark-friend' : 'mark-foe'}`} aria-hidden="true">
      <svg width="12" height="12" viewBox="0 0 12 12">
        <path d={good ? 'M2 6H10M6 2V10' : 'M3 3L9 9M9 3L3 9'} stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </span>
  );
}

/** Companions within one square, sharing time in the bed, with the evidence label. */
function neighboursOf(p: Planting, all: readonly Planting[], plantOf: (id: string) => Plant | undefined, iof: ReturnType<typeof intervalOfP.peek>) {
  const mine = iof(p);
  const seen = new Set<string>();
  const out: { name: string; good: boolean; reason: string; tested: boolean; where: string }[] = [];
  for (const q of all) {
    if (q.id === p.id || q.containerId !== p.containerId || q.plantId === p.plantId || seen.has(q.plantId)) continue;
    if (p.cells && q.cells && !cellsNear(p.cells, q.cells, 1)) continue;
    const theirs = iof(q);
    if (mine && theirs && !intervalsOverlap(mine, theirs)) continue;
    const comp = COMPANIONS.find((x) => (x.a === p.plantId && x.b === q.plantId) || (x.a === q.plantId && x.b === p.plantId));
    if (!comp) continue;
    seen.add(q.plantId);
    const where = p.cells && q.cells ? (cellsOverlap(p.cells, q.cells) ? 'in the same squares' : 'next door') : 'in the same pot';
    out.push({ name: plantOf(q.plantId)?.name ?? 'A plant', good: comp.kind === 'good', reason: comp.reason, tested: comp.evidence === 'tested', where });
  }
  return out;
}

export function PlantingInspector({ p }: { p: Planting }) {
  const g = garden.value!;
  const plant = plantLookup.value(p.plantId);
  const container = g.containers.find((c) => c.id === p.containerId);
  const ph = phasesOfP.value(p);
  const day = shownDay.value;
  const panel = useSignal<'none' | 'harvest' | 'dates'>('none');
  const error = useSignal<string | null>(null);
  useEffect(() => {
    panel.value = 'none';
    error.value = null;
  }, [p.id]);
  if (!plant || !container) return null;
  const name = plant.name;
  const lower = inSentence(name);
  const neighbours = neighboursOf(p, g.plantings, plantLookup.value, intervalOfP.value);
  const rot = rotation.value.filter((r) => r.planting.id === p.id);
  const where = p.cells ? `${container.name}, ${cellsName(p.cells)}` : container.name;
  const inGround = (present.value.get(container.id) ?? []).some((x) => x.id === p.id);
  const marked = p.actual?.bedIn !== undefined;
  const run = (res: { ok: boolean; error?: string }) => {
    error.value = res.ok ? null : (res.error ?? 'That did not work.');
    return res.ok;
  };

  return (
    <div class="inspector" aria-labelledby="inspector-title">
      <div class="insp-head">
        <Glyph form={plant.glyph.form} color={plant.glyph.color} size={44} />
        <div>
          <h2 id="inspector-title">{name}</h2>
          <p class="muted small">
            {p.count} {p.count === 1 ? 'plant' : 'plants'} in{' '}
            <button type="button" class="link-btn" onClick={() => selectContainer(container.id)}>
              {where}
            </button>
            {p.cells ? `, ${p.cells.w} by ${p.cells.h} ${p.cells.w * p.cells.h === 1 ? 'square' : 'squares'}` : ''}
          </p>
          {!inGround && ph ? <p class="small muted">Not in the ground on {fmtDay(day)}.</p> : null}
        </div>
      </div>

      {ph ? <Steps steps={phaseSteps(p, plant, ph, day)} /> : <p class="small">{g.climate ? 'The dates for this planting could not be worked out.' : 'Add your town or frost dates in Settings to get dates.'}</p>}

      {neighbours.length > 0 ? (
        <div class="insp-block">
          <h3>Neighbors</h3>
          {neighbours.map((n) => (
            <p key={n.name} class="neighbour">
              <Mark good={n.good} />
              <span>
                <span class="visually-hidden">{n.good ? 'Good neighbor: ' : 'Poor neighbor: '}</span>
                <strong>{n.name}</strong>, {n.where}. {n.reason} <span class="muted">{n.tested ? 'Backed by research.' : 'Traditional pairing, not proven.'}</span>
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {rot.length > 0 ? (
        <div class="insp-block">
          <h3>Rotation</h3>
          {rot.map((r) => (
            <p key={r.earlier.id} class="caution small">
              <span class="visually-hidden">Warning: </span>
              {r.reason}
            </p>
          ))}
        </div>
      ) : null}

      <CountField p={p} />

      <div class="insp-actions">
        <button type="button" class="btn btn-primary" aria-expanded={panel.value === 'harvest'} onClick={() => (panel.value = panel.value === 'harvest' ? 'none' : 'harvest')}>
          Log a harvest
        </button>
        {panel.value === 'harvest' ? <HarvestForm p={p} plant={plant} onDone={() => (panel.value = 'none')} /> : null}
        <div class="row">
          <button type="button" class="btn grow" aria-expanded={panel.value === 'dates'} onClick={() => (panel.value = panel.value === 'dates' ? 'none' : 'dates')}>
            Change dates
          </button>
          <button
            type="button"
            class="btn grow"
            onClick={() => {
              const res = act({ type: 'removePlanting', gardenId: g.id, plantingId: p.id }, `pull out ${lower}`, `Pulled out ${p.count} ${lower} ${p.count === 1 ? 'plant' : 'plants'}.`);
              if (res.ok) selection.value = { kind: 'container', id: container.id };
              else run(res);
            }}
          >
            Pull out
          </button>
        </div>
        {panel.value === 'dates' ? <DatesForm p={p} ph={ph} onDone={() => (panel.value = 'none')} /> : null}
        <button
          type="button"
          class="btn"
          onClick={() => {
            const actual = { ...(p.actual ?? {}) };
            if (marked) delete actual.bedIn;
            else actual.bedIn = today.value;
            const empty = Object.keys(actual).length === 0;
            run(
              act(
                { type: 'updatePlanting', gardenId: g.id, plantingId: p.id, patch: { actual: empty ? undefined : actual } },
                marked ? `clear the ${pastVerbOf(p.method).toLowerCase()} date` : `mark ${lower} ${pastVerbOf(p.method).toLowerCase()}`,
              ),
            );
          }}
        >
          {marked ? `Not ${pastVerbOf(p.method).toLowerCase()} yet` : `Mark as ${pastVerbOf(p.method).toLowerCase()} today`}
        </button>
        {error.value ? (
          <p class="form-error" role="alert">
            {error.value}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CountField({ p }: { p: Planting }) {
  const g = garden.value!;
  const value = useSignal(String(p.count));
  const error = useSignal<string | null>(null);
  useEffect(() => {
    value.value = String(p.count);
    error.value = null;
  }, [p.id, p.count]);
  const id = `count-${p.id}`;
  return (
    <form
      class="field insp-count"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.value);
        const res = act({ type: 'updatePlanting', gardenId: g.id, plantingId: p.id, patch: { count: n } }, 'change the count');
        error.value = res.ok ? null : res.error;
      }}
    >
      <label for={id}>Plants</label>
      <div class="row">
        <input id={id} class="input count-input" type="number" inputMode="numeric" min={1} max={10000} step={1} value={value.value} onInput={(e) => (value.value = (e.currentTarget as HTMLInputElement).value)} />
        <button type="submit" class="btn" disabled={value.value === String(p.count)}>
          Save
        </button>
      </div>
      {error.value ? (
        <p class="form-error" role="alert">
          {error.value}
        </p>
      ) : null}
    </form>
  );
}

function HarvestForm({ p, plant, onDone }: { p: Planting; plant: Plant; onDone: () => void }) {
  const g = garden.value!;
  const u = units.value;
  const date = useSignal(today.value);
  const weight = useSignal('');
  const count = useSignal('');
  const error = useSignal<string | null>(null);
  const example = `${formatWeight(1020.6, u)} or ${formatWeight(250, u)}`;
  return (
    <form
      class="insp-form"
      onSubmit={(e) => {
        e.preventDefault();
        const grams = weight.value.trim() ? readWeight(weight.value, u) : undefined;
        if (grams === null) {
          error.value = `GardenSync could not read that weight. Write it like ${example}.`;
          return;
        }
        const n = count.value.trim() ? Number(count.value) : undefined;
        const harvest = { id: newId(), plantId: p.plantId, plantingId: p.id, date: date.value, ...(grams !== undefined ? { grams } : {}), ...(n !== undefined ? { count: n } : {}) };
        const what = grams !== undefined ? formatWeight(grams, u) : `${n ?? 0}`;
        const res = act({ type: 'logHarvest', gardenId: g.id, harvest }, `log a harvest of ${inSentence(plant.name)}`, `Logged ${what} of ${inSentence(plant.name)}.`);
        if (res.ok) onDone();
        else error.value = res.error;
      }}
    >
      <div class="field">
        <label for="h-date">Picked on</label>
        <input id="h-date" class="input" type="date" required value={date.value} onInput={(e) => (date.value = (e.currentTarget as HTMLInputElement).value)} />
      </div>
      <div class="field">
        <label for="h-weight">Weight</label>
        <input id="h-weight" class="input" type="text" inputMode="decimal" aria-describedby="h-weight-hint" value={weight.value} onInput={(e) => (weight.value = (e.currentTarget as HTMLInputElement).value)} />
        <span id="h-weight-hint" class="muted small">
          Such as {example}
        </span>
      </div>
      <div class="field">
        <label for="h-count">Or how many</label>
        <input id="h-count" class="input" type="number" inputMode="numeric" min={0} step={1} value={count.value} onInput={(e) => (count.value = (e.currentTarget as HTMLInputElement).value)} />
      </div>
      {error.value ? (
        <p class="form-error" role="alert">
          {error.value}
        </p>
      ) : null}
      <div class="row">
        <button type="submit" class="btn btn-primary">
          Log it
        </button>
        <button type="button" class="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DatesForm({ p, ph, onDone }: { p: Planting; ph: PlantingPhases | null; onDone: () => void }) {
  const g = garden.value!;
  const auto = p.anchor.kind === 'auto';
  const offset = useSignal(String(p.anchor.kind === 'auto' ? p.anchor.offsetDays : 0));
  const pinIn = useSignal(p.anchor.kind === 'pinned' ? p.anchor.bedIn : ph ? toIso(ph.bedIn) : today.value);
  const pinOut = useSignal(p.anchor.kind === 'pinned' ? (p.anchor.bedOut ?? '') : '');
  const error = useSignal<string | null>(null);
  const done = (res: { ok: boolean; error?: string }) => {
    if (res.ok) onDone();
    else error.value = res.error ?? 'That did not work.';
  };
  return (
    <div class="insp-form">
      {auto && p.anchor.kind === 'auto' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Math.round(Number(offset.value));
            if (!Number.isFinite(n) || n < -366 || n > 366) {
              error.value = 'Move it by up to a year either way.';
              return;
            }
            if (p.anchor.kind !== 'auto') return;
            done(act({ type: 'updatePlanting', gardenId: g.id, plantingId: p.id, patch: { anchor: { ...p.anchor, offsetDays: n } } }, 'shift the dates'));
          }}
        >
          <div class="field">
            <label for="d-offset">Days after the start of its window</label>
            <input id="d-offset" class="input" type="number" min={-366} max={366} step={1} aria-describedby="d-offset-hint" value={offset.value} onInput={(e) => (offset.value = (e.currentTarget as HTMLInputElement).value)} />
            <span id="d-offset-hint" class="muted small">
              The dates still follow your climate. Use a negative number to go earlier.
            </span>
          </div>
          <button type="submit" class="btn">
            Shift the dates
          </button>
        </form>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const anchor = { kind: 'pinned' as const, bedIn: pinIn.value, ...(pinOut.value ? { bedOut: pinOut.value } : {}) };
          done(act({ type: 'updatePlanting', gardenId: g.id, plantingId: p.id, patch: { anchor } }, 'set the dates'));
        }}
      >
        <p class="small muted">{auto ? 'Or set your own dates. They stay put when the climate changes.' : 'These are dates you set. They stay put when the climate changes.'}</p>
        <div class="field">
          <label for="d-in">Goes in on</label>
          <input id="d-in" class="input" type="date" required value={pinIn.value} onInput={(e) => (pinIn.value = (e.currentTarget as HTMLInputElement).value)} />
        </div>
        <div class="field">
          <label for="d-out">Comes out on (optional)</label>
          <input id="d-out" class="input" type="date" value={pinOut.value} onInput={(e) => (pinOut.value = (e.currentTarget as HTMLInputElement).value)} />
        </div>
        <div class="row">
          <button type="submit" class="btn">
            Set these dates
          </button>
          <button type="button" class="btn" onClick={onDone}>
            Cancel
          </button>
        </div>
      </form>
      {error.value ? (
        <p class="form-error" role="alert">
          {error.value}
        </p>
      ) : null}
    </div>
  );
}

// ---- Beds and pots ---------------------------------------------------------------------------

export function ContainerInspector({ c }: { c: Container }) {
  const g = garden.value!;
  const u = units.value;
  const name = useSignal(c.name);
  const cols = useSignal(c.form === 'grid' ? String(c.cols) : '');
  const rows = useSignal(c.form === 'grid' ? String(c.rows) : '');
  const diameter = useSignal(c.form === 'vessel' ? formatLength(c.diameterCm, u) : '');
  const volume = useSignal(c.form === 'vessel' ? String(fromLitres(c.litres, u)) : '');
  const pockets = useSignal(c.form === 'vessel' && c.pockets !== undefined ? String(c.pockets) : '');
  const confirmRemove = useSignal(false);
  const error = useSignal<string | null>(null);
  const nameError = useSignal<string | null>(null);

  useEffect(() => {
    name.value = c.name;
    nameError.value = null;
  }, [c.id, c.name]);
  useEffect(() => {
    if (c.form === 'grid') {
      cols.value = String(c.cols);
      rows.value = String(c.rows);
    } else {
      diameter.value = formatLength(c.diameterCm, u);
      volume.value = String(fromLitres(c.litres, u));
      pockets.value = c.pockets !== undefined ? String(c.pockets) : '';
    }
    error.value = null;
    confirmRemove.value = false;
  }, [c, u]);

  const plantings = plantingsByContainer.value.get(c.id) ?? [];
  const here = new Set((present.value.get(c.id) ?? []).map((p) => p.id));
  const plantOf = plantLookup.value;
  const size =
    c.form === 'grid'
      ? `${formatLength(c.rows * g.cellCm, u)} by ${formatLength(c.cols * g.cellCm, u)}, ${c.cols * c.rows} squares`
      : `${formatLength(c.diameterCm, u)} across, ${formatVolume(c.litres, u)} of soil`;
  const run = (res: { ok: boolean; error?: string }) => {
    error.value = res.ok ? null : (res.error ?? 'That did not work.');
  };
  const nudge = (dx: number, dy: number) =>
    run(act({ type: 'updateContainer', gardenId: g.id, containerId: c.id, patch: { x: Math.round((c.x + dx) * 100) / 100, y: Math.round((c.y + dy) * 100) / 100 } }, `move ${c.name}`, undefined, { coalesceKey: `move-${c.id}` }));
  const step = c.form === 'grid' ? g.cellCm : 10;

  return (
    <div class="inspector" aria-labelledby="inspector-title">
      <div class="insp-head">
        <div>
          <h2 id="inspector-title">{c.name}</h2>
          <p class="muted small">
            {KIND_WORDS[c.kind]}, {size}
          </p>
        </div>
      </div>

      <div class="field">
        <label for="c-name">Name</label>
        <input
          id="c-name"
          class="input"
          type="text"
          maxLength={80}
          value={name.value}
          onInput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            name.value = v;
            const res = act({ type: 'updateContainer', gardenId: g.id, containerId: c.id, patch: { name: v } }, 'rename', undefined, { coalesceKey: `name-${c.id}` });
            nameError.value = res.ok ? null : res.error;
          }}
        />
        {nameError.value ? <span class="form-error">{nameError.value}</span> : null}
      </div>

      <form
        class="insp-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (c.form === 'grid') {
            run(act({ type: 'updateContainer', gardenId: g.id, containerId: c.id, patch: { cols: Number(cols.value), rows: Number(rows.value) } }, `resize ${c.name}`));
            return;
          }
          const d = readLength(diameter.value, u);
          if (d === null) {
            error.value = `GardenSync could not read that width. Write it like ${formatLength(30.48, u)} or ${formatLength(45, u)}.`;
            return;
          }
          const litres = toLitres(Number(volume.value), u);
          const patch = { diameterCm: Math.round(d * 10) / 10, litres: Math.round(litres * 10) / 10, ...(c.kind === 'tower' && pockets.value ? { pockets: Number(pockets.value) } : {}) };
          run(act({ type: 'updateContainer', gardenId: g.id, containerId: c.id, patch }, `resize ${c.name}`));
        }}
      >
        <fieldset class="size-fields">
          <legend>Size</legend>
          {c.form === 'grid' ? (
            <>
              <div class="field">
                <label for="c-cols">Squares across</label>
                <input id="c-cols" class="input" type="number" inputMode="numeric" min={1} max={60} step={1} value={cols.value} onInput={(e) => (cols.value = (e.currentTarget as HTMLInputElement).value)} />
              </div>
              {c.kind === 'window-box' || c.kind === 'trough' ? null : (
                <div class="field">
                  <label for="c-rows">Squares deep</label>
                  <input id="c-rows" class="input" type="number" inputMode="numeric" min={1} max={60} step={1} value={rows.value} onInput={(e) => (rows.value = (e.currentTarget as HTMLInputElement).value)} />
                </div>
              )}
              <p class="muted small">One square is {formatLength(g.cellCm, u)} each way.</p>
            </>
          ) : (
            <>
              <div class="field">
                <label for="c-diam">Width across</label>
                <input id="c-diam" class="input" type="text" value={diameter.value} onInput={(e) => (diameter.value = (e.currentTarget as HTMLInputElement).value)} />
              </div>
              <div class="field">
                <label for="c-vol">Soil volume ({volumeUnit(u)})</label>
                <input id="c-vol" class="input" type="number" inputMode="decimal" min={0.1} step={0.1} value={volume.value} onInput={(e) => (volume.value = (e.currentTarget as HTMLInputElement).value)} />
              </div>
              {c.kind === 'tower' ? (
                <div class="field">
                  <label for="c-pockets">Pockets</label>
                  <input id="c-pockets" class="input" type="number" min={1} max={60} step={1} value={pockets.value} onInput={(e) => (pockets.value = (e.currentTarget as HTMLInputElement).value)} />
                </div>
              ) : null}
            </>
          )}
        </fieldset>
        <button type="submit" class="btn">
          Resize
        </button>
      </form>

      <div class="insp-block">
        <h3>Move and turn</h3>
        <div class="nudge" role="group" aria-label={`Move ${c.name}`}>
          <button type="button" class="btn btn-icon" aria-label="Move up" title="Move up" onClick={() => nudge(0, -step)}>
            <Arrow d="M8 13V3M3.5 7.5L8 3L12.5 7.5" />
          </button>
          <button type="button" class="btn btn-icon" aria-label="Move down" title="Move down" onClick={() => nudge(0, step)}>
            <Arrow d="M8 3V13M3.5 8.5L8 13L12.5 8.5" />
          </button>
          <button type="button" class="btn btn-icon" aria-label="Move left" title="Move left" onClick={() => nudge(-step, 0)}>
            <Arrow d="M13 8H3M7.5 3.5L3 8L7.5 12.5" />
          </button>
          <button type="button" class="btn btn-icon" aria-label="Move right" title="Move right" onClick={() => nudge(step, 0)}>
            <Arrow d="M3 8H13M8.5 3.5L13 8L8.5 12.5" />
          </button>
          {c.form === 'grid' ? (
            <button
              type="button"
              class="btn"
              onClick={() => run(act({ type: 'updateContainer', gardenId: g.id, containerId: c.id, patch: { rotation: ((c.rotation + 90) % 360) as 0 | 90 | 180 | 270 } }, `turn ${c.name}`))}
            >
              Turn a quarter
            </button>
          ) : null}
        </div>
        <p class="muted small">Or drag it with the mouse, or use Shift and the arrow keys on the plan.</p>
      </div>

      <div class="insp-block">
        <h3>Plantings</h3>
        {plantings.length === 0 ? (
          <p class="muted small">Nothing planted yet. Choose a plant, then tap {c.form === 'grid' ? 'squares' : 'this pot'}.</p>
        ) : (
          <ul class="insp-list">
            {plantings.map((p) => {
              const plant = plantOf(p.plantId);
              const inGround = here.has(p.id);
              return (
                <li key={p.id}>
                  <button type="button" class="insp-list-item" onClick={() => selectPlanting(p.id)}>
                    {plant ? <Glyph form={plant.glyph.form} color={plant.glyph.color} size={24} /> : null}
                    <span>
                      <strong>{plant?.name ?? 'Plant'}</strong> {p.count}
                      {p.cells ? `, ${cellsName(p.cells)}` : ''}
                      {inGround ? '' : <span class="badge badge-planned">Planned</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error.value ? (
        <p class="form-error" role="alert">
          {error.value}
        </p>
      ) : null}

      <div class="insp-actions">
        {confirmRemove.value ? (
          <div class="confirm" role="group" aria-labelledby="confirm-text">
            <p id="confirm-text">
              Remove {c.name}
              {plantings.length > 0 ? ` and the ${plantings.length === 1 ? 'planting' : `${plantings.length} plantings`} in it` : ''}? You can undo this.
            </p>
            <div class="row">
              <button
                type="button"
                class="btn btn-primary"
                onClick={() => {
                  const res = act({ type: 'removeContainer', gardenId: g.id, containerId: c.id }, `remove ${c.name}`, `Removed ${c.name}.`);
                  if (res.ok) selection.value = null;
                  else run(res);
                }}
              >
                Remove {c.name}
              </button>
              <button type="button" class="btn" onClick={() => (confirmRemove.value = false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" class="btn" onClick={() => (confirmRemove.value = true)}>
            Remove {c.form === 'grid' ? 'this bed' : 'this container'}
          </button>
        )}
      </div>
    </div>
  );
}

function Arrow({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d={d} stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

