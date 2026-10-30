// First run: "Where do you garden?" Search a town (or type frost dates), see what GardenSync worked
// out, pick a starter, and go. Only the town's coordinates leave the device.
import { useSignal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import type { ClimateProfile } from '../../domain/climate/types';
import { manualProfile } from '../../domain/climate/manual';
import { circularDoy, monthDayOf, toDay } from '../../domain/dates';
import { starterOps, type StarterKind } from '../../domain/doc/starters';
import { formatTemp, type Units } from '../../domain/units';
import { lastCompleteYears, profileForPlace, type PlaceHit } from '../../platform/openmeteo';
import { newId, store, today } from '../appState';
import { Logo } from '../components/Header';
import { PlaceSearch, placeErrorText } from '../components/PlaceSearch';
import { fmtMonthDay } from '../format';
import { navigate } from '../router';
import './FirstRun.css';

type Lookup =
  | { kind: 'idle' }
  | { kind: 'loading'; place: PlaceHit }
  | { kind: 'done'; profile: ClimateProfile }
  | { kind: 'error'; place: PlaceHit; message: string };

const defaultUnits = (): Units =>
  typeof navigator !== 'undefined' && /^en-(US|LR|MM)/.test(navigator.language) ? 'imperial' : 'metric';


export function FirstRun() {
  const lookup = useSignal<Lookup>({ kind: 'idle' });
  const manual = useSignal(false);
  const lastFrost = useSignal('');
  const firstFrost = useSignal('');
  const starter = useSignal<StarterKind>('first-bed');
  const unitsSel = useSignal<Units>(defaultUnits());
  const unitsTouched = useSignal(false);
  const gardenName = useSignal('My garden');
  const abort = useRef<AbortController | null>(null);
  const locating = useSignal<'idle' | 'busy' | string>('idle');

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      locating.value = 'This browser cannot share its location. Type your town instead.';
      return;
    }
    locating.value = 'busy';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locating.value = 'idle';
        // Rounded to about 1 km: plenty for 30 years of weather, and no more precise than it needs to be.
        const round = (n: number) => Math.round(n * 100) / 100;
        void choose({ name: 'Your location', lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) });
      },
      (err) => {
        locating.value =
          err.code === err.PERMISSION_DENIED
            ? 'Location is turned off for this site. Type your town instead.'
            : 'Your location could not be found just now. Type your town instead.';
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  }

  async function choose(place: PlaceHit) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    lookup.value = { kind: 'loading', place };
    // The town's country is a better guess at the units than the browser's language.
    if (!unitsTouched.value && place.country) unitsSel.value = /^(United States|Liberia|Myanmar)$/.test(place.country) ? 'imperial' : 'metric';
    try {
      const profile = await profileForPlace(place, lastCompleteYears(today.value), today.value, undefined, ctl.signal);
      if (!ctl.signal.aborted) lookup.value = { kind: 'done', profile };
    } catch (err) {
      if (!ctl.signal.aborted) lookup.value = { kind: 'error', place, message: placeErrorText(err) };
    }
  }

  function useManual() {
    if (!lastFrost.value || !firstFrost.value) return;
    const profile = manualProfile({
      lastFrost: monthDayOf(toDay(lastFrost.value)),
      firstFrost: monthDayOf(toDay(firstFrost.value)),
      asOf: today.value,
      ...(lookup.value.kind === 'error' ? { place: lookup.value.place } : {}),
    });
    lookup.value = { kind: 'done', profile };
    manual.value = false;
  }

  function start() {
    const climate = lookup.value.kind === 'done' ? lookup.value.profile : null;
    const ops = starterOps({
      kind: starter.value,
      gardenId: newId(),
      name: gardenName.value.trim() || 'My garden',
      today: today.value,
      units: unitsSel.value,
      climate,
      newId,
    });
    const res = store.dispatch({ type: 'batch', ops: [...ops, { type: 'updateSettings', patch: { units: unitsSel.value } }] }, { label: 'start the garden' });
    if (res.ok) navigate({ name: 'garden' });
  }

  const profile = lookup.value.kind === 'done' ? lookup.value.profile : null;
  const u = unitsSel.value;

  return (
    <main class="first-run">
      <section class="fr-ask" aria-labelledby="fr-title">
        <div class="fr-brand">
          <Logo />
          <span>GardenSync</span>
        </div>
        <h1 id="fr-title" tabIndex={-1}>
          Where do you garden?
        </h1>
        <p class="fr-lede">
          Your town sets every date in the app. GardenSync looks up 30 years of weather there and works out when frost usually ends
          and comes back.
        </p>

        <div class="fr-search">
          <PlaceSearch
            id="fr-town"
            picked={lookup.value.kind === 'loading' || lookup.value.kind === 'error' ? lookup.value.place : null}
            onPick={choose}
          />
        </div>

        <div class="fr-alt">
          <button class="btn-quiet btn" onClick={useMyLocation} disabled={locating.value === 'busy'}>
            {locating.value === 'busy' ? 'Finding you' : 'Use my location'}
          </button>
          <button class="btn-quiet btn" onClick={() => (manual.value = !manual.value)} aria-expanded={manual.value}>
            I know my frost dates
          </button>
        </div>
        {locating.value !== 'idle' && locating.value !== 'busy' ? (
          <p class="fr-small" role="alert">
            {locating.value}
          </p>
        ) : null}
        {manual.value ? (
          <form
            class="fr-manual panel"
            onSubmit={(e) => {
              e.preventDefault();
              useManual();
            }}
          >
            <div class="field">
              <label for="fr-lf">Typical last spring frost</label>
              <input id="fr-lf" class="input" type="date" required value={lastFrost.value} onInput={(e) => (lastFrost.value = (e.target as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label for="fr-ff">Typical first fall frost</label>
              <input id="fr-ff" class="input" type="date" required value={firstFrost.value} onInput={(e) => (firstFrost.value = (e.target as HTMLInputElement).value)} />
            </div>
            <p class="muted fr-small">Any year will do; only the month and day are used. Without a town, GardenSync cannot allow for summer heat.</p>
            <button class="btn" type="submit">
              Use these dates
            </button>
          </form>
        ) : null}
        <p class="muted fr-small">Only the town's position leaves your device, to fetch weather records. Your garden stays in this browser.</p>
      </section>

      <section class="fr-found" data-state={lookup.value.kind} aria-live="polite" aria-labelledby="fr-found-title">
        {lookup.value.kind === 'idle' ? (
          <div class="fr-empty">
            <h2 id="fr-found-title">What you will get</h2>
            <p class="muted">Pick your town and GardenSync works out these four things for it. Every date in the app follows from them.</p>
            <figure class="fr-example" aria-labelledby="fr-example-cap">
              <figcaption id="fr-example-cap" class="fr-example-tag">Example, not your town</figcaption>
              <dl class="fr-facts">
                <div class="fr-fact">
                  <dt>Last spring frost</dt>
                  <dd class="fr-big">Around Apr 20</dd>
                </div>
                <div class="fr-fact">
                  <dt>First fall frost</dt>
                  <dd class="fr-big">Around Oct 15</dd>
                </div>
                <div class="fr-fact">
                  <dt>Frost-free season</dt>
                  <dd class="fr-big">178 days</dd>
                </div>
                <div class="fr-fact">
                  <dt>Hardiness zone</dt>
                  <dd class="fr-big">6b</dd>
                </div>
              </dl>
            </figure>
          </div>
        ) : null}
        {lookup.value.kind === 'loading' ? (
          <div class="fr-empty">
            <h2 id="fr-found-title">{lookup.value.place.name}</h2>
            <p>Reading 30 years of weather records. This takes a few seconds.</p>
          </div>
        ) : null}
        {lookup.value.kind === 'error' ? (
          <div class="fr-error panel">
            <h2 id="fr-found-title">Weather records did not load</h2>
            <p>{lookup.value.message} Nothing was changed.</p>
            <div class="fr-row">
              <button class="btn" onClick={() => lookup.value.kind === 'error' && choose(lookup.value.place)}>
                Try again
              </button>
              <button class="btn" onClick={() => (manual.value = true)}>
                Type my frost dates instead
              </button>
            </div>
          </div>
        ) : null}
        {profile ? <Found profile={profile} units={u} /> : null}

        {profile || lookup.value.kind === 'error' ? (
          <div class="fr-start">
            <div class="field">
              <label for="fr-name">Name your garden</label>
              <input id="fr-name" class="input" value={gardenName.value} onInput={(e) => (gardenName.value = (e.target as HTMLInputElement).value)} />
            </div>
            <fieldset class="fr-choices">
              <legend>Start with</legend>
              {(
                [
                  ['first-bed', 'One 4 by 8 bed', 'Planted for a first season'],
                  ['patio', 'A patio of pots', 'Herbs, tomatoes, peppers'],
                  ['empty', 'An empty garden', 'Draw your own beds'],
                ] as const
              ).map(([k, title, sub]) => (
                <label class="fr-choice" data-picked={starter.value === k} key={k}>
                  <span class="fr-choice-title">
                    <input type="radio" name="fr-starter" checked={starter.value === k} onChange={() => (starter.value = k)} />
                    {title}
                  </span>
                  <span class="muted fr-small">{sub}</span>
                </label>
              ))}
            </fieldset>
            <fieldset class="fr-units">
              <legend>Measurements</legend>
              <label>
                <input type="radio" name="fr-units" checked={u === 'imperial'} onChange={() => { unitsSel.value = 'imperial'; unitsTouched.value = true; }} />
                Feet, pounds, Fahrenheit
              </label>
              <label>
                <input type="radio" name="fr-units" checked={u === 'metric'} onChange={() => { unitsSel.value = 'metric'; unitsTouched.value = true; }} />
                Meters, kilograms, Celsius
              </label>
            </fieldset>
            <button class="btn btn-primary fr-go" onClick={start}>
              Start planning
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Found({ profile, units }: { profile: ClimateProfile; units: Units }) {
  const lf = profile.lastFrost;
  const ff = profile.firstFrost;
  // Days from the last spring frost forward to the first fall frost, wrapping the new year if needed.
  const season = lf.p50 && ff.p50 ? (((circularDoy(ff.p50) - circularDoy(lf.p50)) % 365) + 365) % 365 : null;
  return (
    <div class="fr-result">
      <h2 id="fr-found-title">{profile.place?.name ?? 'Your frost dates'}</h2>
      <p class="muted">
        {profile.source === 'computed' && profile.years
          ? `From daily weather records for ${profile.years[0]} to ${profile.years[1]}. These are typical dates, not promises: check the forecast before planting out tender crops.`
          : 'From the dates you typed in.'}
      </p>
      {profile.frostClass === 'none' ? (
        <p class="fr-callout">Frost almost never comes here, so GardenSync plans by temperature: when it is cool enough for greens and warm enough for fruiting crops.</p>
      ) : null}
      {profile.frostClass === 'marginal' ? (
        <p class="fr-callout">Frost comes only in some winters here. Dates follow temperature, with a warning for tender crops in the coldest weeks.</p>
      ) : null}
      <dl class="fr-facts">
        {lf.p50 ? (
          <div class="fr-fact">
            <dt>Last spring frost</dt>
            <dd class="fr-big">{fmtMonthDay(lf.p50)}</dd>
            {lf.p90 ? <dd class="muted fr-small">Safe for tender plants by {fmtMonthDay(lf.p90)} in 9&nbsp;years out of&nbsp;10</dd> : null}
          </div>
        ) : null}
        {ff.p50 ? (
          <div class="fr-fact">
            <dt>First fall frost</dt>
            <dd class="fr-big">{fmtMonthDay(ff.p50)}</dd>
            {ff.p10 ? <dd class="muted fr-small">Can come by {fmtMonthDay(ff.p10)} in 1&nbsp;year out of&nbsp;10</dd> : null}
          </div>
        ) : null}
        {season !== null ? (
          <div class="fr-fact">
            <dt>Frost-free season</dt>
            <dd class="fr-big">{season} days</dd>
          </div>
        ) : null}
        {profile.zone ? (
          <div class="fr-fact">
            <dt>USDA-style hardiness zone</dt>
            <dd class="fr-big">{profile.zone}</dd>
            {profile.extremeMinC !== null ? (
              <dd class="muted fr-small">Coldest night of a typical winter: {formatTemp(profile.extremeMinC, units)}</dd>
            ) : null}
          </div>
        ) : null}
      </dl>
    </div>
  );
}
