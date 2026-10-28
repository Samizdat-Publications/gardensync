// Placing a plant: what is chosen, how many, the dates it gets (the next viable window from the day
// shown, and which window that is), what it shares squares with, and the one button that plants it.
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Plant } from '../../domain/plants/schema';
import { Glyph } from '../components/Glyph';
import { fmtDay } from '../format';
import { candidate } from './candidate';
import { plantLookup } from './derived';
import { cellsName } from './geometry';
import { clearSquares, commitPlacement } from './interactions';
import { draft, paletteOpen, stopPlacing } from './plannerState';
import { methodLabel, methodsFor, type PlaceMethod } from './placement';

function densityText(plant: Plant): string {
  const d = plant.density;
  if ('perSquare' in d) return d.perSquare === 1 ? 'One per square' : `${d.perSquare} per square`;
  const [a, b] = d.squares;
  return `One plant needs ${a} by ${b} squares`;
}

export function PlacementPanel({ onChange }: { onChange?: () => void }) {
  const c = candidate.value;
  const d = draft.value;
  const error = useSignal<string | null>(null);
  const countText = useSignal('');
  useEffect(() => {
    countText.value = c ? String(c.count) : '';
  }, [c?.count, c?.container?.id, c?.cells?.w, c?.cells?.h]);
  useEffect(() => {
    error.value = null;
  }, [c?.plant.id, d.containerId]);
  if (!c) return null;
  const plant = c.plant;
  const lower = plant.name.toLowerCase();
  const ways = methodsFor(plant);
  const conflicts = c.clashes.filter((x) => x.kind === 'conflict');
  const shares = c.clashes.filter((x) => x.kind === 'interplant');
  const plantOf = plantLookup.value;
  const takenHere = c.container?.form === 'grid' ? c.taken.filter((t) => t.planting.containerId === c.container!.id) : [];

  let where: string;
  if (!c.container) where = 'Tap a square to start the patch, then tap the square at the far corner. Or tap a pot.';
  else if (c.container.form === 'vessel') where = `${c.container.name}.`;
  else if (c.cells && d.phase === 'started') where = `${c.container.name}, ${cellsName(c.cells)}. Tap the far corner to make the patch bigger, or plant just this.`;
  else if (c.cells) where = `${c.container.name}, ${cellsName(c.cells)}: ${c.cells.w * c.cells.h} ${c.cells.w * c.cells.h === 1 ? 'square' : 'squares'}.`;
  else where = `${c.container.name}: tap a square to start the patch.`;

  return (
    <section class="placement" aria-labelledby="placement-title">
      <div class="insp-head">
        <Glyph form={plant.glyph.form} color={plant.glyph.color} size={44} />
        <div>
          <h2 id="placement-title">Placing {lower}</h2>
          <p class="muted small">{densityText(plant)}.</p>
        </div>
        <button
          type="button"
          class="btn change-plant"
          onClick={() => {
            paletteOpen.value = true;
            requestAnimationFrame(() => document.getElementById('planner-find')?.focus());
          }}
        >
          Change
        </button>
      </div>

      {ways.length > 1 ? (
        <div class="field">
          <label for="place-method">How it goes in</label>
          <select
            id="place-method"
            class="input"
            value={c.method}
            onChange={(e) => {
              draft.value = { ...draft.value, method: (e.currentTarget as HTMLSelectElement).value as PlaceMethod, allowClash: false };
              onChange?.();
            }}
          >
            {ways.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m, plant)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <p class="place-where" aria-live="polite">
        {where}
      </p>

      {c.datesText ? <p class="place-dates">{c.datesText}</p> : null}

      {c.container && (c.cells || c.container.form === 'vessel') ? (
        <div class="field">
          <label for="place-count">Plants</label>
          <input
            id="place-count"
            class="input count-input"
            type="number"
            inputMode="numeric"
            min={1}
            max={c.maxCount ?? 10000}
            step={1}
            aria-describedby="place-count-hint"
            value={countText.value}
            onInput={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value;
              countText.value = v;
              const n = Math.round(Number(v));
              if (v !== '' && Number.isFinite(n)) draft.value = { ...draft.value, count: n };
            }}
          />
          <span id="place-count-hint" class="muted small">
            {c.maxCount !== null ? `This one has room for ${c.maxCount}.` : `${c.defaultCount} at the usual spacing.`}
          </span>
        </div>
      ) : null}

      {takenHere.length > 0 ? (
        <p class="small muted">
          <strong>Hatched squares are taken</strong> while this would grow:{' '}
          {takenHere
            .slice(0, 4)
            .map((t) => `${plantOf(t.planting.plantId)?.name ?? 'a plant'} ${t.until === null ? 'from year to year' : `until ${fmtDay(t.until)}`}`)
            .join(', ')}
          {takenHere.length > 4 ? ', and more' : ''}.
        </p>
      ) : null}

      {c.problems.map((p) => (
        <p key={p} class="place-problem">
          <span class="visually-hidden">Problem: </span>
          {p}
        </p>
      ))}
      {c.warnings.map((w) => (
        <p key={w} class="caution small">
          <span class="visually-hidden">Note: </span>
          {w}
        </p>
      ))}
      {shares.map((s) => (
        <p key={s.with.id} class="place-share small">
          <span class="badge badge-share">Interplant</span> {s.reason}
        </p>
      ))}
      {conflicts.map((s) => (
        <p key={s.with.id} class="place-problem">
          <span class="visually-hidden">Clash: </span>
          {s.reason}
        </p>
      ))}
      {c.load && !c.load.ok ? <p class="place-problem">{c.load.reason}</p> : null}
      {c.needsAnyway ? (
        <label class="check">
          <input type="checkbox" checked={d.allowClash} onChange={(e) => (draft.value = { ...draft.value, allowClash: (e.currentTarget as HTMLInputElement).checked })} />
          {c.container?.form === 'vessel' ? 'Plant anyway' : 'Interplant anyway'}
        </label>
      ) : null}

      {error.value ? (
        <p class="form-error" role="alert">
          {error.value}
        </p>
      ) : null}

      <div class="row place-actions">
        <button
          type="button"
          class="btn btn-primary"
          disabled={!c.planting}
          aria-describedby={!c.planting && !c.problems.length ? 'place-where' : undefined}
          onClick={() => {
            const res = commitPlacement();
            error.value = res.ok ? null : (res.error ?? null);
            if (res.ok) onChange?.();
          }}
        >
          {`Plant ${c.count > 0 && c.container ? `${c.count} ` : ''}${lower}`}
        </button>
        {d.phase !== 'none' ? (
          <button type="button" class="btn" onClick={clearSquares}>
            Clear squares
          </button>
        ) : null}
        {/* "Cancel" is shown on desktop where the sheet-head "Stop placing" is hidden. */}
        <button type="button" class="btn place-cancel" onClick={stopPlacing}>
          Stop placing
        </button>
      </div>
    </section>
  );
}
