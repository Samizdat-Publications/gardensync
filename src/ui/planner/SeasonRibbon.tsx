// The season below the canvas: the selected bed's plantings over the year (indoors dashed, growing
// outlined, picking solid; ledger 7), frost-likely and frost-possible bands from the climate, and a
// native range input as the day marker (ledger 3: no drag-only controls).
import { dayFromParts, partsFromDay, toDay, yearOf, type DayNum } from '../../domain/dates';
import type { Planting } from '../../domain/doc/schema';
import { seasonLabel, seasonOf, seasonRefs } from '../../domain/schedule';
import { garden, today } from '../appState';
import { fmtDay, fmtRange } from '../format';
import { selection, shownDay, viewDay } from '../uiState';
import { containers, phasesOfP, plantLookup, plantingsByContainer, selectedContainer, selectedPlanting } from './derived';
import { pastVerbOf, verbOf } from './placement';
import { calendarSpan } from '../calendar/model';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const SPAN = 365;

type Row = { p: Planting; name: string; color: string; text: string; segs: { kind: 'indoor' | 'grow' | 'pick'; a: DayNum; b: DayNum }[] };

/** "June 12" */
export function fmtMonthDayLong(d: DayNum): string {
  return LONG.format(new Date(d * 86_400_000));
}

/** The 365 days the ribbon shows: the growing season of the day shown, from a month start. */
export function seasonSpan(day: DayNum, climate: Parameters<typeof seasonRefs>[0] | null): { start: DayNum; season: number; label: string } {
  if (!climate) {
    const y = yearOf(day);
    return { start: dayFromParts(y, 1, 1), season: y, label: String(y) };
  }
  const season = seasonOf(climate, day);
  // The same months as the calendar, so a leap year never starts the strip in February.
  return { start: calendarSpan(climate, season).start, season, label: seasonLabel(climate, season) };
}

const pct = (d: DayNum, start: DayNum) => `${(Math.min(SPAN, Math.max(0, d - start)) / SPAN) * 100}%`;
const widthPct = (a: DayNum, b: DayNum, start: DayNum) => {
  const x0 = Math.min(SPAN, Math.max(0, a - start));
  const x1 = Math.min(SPAN, Math.max(0, b - start));
  return `${(Math.max(0, x1 - x0) / SPAN) * 100}%`;
};

