// UI state shared between screens. None of it is saved or undone.
import { computed, signal } from '@preact/signals';
import { toDay, type DayNum } from '../domain/dates';
import type { Plant } from '../domain/plants/schema';
import { allPlants, resolvePlant } from '../domain/plants/resolve';
import { garden, today } from './appState';

/** A plant chosen to be placed in the garden (from the library, a card or the planner palette). */
export const placingPlantId = signal<string | null>(null);

/** The day the garden is shown on. null means today. */
export const viewDay = signal<DayNum | null>(null);
export const shownDay = computed<DayNum>(() => viewDay.value ?? toDay(today.value));

/** The selected planting or container in the planner. */
export const selection = signal<{ kind: 'planting' | 'container'; id: string } | null>(null);

/** Every plant this garden can use: the built-in library plus its custom plants and varieties. */
export const gardenPlants = computed(() => allPlants(garden.value?.customPlants ?? []));

/** Looks up a plant (built-in or custom) for the active garden. */
export function plantOf(id: string): Plant | undefined {
  return resolvePlant(id, garden.value?.customPlants ?? [])?.plant;
}
