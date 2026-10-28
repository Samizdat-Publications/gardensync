// Town search against the Open-Meteo geocoder, used by first run and by Settings. Results appear as
// the gardener types; picking one calls onPick. Only the typed text goes to the geocoder.
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { OpenMeteoError, searchPlaces, type PlaceHit } from '../../platform/openmeteo';
import './PlaceSearch.css';

interface Props {
  id: string;
  label?: string;
  picked?: PlaceHit | null;
  onPick: (place: PlaceHit) => void;
  autoFocus?: boolean;
}

export function describePlace(p: PlaceHit): string {
  return [p.region, p.country].filter(Boolean).join(', ');
}

export function placeErrorText(err: unknown): string {
  if (err instanceof OpenMeteoError) {
    if (err.kind === 'timeout') return 'The weather service took too long to answer.';
    if (err.kind === 'network') return 'GardenSync could not reach the weather service. Check the connection.';
    if (err.kind === 'bad-data') return 'The weather records for this place could not be turned into frost dates.';
  }
  return 'The weather service did not answer.';
}

export function PlaceSearch({ id, label = 'Town or postal code', picked, onPick, autoFocus }: Props) {
  const query = useSignal('');
  const hits = useSignal<PlaceHit[]>([]);
  const status = useSignal('');
  // Set when a place is picked: the box then shows its full name without searching for it again.
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const q = query.value.trim();
    if (shown.current !== null && query.value === shown.current) return;
    shown.current = null;
    if (q.length < 2) {
      hits.value = [];
      status.value = '';
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      status.value = 'Searching';
      try {
        hits.value = await searchPlaces(q, { signal: ctl.signal, count: 6 });
        status.value = hits.value.length === 0 ? 'No places match. Try the nearest town, or a postal code.' : `${hits.value.length} places found`;
      } catch (err) {
        if (!ctl.signal.aborted) status.value = placeErrorText(err);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query.value]);

  return (
    <div class="field place-search">
      <label for={id}>{label}</label>
      <input
        id={id}
        class="input"
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query.value}
        onInput={(e) => (query.value = (e.target as HTMLInputElement).value)}
        aria-describedby={`${id}-status`}
      />
      <span id={`${id}-status`} class="muted place-search-status" role="status" aria-live="polite">
        {status.value}
      </span>
      {hits.value.length > 0 ? (
        <ul class="place-hits" aria-label="Matching places">
          {hits.value.map((p) => (
            <li key={`${p.lat},${p.lon}`}>
              <button
                type="button"
                class="place-hit"
                aria-pressed={!!picked && picked.lat === p.lat && picked.lon === p.lon}
                onClick={() => {
                  const name = [p.name, describePlace(p)].filter(Boolean).join(', ');
                  shown.current = name;
                  query.value = name;
                  hits.value = [];
                  status.value = '';
                  onPick(p);
                }}
              >
                <strong>{p.name}</strong>
                <span class="muted">{describePlace(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
