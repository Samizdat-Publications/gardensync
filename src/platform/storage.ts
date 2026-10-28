// Saving the garden document in this browser.
//
// localStorage holds one current save plus safety copies:
//   gardensync.v8.doc                       the current document, wrapped with a revision number
//   gardensync.v8.backup.YYYY-MM-DD         one snapshot per day the garden changed, the newest 7 kept
//   gardensync.v8.snapshot.<label>@<iso>    a copy taken before something risky (an import, a restore)
//   gardensync.v8.quarantine.<iso>          the raw text of a save that failed to load, the newest 3 kept
//
// The revision number stops two open tabs from silently overwriting each other: a save names the
// revision it started from, and if another tab has saved since, the save is refused so the UI can
// offer a reload. saveDoc reads only the stored envelope's schemaVersion and rev (a light JSON parse,
// not a full DocSchema check, so autosave stays cheap). A stored save it cannot read that way (not
// JSON, or written by another schema version, such as a newer GardenSync in another tab) is never
// overwritten: saveDoc refuses with 'unknown-format' and leaves both it and the daily backup alone.
//
// Everything loaded is validated with DocSchema and then checked with checkDoc (domain/doc/check.ts);
// nothing unvalidated reaches state. A save that fails DocSchema is 'corrupt'. A save that passes it
// but fails the cross-reference checks is 'needs-repair': it is quarantined like a corrupt save, but
// the readable document comes back too, with the problems and a repaired copy (repairDoc) for the UI
// to offer. The functions take the storage object as a parameter so tests can pass a fake.
import * as v from 'valibot';
import { repairDoc, checkDoc, type Problem } from '../domain/doc/check';
import { DocSchema, SCHEMA_VERSION, type GardenDoc } from '../domain/doc/schema';

export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DOC_KEY = 'gardensync.v8.doc';
const BACKUP_PREFIX = 'gardensync.v8.backup.';
const SNAPSHOT_PREFIX = 'gardensync.v8.snapshot.';
const QUARANTINE_PREFIX = 'gardensync.v8.quarantine.';
const BACKUPS_KEPT = 7;
const QUARANTINES_KEPT = 3;

const EnvelopeSchema = v.object({
  schemaVersion: v.literal(SCHEMA_VERSION),
  rev: v.pipe(v.number(), v.integer(), v.minValue(0)),
  savedAt: v.string(),
  doc: DocSchema,
});
type Envelope = v.InferOutput<typeof EnvelopeSchema>;

export type LoadResult =
  | { status: 'ok'; doc: GardenDoc; rev: number; savedAt: string }
  | { status: 'empty' }
  /**
   * The save did not validate. Its raw text was copied to `quarantineKey` (null, with `note`, when
   * even that copy could not be written); the original stays under DOC_KEY. The UI offers recovery.
   */
  | { status: 'corrupt'; quarantineKey: string | null; problem: string; note?: string }
  /**
   * The save validated but its records do not fit together (see check.ts). `doc` is what was saved;
   * `repaired` has every safe repair made, and `remaining` lists what still needs the gardener. The
   * raw text is quarantined as for a corrupt save.
   */
  | {
      status: 'needs-repair';
      doc: GardenDoc;
      repaired: GardenDoc;
      problems: Problem[];
      remaining: Problem[];
      rev: number;
      savedAt: string;
      quarantineKey: string | null;
      note?: string;
    };

export type SaveResult =
  | { ok: true; rev: number }
  | { ok: false; reason: 'conflict'; theirRev: number }
  /** The stored save is not one this version can read; it was left as it is. */
  | { ok: false; reason: 'unknown-format'; message: string }
  | { ok: false; reason: 'quota' | 'unavailable'; message: string };

function parseEnvelope(raw: string): { ok: true; env: Envelope } | { ok: false; problem: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, problem: 'The saved garden is not readable text.' };
  }
  const parsed = v.safeParse(EnvelopeSchema, json);
  if (!parsed.success) {
    const issue = parsed.issues[0];
    return { ok: false, problem: `The saved garden has a problem at ${v.getDotPath(issue) ?? 'the top level'}: ${issue.message}` };
  }
  return { ok: true, env: parsed.output };
}

