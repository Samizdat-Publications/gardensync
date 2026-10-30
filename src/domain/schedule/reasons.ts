// Why the schedule gave a date: structured reasons plus a default English sentence for each.
//
// The domain returns `{ code, ...params }` with real day numbers; the UI may render them its own way
// (units, language). `reasonText` is the plain fallback. Dates read "Apr 16". No em dashes.
import { partsFromDay, type DayNum, type DayRange } from '../dates';
import { formatTemp, type Units } from '../units';

export type Method = 'transplant' | 'direct' | 'plant';

/**
 * What ends a harvest. `estimated` marks a hard-frost date filled in from the first frost. A cap is
 * exclusive: the harvest ends the day before it, and a `harvest-until` reason names that last day.
 */
export type CapKind = 'first-frost' | 'minus2' | 'minus5' | 'out-of-range' | 'frost-risk' | 'heat' | 'bolting-heat' | 'window';

export type Reason =
  // How the bed-in window was set
  | { code: 'frost-offset'; method: Method; weeks: readonly [number, number]; lastFrost: DayNum }
  | { code: 'held-to-lf90'; day: DayNum }
  | { code: 'soil-warm'; method: Method; day: DayNum; tempC: number }
  | { code: 'early-for-heat'; day: DayNum; tempC: number }
  | { code: 'heat-trimmed'; tempC: number; what: 'fruit-set' | 'bolting' }
  | { code: 'indoor-start'; weeks: readonly [number, number] }
  | { code: 'harden-off' }
  | { code: 'maturity'; days: number; method: Method; extraDays: number }
  /** `day` is the last day of picking, the same day the harvest range ends on. */
  | { code: 'harvest-until'; day: DayNum; cap: CapKind; estimated: boolean }
  | { code: 'fall-count-back'; ref: DayNum; refKind: 'frost-risk' | 'first-frost' | 'minus2' | 'minus5'; days: number; pickingDays: number; estimated: boolean }
  | { code: 'fall-heat-set'; day: DayNum; tempC: number }
  | { code: 'after-spring'; day: DayNum }
  | { code: 'succession'; everyDays: number; count: number }
  | { code: 'succession-gap'; from: DayNum; to: DayNum; tempC: number }
  | { code: 'season-long'; until: DayNum }
  | { code: 'overwinter-plant'; weeks: readonly [number, number]; ref: DayNum; refKind: 'first-frost' | 'cool-season' }
  | { code: 'overwinter-harvest'; weeks: readonly [number, number]; ref: DayNum; refKind: 'last-frost' | 'cool-season' }
  | { code: 'pre-chill'; weeks: number }
  | { code: 'perennial-harvest'; firstSeason: number; weeks: readonly [number, number] | null }
  | { code: 'temp-range'; minC: number; maxC: number }
  | { code: 'frost-span-avoided'; from: DayNum; to: DayNum }
  // Why a window is not viable
  | { code: 'too-hot'; tempC: number }
  | { code: 'too-cool'; tempC: number }
  | { code: 'too-short'; day: DayNum; cap: CapKind }
  | { code: 'soil-never-warm'; tempC: number; method: Method }
  | { code: 'warmest-weeks'; day: DayNum; tempC: number }
  | { code: 'no-room'; ref: DayNum }
  | { code: 'needs-town' }
  /** The schedule maths could not handle this plant record; nothing was worked out. */
  | { code: 'schedule-error' }
  // Where a planting's own date came from
  | { code: 'pinned-date'; day: DayNum }
  | { code: 'done'; day: DayNum }
  // Warnings
  | { code: 'frost-possible'; day: DayNum }
  | { code: 'cool-summer'; meanC: number; minC: number }
  | { code: 'frost-only' }
  | { code: 'approximate' }
  /** Going in after its usual window closed, with time still to crop. */
  | { code: 'late-planting'; usualEnd: DayNum }
  | { code: 'winter-too-cold'; zoneMinC: number; winterMinC: number }
  | { code: 'hot-weather-shade'; from: DayNum; to: DayNum; tempC: number };

