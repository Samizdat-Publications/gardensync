// Plain-words facts about a plant for the library and the plant card: its family, the fact chips
// (frost, sun, room, pot, support, yield) and its good and bad neighbors. Pure functions, no DOM.
import { COMPANIONS } from '../../domain/plants/library';
import type { Companion, Family, Plant } from '../../domain/plants/schema';
import { formatVolume, formatWeightApprox, type Units } from '../../domain/units';

interface FamilyInfo {
  /** "Nightshade family" */
  name: string;
  /** Well-known relatives as [plant id, how they are named in a sentence]. */
  kin: readonly (readonly [string, string])[];
}

/** Plain names for the botanical families in the library, with relatives a gardener knows. */
export const FAMILY_INFO: Readonly<Record<Exclude<Family, 'Other'>, FamilyInfo>> = {
  Alliaceae: { name: 'Onion family', kin: [['onion', 'onions'], ['garlic', 'garlic'], ['leek', 'leeks'], ['chives', 'chives']] },
  Amaranthaceae: { name: 'Beet family', kin: [['beet', 'beets'], ['swiss-chard', 'chard'], ['spinach', 'spinach']] },
  Apiaceae: { name: 'Carrot family', kin: [['carrot', 'carrots'], ['parsley', 'parsley'], ['dill', 'dill'], ['parsnip', 'parsnips']] },
  Asparagaceae: { name: 'Asparagus family', kin: [] },
  Asteraceae: { name: 'Daisy family', kin: [['lettuce', 'lettuce'], ['sunflower', 'sunflowers'], ['marigold', 'marigolds'], ['zinnia', 'zinnias']] },
  Boraginaceae: { name: 'Borage family', kin: [['comfrey', 'comfrey'], ['forget-me-not', 'forget-me-nots']] },
  Brassicaceae: { name: 'Cabbage family', kin: [['cabbage', 'cabbage'], ['kale', 'kale'], ['broccoli', 'broccoli'], ['radish', 'radishes']] },
  Convolvulaceae: { name: 'Morning glory family', kin: [['morning-glory', 'morning glories']] },
  Cucurbitaceae: { name: 'Squash family', kin: [['cucumber', 'cucumbers'], ['melon', 'melons'], ['pumpkin', 'pumpkins'], ['zucchini', 'zucchini']] },
  Ericaceae: { name: 'Heather family', kin: [['cranberry', 'cranberries'], ['heather', 'heather']] },
  Fabaceae: { name: 'Pea family', kin: [['pea', 'peas'], ['bush-bean', 'beans'], ['clover', 'clover']] },
  Lamiaceae: { name: 'Mint family', kin: [['basil', 'basil'], ['sage', 'sage'], ['thyme', 'thyme'], ['mint', 'mint']] },
  Malvaceae: { name: 'Mallow family', kin: [['hibiscus', 'hibiscus'], ['cotton', 'cotton']] },
  Poaceae: { name: 'Grass family', kin: [['wheat', 'wheat'], ['rice', 'rice']] },
  Polygonaceae: { name: 'Buckwheat family', kin: [['sorrel', 'sorrel'], ['buckwheat', 'buckwheat']] },
  Rosaceae: { name: 'Rose family', kin: [['strawberry', 'strawberries'], ['raspberry', 'raspberries'], ['apple', 'apples']] },
  Solanaceae: { name: 'Nightshade family', kin: [['tomato', 'tomatoes'], ['pepper', 'peppers'], ['eggplant', 'eggplant'], ['potato', 'potatoes']] },
  Tropaeolaceae: { name: 'Nasturtium family', kin: [] },
};

/** "a", "a and b", "a, b and c". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Nightshade family", or null for plants of no listed family. */
export function familyName(family: Family): string | null {
  return family === 'Other' ? null : FAMILY_INFO[family].name;
}

/**
 * "Nightshade family, with peppers, eggplant and potatoes": the plant itself (and the plant a
 * custom variety is based on) is left out of its relatives. null for family 'Other'.
 */
export function familyLine(plant: Plant, parentId?: string): string | null {
  if (plant.family === 'Other') return null;
  const info = FAMILY_INFO[plant.family];
  const kin = info.kin
    .filter(([id]) => id !== plant.id && id !== parentId)
    .slice(0, 3)
    .map(([, label]) => label);
  return kin.length ? `${info.name}, with ${andList(kin)}` : info.name;
}

