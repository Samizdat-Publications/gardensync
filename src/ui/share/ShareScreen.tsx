// Opening a shared garden (#share=g1.… from 8.0, or an old #plan=… link from 7.x): a summary of
// what is in it, then add it to this browser's gardens under fresh ids, or leave it. Nothing is
// saved until the gardener chooses. A shared garden without a location uses the gardener's own.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { decodeV7ShareHash } from '../../domain/doc/migrate-v7';
import type { Garden } from '../../domain/doc/schema';
import { decodeShare } from '../../domain/doc/share';
import { adoptDoc, garden as activeGarden, newId, store, today } from '../appState';
import { navigate } from '../router';
import { plantOf } from '../uiState';

type State = { kind: 'loading' } | { kind: 'ok'; garden: Garden } | { kind: 'error'; message: string };

/** A copy of the garden with new ids, so it can sit beside the gardener's own without clashing. */
function withFreshIds(g: Garden): Garden {
  const map = new Map<string, string>();
  const fresh = (old: string) => {
    if (!map.has(old)) map.set(old, newId());
    return map.get(old)!;
  };
  return {
    ...g,
    id: newId(),
    containers: g.containers.map((c) => ({ ...c, id: fresh(c.id) })),
    series: g.series.map((s) => ({ ...s, id: fresh(s.id) })),
    plantings: g.plantings.map((p) => ({
      ...p,
      id: fresh(p.id),
      containerId: fresh(p.containerId),
      ...(p.seriesId ? { seriesId: fresh(p.seriesId) } : {}),
    })),
    harvests: [],
    journal: [],
    taskState: {},
  };
}

export function ShareScreen({ payload, legacy }: { payload: string; legacy?: boolean }) {
  const state = useSignal<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    if (legacy) {
      const res = decodeV7ShareHash(payload, { today: today.value, newId });
      state.value = 'error' in res ? { kind: 'error', message: res.error } : { kind: 'ok', garden: res.garden };
    } else {
      void decodeShare(payload).then((res) => {
        if (alive) state.value = 'error' in res ? { kind: 'error', message: res.error } : { kind: 'ok', garden: res.garden };
      });
    }
    return () => {
      alive = false;
    };
  }, [payload]);

  const s = state.value;
  const leave = () => {
    history.replaceState(null, '', location.pathname);
    navigate({ name: 'garden' });
  };

  if (s.kind === 'loading') return <main class="center-screen" aria-busy="true" />;
  if (s.kind === 'error') {
    return (
      <main class="center-screen">
        <div class="panel notice">
          <h1 tabIndex={-1}>This shared garden could not be opened</h1>
          <p>{s.message} Nothing in your own gardens was changed.</p>
          <div class="row">
            <button class="btn btn-primary" onClick={leave}>
              Go to my garden
            </button>
          </div>
        </div>
      </main>
    );
  }

  const g = s.garden;
  const plantCount = g.plantings.reduce((n, p) => n + p.count, 0);
  const crops = [...new Set(g.plantings.map((p) => plantOf(p.plantId)?.name ?? p.plantId))].sort();
  const mine = activeGarden.value;

  function add() {
    const copy = withFreshIds(g);
    const climate = copy.climate ?? mine?.climate ?? null;
    const d = store.doc.value;
    const next = { ...copy, climate, name: d.gardens.some((x) => x.name === copy.name) ? `${copy.name} (shared)` : copy.name };
    adoptDoc({ ...d, gardens: [...d.gardens, next], settings: { ...d.settings, activeGardenId: next.id } });
    history.replaceState(null, '', location.pathname);
    navigate({ name: 'garden' });
  }

  return (
    <main class="center-screen">
      <div class="panel notice">
        <h1 tabIndex={-1}>{g.name}</h1>
        <p>
          A shared garden: {g.containers.length} {g.containers.length === 1 ? 'bed or pot' : 'beds and pots'}, {plantCount} plants
          {crops.length > 0 ? ` (${crops.slice(0, 8).join(', ')}${crops.length > 8 ? ', and more' : ''})` : ''}.
        </p>
        <p class="muted">
          {g.climate?.place
            ? `It comes with frost dates for ${g.climate.place.name}.`
            : mine?.climate
              ? 'It has no location, so it will use your frost dates.'
              : 'It has no location; set your town after adding it.'}{' '}
          Adding it keeps your own gardens as they are.
        </p>
        <div class="row">
          <button class="btn btn-primary" onClick={add}>
            Add to my gardens
          </button>
          <button class="btn" onClick={leave}>
            No thanks
          </button>
        </div>
      </div>
    </main>
  );
}
