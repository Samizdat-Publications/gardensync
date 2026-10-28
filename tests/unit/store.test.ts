import { describe, expect, it, vi } from 'vitest';
import { emptyDoc } from '../../src/domain/doc/schema';
import { createStore } from '../../src/ui/store';

const addGarden = (id: string, name: string) =>
  ({ type: 'addGarden', garden: { id, name, createdAt: '2027-03-01', cellCm: 30.48 } }) as const;

describe('store', () => {
  it('changes the document only through ops, and undoes and redoes them', () => {
    const store = createStore(emptyDoc());
    expect(store.canUndo.value).toBe(false);
    expect(store.dispatch(addGarden('g1', 'Back garden'), { label: 'add Back garden' })).toEqual({ ok: true });
    expect(store.doc.value.gardens).toHaveLength(1);
    expect(store.undoLabel.value).toBe('add Back garden');
    expect(store.undo()).toBe(true);
    expect(store.doc.value.gardens).toHaveLength(0);
    expect(store.canRedo.value).toBe(true);
    expect(store.redo()).toBe(true);
    expect(store.doc.value.gardens[0]?.name).toBe('Back garden');
  });

  it('returns a plain error and changes nothing when an op is refused', () => {
    const store = createStore(emptyDoc());
    const before = store.doc.value;
    const res = store.dispatch({ type: 'renameGarden', gardenId: 'nope', name: 'X' });
    expect(res.ok).toBe(false);
    expect(store.doc.value).toBe(before);
    expect(store.canUndo.value).toBe(false);
  });

  it('turns a quick run of edits with one coalesce key into one undo step', () => {
    let t = 0;
    const store = createStore(emptyDoc(), () => t);
    store.dispatch(addGarden('g1', 'B'));
    for (const name of ['Ba', 'Bac', 'Back']) {
      t += 200;
      store.dispatch({ type: 'renameGarden', gardenId: 'g1', name }, { coalesceKey: 'rename:g1' });
    }
    expect(store.doc.value.gardens[0]?.name).toBe('Back');
    store.undo();
    expect(store.doc.value.gardens[0]?.name).toBe('B');
    t += 5000;
    store.redo();
    store.dispatch({ type: 'renameGarden', gardenId: 'g1', name: 'Front' }, { coalesceKey: 'rename:g1' });
    store.undo();
    expect(store.doc.value.gardens[0]?.name).toBe('Back');
  });

  it('a new edit clears redo, and replace clears history', () => {
    const store = createStore(emptyDoc());
    store.dispatch(addGarden('g1', 'A'));
    store.undo();
    store.dispatch(addGarden('g2', 'B'));
    expect(store.canRedo.value).toBe(false);
    store.replace(emptyDoc());
    expect(store.canUndo.value).toBe(false);
    expect(store.doc.value.gardens).toHaveLength(0);
  });

  it('notifies subscribers after every change', () => {
    const store = createStore(emptyDoc());
    const seen: number[] = [];
    const off = store.subscribe((d) => seen.push(d.gardens.length));
    store.dispatch(addGarden('g1', 'A'));
    store.undo();
    off();
    store.redo();
    expect(seen).toEqual([1, 0]);
  });
});

describe('store listeners', () => {
  it('a listener that throws cannot break a committed dispatch or the other listeners', () => {
    const store = createStore(emptyDoc());
    const seen: number[] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.subscribe(() => {
      throw new Error('autosave failed');
    });
    store.subscribe((d) => seen.push(d.gardens.length));
    expect(store.dispatch(addGarden('g1', 'Back garden'))).toEqual({ ok: true });
    expect(store.doc.value.gardens).toHaveLength(1);
    expect(store.canUndo.value).toBe(true);
    expect(seen).toEqual([1]);
    expect(store.undo()).toBe(true);
    expect(seen).toEqual([1, 0]);
    expect(errors).toHaveBeenCalledTimes(2);
    expect(String(errors.mock.calls[0]?.[0])).toMatch(/listener failed/);
    errors.mockRestore();
  });
});
