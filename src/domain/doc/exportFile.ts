// The downloadable copy of the gardens ("Download a copy") and reading one back ("Open a saved
// copy"), which also accepts 7.x export files. The assistant key is never part of the document, so it
// can never end up in a file.
import * as v from 'valibot';
import { checkDoc } from './check';
import { migrateV7Export, type MigrateOptions, type MigrationReport } from './migrate-v7';
import { DocSchema, SCHEMA_VERSION, type Garden, type GardenDoc } from './schema';

export const EXPORT_FORMAT = 'gardensync';
/** Files larger than this are refused before parsing. Real gardens are tens of kilobytes. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const ExportFileSchema = v.object({
  format: v.literal(EXPORT_FORMAT),
  schemaVersion: v.literal(SCHEMA_VERSION),
  exportedAt: v.string(),
  app: v.optional(v.string()),
  doc: DocSchema,
});

export function toExportFile(doc: GardenDoc, exportedAt: string, appVersion: string): string {
  return JSON.stringify({ format: EXPORT_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt, app: appVersion, doc }, null, 2);
}

export function exportFileName(today: string): string {
  return `gardensync-${today}.json`;
}

export type ImportResult =
  | { kind: 'doc'; doc: GardenDoc; exportedAt: string }
  | { kind: 'v7'; garden: Garden; report: MigrationReport }
  | { kind: 'error'; message: string };

/** Reads a downloaded copy (8.x or 7.x). Never throws. */
export function parseImportFile(text: string, opts: MigrateOptions): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) return { kind: 'error', message: 'That file is too large to be a GardenSync garden.' };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'error', message: 'That file is not a GardenSync garden: it is not readable JSON.' };
  }
  if (typeof json === 'object' && json !== null && (json as { format?: unknown }).format === EXPORT_FORMAT) {
    const version = (json as { schemaVersion?: unknown }).schemaVersion;
    if (version !== SCHEMA_VERSION) {
      return { kind: 'error', message: 'That copy was saved by a newer GardenSync. Update this one, then open it again.' };
    }
    const parsed = v.safeParse(ExportFileSchema, json);
    if (!parsed.success) {
      const issue = parsed.issues[0];
      return { kind: 'error', message: `That copy is damaged at ${v.getDotPath(issue) ?? 'the top level'}: ${issue.message}` };
    }
    const problems = checkDoc(parsed.output.doc);
    if (problems.length > 0) {
      return { kind: 'error', message: `That copy does not fit together: ${problems[0]!.message}` };
    }
    return { kind: 'doc', doc: parsed.output.doc, exportedAt: parsed.output.exportedAt };
  }
  const migrated = migrateV7Export(json, opts);
  if ('error' in migrated) return { kind: 'error', message: migrated.error };
  return { kind: 'v7', garden: migrated.garden, report: migrated.report };
}
