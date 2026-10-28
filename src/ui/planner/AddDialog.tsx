// "Add a bed or pot": a real <dialog> (focus moves in, Escape closes, focus returns to the button
// that opened it). Sizes are number fields in the gardener's units; the new bed or pot goes on a
// free spot beside what is already there.
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { GRID_KINDS, VESSEL_KINDS, type Container } from '../../domain/doc/schema';
import { formatLength, formatVolume } from '../../domain/units';
import { garden, newId, units } from '../appState';
import { footprints } from './derived';
import { bedFootprint, freeSpot } from './geometry';
import { KIND_WORDS } from './Inspector';
import { fromLitres, readLength, toLitres, volumeUnit } from './measure';
import { act, selectContainer } from './plannerState';
import { fitAll } from './interactions';

type Kind = Container['kind'];
const isVessel = (k: Kind) => (VESSEL_KINDS as readonly string[]).includes(k);
const oneRow = (k: Kind) => k === 'window-box' || k === 'trough';

/** A name not used yet: "Bed 2", "Pot 3". */
export function nextName(kind: Kind, taken: readonly string[]): string {
  const base = isVessel(kind) ? (kind === 'pot' ? 'Pot' : KIND_WORDS[kind]) : oneRow(kind) ? KIND_WORDS[kind] : 'Bed';
  for (let n = 1; n < 1000; n++) {
    const name = `${base} ${n}`;
    if (!taken.includes(name)) return name;
  }
  return base;
}

