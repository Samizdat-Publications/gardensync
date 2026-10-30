// Pure helpers behind the settings screen. No DOM; unit tested.
import type { IsoDate } from '../../domain/dates';
import type { GardenDoc } from '../../domain/doc/schema';

/**
 * A document opened from a file or a backup, keeping the later of the two "last downloaded" days.
 * A saved copy is written before the download is recorded, so without this, opening the copy just
 * downloaded would say it was never downloaded.
 */
export function keepLastExport(incoming: GardenDoc, current: IsoDate | undefined): GardenDoc {
  const had = incoming.settings.lastExportAt;
  const later = had === undefined ? current : current === undefined ? had : had > current ? had : current;
  if (later === undefined || later === had) return incoming;
  return { ...incoming, settings: { ...incoming.settings, lastExportAt: later } };
}

/**
 * Which section the side menu marks while the page scrolls. A section whose heading sits in the
 * reading band near the top of the screen wins (the first one, if two do); otherwise the section
 * being read through, the last one whose top has passed the band. At the bottom of the page the
 * last sections cannot reach the band, so there the section the gardener asked for wins if it is on
 * screen, and otherwise the last one does.
 *
 * `tops` are the sections' top edges relative to the viewport, in page order; the band runs from
 * `bandTop` (below a sticky menu strip, or 0) to `line`.
 */
export function sectionInView(tops: readonly number[], bandTop: number, line: number, atBottom: boolean, requested: number | null, viewportHeight: number): number {
  if (tops.length === 0) return 0;
  if (atBottom) {
    if (requested !== null && requested >= 0 && requested < tops.length && tops[requested]! >= 0 && tops[requested]! < viewportHeight) return requested;
    return tops.length - 1;
  }
  const inBand = tops.findIndex((t) => t >= bandTop - 1 && t <= line);
  if (inBand >= 0) return inBand;
  let at = 0;
  tops.forEach((t, i) => {
    if (t <= line) at = i;
  });
  return at;
}

/** "A", "A and B", "A, B and C", or "A, B, C and 2 more gardens" past three. */
function listNames(names: readonly string[]): string {
  if (names.length > 4) return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more gardens`;
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function gardensText(doc: GardenDoc): string {
  const named = doc.gardens.map((g) => {
    const n = g.containers.length;
    return `${g.name} (${n === 0 ? 'no beds or pots yet' : `${n} ${n === 1 ? 'bed or pot' : 'beds and pots'}`})`;
  });
  return listNames(named);
}

/**
 * The question asked before a saved copy replaces what is in this browser: what goes, what comes in,
 * and that a backup keeps what goes.
 */
export function openCopyQuestion(current: GardenDoc, incoming: GardenDoc): string {
  const n = incoming.gardens.length;
  const comes = n === 0 ? 'no gardens' : `the ${n === 1 ? 'garden' : 'gardens'} in the file: ${gardensText(incoming)}`;
  if (current.gardens.length === 0) return `Open this copy? It brings in ${comes}.`;
  return `Open this copy? It replaces ${gardensText(current)} with ${comes}. What is here now is kept in Backups, so you can restore it.`;
}

/** The import errors that only mean "this is not a garden file at all", worded for a 7.x file. */
const NOT_A_GARDEN = new Set([
  'That file is not a GardenSync garden: it is not readable JSON.',
  'This file is not valid JSON, so it is not a GardenSync 7 export.',
  'This file is not a GardenSync 7 export.',
]);

/** What to say when a file cannot be opened: plainly, and always that nothing changed. */
export function openErrorText(message: string): string {
  if (NOT_A_GARDEN.has(message)) return 'This file is not a GardenSync garden file. Nothing was changed.';
  return `${message.trimEnd()} Nothing was changed.`;
}
