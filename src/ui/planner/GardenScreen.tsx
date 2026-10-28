// The Garden screen. The planner itself (Planner.tsx) is its own chunk, so the entry bundle stays
// inside its budget; the chunk starts loading as soon as the app does, and the service worker
// precaches it, so on a return visit it is there at once.
import { useEffect, useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';

let Loaded: FunctionComponent | null = null;
const loading = import('./Planner').then((m) => {
  Loaded = m.Planner;
  return m.Planner;
});

export function GardenScreen() {
  const [, setReady] = useState(Loaded !== null);
  useEffect(() => {
    if (!Loaded) void loading.then(() => setReady(true));
  }, []);
  if (!Loaded) {
    return (
      <main class="placeholder" aria-busy="true">
        <h1 tabIndex={-1}>Garden</h1>
      </main>
    );
  }
  return <Loaded />;
}
