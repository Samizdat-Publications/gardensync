// The year at a glance: every planting by bed across one growing season, with seedlings indoors
// (dashed), growing (outlined tint) and picking (solid) told apart by shape, frost risk bands,
// today, a season switcher, a list view for screen readers and small screens, and print.
// A-calendar.dc.html.
import { useSignal } from '@preact/signals';
import type { ClimateProfile as Climate } from '../../domain/climate/types';
import { dayFromParts, partsFromDay, toDay, type DayNum } from '../../domain/dates';
import type { Garden } from '../../domain/doc/schema';
import { squaresLabel } from '../../domain/layout/labels';
import { HALF_SEASON, plantingPhases, seasonLabel, seasonOf, seasonRefs, type PlantingPhases } from '../../domain/schedule';
import { garden, today } from '../appState';
import { fmtDay, fmtRange } from '../format';
import { hrefOf } from '../router';
import { plantOf } from '../uiState';
import './Calendar.css';

interface Row {
  key: string;
  label: string;
  where: string;
  color: string;
  phases: PlantingPhases;
}

/** Convert a #rrggbb hex color (plant.glyph.color schema) to rgba() with the given alpha (0-1). */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Aligns a day to the nearest 1st of a month: days 1-15 snap to the current month, 16+ to the
 * next. Mirrors the same helper in SeasonRibbon so the calendar span starts on the same boundary
 * as the planner season strip.
 */
function nearestMonthStart(d: DayNum): DayNum {
  const { year, month, day } = partsFromDay(d);
  if (day <= 15) return dayFromParts(year, month, 1);
  return month === 12 ? dayFromParts(year + 1, 1, 1) : dayFromParts(year, month + 1, 1);
}

/**
 * Label for a succession planting. Uses the bed-in date rather than the 1-based round number so
 * the label is self-contained: "Radish, round 5" is confusing when rounds 1-4 are in a previous
 * season, but "Radish, sow May 26" is unambiguous. The verb matches the planting method.
 */
function successionLabel(name: string, phases: PlantingPhases): string {
  if (phases.round === undefined) return name;
  const verb = phases.method === 'direct' ? 'sow' : phases.method === 'plant' ? 'plant' : 'plant out';
  return `${name}, ${verb} ${fmtDay(phases.bedIn)}`;
}

interface Group {
  id: string;
  name: string;
  rows: Row[];
}

/** The 365-day span the chart shows for a season, starting on the 1st of a month. */
function spanOf(c: Climate, season: number): { start: DayNum; end: DayNum } {
  // Align the calendar span to the same month boundary the planner's season strip uses so the
  // first month label is January (northern hemisphere) or the warm-season start month (southern
  // hemisphere) rather than mid-January. The span is always 365 days.
  const start = nearestMonthStart(seasonRefs(c, season).W - HALF_SEASON);
  return { start, end: start + 364 };
}

/** Every bed's plantings that show any phase inside the span, earliest first. */
function groupsFor(g: Garden, c: Climate, span: { start: DayNum; end: DayNum }): Group[] {
  return g.containers
    .map((container) => {
      const rows: Row[] = [];
      for (const p of g.plantings.filter((q) => q.containerId === container.id)) {
        const plant = plantOf(p.plantId);
        if (!plant) continue;
        const phases = plantingPhases(p, plant, c);
        if (!phases) continue;
        const end = phases.bedOut ?? span.end + 1;
        const start = phases.indoor?.start ?? phases.bedIn;
        if (!(end > span.start && start <= span.end)) continue;
        rows.push({
          key: p.id,
          // P4: label succession rows by bed-in date to avoid confusing "round N" labels when
          // earlier rounds were in a previous season.
          label: successionLabel(plant.name, phases),
          where: p.cells ? squaresLabel(p.cells) : `${p.count} in the ${container.kind.replace('-', ' ')}`,
          color: plant.glyph.color,
          phases,
        });
      }
      rows.sort((a, b) => (a.phases.indoor?.start ?? a.phases.bedIn) - (b.phases.indoor?.start ?? b.phases.bedIn));
      return { id: container.id, name: container.name, rows };
    })
    .filter((gr) => gr.rows.length > 0);
}