/**
 * Keeps the raw text of a save that failed to load. An identical copy already kept is reused rather
 * than written again; only the newest QUARANTINES_KEPT copies are kept. The key is null when the
 * copy could not be written.
 */
function quarantine(kv: KeyValueStore, raw: string, now: string): { quarantineKey: string | null; note?: string } {
  const existing = keysWithPrefix(kv, QUARANTINE_PREFIX);
  const same = existing.find((k) => kv.getItem(k) === raw);
  if (same !== undefined) return { quarantineKey: same };
  const key = QUARANTINE_PREFIX + now;
  try {
    kv.setItem(key, raw);
  } catch {
    // The original is still in place under DOC_KEY: the app never overwrites it until the gardener
    // chooses what to do.
    return { quarantineKey: null, note: 'A safety copy of the damaged save could not be written; the original is still in place.' };
  }
  const all = keysWithPrefix(kv, QUARANTINE_PREFIX);
  for (const k of all.slice(0, Math.max(0, all.length - QUARANTINES_KEPT))) kv.removeItem(k);
  return { quarantineKey: key };
}

/** Reads the current save. `now` is an ISO timestamp used to name a quarantine copy. */
export function loadDoc(kv: KeyValueStore, now: string): LoadResult {
  const raw = kv.getItem(DOC_KEY);
  if (raw === null) return { status: 'empty' };
  const res = parseEnvelope(raw);
  if (!res.ok) return { status: 'corrupt', problem: res.problem, ...quarantine(kv, raw, now) };
  const { doc, rev, savedAt } = res.env;
  const problems = checkDoc(doc);
  if (problems.length === 0) return { status: 'ok', doc, rev, savedAt };
  const fix = repairDoc(doc);
  return { status: 'needs-repair', doc, repaired: fix.doc, problems, remaining: fix.remaining, rev, savedAt, ...quarantine(kv, raw, now) };
}

/** What is stored under DOC_KEY, as far as saving needs to know. */
export type StoredRev = { kind: 'none' } | { kind: 'rev'; rev: number } | { kind: 'unknown-format' };

/**
 * The revision currently stored, from a light parse: JSON, our schemaVersion and a whole rev. The
 * document itself is not validated here; loadDoc does that.
 */
export function storedRev(kv: KeyValueStore): StoredRev {
  const raw = kv.getItem(DOC_KEY);
  if (raw === null) return { kind: 'none' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: 'unknown-format' };
  }
  if (typeof json !== 'object' || json === null) return { kind: 'unknown-format' };
  const { schemaVersion, rev } = json as { schemaVersion?: unknown; rev?: unknown };
  if (schemaVersion !== SCHEMA_VERSION || typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) {
    return { kind: 'unknown-format' };
  }
  return { kind: 'rev', rev };
}

function isQuotaError(e: unknown): boolean {
  return e instanceof Error && /quota|exceeded/i.test(`${e.name} ${e.message}`);
}

/**
 * Saves the document if nobody else has saved since `expectedRev` (pass -1 for a first save).
 * `today` (YYYY-MM-DD) decides which daily backup to keep; `now` is the ISO timestamp recorded.
 */
export function saveDoc(
  kv: KeyValueStore,
  doc: GardenDoc,
  opts: {
    expectedRev: number;
    today: string;
    now: string;
    /**
     * Replace a save this version cannot read. Only for the recovery screen, after the gardener has
     * chosen what to keep and the unreadable text has been quarantined by loadDoc.
     */
    replaceUnreadable?: boolean;
  },
): SaveResult {
  const stored = storedRev(kv);
  if (stored.kind === 'unknown-format' && !opts.replaceUnreadable) {
    return {
      ok: false,
      reason: 'unknown-format',
      message: 'The garden saved in this browser is in a form this version cannot read, so it was not overwritten. Reload, or download a copy first.',
    };
  }
  const current = stored.kind === 'rev' ? stored.rev : -1;
  // Newer than what we started from: another tab saved. Older (the save was cleared): carry on.
  if (current > opts.expectedRev) return { ok: false, reason: 'conflict', theirRev: current };
  const rev = Math.max(current, opts.expectedRev) + 1;
  const env: Envelope = { schemaVersion: SCHEMA_VERSION, rev, savedAt: opts.now, doc };
  const text = JSON.stringify(env);
  try {
    kv.setItem(DOC_KEY, text);
  } catch (e) {
    if (isQuotaError(e)) {
      // Make room by dropping the oldest backups, then try once more.
      pruneBackups(kv, 1);
      try {
        kv.setItem(DOC_KEY, text);
      } catch (e2) {
        return isQuotaError(e2)
          ? { ok: false, reason: 'quota', message: 'This browser has run out of room for the garden. Download a copy, then clear old backups.' }
          : { ok: false, reason: 'unavailable', message: 'This browser would not save the garden.' };
      }
    } else {
      return { ok: false, reason: 'unavailable', message: 'This browser would not save the garden.' };
    }
  }
  writeDailyBackup(kv, text, opts.today);
  return { ok: true, rev };
}

