// USDA-style hardiness zones from an average annual extreme minimum temperature.
//
// The USDA map bands the average yearly lowest temperature in 10 F steps, each split into a colder
// half "a" and a warmer half "b": zone 1a is -60 to -55 F, 1b is -55 to -50 F, ... 13b is 65 to 70 F.
// Anything colder than -55 F is reported as 1a and anything at or above 65 F as 13b.

export const MIN_ZONE = 1;
export const MAX_ZONE = 13;

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function zoneFromExtremeMinF(f: number): string {
  if (!Number.isFinite(f)) throw new RangeError(`Not a temperature: ${f}`);
  const shifted = f + 60;
  // Work in tenths of a degree so floating-point noise at band edges cannot flip a zone.
  const tenths = Math.round(shifted * 10);
  let zone = Math.floor(tenths / 100) + 1;
  let half: 'a' | 'b' = ((tenths % 100) + 100) % 100 < 50 ? 'a' : 'b';
  if (zone < MIN_ZONE) {
    zone = MIN_ZONE;
    half = 'a';
  } else if (zone > MAX_ZONE) {
    zone = MAX_ZONE;
    half = 'b';
  }
  return `${zone}${half}`;
}

/** Zone such as "6b" from a mean extreme minimum in degrees C, or null when there is none. */
export function zoneFromExtremeMinC(c: number | null | undefined): string | null {
  if (c === null || c === undefined || !Number.isFinite(c)) return null;
  return zoneFromExtremeMinF(cToF(c));
}

/** The extreme-minimum band a zone covers, in degrees F, lower bound inclusive. */
export function zoneRangeF(zone: string): { fromF: number; toF: number } {
  const m = /^(\d{1,2})([ab])$/.exec(zone);
  const n = m ? Number(m[1]) : NaN;
  if (!m || n < MIN_ZONE || n > MAX_ZONE) throw new RangeError(`Not a zone: ${zone}`);
  const fromF = (n - 1) * 10 - 60 + (m[2] === 'b' ? 5 : 0);
  return { fromF, toF: fromF + 5 };
}
