// Frost watch for This week: the next 7 nights' lows from the Open-Meteo forecast, and a warning
// when a night at or below freezing falls while tender crops are in the ground. Kept for 3 hours per
// place so moving between screens does not refetch. Offline, it says so and the rest still works.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { toDay } from '../../domain/dates';
import { plantingPhases } from '../../domain/schedule';
import { formatTemp } from '../../domain/units';
import { fetchForecast, type NightForecast } from '../../platform/openmeteo';
import { garden, units } from '../appState';
import { fmtDay, inSentence } from '../format';
import { plantOf } from '../uiState';

const CACHE_MS = 3 * 60 * 60 * 1000;
const NEAR_FROST_C = 2;

function cacheKey(lat: number, lon: number) {
  return `gardensync.v8.forecast.${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function readCache(key: string): NightForecast[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, nights } = JSON.parse(raw) as { at: number; nights: NightForecast[] };
    return Date.now() - at < CACHE_MS ? nights : null;
  } catch {
    return null;
  }
}

export function FrostWatch() {
  const g = garden.value;
  const place = g?.climate?.place;
  const state = useSignal<{ kind: 'loading' } | { kind: 'ok'; nights: NightForecast[] } | { kind: 'error' }>({ kind: 'loading' });

  useEffect(() => {
    if (!place) return;
    const key = cacheKey(place.lat, place.lon);
    const cached = readCache(key);
    if (cached) {
      state.value = { kind: 'ok', nights: cached };
      return;
    }
    const ctl = new AbortController();
    fetchForecast(place.lat, place.lon, { signal: ctl.signal })
      .then((nights) => {
        state.value = { kind: 'ok', nights };
        try {
          sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), nights }));
        } catch {
          // Without session storage the forecast is simply fetched again next time.
        }
      })
      .catch(() => {
        if (!ctl.signal.aborted) state.value = { kind: 'error' };
      });
    return () => ctl.abort();
  }, [place?.lat, place?.lon]);

  if (!g || !place) return null;
  const u = units.value;
  const s = state.value;

  let warning: { night: NightForecast; crops: string[] } | null = null;
  if (s.kind === 'ok') {
    const frosty = s.nights.find((n) => n.minC <= 0);
    if (frosty) {
      const day = toDay(frosty.date);
      const crops = new Set<string>();
      for (const p of g.plantings) {
        const plant = plantOf(p.plantId);
        if (!plant || plant.frost !== 'tender') continue;
        const ph = plantingPhases(p, plant, g.climate);
        if (ph && ph.bedIn <= day && (ph.bedOut === null || day < ph.bedOut)) crops.add(inSentence(plant.name));
      }
      warning = { night: frosty, crops: [...crops] };
    }
  }

  return (
    <>
      {warning ? (
        <section class="frost-alert" aria-labelledby="frost-alert-h">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <path d="M14 3v22M4.5 8.5l19 11M23.5 8.5l-19 11M10.5 4.5 14 7l3.5-2.5M10.5 23.5 14 21l3.5 2.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div>
            <h2 id="frost-alert-h">
              Frost likely on the night of {fmtDay(toDay(warning.night.date))}, low of {formatTemp(warning.night.minC, u)}
            </h2>
            <p>
              {warning.crops.length > 0
                ? `Cover or bring in what frost would kill: ${warning.crops.join(', ')}.`
                : 'Nothing in the ground is tender, but seedlings hardening off should come in for the night.'}
            </p>
          </div>
        </section>
      ) : null}
      <section class="panel nights" aria-labelledby="nights-h">
        <h2 id="nights-h">Next 7 nights</h2>
        {s.kind === 'loading' ? <p class="muted">Getting the forecast.</p> : null}
        {s.kind === 'error' ? <p class="muted">The forecast did not load. It comes back when you are online; everything else still works.</p> : null}
        {s.kind === 'ok' ? (
          <ol class="nights-list">
            {s.nights.map((n) => {
              const frost = n.minC <= 0;
              const near = !frost && n.minC <= NEAR_FROST_C;
              return (
                <li key={n.date} data-frost={frost ? 'yes' : near ? 'near' : 'no'}>
                  <span class="muted">{new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(toDay(n.date) * 86_400_000))}</span>
                  <strong>{formatTemp(n.minC, u)}</strong>
                  <span class="night-flag">{frost ? 'Frost' : near ? 'Near' : ''}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
        <p class="muted small">Overnight lows from the Open-Meteo forecast for {place.name}.</p>
      </section>
    </>
  );
}