function keysWithPrefix(kv: KeyValueStore, prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < kv.length; i++) {
    const k = kv.key(i);
    if (k !== null && k.startsWith(prefix)) out.push(k);
  }
  return out.sort();
}

function writeDailyBackup(kv: KeyValueStore, text: string, today: string): void {
  try {
    kv.setItem(BACKUP_PREFIX + today, text);
    pruneBackups(kv, BACKUPS_KEPT);
  } catch {
    // A backup that does not fit is skipped; the main save already succeeded.
  }
}

function pruneBackups(kv: KeyValueStore, keep: number): void {
  const keys = keysWithPrefix(kv, BACKUP_PREFIX);
  for (const k of keys.slice(0, Math.max(0, keys.length - keep))) kv.removeItem(k);
}

export interface BackupInfo {
  key: string;
  /** YYYY-MM-DD for daily backups, the label for snapshots. */
  label: string;
  kind: 'daily' | 'snapshot';
  savedAt: string | null;
  gardens: number;
}

/** The label part of a snapshot key: everything before the last '@' (older keys have none). */
function snapshotLabel(key: string): string {
  const rest = key.slice(SNAPSHOT_PREFIX.length);
  const at = rest.lastIndexOf('@');
  return at < 0 ? rest : rest.slice(0, at);
}

/** Backups and snapshots that can be restored, newest first. Unreadable ones are left out. */
export function listBackups(kv: KeyValueStore): BackupInfo[] {
  const out: BackupInfo[] = [];
  for (const [prefix, kind] of [[BACKUP_PREFIX, 'daily'], [SNAPSHOT_PREFIX, 'snapshot']] as const) {
    for (const key of keysWithPrefix(kv, prefix)) {
      const raw = kv.getItem(key);
      if (raw === null) continue;
      const res = parseEnvelope(raw);
      if (!res.ok) continue;
      const label = kind === 'daily' ? key.slice(prefix.length) : snapshotLabel(key);
      out.push({ key, label, kind, savedAt: res.env.savedAt, gardens: res.env.doc.gardens.length });
    }
  }
  return out.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
}

/** Reads a backup or snapshot by key, validated. */
export function readBackup(kv: KeyValueStore, key: string): GardenDoc | null {
  if (!key.startsWith(BACKUP_PREFIX) && !key.startsWith(SNAPSHOT_PREFIX)) return null;
  const raw = kv.getItem(key);
  if (raw === null) return null;
  const res = parseEnvelope(raw);
  return res.ok ? res.env.doc : null;
}

/**
 * Keeps a copy of the current document before something risky, such as an import. The key holds
 * the label and the timestamp, so a second snapshot with the same label never replaces the first.
 * Returns the key, or null when the copy could not be written.
 */
export function takeSnapshot(kv: KeyValueStore, doc: GardenDoc, label: string, now: string): string | null {
  const safe = label.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
  const key = `${SNAPSHOT_PREFIX}${safe}@${now}`;
  const env: Envelope = { schemaVersion: SCHEMA_VERSION, rev: 0, savedAt: now, doc };
  try {
    kv.setItem(key, JSON.stringify(env));
    return key;
  } catch {
    return null;
  }
}

/**
 * Asks the browser to keep this site's storage even when space runs low. Safari otherwise clears
 * storage of sites not visited for 7 days. Returns whether storage is persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
