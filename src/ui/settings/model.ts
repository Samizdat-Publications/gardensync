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
