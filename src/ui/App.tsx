// The app: boot states first (loading, a 7.x garden to bring across, a save to recover, another tab
// saved), then first run when there is no garden yet, then the screens behind the shared header.
import { useMemo } from 'preact/hooks';
import { migrateV7Storage } from '../domain/doc/migrate-v7';
import { applyOp } from '../domain/doc/ops';
import { emptyDoc } from '../domain/doc/schema';
import { adoptDoc, boot, garden, newId, store, today } from './appState';
import { AssistantComponent, assistantOpen } from './assistant/open';
import { Header } from './components/Header';
import { route } from './router';
import { GardenScreen } from './planner/GardenScreen';
import { PlantsScreen } from './plants/PlantsScreen';
import { FirstRun } from './screens/FirstRun';
import { CalendarScreen } from './calendar/CalendarScreen';
import { HarvestScreen } from './harvest/HarvestScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { ShareScreen } from './share/ShareScreen';
import { WeekScreen } from './week/WeekScreen';
import './App.css';

export function App() {
  const b = boot.value;
  if (b.kind === 'loading') return <main class="center-screen" aria-busy="true" />;
  if (b.kind === 'offer-v7') return <OfferV7 raw={b.raw} />;
  if (b.kind === 'recovery') return <Recovery />;
  if (b.kind === 'conflict') return <Conflict reason={b.reason} />;
  const r = route.value;
  // A share link opens before first run, so a first visit through a link can add the garden.
  if (r.name === 'share') return <ShareScreen payload={r.payload} {...(r.legacy ? { legacy: true } : {})} />;
  if (!garden.value) return <FirstRun />;

  return (
    <>
      <a class="skip-link" href="#screen">
        Skip to content
      </a>
      <Header />
      <div id="screen">
        {r.name === 'garden' ? <GardenScreen /> : null}
        {r.name === 'week' ? <WeekScreen /> : null}
        {r.name === 'calendar' ? <CalendarScreen /> : null}
        {r.name === 'plants' ? <PlantsScreen {...(r.plantId ? { plantId: r.plantId } : {})} /> : null}
        {r.name === 'harvest' ? <HarvestScreen /> : null}
        {r.name === 'settings' ? <SettingsScreen /> : null}
      </div>
      {assistantOpen.value && AssistantComponent.value ? <AssistantComponent.value /> : null}
    </>
  );
}

function OfferV7({ raw }: { raw: Record<string, string | null> }) {
  const result = useMemo(
    () => migrateV7Storage(raw, { today: today.value, newId, tzOffsetMinutes: -new Date().getTimezoneOffset() }),
    [raw],
  );
  if ('error' in result) {
    return (
      <main class="center-screen">
        <div class="panel notice">
          <h1 tabIndex={-1}>An older garden could not be read</h1>
          <p>GardenSync found data from version 7 in this browser but could not make sense of it: {result.error} It has been left exactly as it was.</p>
          <button class="btn btn-primary" onClick={() => adoptDoc(emptyDoc())}>
            Start a new garden
          </button>
        </div>
      </main>
    );
  }
  const { report, garden: g } = result;
  const bring = () => {
    const res = applyOp(emptyDoc(), {
      type: 'batch',
      ops: [
        { type: 'addGarden', garden: { id: g.id, name: g.name, createdAt: g.createdAt, cellCm: g.cellCm } },
        { type: 'setActiveGarden', gardenId: g.id },
      ],
    });
    if (!res.ok) return;
    adoptDoc({ ...res.doc, gardens: [g] });
  };
  return (
    <main class="center-screen">
      <div class="panel notice">
        <h1 tabIndex={-1}>Your older garden is here</h1>
        <p>
          GardenSync found a garden saved by version 7 in this browser: {report.containers} beds and pots, {report.plants} plants
          {report.unknownPlantIds.length > 0 ? `, ${report.unknownPlantIds.length} of them not in the new library` : ''}.
          {report.customPlantsCreated > 0 ? ` ${report.customPlantsCreated} come across as your own plants.` : ''} The old data stays
          untouched.
        </p>
        {report.warnings.length > 0 ? (
          <details>
            <summary>Details</summary>
            <ul>
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <div class="row">
          <button class="btn btn-primary" onClick={bring}>
            Bring it across
          </button>
          <button class="btn" onClick={() => adoptDoc(emptyDoc())}>
            Start a new garden instead
          </button>
        </div>
        <p class="muted small">After it comes across, set your town in Settings so the dates fit your climate.</p>
      </div>
    </main>
  );
}

function Recovery() {
  const b = boot.value;
  if (b.kind !== 'recovery') return null;
  const r = b.result;
  return (
    <main class="center-screen">
      <div class="panel notice">
        <h1 tabIndex={-1}>{r.status === 'needs-repair' ? 'Your garden needs a small repair' : 'Your saved garden could not be read'}</h1>
        {r.status === 'needs-repair' ? (
          <>
            <p>Some records in the saved garden point at things that no longer exist. GardenSync can tidy them up; a copy of the original is kept aside.</p>
            {r.remaining.length > 0 ? <p class="muted">Some problems need you to check them afterwards: {r.remaining.map((p) => p.message).join(' ')}</p> : null}
            <div class="row">
              <button class="btn btn-primary" onClick={() => adoptDoc(r.repaired)}>
                Repair and continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{r.problem} A copy of the saved text has been kept aside{r.quarantineKey ? '' : ` (${r.note ?? 'the copy could not be made'})`}, so nothing is lost.</p>
            <div class="row">
              <a class="btn" href={rawSaveHref()} download="gardensync-unreadable-save.json">
                Download the saved text
              </a>
              <button class="btn btn-primary" onClick={() => adoptDoc(emptyDoc(), { replaceUnreadable: true })}>
                Start a new garden
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function rawSaveHref(): string {
  try {
    const raw = localStorage.getItem('gardensync.v8.doc') ?? '';
    return URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  } catch {
    return '#';
  }
}

function Conflict({ reason }: { reason: 'other-tab' | 'unknown-format' }) {
  return (
    <main class="center-screen">
      <div class="panel notice">
        <h1 tabIndex={-1}>{reason === 'other-tab' ? 'GardenSync is open in another tab' : 'A newer GardenSync saved this garden'}</h1>
        <p>
          {reason === 'other-tab'
            ? 'Changes were saved in another tab or window. Reload to carry on with the latest version; nothing was overwritten.'
            : 'The garden in this browser was saved by a newer version. Reload to get the newest GardenSync; nothing was overwritten.'}
        </p>
        <button class="btn btn-primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </main>
  );
}

// Keep the store referenced so tests and the console can reach it in development.
if (import.meta.env.DEV) (globalThis as { gardensync?: unknown }).gardensync = { store };
