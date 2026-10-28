// Hash routes, so the app works from any static host and a share link (#g1.…) can sit beside them.
import { signal } from '@preact/signals';

export type Route =
  | { name: 'garden' }
  | { name: 'week' }
  | { name: 'calendar' }
  | { name: 'plants'; plantId?: string }
  | { name: 'harvest' }
  | { name: 'settings'; section?: string }
  /** A shared garden in the hash, e.g. #share=g1.xyz, or an old 7.x #plan=… link (legacy). */
  | { name: 'share'; payload: string; legacy?: boolean };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('share=')) return { name: 'share', payload: h.slice('share='.length) };
  if (h.startsWith('plan=')) return { name: 'share', payload: h, legacy: true };
  const [head, rest] = h.split('/', 2);
  switch (head) {
    case 'week':
      return { name: 'week' };
    case 'calendar':
      return { name: 'calendar' };
    case 'plants':
      return rest ? { name: 'plants', plantId: decodeURIComponent(rest) } : { name: 'plants' };
    case 'harvest':
      return { name: 'harvest' };
    case 'settings':
      return rest ? { name: 'settings', section: rest } : { name: 'settings' };
    default:
      return { name: 'garden' };
  }
}

export function hrefOf(route: Route): string {
  switch (route.name) {
    case 'garden':
      return '#/';
    case 'plants':
      return route.plantId ? `#/plants/${encodeURIComponent(route.plantId)}` : '#/plants';
    case 'settings':
      return route.section ? `#/settings/${route.section}` : '#/settings';
    case 'share':
      return route.legacy ? `#${route.payload}` : `#share=${route.payload}`;
    default:
      return `#/${route.name}`;
  }
}

export const route = signal<Route>(typeof location === 'undefined' ? { name: 'garden' } : parseRoute(location.hash));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parseRoute(location.hash);
    // Move focus to the new screen's heading for keyboard and screen-reader users.
    // A screen that already put focus somewhere deliberate (a plant card's heading) keeps it.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches('main [tabindex="-1"]')) return;
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
    });
  });
}

export function navigate(r: Route): void {
  location.hash = hrefOf(r);
}
