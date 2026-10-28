// Public API of the schedule module: planting windows, a planting's own dates, and tasks.
export {
  plantSchedule,
  scheduleMode,
  daysToHarvest,
  outdoorMethods,
  harvestInSeason,
  harvestFrom,
  type PlantSchedule,
  type ScheduleWindow,
  type ScheduleMode,
  type WindowKind,
} from './windows';
export {
  midsummer,
  seasonRefs,
  seasonOf,
  seasonLabel,
  coolestRun,
  HALF_SEASON,
  type SeasonRefs,
} from './seasons';
export { reasonText, formatDay, formatRange, type Reason, type ReasonCode, type Method, type CapKind } from './reasons';
export {
  plantingPhases,
  intervalOf,
  findWindow,
  scheduleMethod,
  methodSupported,
  actualInOrder,
  type PlantingPhases,
  type AnchorWindow,
} from './project';
export { tasksFor, taskId, taskSeason, type Task, type TaskKind } from './tasks';
export { nextWindow, type WindowChoice } from './next';
