// The planner screen (Main.dc.html): the plant palette on the left, the garden canvas with the season below
// it in the middle, the inspector on the right. Below 1200 px the inspector becomes a sheet; on
// phones (760 px and less) the canvas fills the screen and the palette is a sheet opened by "Add
// plants" (A-phone-garden, A-phone-place). An empty garden shows the A-states empty state.
import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { toDay } from '../../domain/dates';
import { formatLength } from '../../domain/units';
import { garden, newId, store, today, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay } from '../format';
import { placingPlantId, selection, shownDay, viewDay } from '../uiState';
import { AddDialog } from './AddDialog';
import { Canvas } from './Canvas';
import { ClashCard } from './ClashCard';
import { svgToPng, saveBlob } from '../../platform/png';
import { busiestAhead, containers, phasesOfP, plantLookup, present, selectedContainer, selectedPlanting } from './derived';
import { PlanPoster } from './Poster';
import { cellsName } from './geometry';
import { ContainerInspector, PlantingInspector } from './Inspector';
import { Palette } from './Palette';
import { PlacementPanel } from './PlacementPanel';
import { fitAll } from './interactions';
import { act, paletteDrag, paletteOpen, placingPreviewDay, showToast, stopPlacing } from './plannerState';
import { SeasonRibbon } from './SeasonRibbon';
import { Toast } from './Toast';
import type { Container } from '../../domain/doc/schema';
import './planner.css';

function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

function undo(): void {
  const label = store.undoLabel.value;
  if (store.undo()) showToast(`Undone: ${label ?? 'last change'}.`);
}
function redo(): void {
  const label = store.redoLabel.value;
  if (store.redo()) showToast(`Redone: ${label ?? 'last change'}.`);
}