export function CalendarScreen() {
  const g = garden.value;
  // Null until the gardener moves: the chart shows this season, or the next one when this season has
  // nothing in it yet (a gardener planning in the fall wants to see next year's plan, not a blank).
  const offset = useSignal<number | null>(null);
  // Default to list view on narrow screens so all 12 months need not fit horizontally.
  // The user can switch back to the chart at any time.
  const asList = useSignal(window.innerWidth < 600);
  if (!g) return null;
  const c = g.climate;
  const todayDay = toDay(today.value);

  if (!c) {
    return (
      <main class="calendar">
        <h1 tabIndex={-1}>Calendar</h1>
        <p class="cal-banner">
          The calendar needs your town or your frost dates. <a href={hrefOf({ name: 'settings', section: 'climate' })}>Set them in Settings</a>.
        </p>
      </main>
    );
  }

  const thisSeason = seasonOf(c, todayDay);
  let shift = offset.value;
  if (shift === null) {
    shift = groupsFor(g, c, spanOf(c, thisSeason)).length === 0 && groupsFor(g, c, spanOf(c, thisSeason + 1)).length > 0 ? 1 : 0;
  }
  const season = thisSeason + shift;
  const refs = seasonRefs(c, season);
  const span = spanOf(c, season);
  const days = span.end - span.start + 1; // always 365
  const pct = (d: DayNum) => `${(((Math.min(Math.max(d, span.start), span.end + 1) - span.start) / days) * 100).toFixed(3)}%`;
  const width = (a: DayNum, b: DayNum) => `${(((Math.min(b, span.end + 1) - Math.max(a, span.start)) / days) * 100).toFixed(3)}%`;

  // Month ticks: one per calendar month whose 1st falls within the span. Since the span starts at
  // a month boundary, the first tick is always at 0% (the left edge).
  const months: { day: DayNum; label: string }[] = [];
  for (let d = span.start; d <= span.end; d++) {
    const p = partsFromDay(d);
    if (p.day === 1)
      months.push({
        day: d,
        label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(d * 86_400_000)),
      });
  }

  const groups = groupsFor(g, c, span);
  const anyIndoor = groups.some((gr) => gr.rows.some((r) => r.phases.indoor && r.phases.indoor.start <= span.end && r.phases.bedIn > span.start));

  const frost: { from: DayNum; to: DayNum; kind: 'likely' | 'possible' }[] = [];
  if (refs.LF50 !== null) frost.push({ from: span.start, to: refs.LF50, kind: 'likely' });
  if (refs.LF50 !== null && refs.LF90 !== null) frost.push({ from: refs.LF50, to: refs.LF90, kind: 'possible' });
  if (refs.FF10 !== null && refs.FF50 !== null) frost.push({ from: refs.FF10, to: refs.FF50, kind: 'possible' });
  if (refs.FF50 !== null) frost.push({ from: refs.FF50, to: span.end + 1, kind: 'likely' });

  return (
    <main class="calendar">
      <div class="cal-head">
        <h1 tabIndex={-1}>{seasonLabel(c, season)} at a glance</h1>
        <div role="group" aria-label="Season" class="row">
          <button class="btn btn-icon" aria-label="Previous season" onClick={() => (offset.value = shift - 1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="btn btn-icon" aria-label="Next season" onClick={() => (offset.value = shift + 1)}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          {season !== thisSeason ? (
            <button class="btn" onClick={() => (offset.value = 0)}>
              Back to {seasonLabel(c, thisSeason)}
            </button>
          ) : null}
        </div>
        <span class="cal-spacer" />
        <button class="btn" aria-pressed={asList.value} onClick={() => (asList.value = !asList.value)}>
          {asList.value ? 'Show as a chart' : 'Show as a list'}
        </button>
        <button class="btn" onClick={() => window.print()}>
          Print the year
        </button>
      </div>

      {groups.length === 0 ? (
        <section class="panel cal-empty">
          <h2>Nothing planted this season</h2>
          <p class="muted">Plantings appear here with their sowing, growing and picking dates.</p>
          <a href={hrefOf({ name: 'garden' })}>Go to the garden</a>
        </section>
      ) : asList.value ? (
        <CalendarList groups={groups} />
      ) : (
        <div class="cal-scroll panel">
          <div class="cal-chart" role="img" aria-label="Year chart of plantings. Use Show as a list for the dates as text.">
            <div class="cal-months" aria-hidden="true">
              <span />
              <div class="cal-track">
                {months.map((m) => (
                  <span key={m.day} class="cal-month" style={{ left: pct(m.day) }}>
                    <span class="cal-month-long">{m.label}</span>
                    <span class="cal-month-short">{m.label.charAt(0)}</span>
                  </span>
                ))}
              </div>
            </div>
            <div class="cal-body">
              <div class="cal-bands" aria-hidden="true">
                {frost.map((f, i) => (
                  <span key={i} class={`cal-frost cal-frost-${f.kind}`} style={{ left: pct(f.from), width: width(f.from, f.to) }} />
                ))}
                {todayDay >= span.start && todayDay <= span.end ? <span class="cal-today" style={{ left: pct(todayDay) }} /> : null}
              </div>
              {groups.map((gr) => (
                <div key={gr.id} class="cal-group">
                  <h2 class="cal-group-name">{gr.name}</h2>
                  {gr.rows.map((r) => (
                    <div key={r.key} class="cal-row">
                      <span class="cal-label">{r.label}</span>
                      <div class="cal-track">
                        {r.phases.indoor ? (
                          // P3: the indoor phase bar renders whenever plantingPhases gives a non-null
                          // indoor range. It is absent in the starter garden because the auto-starter
                          // switches tomatoes to method "bought" when it is too late to raise from
                          // seed -- "bought" does not raise its own seedlings, so indoor is null.
                          // For a planting with method "transplant" or "indoor", the dashed bar below
                          // spans from seed-start to the day the plant goes in the ground.
                          <span
                            class="seg seg-indoor"
                            style={{ left: pct(r.phases.indoor.start), width: width(r.phases.indoor.start, r.phases.bedIn), borderColor: r.color }}
                          />
                        ) : null}
                        {/* Growing: outlined bar with 28% tinted fill so it is visible in both themes. */}
                        <span
                          class="seg seg-grow"
                          style={{
                            left: pct(r.phases.bedIn),
                            width: width(r.phases.bedIn, r.phases.bedOut ?? span.end + 1),
                            borderColor: r.color,
                            background: hexToRgba(r.color, 0.28),
                          }}
                        />
                        {r.phases.harvest ? (
                          <span
                            class="seg seg-pick"
                            style={{
                              left: pct(r.phases.harvest.start),
                              width: width(r.phases.harvest.start, r.phases.harvest.end + 1),
                              background: r.color,
                              borderColor: r.color,
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* P2: legend belongs to the chart, not the list. Hidden in list view so it does not clutter
          the stacked date cards. Bars take each crop's color, so the key shows status by fill style
          in a neutral color: dashed outline, outline, solid. */}
      {!asList.value && groups.length > 0 ? (
        <div class="cal-key">
          <ul class="cal-legend" aria-label="Key">
            {anyIndoor ? (
              <li>
                <span class="key key-indoor" aria-hidden="true" />
                Dashed outline: seedlings indoors
              </li>
            ) : null}
            <li>
              <span class="key key-grow" aria-hidden="true" />
              Outline: growing in the bed
            </li>
            <li>
              <span class="key key-pick" aria-hidden="true" />
              Solid: ready to pick
            </li>
            <li>
              <span class="key key-likely" aria-hidden="true" />
              Frost likely
            </li>
            <li>
              <span class="key key-possible" aria-hidden="true" />
              Frost possible
            </li>
            {todayDay >= span.start && todayDay <= span.end ? (
              <li>
                <span class="key key-today" aria-hidden="true" />
                Today, {fmtDay(todayDay)}
              </li>
            ) : null}
          </ul>
          <p class="cal-key-note">Each bar takes its crop's color.</p>
        </div>
      ) : null}
    </main>
  );
}

/**
 * P2: Stacked list view replaces the scrollable table so narrow screens can read all dates without
 * sideways scrolling. Each planting shows its name, location, and non-empty date phases as a
 * definition list. Empty fields (no indoor phase, no harvest) are omitted.
 */
function CalendarList({ groups }: { groups: { id: string; name: string; rows: Row[] }[] }) {
  return (
    <div class="cal-list">
      {groups.map((gr) => (
        <section key={gr.id} class="panel" aria-labelledby={`cal-grp-${gr.id}`}>
          <h2 id={`cal-grp-${gr.id}`}>{gr.name}</h2>
          <ul class="cal-list-items">
            {gr.rows.map((r) => (
              <li key={r.key} class="cal-list-item">
                <div class="cal-list-name">{r.label}</div>
                <div class="cal-list-where">{r.where}</div>
                <dl class="cal-list-dates">
                  {r.phases.indoor ? (
                    <>
                      <dt>Indoors</dt>
                      <dd>{fmtRange(r.phases.indoor.start, r.phases.indoor.end)}</dd>
                    </>
                  ) : null}
                  <dt>In the bed</dt>
                  <dd>
                    {r.phases.bedOut !== null
                      ? fmtRange(r.phases.bedIn, r.phases.bedOut - 1)
                      : `From ${fmtDay(r.phases.bedIn)}`}
                  </dd>
                  {r.phases.harvest ? (
                    <>
                      <dt>Pick</dt>
                      <dd>{fmtRange(r.phases.harvest.start, r.phases.harvest.end)}</dd>
                    </>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