export function AddDialog({ open, kind: initialKind, onClose }: { open: boolean; kind: Kind; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const g = garden.value!;
  const u = units.value;
  const kind = useSignal<Kind>(initialKind);
  const name = useSignal('');
  const cols = useSignal('8');
  const rows = useSignal('4');
  const diameter = useSignal('');
  const volume = useSignal('');
  const pockets = useSignal('8');
  const error = useSignal<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      kind.value = initialKind;
      reset(initialKind);
      el.showModal();
      requestAnimationFrame(() => el.querySelector<HTMLElement>('#add-kind')?.focus());
    } else if (open) {
      requestAnimationFrame(() => el.querySelector<HTMLElement>('#add-kind')?.focus());
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  function reset(k: Kind) {
    name.value = nextName(k, g.containers.map((c) => c.name));
    error.value = null;
    if (oneRow(k)) {
      cols.value = '3';
      rows.value = '1';
    } else if (!isVessel(k)) {
      cols.value = '8';
      rows.value = '4';
    }
    // A 12 in (30 cm) pot of about 4 gal (15 L), and so on: round numbers in either system.
    const squares = k === 'tower' ? 1.5 : k === 'pot' || k === 'bucket' ? 1 : 4 / 3;
    const litres = k === 'pot' ? 15 : k === 'bucket' ? 19 : k === 'tower' ? 60 : 40;
    diameter.value = formatLength(Math.round(squares * g.cellCm * 10) / 10, u);
    volume.value = String(fromLitres(litres, u));
  }

  const submit = (e: Event) => {
    e.preventDefault();
    const k = kind.value;
    const id = newId();
    let container: Container;
    const existing = [...footprints.value.values()];
    if (isVessel(k)) {
      const d = readLength(diameter.value, u);
      if (d === null || d <= 0) {
        error.value = `GardenSync could not read that width. Write it like ${formatLength(30.48, u)} or ${formatLength(45, u)}.`;
        return;
      }
      const litres = toLitres(Number(volume.value), u);
      const spot = freeSpot(existing, d, d, 30);
      container = {
        id,
        form: 'vessel',
        kind: k as Extract<Container, { form: 'vessel' }>['kind'],
        name: name.value,
        x: spot.x + d / 2,
        y: spot.y + d / 2,
        diameterCm: Math.round(d * 10) / 10,
        litres: Math.round(litres * 10) / 10,
        ...(k === 'tower' ? { pockets: Number(pockets.value) } : {}),
      };
    } else {
      const c = Number(cols.value);
      const r = oneRow(k) ? 1 : Number(rows.value);
      const fp = bedFootprint({ x: 0, y: 0, cols: c, rows: r, rotation: 0 }, g.cellCm);
      const spot = freeSpot(existing, fp.w, fp.h, 45);
      container = { id, form: 'grid', kind: k as Extract<Container, { form: 'grid' }>['kind'], name: name.value, x: spot.x, y: spot.y, cols: c, rows: r, rotation: 0 };
    }
    const res = act({ type: 'addContainer', gardenId: g.id, container }, `add ${container.name}`, `Added ${container.name}.`);
    if (!res.ok) {
      error.value = res.error;
      return;
    }
    selectContainer(id);
    onClose();
    requestAnimationFrame(() => fitAll());
  };

  const k = kind.value;
  const vessel = isVessel(k);
  const c = Number(cols.value) || 0;
  const r = oneRow(k) ? 1 : Number(rows.value) || 0;
  const litresNow = toLitres(Number(volume.value) || 0, u);

  return (
    <dialog ref={ref} class="add-dialog panel" aria-labelledby="add-title" onClose={onClose} onCancel={onClose}>
      {open ? (
      <form onSubmit={submit} class="add-form">
        <h2 id="add-title">Add a bed or pot</h2>
        <div class="field">
          <label for="add-kind">Kind</label>
          <select
            id="add-kind"
            class="input"
            value={k}
            onChange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value as Kind;
              kind.value = v;
              reset(v);
            }}
          >
            <optgroup label="Beds, measured in squares">
              {GRID_KINDS.map((x) => (
                <option key={x} value={x}>
                  {KIND_WORDS[x]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Containers, measured by soil">
              {VESSEL_KINDS.map((x) => (
                <option key={x} value={x}>
                  {KIND_WORDS[x]}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div class="field">
          <label for="add-name">Name</label>
          <input id="add-name" class="input" type="text" required maxLength={80} value={name.value} onInput={(e) => (name.value = (e.currentTarget as HTMLInputElement).value)} />
        </div>
        {vessel ? (
          <>
            <div class="field">
              <label for="add-diam">Width across</label>
              <input id="add-diam" class="input" type="text" required aria-describedby="add-diam-hint" value={diameter.value} onInput={(e) => (diameter.value = (e.currentTarget as HTMLInputElement).value)} />
              <span id="add-diam-hint" class="muted small">
                Such as {formatLength(30.48, u)} or {formatLength(45.72, u)}
              </span>
            </div>
            <div class="field">
              <label for="add-vol">Soil volume ({volumeUnit(u)})</label>
              <input id="add-vol" class="input" type="number" inputMode="decimal" required min={0.3} max={600} step={0.1} value={volume.value} onInput={(e) => (volume.value = (e.currentTarget as HTMLInputElement).value)} />
            </div>
            {k === 'tower' ? (
              <div class="field">
                <label for="add-pockets">Pockets</label>
                <input id="add-pockets" class="input" type="number" min={1} max={60} step={1} value={pockets.value} onInput={(e) => (pockets.value = (e.currentTarget as HTMLInputElement).value)} />
              </div>
            ) : null}
          </>
        ) : (
          <div class="row add-size">
            <div class="field">
              <label for="add-cols">Squares across</label>
              <input id="add-cols" class="input" type="number" inputMode="numeric" required min={1} max={60} step={1} value={cols.value} onInput={(e) => (cols.value = (e.currentTarget as HTMLInputElement).value)} />
            </div>
            {oneRow(k) ? null : (
              <div class="field">
                <label for="add-rows">Squares deep</label>
                <input id="add-rows" class="input" type="number" inputMode="numeric" required min={1} max={60} step={1} value={rows.value} onInput={(e) => (rows.value = (e.currentTarget as HTMLInputElement).value)} />
              </div>
            )}
          </div>
        )}
        <p class="muted small" aria-live="polite">
          {vessel
            ? `Holds ${formatVolume(litresNow, u)} of soil.`
            : c > 0 && r > 0
              ? `${formatLength(r * g.cellCm, u)} by ${formatLength(c * g.cellCm, u)}. One square is ${formatLength(g.cellCm, u)} each way.`
              : ''}
        </p>
        {error.value ? (
          <p class="form-error" role="alert">
            {error.value}
          </p>
        ) : null}
        <div class="row add-actions">
          <button type="submit" class="btn btn-primary">
            Add {vessel ? KIND_WORDS[k].toLowerCase() : oneRow(k) ? KIND_WORDS[k].toLowerCase() : 'bed'}
          </button>
          <button type="button" class="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
      ) : null}
    </dialog>
  );
}