export function SeasonRibbon() {
  const g = garden.value!;
  const climate = g.climate;
  const day = shownDay.value;
  const todayDay = toDay(today.value);
  const bed = selectedContainer.value ?? containers.value[0] ?? null;
  const selP = selectedPlanting.value;
  const phasesOf = phasesOfP.value;
  const plantOf = plantLookup.value;

  /** Build the list of rows for a given season span start. */
  const makeRows = (spanStart: DayNum): Row[] => {
    const spanEnd = spanStart + SPAN;
    const out: Row[] = [];
    for (const p of bed ? (plantingsByContainer.value.get(bed.id) ?? []) : []) {
      const ph = phasesOf(p);
      const plant = plantOf(p.plantId);
      if (!ph || !plant) continue;
      const last = ph.bedOut ?? spanEnd;
      const first = ph.indoor?.start ?? ph.bedIn;
      if (last < spanStart || first >= spanEnd) continue;
      const segs: Row['segs'] = [];
      if (ph.indoor) segs.push({ kind: 'indoor', a: ph.indoor.start, b: Math.max(ph.indoor.end + 1, ph.bedIn) });
      if (ph.harvest) {
        segs.push({ kind: 'grow', a: ph.bedIn, b: ph.harvest.start });
        segs.push({ kind: 'pick', a: ph.harvest.start, b: ph.harvest.end + 1 });
      } else {
        segs.push({ kind: 'grow', a: ph.bedIn, b: last });
      }
      const m = p.method;
      const inText = `${ph.actual.bedIn ? pastVerbOf(m).toLowerCase() : verbOf(m).toLowerCase()} ${fmtDay(ph.bedIn)}`;
      const text = `${plant.name}: ${ph.indoor ? `start indoors ${fmtRange(ph.indoor.start, ph.indoor.end)}, ` : ''}${inText}${ph.harvest ? `, pick ${fmtRange(ph.harvest.start, ph.harvest.end)}` : ''}.`;
      out.push({ p, name: plant.name, color: plant.glyph.color, text, segs });
    }
    return out;
  };

  const { start: s0, season: s0season, label: l0 } = seasonSpan(day, climate);
  let start = s0;
  let currentSeason = s0season;
  let label = l0;
  let rows = makeRows(start);
  let nextSeason = false;

  // When nothing is planned in the selected bed this season but the bed has plantings coming up
  // next season, switch to next season automatically so the ribbon shows something useful.
  if (rows.length === 0 && bed) {
    const allBedPlantings = plantingsByContainer.value.get(bed.id) ?? [];
    if (allBedPlantings.length > 0) {
      const next = seasonSpan(day + SPAN, climate);
      const nextRows = makeRows(next.start);
      if (nextRows.length > 0) {
        start = next.start;
        currentSeason = next.season;
        label = next.label;
        nextSeason = true;
        rows = nextRows;
      }
    }
  }

  rows.sort((a, b) => (a.p.id === selP?.id ? -1 : b.p.id === selP?.id ? 1 : 0));

  const end = start + SPAN;

  const frost: { kind: 'likely' | 'possible'; a: DayNum; b: DayNum }[] = [];
  if (climate) {
    // Use the same season whose plantings are shown, not the one containing the ribbon start.
    // When nextSeason is true the ribbon start (Jan 1 of the next year) resolves to the previous
    // season in seasonOf(), which would put all frost dates in the wrong year.
    const r = seasonRefs(climate, currentSeason);
    if (r.LF50 !== null) {
      frost.push({ kind: 'likely', a: start, b: r.LF50 });
      if (r.LF90 !== null && r.LF90 > r.LF50) frost.push({ kind: 'possible', a: r.LF50, b: r.LF90 });
    }
    if (r.FF50 !== null) {
      frost.push({ kind: 'likely', a: r.FF50, b: end });
      if (r.FF10 !== null && r.FF10 < r.FF50) frost.push({ kind: 'possible', a: r.FF10, b: r.FF50 });
    }
  }

  const months = Array.from({ length: 12 }, (_, k) => {
    const { year, month } = partsFromDay(start);
    const m0 = month - 1 + k;
    const d = dayFromParts(year + Math.floor(m0 / 12), (m0 % 12) + 1, 1);
    return { d, name: MONTHS[m0 % 12]! };
  });

  const value = Math.min(SPAN - 1, Math.max(0, day - start));
  const setDay = (d: DayNum) => {
    viewDay.value = d === todayDay ? null : d;
  };

  const headingText = nextSeason
    ? `${bed ? bed.name : 'Season'}, ${label} season (next)`
    : `${bed ? bed.name : 'Season'}, ${label} season`;

  return (
    <section class="season panel" aria-labelledby="season-title">
      <div class="season-head">
        <h2 id="season-title">{headingText}</h2>
        <p class="muted small season-hint">
          {todayDay >= start && todayDay < start + SPAN ? 'Move the marker' : 'Pick a day on the strip'} to see the garden on any day. Blue is frost risk.
        </p>
        <div class="season-nav">
          <button type="button" class="btn btn-icon" aria-label="Previous season" title="Previous season" onClick={() => setDay(day - SPAN)}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button type="button" class="btn btn-icon" aria-label="Next season" title="Next season" onClick={() => setDay(day + SPAN)}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div class="ribbon">
        <div class="ribbon-months" aria-hidden="true">
          {months.map((m) => (
            <span key={m.d} style={{ left: pct(m.d, start) }}>
              {m.name}
            </span>
          ))}
        </div>
        <div class="ribbon-body">
          <div class="ribbon-frost" aria-hidden="true">
            {frost.map((f, k) => (
              <span key={k} class={`frost frost-${f.kind}`} style={{ left: pct(f.a, start), width: widthPct(f.a, f.b, start) }} />
            ))}
            {months.slice(1).map((m) => (
              <span key={`g${m.d}`} class="ribbon-gridline" style={{ left: pct(m.d, start) }} />
            ))}
            <span class="ribbon-marker" style={{ left: pct(day, start) }} />
          </div>
          {rows.length === 0 ? (
            <p class="ribbon-empty muted small">{bed ? `Nothing is planned in ${bed.name} this season.` : 'Add a bed or a pot to see its season.'}</p>
          ) : (
            <ul class="ribbon-rows">
              {rows.map((r) => (
                <li key={r.p.id} class="ribbon-row">
                  <button
                    type="button"
                    class={`ribbon-name${r.p.id === selP?.id ? ' is-selected' : ''}`}
                    onClick={() => (selection.value = { kind: 'planting', id: r.p.id })}
                  >
                    {r.name}
                    <span class="visually-hidden"> {r.text}</span>
                  </button>
                  <span class="ribbon-track" aria-hidden="true" style={{ '--crop': r.color }}>
                    {r.segs.map((sg, k) => (
                      <span key={k} class={`seg seg-${sg.kind}`} style={{ left: pct(sg.a, start), width: widthPct(sg.a, sg.b, start) }} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div class="ribbon-slider">
          <label for="day-shown" class="ribbon-slider-label">
            Day shown in the garden <strong>{fmtDay(day)}</strong>
          </label>
          <input
            id="day-shown"
            type="range"
            min={0}
            max={SPAN - 1}
            step={1}
            value={value}
            aria-valuetext={fmtMonthDayLong(day)}
            onInput={(e) => setDay(start + Number((e.currentTarget as HTMLInputElement).value))}
          />
        </div>
      </div>
      <ul class="season-legend small" aria-label="Key">
        <li>
          <span class="key key-indoor" aria-hidden="true" />
          Seedlings indoors
        </li>
        <li>
          <span class="key key-grow" aria-hidden="true" />
          In the ground
        </li>
        <li>
          <span class="key key-pick" aria-hidden="true" />
          Ready to pick
        </li>
        <li>
          <span class="key key-likely" aria-hidden="true" />
          Frost likely
        </li>
        <li>
          <span class="key key-possible" aria-hidden="true" />
          Frost possible
        </li>
      </ul>
    </section>
  );
}
