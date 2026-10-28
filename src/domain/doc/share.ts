// Share links: a garden plan compressed into text short enough for a URL hash.
//
// What goes in: the garden's name, id, creation date and grid size, its containers, plantings,
// succession series and custom plants. What never goes in: harvests, the journal, ticked tasks and
// the 7.x legacy data (they are the gardener's own records, not the plan). The climate goes in only
// when the sender asks to include their location, with the coordinates rounded to 0.1 degree
// (about 11 km); otherwise the recipient's own climate is used.
//
// Format: "g1." + base64url(deflate-raw(UTF-8 JSON)). The "g1" names this payload version; a
// future format gets a new prefix and this decoder keeps reading g1. Compression is the standard
// CompressionStream, available in every current browser and in Node 18+.
//
// Decoding never throws and trusts nothing: the text length is capped, the inflated size is capped
// (MAX_SHARE_BYTES, so a small link cannot expand into a huge one), and the result must pass
// GardenSchema plus every cross-reference check in check.ts (plantings point at a container and a
// plant that exist, squares fit, ids are unique, and so on).
import * as v from 'valibot';
import type { ClimateProfile } from '../climate/types';
import { checkGarden } from './check';
import { GardenSchema, type Garden } from './schema';

export const SHARE_PREFIX = 'g1.';
/** Largest decompressed payload accepted, in bytes. */
export const MAX_SHARE_BYTES = 512 * 1024;
/** Longest share text accepted, in characters. Far beyond any URL a browser keeps. */
export const MAX_SHARE_CHARS = 256 * 1024;

/** The fields of a Garden that travel in a share link. */
type SharedFields = Pick<
  Garden,
  'id' | 'name' | 'createdAt' | 'cellCm' | 'climate' | 'containers' | 'plantings' | 'series' | 'customPlants'
>;

interface SharePayload extends SharedFields {
  /** Payload version, matching the prefix. */
  v: 1;
}

export interface ShareOptions {
  /** Include the climate (town and frost dates), with the coordinates rounded to 0.1 degree. */
  includeLocation: boolean;
}

/** The climate as shared: coordinates rounded to 0.1 degree. */
function sharedClimate(climate: ClimateProfile | null): ClimateProfile | null {
  if (!climate) return null;
  if (!climate.place) return { ...climate };
  const round1 = (x: number) => Math.round(x * 10) / 10;
  return { ...climate, place: { ...climate.place, lat: round1(climate.place.lat), lon: round1(climate.place.lon) } };
}

// ---- Bytes, compression and base64url -----------------------------------------------------------

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflate, giving up (null) as soon as the output passes `cap` bytes. Rejects on corrupt data. */
async function inflateCapped(bytes: Uint8Array<ArrayBuffer>, cap: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  // Chunked so String.fromCharCode never gets more arguments than the engine allows.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** null when the text is not base64url. */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

// ---- Encode and decode --------------------------------------------------------------------------

/** The share text for a garden: "g1." followed by the compressed plan. */
export async function encodeShare(garden: Garden, opts: ShareOptions): Promise<string> {
  const payload: SharePayload = {
    v: 1,
    id: garden.id,
    name: garden.name,
    createdAt: garden.createdAt,
    cellCm: garden.cellCm,
    climate: opts.includeLocation ? sharedClimate(garden.climate) : null,
    containers: garden.containers,
    plantings: garden.plantings,
    series: garden.series,
    customPlants: garden.customPlants,
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return SHARE_PREFIX + toBase64Url(await deflate(json));
}

/**
 * The garden in a share text. Accepts the bare text, a "#..." hash or a whole URL, as long as it
 * holds "g1." followed by the payload ("." never appears in base64url, so the prefix is unambiguous).
 * The garden comes back with empty harvests, journal and ticked tasks. Its id is the sender's, so
 * the caller should give it a fresh id if this browser already has a garden with that id.
 */
export async function decodeShare(text: string): Promise<{ garden: Garden } | { error: string }> {
  try {
    if (typeof text !== 'string') return { error: 'This is not a GardenSync share link.' };
    if (text.length > MAX_SHARE_CHARS) return { error: 'This share link is too long.' };
    const at = text.lastIndexOf(SHARE_PREFIX);
    if (at < 0) return { error: 'This is not a GardenSync share link.' };
    const bytes = fromBase64Url(text.slice(at + SHARE_PREFIX.length).trim());
    if (!bytes || bytes.length === 0) return { error: 'This share link is damaged.' };

    let inflated: Uint8Array<ArrayBuffer> | null;
    try {
      inflated = await inflateCapped(bytes, MAX_SHARE_BYTES);
    } catch {
      return { error: 'This share link is damaged.' };
    }
    if (!inflated) return { error: 'This share link holds more than a garden plan can, so it was not opened.' };

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inflated)) as unknown;
    } catch {
      return { error: 'This share link is damaged.' };
    }
    if (typeof payload !== 'object' || payload === null || (payload as { v?: unknown }).v !== 1) {
      return { error: 'This share link was made by a version of GardenSync this one does not know.' };
    }
    const p = payload as Partial<SharePayload>;
    const candidate = {
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      cellCm: p.cellCm,
      climate: p.climate ?? null,
      containers: p.containers,
      plantings: p.plantings,
      series: p.series,
      harvests: [],
      journal: [],
      customPlants: p.customPlants,
      taskState: {},
    };
    const parsed = v.safeParse(GardenSchema, candidate);
    if (!parsed.success) {
      const issue = parsed.issues[0];
      return { error: `This share link holds a plan that is not valid (${v.getDotPath(issue) ?? 'garden'}: ${issue.message}).` };
    }
    const garden = parsed.output;
    const problem = checkGarden(garden)[0];
    if (problem) {
      if (problem.code === 'missing-container') return { error: 'This share link has a planting in a bed that is not in the plan.' };
      if (problem.code === 'unknown-plant') {
        const id = garden.plantings.find((p) => p.id === problem.id)?.plantId ?? problem.id;
        return { error: `This share link uses a plant this version does not know (${id}).` };
      }
      return { error: `This share link holds a plan that does not fit together: ${problem.message}` };
    }
    return { garden };
  } catch (err) {
    return { error: `The share link could not be opened (${err instanceof Error ? err.message : String(err)}).` };
  }
}