function UndoIcon({ flip }: { flip?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M6 4L2.5 7.5L6 11M3 7.5H11a4.5 4.5 0 0 1 0 9H8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Planner() {
  const g = garden.value;
  const addOpen = useSignal(false);
  const addKind = useSignal<Container['kind']>('raised-bed');
  const addButton = useRef<HTMLButtonElement>(null);
  const plantsButton = useRef<HTMLButtonElement>(null);
  const lastOpener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape anywhere outside a field or dialog stops placing (the plan handles its own Escape).
      if (e.key === 'Escape' && placingPlantId.value !== null && !e.defaultPrevented && !isTyping(e.target) && !document.querySelector('dialog[open]')) {
        stopPlacing();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Phone palette sheet: focus moves into it and back to "Add plants" when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (paletteOpen.value && !wasOpen.current) requestAnimationFrame(() => document.getElementById('planner-find')?.focus());
    if (!paletteOpen.value && wasOpen.current && window.matchMedia('(max-width: 760px)').matches) plantsButton.current?.focus();
    wasOpen.current = paletteOpen.value;
  }, [paletteOpen.value]);

  // The planner fills the window under the header, whatever height the header wraps to.
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => el.style.setProperty('--planner-top', `${Math.max(0, el.getBoundingClientRect().top + window.scrollY)}px`);
    measure();
    const header = document.querySelector('.app-header');
    const ro = new ResizeObserver(measure);
    if (header) ro.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [g !== null]);

  // On phone the placement sheet or selection sheet covers the full bottom of the plan:
  // fit the garden into the visible area above it. At tablet/laptop (760-1199 px) the sheet
  // is a corner overlay, not full-width, so no bottom inset is needed.
  const placingNow = placingPlantId.value !== null;
  useEffect(() => {
    if (!placingNow || !window.matchMedia('(max-width: 1199px)').matches) return;
    requestAnimationFrame(() => {
      const canvas = document.querySelector('.canvas-wrap')?.getBoundingClientRect();
      const sheet = document.querySelector('.planner-side.has-content')?.getBoundingClientRect();
      if (canvas && sheet) {
        const isPhone = window.matchMedia('(max-width: 760px)').matches;
        fitAll(isPhone ? Math.max(0, canvas.bottom - sheet.top) : 0);
      }
    });
  }, [placingNow]);

  // Compute hasSelection from signals directly so the hook runs before the early return.
  const hasSelectionNow = !!(selectedPlanting.value || (selection.value?.kind === 'container' && selectedContainer.value)) && placingPlantId.value === null;
  useEffect(() => {
    if (!hasSelectionNow || !window.matchMedia('(max-width: 1199px)').matches) return;
    requestAnimationFrame(() => {
      const canvas = document.querySelector('.canvas-wrap')?.getBoundingClientRect();
      const sheet = document.querySelector('.planner-side.has-content')?.getBoundingClientRect();
      if (canvas && sheet) {
        const isPhone = window.matchMedia('(max-width: 760px)').matches;
        fitAll(isPhone ? Math.max(0, canvas.bottom - sheet.top) : 0);
      }
    });
  }, [hasSelectionNow]);

  if (!g) return null;
  const u = units.value;
  const day = shownDay.value;
  const todayDay = toDay(today.value);
  // Disable undo when the only step would bring us back to the empty-doc state created at first run.
  const canUndoNow = store.canUndo.value && store.undoLabel.value !== 'start the garden';
  const placing = placingPlantId.value !== null;
  const previewDay = placingPreviewDay.value;
  const placingPlant = placing ? plantLookup.value(placingPlantId.value!) : null;
  const selP = selectedPlanting.value;
  const selC = selection.value?.kind === 'container' ? selectedContainer.value : null;
  const has = g.containers.length > 0;
  const sideContent = placing || selP || selC;

  const openAdd = (kind: Container['kind'], from: HTMLElement | null) => {
    lastOpener.current = from;
    addKind.value = kind;
    addOpen.value = true;
  };
  const closeAdd = () => {
    addOpen.value = false;
    requestAnimationFrame(() => (lastOpener.current ?? addButton.current)?.focus());
  };

  const addStarterBed = () => {
    const id = newId();
    const res = act(
      { type: 'addContainer', gardenId: g.id, container: { id, form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 8, rows: 4, rotation: 0 } },
      'add Bed 1',
      'Added Bed 1. Now choose a plant and tap its squares.',
    );
    if (res.ok) requestAnimationFrame(() => fitAll());
  };

  // The plan's text alternative: every bed and pot and what is in it on the day shown.
  const plantOf = plantLookup.value;
  const description = containers.value
    .map((c) => {
      const here = present.value.get(c.id) ?? [];
      const size = c.form === 'grid' ? `${formatLength(c.rows * g.cellCm, u)} by ${formatLength(c.cols * g.cellCm, u)}` : formatLength(c.diameterCm, u);
      const what = here.length
        ? here.map((p) => `${plantOf(p.plantId)?.name ?? 'a plant'}, ${p.count}${p.cells ? ` in ${cellsName(p.cells)}` : ''}`).join('; ')
        : 'nothing in the ground';
      return `${c.name}, ${size}: ${what}.`;
    })
    .join(' ');

  return (
    <main class={`planner${placing ? ' is-placing' : ''}`} ref={root}>
      <aside class={`planner-palette${paletteOpen.value ? ' open' : ''}`} aria-labelledby="palette-title">
        <div class="sheet-head">
          <span class="sheet-grip" aria-hidden="true" />
          <button type="button" class="btn sheet-close" onClick={() => (paletteOpen.value = false)}>
            Done
          </button>
        </div>
        <Palette
          headingId="palette-title"
          onChosen={() => {
            paletteOpen.value = false;
          }}
        />
      </aside>

      <div class="planner-main">
        <div class="planner-bar">
          <h1 tabIndex={-1}>
            {g.name} on {fmtDay(day)}
          </h1>
          {placing && previewDay !== null && placingPlant ? (
            <span class="ahead">
              Showing {fmtDay(previewDay)}, when {placingPlant.name.toLowerCase()} would go in
              <button type="button" class="btn ahead-btn" onClick={stopPlacing}>
                Stop placing
              </button>
            </span>
          ) : day !== todayDay ? (
            <span class="ahead">
              {day > todayDay ? 'Looking ahead' : 'Looking back'}: today is {fmtDay(todayDay)}
              <button type="button" class="btn ahead-btn" onClick={() => (viewDay.value = null)}>
                Back to today
              </button>
            </span>
          ) : busiestAhead.value ? (
            <span class="ahead">
              Nothing is in the ground yet; the first planting goes in on {fmtDay(busiestAhead.value.first)}.
              <button type="button" class="btn ahead-btn" onClick={() => (viewDay.value = busiestAhead.value!.best)}>
                Show the garden on {fmtDay(busiestAhead.value.best)}
              </button>
            </span>
          ) : null}
          <span class="bar-gap" />
          <div role="group" aria-label="Edit" class="bar-tools">
            <button type="button" class="btn btn-icon" aria-label="Undo" title={canUndoNow && store.undoLabel.value ? `Undo ${store.undoLabel.value}` : 'Nothing to undo'} disabled={!canUndoNow} onClick={undo}>
              <UndoIcon />
            </button>
            <button type="button" class="btn btn-icon" aria-label="Redo" title={store.redoLabel.value ? `Redo ${store.redoLabel.value}` : 'Nothing to redo'} disabled={!store.canRedo.value} onClick={redo}>
              <UndoIcon flip />
            </button>
            <button type="button" class="btn" ref={addButton} aria-label="Add a bed or pot" onClick={(e) => openAdd('raised-bed', e.currentTarget)}>
              <span class="btn-label-long">Add a bed or pot</span>
              <span class="btn-label-short" aria-hidden="true">Add</span>
            </button>
            <details class="bar-more">
              <summary class="btn" aria-label="Print or save">
                <span class="btn-label-long">Print or save</span>
                <span class="btn-label-short" aria-hidden="true">Print</span>
              </summary>
              <div class="bar-more-menu panel">
                <button type="button" class="btn" onClick={() => window.print()}>
                  Print the plan
                </button>
                <button type="button" class="btn" onClick={() => void savePicture(g.name)}>
                  Save a picture
                </button>
              </div>
            </details>
          </div>
        </div>

        {has ? (
          <div class="canvas-area">
            <Canvas descriptionId="plan-desc" />
            <button
              type="button"
              class="btn btn-primary add-plants"
              ref={plantsButton}
              aria-expanded={paletteOpen.value}
              onClick={() => (paletteOpen.value = !paletteOpen.value)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M9 3V15M3 9H15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
              </svg>
              Add plants
            </button>
            {/* Palette drag ghost: follows the pointer while dragging from the plant list. */}
            {paletteDrag.value ? (
              <div
                class="palette-ghost"
                aria-hidden="true"
                style={{ left: `${paletteDrag.value.screenX + 12}px`, top: `${paletteDrag.value.screenY - 24}px` }}
              >
                <Glyph form={paletteDrag.value.plant.glyph.form} color={paletteDrag.value.plant.glyph.color} size={36} />
                <span class="palette-ghost-name">{paletteDrag.value.plant.name}</span>
              </div>
            ) : null}
            <ClashCard />
          </div>
        ) : (
          <section class="empty panel" aria-labelledby="empty-title">
            <svg viewBox="0 0 220 120" aria-hidden="true" class="empty-art">
              <rect x="2" y="2" width="216" height="116" rx="8" fill="var(--c-paper)" />
              <path d="M2 42H218M2 82H218M56 2V118M110 2V118M164 2V118" stroke="var(--c-grid)" />
              <rect x="58" y="44" width="104" height="36" rx="3" fill="none" stroke="var(--c-accent)" stroke-width="2.5" stroke-dasharray="7 5" />
            </svg>
            <h2 id="empty-title">Draw your first bed</h2>
            <p>Add a raised bed or a pot. Then pick plants to fill the squares, and GardenSync works out their dates.</p>
            <div class="row">
              <button type="button" class="btn btn-primary" onClick={addStarterBed}>
                Add a 4 by 8 bed
              </button>
              <button type="button" class="btn" onClick={(e) => openAdd('pot', e.currentTarget)}>
                Add a pot
              </button>
            </div>
            <p class="muted small">
              {g.cellCm === 30.48 ? 'Each square is 1 ft, the classic square-foot gardening size.' : 'Each square is 30 cm, a metric square-foot garden.'}
            </p>
          </section>
        )}
        <p id="plan-desc" class="visually-hidden">
          {description}
        </p>
        {has ? <SeasonRibbon /> : null}
      </div>

      <aside class={`planner-side${sideContent ? ' has-content' : ''}`} aria-label={placing ? 'Placing a plant' : selP ? 'Selected planting' : selC ? 'Selected bed or pot' : 'Details'}>
        {sideContent ? (
          <div class="sheet-head side-head">
            <span class="sheet-grip" aria-hidden="true" />
            <button
              type="button"
              class="btn sheet-close"
              onClick={() => {
                if (placing) stopPlacing();
                else selection.value = null;
              }}
            >
              {placing ? 'Stop placing' : 'Close'}
            </button>
          </div>
        ) : null}
        {placing ? (
          <PlacementPanel />
        ) : selP ? (
          <PlantingInspector p={selP} />
        ) : selC ? (
          <ContainerInspector c={selC} />
        ) : (
          <div class="side-hint">
            <h2>Details</h2>
            <p class="muted small">Choose a plant to place it, or pick a planting, bed or pot on the plan to see its dates and change it.</p>
          </div>
        )}
      </aside>

      <AddDialog open={addOpen.value} kind={addKind.value} onClose={closeAdd} />
      <Toast />
      <div class="print-poster" aria-hidden="true">
        <PlanPoster id="plan-poster" garden={g} day={day} units={units.value} plantOf={plantLookup.value} phasesOf={phasesOfP.value} present={present.value} />
      </div>
    </main>
  );
}

/** The poster as a PNG download, named after the garden. */
async function savePicture(name: string): Promise<void> {
  const svg = document.getElementById('plan-poster');
  if (!(svg instanceof SVGSVGElement)) return;
  try {
    const blob = await svgToPng(svg, { scale: 3 });
    // Lower case with hyphens: some browsers turn spaces in download names into underscores.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'garden';
    saveBlob(blob, `${slug}.png`);
    showToast('Saved a picture of the plan.');
  } catch {
    showToast('The picture could not be made in this browser. Try Print the plan instead.');
  }
}
