// The plant palette: find a plant, filter by kind or by what can go in this week, and choose one
// to place. Choosing is a tap (or Enter on keyboard). Drag from palette: hold and drag any plant
// item onto a bed square to drop it without choosing first. Mouse/pen: 6px threshold. Touch: 350ms
// long press starts the drag (the list still scrolls on short tap/scroll). A first-time hint at the
// top of the list is dismissible and remembered in localStorage.
import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { toDay } from '../../domain/dates';
import type { Category, Plant } from '../../domain/plants/schema';
import { garden, today } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay } from '../format';
import { gardenPlants, placingPlantId } from '../uiState';
import { paletteDrag, startPlacing, stopPlacing } from './plannerState';
import { defaultMethod, nextWindow, verbOf, WEEK_DAYS } from './placement';

const HINT_KEY = 'gardensync.palette-drag-hint-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {
    // Ignore storage errors.
  }
}

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
  const hintDismissed = useSignal(readDismissed());
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown.length > 0) {
              e.preventDefault();
              const first = shown[0]!.plant;
              if (placingPlantId.value === first.id) stopPlacing();
              else startPlacing(first.id);
              onChosen?.();
            }
          }}
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
      {!hintDismissed.value ? (
        <div class="palette-hint-banner" role="note">
          <span>Drag a plant onto a square, or tap it and then a square.</span>
          <button
            type="button"
            class="btn palette-hint-dismiss"
            onClick={() => {
              hintDismissed.value = true;
              writeDismissed();
            }}
          >
            Got it
          </button>
        </div>
      ) : null}
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
                <PaletteItem
                  plant={r.plant}
                  hint={h?.text ?? ''}
                  on={on}
                  onChoose={() => {
                    if (on) stopPlacing();
                    else startPlacing(r.plant.id);
                    onChosen?.();
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Starting a drag chooses the plant, as a tap would: the plan switches to the day it would go in,
 * so the crops it would share the bed with are on screen while it is dragged, and the drop plants it.
 */
function beginDrag(plant: Plant, x: number, y: number): void {
  if (placingPlantId.value !== plant.id) startPlacing(plant.id);
  paletteDrag.value = { plant, screenX: x, screenY: y, snap: null };
}

/** One plant row in the palette with drag-from-palette support. */
function PaletteItem({ plant, hint, on, onChoose }: { plant: Plant; hint: string; on: boolean; onChoose: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  // Long-press timer reference for touch.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = btn.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      // Ignore right-click and middle-click.
      if (e.button !== 0) return;
      pressStart.current = { x: e.clientX, y: e.clientY };

      if (e.pointerType === 'touch') {
        // Touch: long press starts drag. Short tap still fires click (for choosing).
        pressTimer.current = setTimeout(() => {
          if (!pressStart.current) return;
          // Cancel the pending click so choosing does not fire.
          pressStart.current = null;
          el.releasePointerCapture(e.pointerId);
          beginDrag(plant, e.clientX, e.clientY);
        }, 350);
      }
      // Mouse/pen: track movement in pointermove; if 6px threshold exceeded, start drag.
    };

    const onMove = (e: PointerEvent) => {
      if (!pressStart.current) return;
      if (e.pointerType === 'touch') {
        // Cancel long press if moved more than 8px (the user is scrolling).
        const dx = e.clientX - pressStart.current.x;
        const dy = e.clientY - pressStart.current.y;
        if (Math.hypot(dx, dy) > 8) {
          clearTimeout(pressTimer.current ?? undefined);
          pressTimer.current = null;
          pressStart.current = null;
        }
      } else {
        // Mouse/pen: 6px threshold starts drag.
        const dx = e.clientX - pressStart.current.x;
        const dy = e.clientY - pressStart.current.y;
        if (Math.hypot(dx, dy) >= 6) {
          pressStart.current = null;
          el.releasePointerCapture(e.pointerId);
          beginDrag(plant, e.clientX, e.clientY);
        }
      }
    };

    const onUp = () => {
      clearTimeout(pressTimer.current ?? undefined);
      pressTimer.current = null;
      pressStart.current = null;
    };

    const onCancel = () => {
      clearTimeout(pressTimer.current ?? undefined);
      pressTimer.current = null;
      pressStart.current = null;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, [plant]);

  return (
    <button
      ref={btn}
      type="button"
      class="palette-item"
      aria-pressed={on}
      onClick={onChoose}
    >
      <Glyph form={plant.glyph.form} color={plant.glyph.color} size={30} />
      <span class="palette-text">
        <span class="palette-name">{plant.name}</span>
        {hint ? <span class="palette-hint">{hint}</span> : null}
      </span>
    </button>
  );
}
