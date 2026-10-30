// The harvest log: log a pick, see each crop picked so far against what its plantings should give,
// and the recent picks with edit and delete. Layout from A-harvest.dc.html.
import { useSignal } from '@preact/signals';
import { isIsoDate, toDay } from '../../domain/dates';
import type { Harvest } from '../../domain/doc/schema';
import type { Plant } from '../../domain/plants/schema';
import { plantingPhases, seasonLabel, seasonOf } from '../../domain/schedule';
import { formatWeight, formatWeightApprox, parseWeight } from '../../domain/units';
import { pickedSoFar, type Amount } from '../../domain/yield';
import { garden, newId, store, today, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay, inSentence } from '../format';
import { hrefOf } from '../router';
import { plantOf } from '../uiState';
import './Harvest.css';
import { cropRows, earlyPickNote, pickablePlantings, plantingOptionLabels, type CropRow } from './model';

/** "1 lb 8 oz", "12 counted", or both: picks logged by weight and by count do not add up. */
function amountText(a: Amount, u: 'imperial' | 'metric'): string {
  const parts: string[] = [];
  if (a.grams > 0) parts.push(formatWeight(a.grams, u));
  if (a.count > 0) parts.push(`${Math.round(a.count)} counted`);
  return parts.join(' and ') || 'nothing yet';
}

/**
 * What a counted crop's count is a count of. Yields by count are blooms for flowers (the library's
 * flower yields are flowers per plant); other counted crops (heads, ears, fruits) have no single
 * noun, so they fall back to a plain verb.
 */
function countNoun(category: Plant['category']): string | null {
  return category === 'flower' ? 'flowers' : null;
}

/** "1 lb 8 oz of 10 lb", "4 of about 12 flowers", or just what was picked when nothing is planned. */
function progressText(r: CropRow, u: 'imperial' | 'metric', noun: string | null): string {
  const { expected: e, picked: got } = r;
  if (e.grams > 0) return `${formatWeight(got.grams, u)} of ${formatWeight(e.grams, u)}${got.count > 0 ? `, and ${Math.round(got.count)} counted` : ''}`;
  if (e.count > 0) return `${Math.round(got.count)} of ${Math.round(e.count)} ${noun ?? 'picked'}${got.grams > 0 ? `, and ${formatWeight(got.grams, u)}` : ''}`;
  return `${amountText(got, u)}, not in this season's plan`;
}

function expectedAmountText(e: Amount, u: 'imperial' | 'metric', noun: string | null): string {
  const parts: string[] = [];
  if (e.grams > 0) parts.push(formatWeight(e.grams, u));
  if (e.count > 0) parts.push(`about ${Math.round(e.count)} ${noun ?? 'to pick'}`);
  return parts.join(', ') || 'no estimate';
}

