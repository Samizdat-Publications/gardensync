// The harvest log: log a pick, see each crop picked so far against what its plantings should give,
// and the recent picks with edit and delete. Layout from A-harvest.dc.html.
import { useSignal } from '@preact/signals';
import { toDay } from '../../domain/dates';
import type { Harvest } from '../../domain/doc/schema';
import type { Plant } from '../../domain/plants/schema';
import { plantingPhases, seasonLabel, seasonOf } from '../../domain/schedule';
import { formatWeight, parseWeight } from '../../domain/units';
import { expectedYield, pickedSoFar, type Amount } from '../../domain/yield';
import { garden, newId, store, today, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay, inSentence } from '../format';
import { hrefOf } from '../router';
import { plantOf } from '../uiState';
import './Harvest.css';

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

  // Crops in this season's plantings, with what they should give.
  const crops = new Map<string, { name: string; color: string; form: Parameters<typeof Glyph>[0]['form']; noun: string | null; expected: Amount }>();
  for (const p of g.plantings) {
    const plant = plantOf(p.plantId);
    if (!plant) continue;
    const phases = plantingPhases(p, plant, c);
    if (phases && phases.season !== season) continue;
    const e = expectedYield(p, plant);
    const prev = crops.get(plant.id);
    crops.set(plant.id, {
      name: plant.name,
      color: plant.glyph.color,
      form: plant.glyph.form,
      noun: countNoun(plant.category),
      expected: { grams: (prev?.expected.grams ?? 0) + e.grams, count: (prev?.expected.count ?? 0) + e.count },
    });
  }
  const seasonHarvests = g.harvests.filter((h) => inSeason(h.date));
  const total = pickedSoFar(seasonHarvests, () => true);
  const expectedTotal = [...crops.values()].reduce((a, x) => a + x.expected.grams, 0);
  const recent = [...g.harvests].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <main class="harvest">
      <header class="harvest-head">
        <h1 tabIndex={-1}>{c ? seasonLabel(c, season) : season} harvest</h1>
        <p class="harvest-sub">
          {seasonHarvests.length === 0
            ? 'Nothing picked yet this season. Log your first pick with the form here, or from a planting in the garden.'
            : `Picked so far: ${amountText(total, u)}.${expectedTotal > 0 ? ` The plan expects about ${formatWeight(expectedTotal, u)} by the end of the season.` : ''}`}
        </p>
      </header>
      <div class="harvest-main">
        {crops.size > 0 ? (
          <section class="panel harvest-crops" aria-labelledby="hv-crops">
            {seasonHarvests.length === 0 ? (
              <>
                <h2 id="hv-crops">What the plan should give this season</h2>
                <ul class="crop-plan-list">
                  {[...crops.entries()].map(([id, crop]) => (
                    <li key={id} class="crop-plan-row">
                      <span class="crop-name">
                        <Glyph form={crop.form} color={crop.color} size={22} />
                        {crop.name}
                      </span>
                      <span class="muted crop-plan-amt">{expectedAmountText(crop.expected, u, crop.noun)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2 id="hv-crops">Picked so far, against what each crop should give</h2>
                <ul class="crop-list">
                  {[...crops.entries()].map(([id, crop]) => {
                    const got = pickedSoFar(seasonHarvests, (h) => h.plantId === id);
                    const byWeight = crop.expected.grams > 0;
                    const exp = byWeight ? crop.expected.grams : crop.expected.count;
                    const have = byWeight ? got.grams : got.count;
                    const pct = exp > 0 ? Math.min(100, Math.round((have / exp) * 100)) : 0;
                    const text = byWeight
                      ? `${formatWeight(have, u)} of ${formatWeight(exp, u)}`
                      : `${Math.round(have)} of ${Math.round(exp)} ${crop.noun ?? 'picked'}`;
                    return (
                      <li key={id} class="crop-row">
                        <span class="crop-name">
                          <Glyph form={crop.form} color={crop.color} size={26} />
                          {crop.name}
                        </span>
                        <span class="crop-bar" role="img" aria-label={`${crop.name}: ${text}`}>
                          <span style={{ width: `${pct}%`, background: crop.color }} />
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
  const options = g.plantings
    .map((p) => ({ p, plant: plantOf(p.plantId), container: g.containers.find((c) => c.id === p.containerId) }))
    .filter((o) => o.plant)
    .sort((a, b) => a.plant!.name.localeCompare(b.plant!.name));
  // Starts empty: the gardener says what they picked rather than logging against the first name.
  const plantingId = useSignal('');
  const amount = useSignal('');
  const count = useSignal('');
  const date = useSignal(today.value);
  const note = useSignal('');
  const message = useSignal<{ ok: boolean; text: string } | null>(null);

  if (options.length === 0) {
    return (
      <section class="panel log-form">
        <h2>Log a harvest</h2>
        <p class="muted">
          Plant something in the <a href={hrefOf({ name: 'garden' })}>garden</a> first, then log what you pick here.
        </p>
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
    } else {
      message.value = { ok: false, text: res.error };
    }
  }

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
              {o.plant!.name}, {o.container?.name ?? ''}
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
        Log harvest
      </button>
      <p role="status" class={message.value?.ok === false ? 'log-error' : 'log-ok'}>
        {message.value?.text ?? ''}
      </p>
    </form>
  );
}
