// Placing a plant: shows what is chosen, how it goes in, and the dates it would get. The "commit"
// action is now a tap or drag on the canvas; this panel is a helper that shows state and offers the
// method chooser and a Done button. Vessel placing still uses the candidate signal for its fit info.
import type { Plant } from '../../domain/plants/schema';
import { Glyph } from '../components/Glyph';
import { candidate } from './candidate';
import { plantLookup } from './derived';
import { fmtDay } from '../format';
import { placingPlantId } from '../uiState';
import { draft, paletteOpen, placingPreviewDay, stopPlacing } from './plannerState';
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
  if (!c) {
    const plantId = placingPlantId.value;
    const plant = plantId ? plantLookup.value(plantId) : null;
    if (!plant) return null;
    return (
      <section class="placement" aria-labelledby="placement-title">
        <div class="insp-head">
          <Glyph form={plant.glyph.form} color={plant.glyph.color} size={44} />
          <div>
            <h2 id="placement-title">Placing {plant.name.toLowerCase()}</h2>
          </div>
        </div>
        <p class="place-where">Tap a square to plant, or drag across squares to paint a bigger patch.</p>
        <div class="row place-actions">
          <button type="button" class="btn place-cancel" onClick={stopPlacing}>
            Stop placing
          </button>
        </div>
      </section>
    );
  }

  const plant = c.plant;
  const lower = plant.name.toLowerCase();
  const ways = methodsFor(plant);
  const plantOf = plantLookup.value;

  // Vessel: show fit info and how many fit.
  const isVessel = c.container?.form === 'vessel';
  const takenHere = !isVessel ? c.taken.filter((t) => c.container && t.planting.containerId === c.container.id) : [];

  // Show when the plant goes in (from the auto-switched view day or the shown day).
  const previewDay = placingPreviewDay.value;

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

      {previewDay !== null ? (
        <p class="place-where" aria-live="polite">
          Showing {fmtDay(previewDay)}, when {lower} would go in. Tap a square to plant, or drag to paint a bigger patch.
        </p>
      ) : (
        <p class="place-where" aria-live="polite">
          {isVessel && c.container
            ? `Tap the ${c.container.name} to add ${lower}.`
            : 'Tap a square to plant, or drag across squares to paint a bigger patch.'}
        </p>
      )}

      {c.datesText ? <p class="place-dates">{c.datesText}</p> : null}

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

      <div class="row place-actions">
        <button type="button" class="btn place-cancel" onClick={stopPlacing}>
          Stop placing
        </button>
      </div>
    </section>
  );
}
