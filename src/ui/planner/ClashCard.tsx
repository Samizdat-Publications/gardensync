// Clash card: shown when dropping a plant lands on occupied squares. Offers plant-after, find-room,
// replace, or grow-alongside as a way forward. Positioned near the drop point as a fixed overlay,
// keyboard reachable, Escape closes it, focus moves into it on open and back on close.
import { useEffect, useRef } from 'preact/hooks';
import { COMPANIONS } from '../../domain/plants/library';
import type { Planting } from '../../domain/doc/schema';
import { squaresLabel } from '../../domain/layout/labels';
import { fmtDay, inSentence } from '../format';
import { garden, newId } from '../appState';
import { selection } from '../uiState';
import { plantLookup, intervalOfP } from './derived';
import { act, clashCard, showToast } from './plannerState';
import { commitPlanting } from './interactions';

export function ClashCard() {
  const data = clashCard.value;
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (data) {
      prevFocusRef.current = document.activeElement;
      requestAnimationFrame(() => cardRef.current?.querySelector<HTMLElement>('button')?.focus());
    } else if (prevFocusRef.current instanceof HTMLElement) {
      prevFocusRef.current.focus();
      prevFocusRef.current = null;
    }
  }, [!!data]);

  if (!data) return null;

  const { req, proposal, reso, screenX, screenY } = data;
  const g = garden.value;
  if (!g) return null;

  const plantOf = plantLookup.value;
  const iof = intervalOfP.value;

  // Describe each clash: "Tomato is here Apr 30 to Sep 12"
  const clashDescs = proposal.clashes.map((c) => {
    const name = plantOf(c.with.plantId)?.name ?? 'A plant';
    const i = iof(c.with);
    if (!i) return `${name} is here (dates unknown)`;
    const end = i.bedOut !== null ? ` to ${fmtDay(i.bedOut)}` : ' (perennial)';
    return `${name} is here ${fmtDay(i.bedIn)}${end}`;
  });

  // Check whether any clash pair is a foe companion: if so, do not offer "Grow alongside".
  const hasFoe = proposal.clashes.some((c) => {
    const comp = COMPANIONS.find(
      (x) => (x.a === req.plant.id && x.b === c.with.plantId) || (x.a === c.with.plantId && x.b === req.plant.id),
    );
    return comp?.kind === 'bad';
  });

  const close = () => {
    clashCard.value = null;
  };

  const commitWith = (pl: Omit<Planting, 'id'>, plantName: string) => {
    commitPlanting(pl, plantName, g.id);
    clashCard.value = null;
  };

  const doReplace = () => {
    if (!proposal.planting) return;
    const newPlantingId = newId();
    const replaceOps = reso.replace.map((p) => ({ type: 'removePlanting' as const, gardenId: g.id, plantingId: p.id }));
    const addOp = { type: 'addPlanting' as const, gardenId: g.id, planting: { ...proposal.planting, id: newPlantingId } };
    const names = [...new Set(reso.replace.map((p) => plantOf(p.plantId)?.name ?? 'plant'))].join(' and ');
    const plantName = inSentence(req.plant.name);
    const res = act(
      { type: 'batch', ops: [...replaceOps, addOp] },
      `replace ${names} with ${plantName}`,
      `Replaced ${names} with ${plantName}.`,
    );
    if (res.ok) {
      selection.value = { kind: 'planting', id: newPlantingId };
      clashCard.value = null;
    } else {
      showToast(res.error ?? 'That did not work.');
    }
  };

  // Position: near the drop point, clamped within the viewport.
  const W = 280;
  const left = Math.min(Math.max(8, screenX + 10), (typeof window !== 'undefined' ? window.innerWidth : 800) - W - 8);
  const top = Math.min(Math.max(8, screenY + 10), (typeof window !== 'undefined' ? window.innerHeight : 600) - 8);

  return (
    <div
      ref={cardRef}
      class="clash-card"
      role="dialog"
      aria-label={`Conflict: ${req.plant.name} clashes here`}
      aria-modal="false"
      tabIndex={-1}
      style={{ position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${W}px`, zIndex: 200 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div class="clash-head">
        <strong class="clash-title">{req.plant.name} clashes here</strong>
        <button type="button" class="btn btn-icon clash-x" aria-label="Close" onClick={close}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      {clashDescs.map((d, k) => (
        <p key={k} class="clash-desc">
          {d}
        </p>
      ))}
      <div class="clash-actions">
        {reso.after ? (
          <button
            type="button"
            class="btn"
            onClick={() => commitWith(reso.after!.planting, req.plant.name)}
          >
            Plant after it, from {fmtDay(reso.after.bedIn)}
          </button>
        ) : null}
        {reso.room ? (
          <button
            type="button"
            class="btn"
            onClick={() => commitWith(reso.room!.planting, req.plant.name)}
          >
            Find room: {reso.room.bed.name}, {squaresLabel(reso.room.planting.cells!)}
          </button>
        ) : null}
        {reso.replace.length > 0 ? (
          <button type="button" class="btn" onClick={doReplace}>
            Replace {[...new Set(reso.replace.map((p) => plantOf(p.plantId)?.name ?? 'plant'))].join(', ')}
          </button>
        ) : null}
        {!hasFoe && proposal.planting ? (
          <button
            type="button"
            class="btn"
            onClick={() => {
              if (proposal.planting) commitWith(proposal.planting, req.plant.name);
            }}
          >
            Grow alongside anyway
          </button>
        ) : null}
        {reso.after === null && reso.room === null && reso.replace.length === 0 && hasFoe ? (
          <p class="clash-no-options muted small">No options: this combination is a poor pairing.</p>
        ) : null}
      </div>
    </div>
  );
}
