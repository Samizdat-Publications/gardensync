// The plant library: search, filter chips and a grid of every plant with one line of timing for
// this garden. With a plant chosen, its card sits beside the grid on wide screens; on narrow ones the
// card is its own view with a link back (artboard A-plants, ledger items 2 to 20).
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { PLANTS } from '../../domain/plants/library';
import type { Category } from '../../domain/plants/schema';
import { garden, today } from '../appState';
import { Glyph } from '../components/Glyph';
import { hrefOf } from '../router';
import { gardenPlants } from '../uiState';
import { PlantCard } from './PlantCard';
import { CATEGORY_FILTERS, FEATURE_FILTERS, filterPlants, type FeatureFilter } from './search';
import { canGoInNow, hasSchedule, timingLine } from './timing';
import './PlantsScreen.css';

// What the gardener typed and pressed stays while they open cards and come back. UI state only.
const query = signal('');
const features = signal<ReadonlySet<FeatureFilter>>(new Set());
const categories = signal<ReadonlySet<Category>>(new Set());

function toggle<T>(s: ReadonlySet<T>, v: T): ReadonlySet<T> {
  const next = new Set(s);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

/** "63 plants, each checked against at least two growing guides", plus the gardener's own. */
function countLine(custom: number): string {
  const min = Math.min(...PLANTS.map((p) => p.sources.length));
  const guides = `${NUMBER_WORDS[min] ?? String(min)} growing guide${min === 1 ? '' : 's'}`;
  const own = custom > 0 ? `, plus ${custom} of your own` : '';
  return `${PLANTS.length} plants, each checked against at least ${guides}${own}`;
}

export function PlantsScreen({ plantId }: { plantId?: string }) {
  const g = garden.value;
  const profile = g?.climate ?? null;
  const day = today.value;
  const plants = gardenPlants.value;
  const scheduled = hasSchedule(profile);

  // One timing line per plant, worked out once per climate, day and plant list.
  const lines = useMemo(() => new Map(plants.map((r) => [r.plant.id, timingLine(r.plant, profile, day)])), [plants, profile, day]);
  const nowIds = useMemo(
    () => (scheduled ? new Set(plants.filter((r) => canGoInNow(r.plant, profile, day)).map((r) => r.plant.id)) : new Set<string>()),
    [plants, profile, day, scheduled],
  );

  const feats = features.value;
  const activeFeatures = scheduled ? feats : new Set([...feats].filter((f) => f !== 'now'));
  const cats = categories.value;
  const q = query.value;
  const shown = filterPlants(plants, { query: q, features: activeFeatures, categories: cats, canGoInNow: (p) => nowIds.has(p.id) });
  const filtering = q.trim() !== '' || activeFeatures.size > 0 || cats.size > 0;
  const customCount = plants.filter((r) => r.custom).length;

  const chosen = plantId ? plants.find((r) => r.plant.id === plantId) : undefined;

  // Focus: the card heading when a card opens; the plant's link in the grid when it closes.
  const cardHeading = useRef<HTMLHeadingElement>(null);
  const previous = useRef<string | undefined>(undefined);
  const mounted = useRef(false);

  // Beside the grid the card reads like a page: it scrolls with the page and, once its end is in
  // view, stays put while the grid scrolls on. CSS needs its height for that (see .plant-card).
  const cardCol = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const col = cardCol.current;
    const card = col?.firstElementChild;
    if (!col || !(card instanceof HTMLElement)) return;
    const measure = () => col.style.setProperty('--pc-h', `${Math.ceil(card.getBoundingClientRect().height)}px`);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    return () => ro.disconnect();
  }, [plantId, !!chosen]);

  useEffect(() => {
    const prev = previous.current;
    previous.current = plantId;
    if (plantId && (plantId !== prev || !mounted.current)) {
      const h = cardHeading.current;
      h?.focus({ preventScroll: true });
      // A card longer than the window may be resting with its end in view; open it at its top.
      const r = h?.getBoundingClientRect();
      if (r && (r.top < 0 || r.bottom > innerHeight)) scrollTo(0, 0);
    } else if (!plantId && prev && mounted.current) {
      document.querySelector<HTMLElement>(`[data-plant-link="${CSS.escape(prev)}"]`)?.focus();
    }
    mounted.current = true;
  }, [plantId]);

  const clear = () => {
    query.value = '';
    features.value = new Set();
    categories.value = new Set();
  };

  return (
    <main class="plants" data-card={plantId ? 'open' : undefined}>
      <section class="plants-lib" aria-labelledby="plants-title">
        <div class="plants-head">
          <h1 id="plants-title" tabIndex={-1}>
            Plants
          </h1>
          <p class="muted">{countLine(customCount)}</p>
        </div>
        <div class="plants-tools">
          <div class="plants-find">
            <label for="plants-find" class="visually-hidden">
              Find a plant
            </label>
            <input
              id="plants-find"
              class="input"
              type="search"
              placeholder="Find a plant"
              autocomplete="off"
              aria-describedby="plants-find-hint"
              value={q}
              onInput={(e) => (query.value = e.currentTarget.value)}
            />
            <span id="plants-find-hint" class="visually-hidden">
              By name, Latin name or family, or words like herb, shade or pot.
            </span>
          </div>
          <div role="group" aria-label="Show only" class="plants-chips">
            {FEATURE_FILTERS.filter((f) => f.id !== 'now' || scheduled).map((f) => (
              <button
                key={f.id}
                type="button"
                class="chip"
                aria-pressed={feats.has(f.id)}
                onClick={() => (features.value = toggle(features.value, f.id))}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Kinds of plant" class="plants-chips">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                class="chip"
                aria-pressed={cats.has(c.id)}
                onClick={() => (categories.value = toggle(categories.value, c.id))}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <p class="plants-status muted small" role="status">
          {filtering ? `${shown.length} of ${plants.length} plants shown` : ''}
        </p>
        {shown.length > 0 ? (
          <ul class="plants-grid" aria-label="Plants">
            {shown.map(({ plant: p, custom }) => (
              <li key={p.id}>
                <a
                  class="plant-tile"
                  href={hrefOf({ name: 'plants', plantId: p.id })}
                  data-plant-link={p.id}
                  aria-current={p.id === plantId ? 'true' : undefined}
                >
                  <Glyph form={p.glyph.form} color={p.glyph.color} size={40} />
                  <span class="plant-tile-name">{p.name}</span>
                  <span class="plant-tile-when">{lines.get(p.id)}</span>
                  {custom ? <span class="plant-tile-own">Your own</span> : null}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div class="plants-empty panel">
            <h2>No plants match</h2>
            <p class="muted">Try fewer filters or another word.</p>
            <button type="button" class="btn" onClick={clear}>
              Clear the search and filters
            </button>
          </div>
        )}
      </section>
      {plantId ? (
        <div class="plant-col" ref={cardCol}>
          {chosen ? (
            <PlantCard resolved={chosen} headingRef={cardHeading} />
          ) : (
            <article class="plant-card" aria-labelledby="pc-name">
              <a class="plant-back" href={hrefOf({ name: 'plants' })}>
                All plants
              </a>
              <h2 id="pc-name" ref={cardHeading} tabIndex={-1}>
                Plant not found
              </h2>
              <p class="muted">This garden has no plant with that name. It may have been removed.</p>
            </article>
          )}
        </div>
      ) : null}
    </main>
  );
}
