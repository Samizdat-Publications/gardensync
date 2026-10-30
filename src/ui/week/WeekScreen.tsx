// This week: the jobs for the gardener's plantings, worked out from the schedule (never typed),
// each with its reason and a tick box. Layout from A-week.dc.html.
import { computed } from '@preact/signals';
import { addDays, partsFromDay, startOfWeek, toDay, toIso, type DayNum } from '../../domain/dates';
import { squaresLabel } from '../../domain/layout/labels';
import type { Plant } from '../../domain/plants/schema';
import { reasonText, tasksFor, type Task, type TaskKind } from '../../domain/schedule';
import { garden, store, today, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtLong, fmtNear, fmtRange, fmtSpan, inSentence, sentence } from '../format';
import { hrefOf } from '../router';
import { gardenPlants } from '../uiState';
import { FrostWatch } from './FrostWatch';
import './Week.css';

const VERB: Record<TaskKind, string> = {
  'start-indoors': 'Start {p} seeds indoors',
  'harden-off': 'Start hardening off {p}',
  transplant: 'Plant out {p}',
  'direct-sow': 'Sow {p}',
  plant: 'Plant {p}',
  'plant-next-year': 'Plant {p} for next year',
  'succession-sow': 'Sow {p} again',
  'start-picking': 'Start picking {p}',
  'end-of-season': 'Pull out {p}',
  'frost-possible': 'Frost possible from now: protect {p}',
};

function title(t: Task, plant: Plant | undefined): string {
  const name = plant ? inSentence(plant.name) : 'this planting';
  return VERB[t.kind].replace('{p}', name).replace('{r}', String((t.round ?? 0) + 1)).replace(/^./, (c) => c.toUpperCase());
}

const plantMap = computed(() => new Map(gardenPlants.value.map((r) => [r.plant.id, r.plant])));