export interface FactChip {
  text: string;
  /** Frost facts are always drawn in the frost colour. */
  tone: 'frost' | 'plain';
}

const FROST_TEXT: Record<Plant['frost'], string> = {
  tender: 'Killed by frost',
  'half-hardy': 'Takes a light frost',
  hardy: 'Takes hard frost',
};

const SUPPORT_TEXT: Record<NonNullable<Plant['support']>, string> = {
  stake: 'Needs a stake',
  trellis: 'Needs a trellis',
  cage: 'Needs a cage',
};

export function sunText(plant: Plant): string {
  if (plant.sun === 'shade') return 'Shade';
  if (plant.sun === 'partial') return 'Part shade';
  return plant.shadeTolerant ? 'Full sun or part shade' : 'Full sun';
}

/** "1 per square", "16 per square", "Takes 3 by 3 squares". */
export function densityText(plant: Plant): string {
  const d = plant.density;
  return 'perSquare' in d ? `${d.perSquare} per square` : `Takes ${d.squares[0]} by ${d.squares[1]} squares`;
}

/** "Pot of 5.3 gal or more", or null when it does not suit a pot. */
export function containerText(plant: Plant, units: Units): string | null {
  return plant.container ? `Pot of ${formatVolume(plant.container.minLitres, units)} or more` : null;
}

/** What a counted yield is counted in, by drawn form. Forms without a natural word get none. */
function countNoun(plant: Plant, n: number): string {
  const one = n === 1;
  switch (plant.glyph.form) {
    case 'flower':
      return one ? ' flower' : ' flowers';
    case 'fruiting':
    case 'vine':
    case 'cane':
      return ' fruit';
    case 'rosette':
    case 'brassica':
      return one ? ' head' : ' heads';
    default:
      return '';
  }
}

/** "About 9 lb 15 oz a plant", "About 3 fruit a plant", or null when there is no estimate. */
export function yieldText(plant: Plant, units: Units): string | null {
  const y = plant.yield;
  if (!(y.amount > 0)) return null;
  const amount = y.unit === 'g' ? formatWeightApprox(y.amount, units) : `${Math.round(y.amount)}${countNoun(plant, Math.round(y.amount))}`;
  return `About ${amount} a ${y.per}`;
}

/** The chips under a plant's name on its card, in reading order. */
export function factChips(plant: Plant, units: Units): FactChip[] {
  const out: FactChip[] = [{ text: FROST_TEXT[plant.frost], tone: 'frost' }];
  out.push({ text: sunText(plant), tone: 'plain' });
  out.push({ text: densityText(plant), tone: 'plain' });
  if (plant.support) out.push({ text: SUPPORT_TEXT[plant.support], tone: 'plain' });
  out.push({ text: containerText(plant, units) ?? 'Not suited to pots', tone: 'plain' });
  const y = yieldText(plant, units);
  if (y) out.push({ text: y, tone: 'plain' });
  if (plant.lifecycle === 'perennial') out.push({ text: 'Comes back every year', tone: 'plain' });
  return out;
}

export interface Neighbor {
  otherId: string;
  kind: Companion['kind'];
  reason: string;
  evidence: Companion['evidence'];
  source?: Companion['source'];
}

/** Good and bad neighbors of a plant, good ones first, each with its reason and evidence. */
export function neighborsOf(plantId: string, companions: readonly Companion[] = COMPANIONS): Neighbor[] {
  const out: Neighbor[] = [];
  for (const c of companions) {
    const otherId = c.a === plantId ? c.b : c.b === plantId ? c.a : null;
    if (otherId === null || otherId === plantId) continue;
    out.push({ otherId, kind: c.kind, reason: c.reason, evidence: c.evidence, ...(c.source ? { source: c.source } : {}) });
  }
  // Stable: keeps the order of the companion file within each kind.
  return [...out.filter((n) => n.kind === 'good'), ...out.filter((n) => n.kind === 'bad')];
}

export const EVIDENCE_TEXT: Record<Companion['evidence'], string> = {
  tested: 'Shown in trials.',
  traditional: 'Traditional, not proven.',
};

/** A plant name inside a sentence: "sweet potato", but "Swiss chard" and "Brussels sprouts". */
export function nameInSentence(name: string): string {
  return /^(Swiss|Brussels|French|English|Italian)\b/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}
