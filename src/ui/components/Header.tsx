// The one header every screen shares (ledger item 9): logo, garden name, main navigation, the place
// with its frost-safe date, and the save status. On phones the navigation moves to a bottom bar.
import { garden, saveStatus, store } from '../appState';
import { assistantOpen, openAssistant } from '../assistant/open';
import { fmtMonthDay } from '../format';
import { hrefOf, route, type Route } from '../router';
import './Header.css';

const NAV: { name: Route['name']; label: string; icon: string }[] = [
  { name: 'garden', label: 'Garden', icon: 'M3 3h16v16H3z M11 3v16 M3 11h16' },
  { name: 'week', label: 'This week', icon: 'M5 6l2 2 3-3 M5 12l2 2 3-3 M13 7h5 M13 13h5 M5 18h13' },
  { name: 'calendar', label: 'Calendar', icon: 'M3 5h16v14H3z M3 9h16 M7 3v3 M15 3v3' },
  { name: 'plants', label: 'Plants', icon: 'M11 19V9 M11 10Q6 9 5 4q5 .5 6 5 M11 8q4.5-2 6-5.5Q12.5 3 11 7.5' },
  { name: 'harvest', label: 'Harvest', icon: 'M4 9h14l-1.5 9h-11z M7 9q4-6 8 0' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" class="logo-mark">
      <rect x="1" y="1" width="28" height="28" rx="4" fill="var(--c-accent)" />
      <path d="M10 1v28M20 1v28M1 10h28M1 20h28" stroke="var(--c-accent-ink)" stroke-width="1" opacity="0.35" />
      <path
        d="M15 24V14M15 15q-5-1-6-6 5 .5 6 5M15 13q4.5-2 6-6-4.5.5-6 5"
        stroke="var(--c-accent-ink)"
        stroke-width="1.8"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function Header() {
  const g = garden.value;
  const current = route.value.name;
  const climate = g?.climate;
  const safe = climate?.lastFrost.p90 ?? climate?.lastFrost.p50 ?? null;
  const status = saveStatus.value;
  return (
    <>
      <header class="app-header">
        <a class="brand" href={hrefOf({ name: 'garden' })}>
          <Logo />
          <span class="brand-name">GardenSync</span>
        </a>
        {g && store.doc.value.gardens.length > 1 ? (
          <>
            <label for="garden-switch" class="visually-hidden">
              Garden
            </label>
            <select
              id="garden-switch"
              class="garden-switch"
              value={g.id}
              onChange={(e) => store.dispatch({ type: 'setActiveGarden', gardenId: (e.target as HTMLSelectElement).value }, { label: 'switch gardens' })}
            >
              {store.doc.value.gardens.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <nav aria-label="Main" class="main-nav">
          {NAV.map((n) => (
            <a key={n.name} href={hrefOf({ name: n.name } as Route)} aria-current={current === n.name ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <a class="place" href={hrefOf({ name: 'settings', section: 'climate' })}>
          {climate?.place ? (
            <>
              <span class="place-name">{climate.place.name}</span>
              <span class="place-sub">
                {climate.frostClass === 'none' ? 'Frost-free' : safe ? `Frost-safe from ${fmtMonthDay(safe)}` : 'Frost is rare'}
              </span>
            </>
          ) : (
            <span class="place-name">{climate ? 'Your frost dates' : 'Set your town'}</span>
          )}
        </a>
        <button
          class="btn assistant-link"
          aria-label="Ask the assistant"
          aria-expanded={assistantOpen.value}
          onClick={() => (assistantOpen.value ? (assistantOpen.value = false) : openAssistant())}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 4.5h14v9H8l-4 3v-3H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            <path d="M6.5 9h.01M10 9h.01M13.5 9h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span class="ask-label" aria-hidden="true">Ask</span>
        </button>
        <a
          class="btn btn-icon settings-link"
          href={hrefOf({ name: 'settings' })}
          aria-label="Settings"
          aria-current={current === 'settings' ? 'page' : undefined}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path
              d="M10 1.5v2.5M10 16v2.5M1.5 10H4M16 10h2.5M4 4l1.8 1.8M14.2 14.2 16 16M4 16l1.8-1.8M14.2 5.8 16 4"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </a>
        <span class="save-status" role="status" aria-live="polite">
          {status.kind === 'error' ? status.message : status.kind === 'saving' ? 'Saving' : ''}
        </span>
      </header>
      <nav aria-label="Main" class="bottom-nav">
        {NAV.map((n) => (
          <a key={n.name} href={hrefOf({ name: n.name } as Route)} aria-current={current === n.name ? 'page' : undefined}>
            <NavIcon d={n.icon} />
            {n.label}
          </a>
        ))}
      </nav>
    </>
  );
}
