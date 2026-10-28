// The built-in plant library: one JSON file per plant in ./library/, validated at load.
// Adding a plant to GardenSync means adding one file there (see CONTRIBUTING.md).
import * as v from 'valibot';
import { CompanionSchema, PlantSchema, type Companion, type Plant } from './schema';
import companionsJson from './companions.json';

const files = import.meta.glob<{ default: unknown }>('./library/*.json', { eager: true });

function load(): Plant[] {
  const plants: Plant[] = [];
  for (const [path, mod] of Object.entries(files)) {
    const parsed = v.safeParse(PlantSchema, mod.default);
    if (!parsed.success) {
      const issue = parsed.issues[0];
      throw new Error(`${path}: ${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`);
    }
    const expectedFile = `./library/${parsed.output.id}.json`;
    if (path !== expectedFile) throw new Error(`${path}: file name must match id (${expectedFile})`);
    plants.push(parsed.output);
  }
  return plants.sort((a, b) => a.name.localeCompare(b.name));
}

export const PLANTS: readonly Plant[] = load();
export const PLANTS_BY_ID: ReadonlyMap<string, Plant> = new Map(PLANTS.map((p) => [p.id, p]));

export const COMPANIONS: readonly Companion[] = v.parse(v.array(CompanionSchema), companionsJson);

export function plantById(id: string): Plant | undefined {
  return PLANTS_BY_ID.get(id);
}