export function HarvestScreen() {
  const g = garden.value;
  if (!g) return null;
  const u = units.value;
  const c = g.climate;
  const season = c ? seasonOf(c, toDay(today.value)) : Number(today.value.slice(0, 4));
  const inSeason = (iso: string) => (c ? seasonOf(c, toDay(iso)) === season : iso.startsWith(String(season)));

  // One row per crop planned for this season or picked in it, so the rows add up to the total.
  const seasonHarvests = g.harvests.filter((h) => inSeason(h.date));
  const crops = cropRows(g.plantings, seasonHarvests, plantOf, c, season);
  const total = pickedSoFar(seasonHarvests, () => true);
  const expectedTotal = crops.reduce((a, x) => a + x.expected.grams, 0);
  const recent = [...g.harvests].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <main class="harvest">
      <header class="harvest-head">
        <h1 tabIndex={-1}>{c ? seasonLabel(c, season) : season} harvest</h1>
        <p class="harvest-sub">
          {seasonHarvests.length === 0
            ? 'Nothing picked yet this season. Log your first pick with the form here, or from a planting in the garden.'
            : `Picked so far: ${amountText(total, u)}.${expectedTotal > 0 ? ` The plan expects about ${formatWeightApprox(expectedTotal, u)} by the end of the season.` : ''}`}
        </p>
      </header>
      <div class="harvest-main">
        {crops.length > 0 ? (
          <section class="panel harvest-crops" aria-labelledby="hv-crops">
            {seasonHarvests.length === 0 ? (
              <>
                <h2 id="hv-crops">What the plan should give this season</h2>
                <ul class="crop-plan-list">
                  {crops.map((crop) => (
                    <li key={crop.plantId} class="crop-plan-row">
                      <span class="crop-name">
                        {crop.plant ? <Glyph form={crop.plant.glyph.form} color={crop.plant.glyph.color} size={22} /> : null}
                        {crop.plant?.name ?? crop.plantId}
                      </span>
                      <span class="muted crop-plan-amt">{expectedAmountText(crop.expected, u, crop.plant ? countNoun(crop.plant.category) : null)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2 id="hv-crops">Picked so far, against what each crop should give</h2>
                <ul class="crop-list">
                  {crops.map((crop) => {
                    const name = crop.plant?.name ?? crop.plantId;
                    const color = crop.plant?.glyph.color ?? 'var(--c-muted)';
                    const byWeight = crop.expected.grams > 0;
                    const exp = byWeight ? crop.expected.grams : crop.expected.count;
                    const have = byWeight ? crop.picked.grams : crop.picked.count;
                    // Picks of a crop with nothing planned this season fill the bar: there is no target.
                    const pct = exp > 0 ? Math.min(100, Math.round((have / exp) * 100)) : 100;
                    const text = progressText(crop, u, crop.plant ? countNoun(crop.plant.category) : null);
                    return (
                      <li key={crop.plantId} class="crop-row">
                        <span class="crop-name">
                          {crop.plant ? <Glyph form={crop.plant.glyph.form} color={color} size={26} /> : null}
                          {name}
                        </span>
                        <span class="crop-bar" role="img" aria-label={`${name}: ${text}`}>
                          <span style={{ width: `${pct}%`, background: color }} />
                        </span>
                        <span class="muted crop-text">{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        ) : null}
        <section aria-labelledby="hv-recent" class="harvest-recent">
          <h2 id="hv-recent">Recent picks</h2>
          {recent.length === 0 ? (
            <p class="muted">Picks you log appear here.</p>
          ) : (
            <div class="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Plant</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Note</th>
                    <th scope="col">
                      <span class="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((h) => (
                    <HarvestRow key={h.id} h={h} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <aside class="harvest-side">
        <LogForm />
      </aside>
    </main>
  );
}

function HarvestRow({ h }: { h: Harvest }) {
  const g = garden.value!;
  const u = units.value;
  const plant = plantOf(h.plantId);
  const amount = [h.grams !== undefined ? formatWeight(h.grams, u) : null, h.count !== undefined ? `${h.count} picked` : null].filter(Boolean).join(', ');
  return (
    <tr>
      <td>{fmtDay(toDay(h.date))}</td>
      <th scope="row">{plant?.name ?? h.plantId}</th>
      <td>{amount}</td>
      <td class="muted">{h.note ?? ''}</td>
      <td>
        <button class="btn" onClick={() => store.dispatch({ type: 'removeHarvest', gardenId: g.id, harvestId: h.id }, { label: 'delete a pick' })}>
          Delete
        </button>
      </td>
    </tr>
  );
}

function LogForm() {
  const g = garden.value!;
  const u = units.value;
  // Only plantings in the ground this season by today: one that goes in next year has nothing to pick.
  const c = g.climate;
  const todayDay = toDay(today.value);
  const found = pickablePlantings(g.plantings, plantOf, c, c ? seasonOf(c, todayDay) : Number(today.value.slice(0, 4)), todayDay)
    .map((p) => {
      const plant = plantOf(p.plantId);
      return { p, plant, container: g.containers.find((k) => k.id === p.containerId), phases: plant ? plantingPhases(p, plant, c) : null };
    })
    .filter((o) => o.plant)
    .sort((a, b) => a.plant!.name.localeCompare(b.plant!.name) || (a.phases?.bedIn ?? 0) - (b.phases?.bedIn ?? 0));
  // "Lettuce, Bed 1, A2 to B3": two lettuces in one bed must not read the same.
  const labels = plantingOptionLabels(
    found.map((o) => ({ p: o.p, plantName: o.plant!.name, containerName: o.container?.name ?? '', sowDay: o.phases?.bedIn ?? null })),
    fmtDay,
  );
  const options = found.map((o, i) => ({ ...o, label: labels[i]! }));
  // Starts empty: the gardener says what they picked rather than logging against the first name.
  const plantingId = useSignal('');
  const amount = useSignal('');
  const count = useSignal('');
  const date = useSignal(today.value);
  const note = useSignal('');
  const message = useSignal<{ ok: boolean | null; text: string } | null>(null);
  // The planting and day the gardener already said yes to, after being told it is early to pick.
  const earlyOk = useSignal('');

  if (options.length === 0) {
    return (
      <section class="panel log-form">
        <h2>Log a harvest</h2>
        {g.plantings.length > 0 ? (
          <p class="muted">Nothing in the garden is in the ground yet this season. Log a pick here once a planting has gone in.</p>
        ) : (
          <p class="muted">
            Plant something in the <a href={hrefOf({ name: 'garden' })}>garden</a> first, then log what you pick here.
          </p>
        )}
      </section>
    );
  }

  function submit(e: Event) {
    e.preventDefault();
    const chosen = options.find((o) => o.p.id === plantingId.value);
    if (!chosen) {
      message.value = { ok: false, text: 'Choose what you picked.' };
      return;
    }
    const grams = amount.value.trim() ? parseWeight(amount.value, u === 'metric' ? 'g' : 'lb') : null;
    const n = count.value.trim() ? Number(count.value) : null;
    if (amount.value.trim() && grams === null) {
      message.value = { ok: false, text: `Type the weight like ${u === 'metric' ? '600 g or 1.2 kg' : '1.5 lb or 12 oz'}.` };
      return;
    }
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      message.value = { ok: false, text: 'The count must be a whole number.' };
      return;
    }
    if (grams === null && n === null) {
      message.value = { ok: false, text: 'Add a weight, a count, or both.' };
      return;
    }
    // Picking before the usual window is allowed (a thinning, an early leaf), but asked about once.
    const early = isIsoDate(date.value) ? earlyPickNote(chosen.plant!.name, chosen.phases, toDay(date.value), fmtDay) : null;
    if (early && earlyOk.value !== `${chosen.p.id}@${date.value}`) {
      earlyOk.value = `${chosen.p.id}@${date.value}`;
      message.value = { ok: null, text: early };
      return;
    }
    const res = store.dispatch(
      {
        type: 'logHarvest',
        gardenId: g.id,
        harvest: {
          id: newId(),
          plantId: chosen.p.plantId,
          plantingId: chosen.p.id,
          date: date.value,
          ...(grams !== null ? { grams } : {}),
          ...(n !== null ? { count: n } : {}),
          ...(note.value.trim() ? { note: note.value.trim() } : {}),
        },
      },
      { label: 'log a harvest' },
    );
    if (res.ok) {
      message.value = { ok: true, text: `Logged ${inSentence(chosen.plant!.name)}.` };
      amount.value = '';
      count.value = '';
      note.value = '';
      earlyOk.value = '';
    } else {
      message.value = { ok: false, text: res.error };
    }
  }

  // Still asking about an early pick only while the planting and day are the ones asked about.
  const asking = message.value?.ok === null && earlyOk.value === `${plantingId.value}@${date.value}`;

  return (
    <form class="panel log-form" onSubmit={submit} aria-labelledby="hv-log" noValidate>
      <h2 id="hv-log">Log a harvest</h2>
      <div class="field">
        <label for="hv-planting">What did you pick?</label>
        <select id="hv-planting" class="input" required value={plantingId.value} onChange={(e) => (plantingId.value = (e.target as HTMLSelectElement).value)}>
          <option value="" disabled>
            Choose a planting
          </option>
          {options.map((o) => (
            <option key={o.p.id} value={o.p.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div class="log-two">
        <div class="field">
          <label for="hv-amount">Weight</label>
          <input id="hv-amount" class="input" inputMode="decimal" placeholder={u === 'metric' ? '600 g' : '1.5 lb'} value={amount.value} onInput={(e) => (amount.value = (e.target as HTMLInputElement).value)} />
        </div>
        <div class="field">
          <label for="hv-count">How many</label>
          <input id="hv-count" class="input" inputMode="numeric" placeholder="12" value={count.value} onInput={(e) => (count.value = (e.target as HTMLInputElement).value)} />
        </div>
      </div>
      <div class="field">
        <label for="hv-date">When</label>
        <input id="hv-date" class="input" type="date" value={date.value} onInput={(e) => (date.value = (e.target as HTMLInputElement).value)} />
      </div>
      <div class="field">
        <label for="hv-note">
          Note <span class="muted">(optional)</span>
        </label>
        <input id="hv-note" class="input" value={note.value} onInput={(e) => (note.value = (e.target as HTMLInputElement).value)} />
      </div>
      <button class="btn btn-primary" type="submit">
        {asking ? 'Log it anyway' : 'Log harvest'}
      </button>
      <p role="status" class={message.value?.ok === false ? 'log-error' : message.value?.ok === null ? 'log-note' : 'log-ok'}>
        {message.value?.ok === null && !asking ? '' : (message.value?.text ?? '')}
      </p>
    </form>
  );
}