export type ReasonCode = Reason['code'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "Apr 16". */
export function formatDay(d: DayNum): string {
  const { month, day } = partsFromDay(d);
  return `${MONTHS[month - 1]} ${day}`;
}

/** "Apr 29 to May 13", or a single date when the range is one day. */
export function formatRange(r: DayRange): string {
  if (r.end - r.start >= 364) return 'all year round';
  return r.start === r.end ? formatDay(r.start) : `${formatDay(r.start)} to ${formatDay(r.end)}`;
}

const c = (t: number) => `${Math.round(t)} C`;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "6 to 2 weeks before", "1 to 4 weeks after", "2 weeks before to 3 weeks after". */
function weeksPhrase([a, b]: readonly [number, number], anchor: string): string {
  const side = (w: number) => (w < 0 ? 'before' : 'after');
  if (a === 0 && b === 0) return `around ${anchor}`;
  if (a === b) return `${plural(Math.abs(a), 'week')} ${side(a)} ${anchor}`;
  if (a < 0 && b <= 0) return b === 0 ? `up to ${plural(-a, 'week')} before ${anchor}` : `${-b} to ${plural(-a, 'week')} before ${anchor}`;
  if (a >= 0 && b > 0) return a === 0 ? `from ${anchor} to ${plural(b, 'week')} after` : `${a} to ${plural(b, 'week')} after ${anchor}`;
  return `${plural(-a, 'week')} before to ${plural(b, 'week')} after ${anchor}`;
}

const VERB: Record<Method, string> = { transplant: 'Plant out', direct: 'Sow', plant: 'Plant' };

const CAP_TEXT: Record<CapKind, string> = {
  'first-frost': 'the usual first frost',
  minus2: 'the usual first hard frost (-2 C)',
  minus5: 'the usual first -5 C freeze',
  'out-of-range': 'when it usually turns too warm or too cool for it',
  'frost-risk': 'when frost becomes possible',
  heat: 'when summer heat stops fruit setting',
  'bolting-heat': 'when summer heat makes it bolt',
  window: 'the end of its usual picking time',
};

/** How a harvest-until sentence ends: the cap is the day after the last day of picking. */
const UNTIL_TEXT: Record<CapKind, string> = {
  'first-frost': 'just before the usual first frost',
  minus2: 'just before the usual first hard frost (-2 C)',
  minus5: 'just before the usual first -5 C freeze',
  'out-of-range': 'before it usually turns too warm or too cool for it',
  'frost-risk': 'before frost becomes possible',
  heat: 'before summer heat stops fruit setting',
  'bolting-heat': 'before summer heat makes it bolt',
  window: 'the end of its usual picking time',
};

/**
 * A plain English sentence for a reason. Temperatures come out in the gardener's units when they
 * are given (with no units, as plain "7 C", for tests and the assistant's own reading).
 */
export function reasonText(r: Reason, units?: Units): string {
  const t = reasonCore(r);
  return units ? t.replace(/(-?\d+(?:\.\d+)?) C\b/g, (_m, n: string) => formatTemp(Number(n), units)) : t;
}

function reasonCore(r: Reason): string {
  switch (r.code) {
    case 'frost-offset':
      return `${VERB[r.method]} ${weeksPhrase(r.weeks, `your last frost (${formatDay(r.lastFrost)})`)}`;
    case 'held-to-lf90':
      return `held back to ${formatDay(r.day)}, when frost has passed in 9 years out of 10`;
    case 'soil-warm':
      return r.method === 'direct'
        ? `not before ${formatDay(r.day)}, when the soil is usually warm enough (${c(r.tempC)}) for the seed to come up`
        : `not before ${formatDay(r.day)}, when the soil is usually warm enough (${c(r.tempC)}) for it to grow away`;
    case 'early-for-heat':
      return `starts before the soil is fully warm (${c(r.tempC)} by ${formatDay(r.day)}) because summer heat ends the season early here; cover young plants on cold nights`;
    case 'heat-trimmed':
      return r.what === 'fruit-set'
        ? `later dates dropped: it would flower in heat over ${c(r.tempC)}, when fruit fails to set`
        : `later dates dropped: it would grow through heat over ${c(r.tempC)} and bolt`;
    case 'indoor-start':
      return `start seeds indoors ${r.weeks[0] === r.weeks[1] ? plural(r.weeks[0], 'week') : `${r.weeks[0]} to ${plural(r.weeks[1], 'week')}`} before planting out`;
    case 'harden-off':
      return 'harden off seedlings outdoors over the 10 days before planting out';
    case 'maturity':
      return r.extraDays > 0
        ? `first harvest about ${r.days + r.extraDays} days after it goes in (${r.days} days, plus ${r.extraDays} for shortening autumn days)`
        : `first harvest about ${r.days} days after it goes in`;
    case 'harvest-until':
      return `harvest until about ${formatDay(r.day)}, ${UNTIL_TEXT[r.cap]}${r.estimated ? ' (estimated)' : ''}`;
    case 'fall-count-back': {
      const ref =
        r.refKind === 'frost-risk'
          ? `${formatDay(r.ref)}, when frost becomes possible`
          : r.refKind === 'first-frost'
            ? `your usual first frost (${formatDay(r.ref)})`
            : r.refKind === 'minus2'
              ? `the first hard frost of -2 C (${formatDay(r.ref)}${r.estimated ? ', estimated' : ''})`
              : `the first -5 C freeze (${formatDay(r.ref)}${r.estimated ? ', estimated' : ''})`;
      const picking = r.pickingDays > 0 ? `, leaving ${r.pickingDays} days of picking` : '';
      return `counted back ${r.days} days from ${ref}, with two extra weeks for shortening days${picking}`;
    }
    case 'fall-heat-set':
      return `in summer heat it flowers without setting fruit; picking starts once days cool below ${c(r.tempC)} (about ${formatDay(r.day)})`;
    case 'after-spring':
      return `not before ${formatDay(r.day)}, after the spring window`;
    case 'succession':
      return `a little more every ${r.everyDays} days keeps the supply steady, up to ${plural(r.count, 'sowing')} a season; add each one to the plan where there is room`;
    case 'succession-gap':
      return `no sowings from ${formatDay(r.from)} to ${formatDay(r.to)}: summer heat over ${c(r.tempC)} would make it bolt`;
    case 'season-long':
      return `sowings stay good from spring right through to ${formatDay(r.until)} here, with no summer break`;
    case 'overwinter-plant':
      return r.refKind === 'first-frost'
        ? `Plant ${weeksPhrase(r.weeks, `your first frost (${formatDay(r.ref)})`)}, to root before winter`
        : `Plant ahead of the coolest months, which begin about ${formatDay(r.ref)}, to root in cool soil`;
    case 'overwinter-harvest':
      return r.refKind === 'last-frost'
        ? `lift ${weeksPhrase(r.weeks, `next spring's last frost (${formatDay(r.ref)})`)}`
        : `lift in late spring, after the coolest months end (about ${formatDay(r.ref)})`;
    case 'pre-chill':
      return `winters here are too mild to trigger bulbing: chill the cloves or sets in a refrigerator for ${plural(r.weeks, 'week')} before planting`;
    case 'perennial-harvest':
      return r.weeks
        ? `first harvest in the ${r.firstSeason} season, then every year ${weeksPhrase(r.weeks, 'your last frost')}`
        : `first harvest in the ${r.firstSeason} season, then every year in late spring, once the coolest months are past (approximate)`;
    case 'temp-range':
      return `where the average temperature stays between ${c(r.minC)} and ${c(r.maxC)} until harvest (approximate)`;
    case 'frost-span-avoided':
      return `kept clear of the frost-risk weeks, ${formatDay(r.from)} to ${formatDay(r.to)}`;
    case 'too-hot':
      return `too warm here: the average temperature stays above ${c(r.tempC)}, so it bolts or fails; try heat-tolerant kinds or another crop`;
    case 'too-cool':
      return `too cool here: the average temperature stays below ${c(r.tempC)} for too long`;
    case 'too-short':
      return `not viable here: too little time to mature and give a week of harvest before ${formatDay(r.day)}, ${CAP_TEXT[r.cap]}`;
    case 'soil-never-warm':
      return r.method === 'direct'
        ? `the soil here rarely reaches ${c(r.tempC)}, so seed sown outdoors may not come up`
        : `the soil here rarely reaches the ${c(r.tempC)} it likes, so growth outdoors is slow`;
    case 'warmest-weeks':
      return `not before ${formatDay(r.day)}, when the warmest weeks begin, as the soil here seldom reaches ${c(r.tempC)}`;
    case 'no-room':
      return `no time for a fall crop: it would not mature before ${formatDay(r.ref)}`;
    case 'needs-town':
      return 'add your town or your frost dates to get a schedule';
    case 'schedule-error':
      return 'the dates for this plant could not be worked out: check its details, such as days to maturity and planting weeks';
    case 'pinned-date':
      return `on ${formatDay(r.day)}, the date you set`;
    case 'done':
      return `done on ${formatDay(r.day)}`;
    case 'frost-possible':
      return `frost possible from ${formatDay(r.day)}: watch the forecast and cover or pick`;
    case 'cool-summer':
      return `it would grow mostly in weather cooler than it likes (about ${c(r.meanC)} on average, against ${c(r.minC)}): grow it under cover or choose early varieties`;
    case 'frost-only':
      return 'based on frost dates only: add your town for heat-aware dates';
    case 'approximate':
      return 'approximate: worked out from temperatures, as frost is rare here';
    case 'late-planting':
      return `later than usual: its window here ended ${formatDay(r.usualEnd)}, but there is still time for a crop before the season ends`;
    case 'winter-too-cold':
      return `winters here (about ${c(r.zoneMinC)}) can be colder than it survives (${c(r.winterMinC)}): mulch well or plant in spring`;
    case 'hot-weather-shade':
      return `sowings from ${formatDay(r.from)} to ${formatDay(r.to)} grow through hot days over ${c(r.tempC)}: give them part shade and keep the soil moist, or they run to seed`;
  }
}
