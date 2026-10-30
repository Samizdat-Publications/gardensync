// The plant card: what the plant is, when it goes in here and why, its neighbors, how to grow it,
// where that advice comes from, and "Add to the garden" (the one name for placing from the library,
// ledger item 13).
import { Fragment, type Ref } from 'preact';
import { useMemo } from 'preact/hooks';
import { PLANTS } from '../../domain/plants/library';
import type { ResolvedPlant } from '../../domain/plants/resolve';
import type { Plant } from '../../domain/plants/schema';
import { seasonLabel, type Reason } from '../../domain/schedule';
import { renderNoteTokens } from '../../domain/units';
import { garden, today, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { hrefOf, navigate } from '../router';
import { placingPlantId, plantOf } from '../uiState';
import { EVIDENCE_TEXT, factChips, familyLine, nameInSentence, neighborsOf } from './facts';
import { cardSchedule, hasSchedule, offsetRows, suggestionsFor, whenSection, type WhenRow, type SuggestionKind } from './timing';

interface Props {
  resolved: ResolvedPlant;
  headingRef: Ref<HTMLHeadingElement>;
}

function FrostIcon() {
  return (
    <svg class="pc-icon pc-icon-frost" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 1.5v15M2.5 5.25l13 7.5M2.5 12.75l13-7.5M7 3l2 1.6L11 3M7 15l2-1.6 2 1.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function CautionIcon() {
  return (
    <svg class="pc-icon pc-icon-caution" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 2 17 16H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M9 7v4M9 13.2v.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  );
}

/** The good and bad neighbor marks from artboard A-system: a plus on a line, a cross on a dash. */
function NeighborMark({ kind }: { kind: 'good' | 'bad' }) {
  return kind === 'good' ? (
    <svg class="pc-mark pc-mark-good" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="9" fill="currentColor" />
      <path d="M7 11h8M11 7v8" stroke="var(--c-panel)" stroke-width="2" stroke-linecap="round" />
    </svg>
  ) : (
    <svg class="pc-mark pc-mark-bad" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="9" fill="currentColor" />
      <path d="M7.8 7.8l6.4 6.4M14.2 7.8l-6.4 6.4" stroke="var(--c-panel)" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

function Rows({ rows }: { rows: WhenRow[] }) {
  return (
    <ol class="pc-rows">
      {rows.map((r) => (
        <li key={`${r.kind}-${r.dates}-${r.action}`} class="pc-row" data-row={r.kind}>
          <span class="pc-dates">{r.dates}</span>
          <span class="pc-action">{r.action}</span>
          {r.why ? <span class="pc-why">{r.why}</span> : null}
        </li>
      ))}
    </ol>
  );
}

const SUGGEST_TAIL: Record<SuggestionKind, [string, string]> = {
  heat: ['likes the heat and does have dates here.', 'like the heat and do have dates here.'],
  cool: ['takes cooler weather and does have dates here.', 'take cooler weather and do have dates here.'],
  quick: ['is quicker and does have dates here.', 'are quicker and do have dates here.'],
};

function Suggestion({ plant, reason, season }: { plant: Plant; reason: Reason; season: number }) {
  const profile = garden.value?.climate;
  if (!profile) return null;
  const s = suggestionsFor(plant, reason, PLANTS, profile, season);
  if (!s) return null;
  const tail = SUGGEST_TAIL[s.kind][s.plants.length === 1 ? 0 : 1];
  return (
    <p>
      {s.plants.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 ? (i === s.plants.length - 1 ? ' and ' : ', ') : null}
          <a href={hrefOf({ name: 'plants', plantId: p.id })}>{i === 0 ? p.name : nameInSentence(p.name)}</a>
        </Fragment>
      ))}{' '}
      {tail}
    </p>
  );
}

const NOT_VIABLE_TITLE: Partial<Record<Reason['code'], string>> = {
  'too-hot': 'Too warm here',
  'too-cool': 'Too cool here',
  'no-chill': 'Winters are too mild here',
  'too-short': 'The season is too short here',
  'soil-never-warm': 'The soil stays too cool here',
};

/** "Too warm here: the average..." under the heading "Too warm here" reads "The average...". */
function withoutTitle(text: string): string {
  const rest = text.replace(/^(Too (warm|cool) here|Winters here are too mild): /, '');
  return rest === text ? text : rest.charAt(0).toUpperCase() + rest.slice(1);
}

function When({ plant }: { plant: Plant }) {
  const g = garden.value;
  const profile = g?.climate ?? null;
  const day = today.value;
  const u = units.value;
  // "Springfield, Ohio" reads as "When, in Springfield".
  const place = profile?.place?.name.split(',')[0]?.trim();
  const heading = place ? `When, in ${place}` : profile ? 'When, with your frost dates' : 'When, by your frost dates';

  const data = useMemo(() => {
    if (!hasSchedule(profile)) return null;
    const sched = cardSchedule(plant, profile, day);
    return { sched, section: whenSection(plant, sched, u), label: seasonLabel(profile, sched.season) };
  }, [plant, profile, day, u]);

  if (!data) {
    return (
      <section class="pc-section" aria-labelledby="pc-when">
        <h3 id="pc-when">{heading}</h3>
        <p class="muted small">Weeks from your last spring frost, as the growing guides give them.</p>
        <Rows rows={offsetRows(plant)} />
        <p class="small">
          <a href={hrefOf({ name: 'settings', section: 'climate' })}>Add your town or frost dates</a> to get real dates for your garden.
        </p>
      </section>
    );
  }

  const { sched, section, label } = data;
  const none = section.blocks.length === 0;
  const first = section.notViable[0];
  return (
    <section class="pc-section" aria-labelledby="pc-when">
      <h3 id="pc-when">{heading}</h3>
      <p class="muted small">For the {label} season.</p>
      {section.notes.map((n) => (
        <p key={n} class="pc-note small">
          {n}
        </p>
      ))}
      {none && first ? (
        <div class="pc-notviable">
          <h4>{NOT_VIABLE_TITLE[first.reason.code] ?? 'No dates here'}</h4>
          {section.notViable.map((n) => (
            <p key={n.text}>{withoutTitle(n.text)}</p>
          ))}
          <Suggestion plant={plant} reason={first.reason} season={sched.season} />
        </div>
      ) : null}
      {section.blocks.map((b, i) => (
        <div key={b.title ?? i} class="pc-block">
          {b.title ? <h4>{b.title}</h4> : null}
          <Rows rows={b.rows} />
          {b.warnings.length > 0 ? (
            <ul class="pc-warnings">
              {b.warnings.map((w) => (
                <li key={w.text} class={w.frost ? 'pc-warn pc-warn-frost' : 'pc-warn'}>
                  {w.frost ? <FrostIcon /> : <CautionIcon />}
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
      {!none && section.notViable.length > 0 ? (
        <div class="pc-block">
          <h4>Not possible here</h4>
          <ul class="pc-plain">
            {section.notViable.map((n) => (
              <li key={n.text}>
                <strong>{n.label}:</strong> {n.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Neighbors({ plant, parentId }: { plant: Plant; parentId?: string }) {
  const list = neighborsOf(parentId ?? plant.id);
  return (
    <section class="pc-section" aria-labelledby="pc-nb">
      <h3 id="pc-nb">Good and bad neighbors</h3>
      {list.length === 0 ? (
        <p class="muted small">No neighbors on record for this plant.</p>
      ) : (
        <ul class="pc-neighbors">
          {list.map((n) => {
            const other = plantOf(n.otherId);
            const name = other?.name ?? n.otherId;
            return (
              <li key={`${n.kind}-${n.otherId}`} class="pc-neighbor">
                <NeighborMark kind={n.kind} />
                <p>
                  <strong>
                    {other ? <a href={hrefOf({ name: 'plants', plantId: n.otherId })}>{name}</a> : name}
                    {n.kind === 'bad' ? ', keep apart' : ''}:
                  </strong>{' '}
                  {n.reason} <span class="muted">{EVIDENCE_TEXT[n.evidence]}</span>
                  {n.source ? (
                    <>
                      {' '}
                      <a href={n.source.url} target="_blank" rel="noopener" class="pc-source-link">
                        Source<span class="visually-hidden">: {n.source.title} (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function PlantCard({ resolved, headingRef }: Props) {
  const { plant, inheritedFrom, parentId } = resolved;
  const u = units.value;
  const family = familyLine(plant, parentId);
  const parentName = parentId ? plantOf(parentId)?.name : undefined;
  const add = () => {
    placingPlantId.value = plant.id;
    navigate({ name: 'garden' });
  };
  const notes = [plant.notes.sowing, plant.notes.care, plant.notes.harvest];

  return (
    <article class="plant-card" aria-labelledby="pc-name">
      <a class="plant-back" href={hrefOf({ name: 'plants' })}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M11 3 5 9l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        All plants
      </a>
      <div class="pc-top">
        <div class="pc-tile" style={{ background: `color-mix(in srgb, ${plant.glyph.color} 16%, var(--c-panel))` }}>
          <Glyph form={plant.glyph.form} color={plant.glyph.color} size={60} />
        </div>
        <div class="pc-names">
          <h2 id="pc-name" ref={headingRef} tabIndex={-1}>
            {plant.name}
          </h2>
          {plant.latin ? <span class="pc-latin">{plant.latin}</span> : null}
          {family ? <span class="muted small">{family}</span> : null}
          {inheritedFrom === 'parent' ? (
            <span class="muted small">Your own plant, based on {parentName ?? 'another plant'}</span>
          ) : inheritedFrom === 'defaults' ? (
            <span class="muted small">Your own plant, based on defaults for this kind of plant</span>
          ) : null}
        </div>
      </div>

      <ul class="pc-facts" aria-label="At a glance">
        {factChips(plant, u).map((c) => (
          <li key={c.text} class={c.tone === 'frost' ? 'pc-fact pc-fact-frost' : 'pc-fact'}>
            {c.tone === 'frost' ? <FrostIcon /> : null}
            {c.text}
          </li>
        ))}
      </ul>

      {/* The one action sits up top, under the name, so a long card never hides it. */}
      <button type="button" class="btn btn-primary pc-add" onClick={add}>
        Add to the garden
      </button>

      <When plant={plant} />
      <Neighbors plant={plant} {...(parentId && resolved.inheritedFrom === 'parent' ? { parentId } : {})} />

      <section class="pc-section" aria-labelledby="pc-how">
        <h3 id="pc-how">Growing it</h3>
        {notes.map((n, i) => (
          <p key={i} class="small">
            {renderNoteTokens(n, u)}
          </p>
        ))}
      </section>

      {plant.sources.length > 0 ? (
        <p class="pc-sources small muted">
          {plant.sources.length === 1 ? 'Source: ' : 'Sources: '}
          {plant.sources.map((s, i) => (
            <Fragment key={s.url}>
              {i > 0 ? (i === plant.sources.length - 1 ? ' and ' : ', ') : null}
              <a href={s.url} target="_blank" rel="noopener">
                {s.title}
                <span class="visually-hidden"> (opens in a new tab)</span>
              </a>
            </Fragment>
          ))}
        </p>
      ) : (
        <p class="pc-sources small muted">No sources: these values are general starting points, not researched advice for this plant.</p>
      )}
    </article>
  );
}