export function WeekScreen() {
  const g = garden.value;
  if (!g) return null;
  const todayDay = toDay(today.value);
  const weekStart = startOfWeek(todayDay);
  const weekEnd = addDays(weekStart, 6);
  const plants = plantMap.value;
  // Date first, then the plant's name, so the list reads the same on every visit.
  const nameOf = (t: Task) => plants.get(t.plantId)?.name ?? t.plantId;
  const tasks = tasksFor(g, plants, addDays(weekStart, -14), addDays(weekEnd, 21)).sort((a, b) => a.date - b.date || nameOf(a).localeCompare(nameOf(b)) || a.id.localeCompare(b.id));

  const overdue = tasks.filter((t) => !t.done && (t.until ?? t.date) < todayDay && (t.until ?? t.date) >= addDays(weekStart, -14));
  const now = tasks.filter((t) => t.date <= todayDay && (t.until ?? t.date) >= todayDay);
  const later = tasks.filter((t) => t.date > todayDay && t.date <= weekEnd);
  const coming = tasks.filter((t) => t.date > weekEnd && !t.done);
  const open = now.filter((t) => !t.done).length + later.filter((t) => !t.done).length + overdue.length;
  // One heading per day in "Coming up", so a busy day does not repeat its date on every line.
  const comingDays: { day: DayNum; tasks: Task[] }[] = [];
  for (const t of coming.slice(0, 8)) {
    const last = comingDays[comingDays.length - 1];
    if (last && last.day === t.date) last.tasks.push(t);
    else comingDays.push({ day: t.date, tasks: [t] });
  }
  // When nothing falls in the next three weeks (a gardener starting in the fall), look further
  // ahead so the page can still say when the next job is.
  const next =
    coming[0] ??
    tasksFor(g, plants, addDays(weekEnd, 22), addDays(weekEnd, 400))
      .filter((t) => !t.done && t.date > weekEnd)
      .sort((a, b) => a.date - b.date || nameOf(a).localeCompare(nameOf(b)) || a.id.localeCompare(b.id))[0];
  // Nothing at all this week: the main column says when the next job is, so the side panel need not.
  const quiet = now.length === 0 && later.length === 0 && overdue.length === 0;
  const startYear = partsFromDay(weekStart).year;
  const endYear = partsFromDay(weekEnd).year;
  const weekSpan = startYear === endYear ? `${fmtLong(weekStart)} to ${fmtLong(weekEnd)}, ${endYear}` : `${fmtLong(weekStart)}, ${startYear} to ${fmtLong(weekEnd)}, ${endYear}`;

  const toggle = (t: Task) =>
    t.done
      ? store.dispatch({ type: 'clearTaskDone', gardenId: g.id, taskId: t.id }, { label: 'untick a job' })
      : store.dispatch({ type: 'setTaskDone', gardenId: g.id, taskId: t.id, date: today.value }, { label: 'tick a job' });

  return (
    <main class="week">
      <div class="week-main">
        <header class="week-head">
          <h1 tabIndex={-1}>This week</h1>
          <p class="muted week-sub">
            {weekSpan}. {open === 0
              ? 'Nothing left to do.'
              : `${open} ${open === 1 ? 'job' : 'jobs'} to do${overdue.length > 0 ? `, ${overdue.length} of them from earlier` : ''}.`}
          </p>
        </header>
        {!g.climate ? (
          <p class="week-banner">
            Dates need your town or your frost dates. <a href={hrefOf({ name: 'settings', section: 'climate' })}>Set them in Settings</a>.
          </p>
        ) : null}
        {overdue.length > 0 ? <TaskGroup id="overdue" heading="Still to do from earlier" tasks={overdue} plants={plants} onToggle={toggle} today={todayDay} /> : null}
        {now.length > 0 ? <TaskGroup id="today" heading="Today" tasks={now} plants={plants} onToggle={toggle} today={todayDay} /> : null}
        {later.length > 0 ? <TaskGroup id="later" heading="Later this week" tasks={later} plants={plants} onToggle={toggle} today={todayDay} /> : null}
        {quiet ? (
          <section class="panel week-empty">
            <h2>Nothing to do this week</h2>
            <p class="muted">
              {next
                ? `The next job is on ${fmtNear(next.date, todayDay)}: ${inSentence(title(next, plants.get(next.plantId)))}.`
                : g.plantings.length === 0
                  ? 'Add plants to the garden and their jobs appear here.'
                  : 'No jobs in the next few weeks.'}
            </p>
            <a href={hrefOf({ name: 'calendar' })}>Look at the year ahead</a>
          </section>
        ) : null}
      </div>
      <aside class="week-side" aria-label="Weather and what is next">
        <FrostWatch />
        <section class="panel week-coming">
          <h2>Coming up</h2>
          {coming.length === 0 ? (
            <p class="muted">
              Nothing in the next three weeks.
              {next && !quiet ? ` The next job is on ${fmtNear(next.date, todayDay)}: ${inSentence(title(next, plants.get(next.plantId)))}.` : ''}
            </p>
          ) : null}
          {comingDays.length > 0 ? (
            <ul class="coming-days">
              {comingDays.map((d) => (
                <li key={d.day}>
                  <h3 class="coming-day">{fmtNear(d.day, todayDay)}</h3>
                  <ul>
                    {d.tasks.map((t) => (
                      <li key={t.id}>{title(t, plants.get(t.plantId))}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
          <a href={hrefOf({ name: 'calendar' })}>See the whole year</a>
        </section>
      </aside>
    </main>
  );
}

function TaskGroup(props: { id: string; heading: string; tasks: Task[]; plants: ReadonlyMap<string, Plant>; onToggle: (t: Task) => void; today: DayNum }) {
  const g = garden.value!;
  return (
    <section class="week-group" aria-labelledby={`wk-${props.id}`}>
      <h2 id={`wk-${props.id}`}>{props.heading}</h2>
      <ul>
        {props.tasks.map((t) => {
          const plant = props.plants.get(t.plantId);
          const container = g.containers.find((c) => c.id === t.containerId);
          const planting = g.plantings.find((p) => p.id === t.plantingId);
          const where = [container?.name, planting?.cells ? squaresLabel(planting.cells) : null, planting ? `${planting.count} ${planting.count === 1 ? 'plant' : 'plants'}` : null]
            .filter(Boolean)
            .join(', ');
          const name = title(t, plant);
          const when =
            t.until !== undefined && t.until !== t.date
              ? t.until - t.date >= 364
                ? 'Any time of year'
                : `Any day ${sameYear(t.date, t.until, props.today) ? fmtRange(t.date, t.until) : fmtSpan(t.date, t.until, props.today)}`
              : fmtNear(t.date, props.today);
          return (
            <li key={t.id} class="task" data-done={t.done}>
              <input type="checkbox" id={`task-${t.id}`} checked={t.done} onChange={() => props.onToggle(t)} />
              {plant ? <Glyph form={plant.glyph.form} color={plant.glyph.color} size={34} /> : <span class="task-glyph-gap" />}
              <label for={`task-${t.id}`} class="task-text">
                <span class="task-title">
                  {name}
                  {t.reason.code === 'late-planting' ? <span class="task-late">Late</span> : null}
                </span>
                <span>{where}</span>
                <span class="muted task-why">
                  {when}. {sentence(reasonText(t.reason, units.value))}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const sameYear = (a: DayNum, b: DayNum, ref: DayNum) => partsFromDay(a).year === partsFromDay(ref).year && partsFromDay(b).year === partsFromDay(ref).year;

/** Exposed for tests: the ISO date a checkbox would record. */
export const tickDate = () => toIso(toDay(today.value));
