// The plant palette: find a plant, filter by kind or by what can go in this week, and choose one
// to place. Choosing is a tap (or Enter); nothing here needs a drag (ledger 3).
import { useSignal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { toDay } from '../../domain/dates';
import type { Category } from '../../domain/plants/schema';
import { garden, today } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay } from '../format';
import { gardenPlants, placingPlantId } from '../uiState';
import { startPlacing, stopPlacing } from './plannerState';
import { defaultMethod, nextWindow, verbOf, WEEK_DAYS } from './placement';

const KINDS: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'vegetable', label: 'Vegetables' },
  { id: 'herb', label: 'Herbs' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'flower', label: 'Flowers' },
];

export function Palette({ onChosen, headingId }: { onChosen?: () => void; headingId: string }) {
  const query = useSignal('');
  const kind = useSignal<Category | 'all'>('all');
  const thisWeek = useSignal(false);
  const climate = garden.value?.climate ?? null;
  const todayDay = toDay(today.value);
  const all = gardenPlants.value;
  const chosen = placingPlantId.value;

  // When each plant can next go in, from today. The schedule is memoised in the domain.
  const hints = useMemo(() => {
    const out = new Map<string, { soon: boolean; text: string }>();
    for (const r of all) {
      if (!climate) {
        out.set(r.plant.id, { soon: false, text: '' });
        continue;
      }
      // Use the plant's default method so the hint matches what a click will do and the library.
      const m = defaultMethod(r.plant);
      const win = nextWindow(r.plant, climate, m, todayDay);
      if (!win) out.set(r.plant.id, { soon: false, text: 'No planting dates here' });
      else if (win.bedIn < todayDay + WEEK_DAYS) out.set(r.plant.id, { soon: true, text: `${verbOf(m)} now` });
      else out.set(r.plant.id, { soon: false, text: `${verbOf(m)} from ${fmtDay(win.bedIn)}` });
    }
    return out;
  }, [all, climate, todayDay]);

  const q = query.value.trim().toLowerCase();
  const shown = all.filter((r) => {
    if (kind.value !== 'all' && r.plant.category !== kind.value) return false;
    if (thisWeek.value && !hints.get(r.plant.id)?.soon) return false;
    if (q && !r.plant.name.toLowerCase().includes(q) && !r.plant.latin.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div class="palette">
      <h2 id={headingId} class="palette-title">
        Plants
      </h2>
      <div class="field">
        <label for="planner-find">Find a plant</label>
        <input
          id="planner-find"
          class="input"
          type="search"
          placeholder="Tomato, basil, peas"
          autocomplete="off"
          value={query.value}
          onInput={(e) => (query.value = (e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <div role="group" aria-label="Kind of plant" class="palette-kinds">
        {KINDS.map((k) => (
          <button key={k.id} type="button" class="chip" aria-pressed={kind.value === k.id} onClick={() => (kind.value = k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      <label class="check">
        <input type="checkbox" checked={thisWeek.value} disabled={!climate} onChange={(e) => (thisWeek.value = (e.currentTarget as HTMLInputElement).checked)} />
        Can go in this week
      </label>
      <p class="visually-hidden" aria-live="polite">
        {shown.length === 1 ? '1 plant' : `${shown.length} plants`}
      </p>
      {shown.length === 0 ? (
        <p class="muted small">No plants match. Try another name, or turn off the filters.</p>
      ) : (
        <ul class="palette-list">
          {shown.map((r) => {
            const h = hints.get(r.plant.id);
            const on = chosen === r.plant.id;
            return (
              <li key={r.plant.id}>
                <button
                  type="button"
                  class="palette-item"
                  aria-pressed={on}
                  onClick={() => {
                    if (on) stopPlacing();
                    else startPlacing(r.plant.id);
                    onChosen?.();
                  }}
                >
                  <Glyph form={r.plant.glyph.form} color={r.plant.glyph.color} size={30} />
                  <span class="palette-text">
                    <span class="palette-name">{r.plant.name}</span>
                    {h?.text ? <span class="palette-hint">{h.text}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
