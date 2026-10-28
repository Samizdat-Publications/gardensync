// "Planted 16 lettuce. Undo": a polite status region that is always in the page, so screen
// readers hear each message, with an Undo button for changes that can be undone.
import { store } from '../appState';
import { clearToast, toast } from './plannerState';

export function Toast() {
  const t = toast.value;
  return (
    <div class="toast-region" role="status" aria-live="polite">
      {t ? (
        <div class="toast panel" key={t.id}>
          <span>{t.text}</span>
          {t.undo && store.canUndo.value ? (
            <button
              type="button"
              class="btn btn-quiet"
              onClick={() => {
                store.undo();
                clearToast();
              }}
            >
              Undo
            </button>
          ) : null}
          <button type="button" class="btn btn-icon btn-quiet toast-close" aria-label="Dismiss" onClick={clearToast}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
