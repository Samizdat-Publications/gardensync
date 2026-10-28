import { describe, expect, it } from 'vitest';
import { emptyDoc, type GardenDoc } from '../../src/domain/doc/schema';
import {
  DOC_KEY,
  listBackups,
  loadDoc,
  readBackup,
  saveDoc,
  storedRev,
  takeSnapshot,
  type KeyValueStore,
} from '../../src/platform/storage';

class FakeStore implements KeyValueStore {
  map = new Map<string, string>();
  quotaBytes = Infinity;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    const used = [...this.map.entries()].reduce((a, [kk, vv]) => (kk === k ? a : a + vv.length), 0);
    if (used + v.length > this.quotaBytes) {
      const e = new Error('The quota has been exceeded.');
      e.name = 'QuotaExceededError';
      throw e;
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const docWith = (name: string): GardenDoc => ({
  ...emptyDoc(),
  gardens: [
    {
      id: 'g1', name, createdAt: '2027-03-01', cellCm: 30.48, climate: null, containers: [], plantings: [],
      series: [], harvests: [], journal: [], customPlants: [], taskState: {},
    },
  ],
  settings: { units: 'imperial', theme: 'system', activeGardenId: 'g1' },
});

describe('storage', () => {
  it('starts empty, then round-trips a saved document', () => {
    const kv = new FakeStore();
    expect(loadDoc(kv, '2027-03-01T10:00:00Z')).toEqual({ status: 'empty' });
    const res = saveDoc(kv, docWith('Back garden'), { expectedRev: -1, today: '2027-03-01', now: '2027-03-01T10:00:00Z' });
    expect(res).toEqual({ ok: true, rev: 0 });
    const loaded = loadDoc(kv, '2027-03-01T10:01:00Z');
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.doc.gardens[0]?.name).toBe('Back garden');
      expect(loaded.rev).toBe(0);
    }
  });

  it('refuses to overwrite a save made by another tab', () => {
    const kv = new FakeStore();
    saveDoc(kv, docWith('A'), { expectedRev: -1, today: '2027-03-01', now: 't1' });
    // Tab 2 saves on top of rev 0.
    expect(saveDoc(kv, docWith('B'), { expectedRev: 0, today: '2027-03-01', now: 't2' })).toEqual({ ok: true, rev: 1 });
    // Tab 1 still thinks rev 0 is current.
    expect(saveDoc(kv, docWith('C'), { expectedRev: 0, today: '2027-03-01', now: 't3' })).toEqual({ ok: false, reason: 'conflict', theirRev: 1 });
    const loaded = loadDoc(kv, 't4');
    expect(loaded.status === 'ok' && loaded.doc.gardens[0]?.name).toBe('B');
  });

  it('quarantines a corrupt save instead of trusting or deleting it', () => {
    const kv = new FakeStore();
    kv.setItem(DOC_KEY, '{"schemaVersion":1,"rev":3,"savedAt":"x","doc":{"gardens":"oops"}}');
    const res = loadDoc(kv, '2027-03-02T08:00:00Z');
    expect(res.status).toBe('corrupt');
    if (res.status === 'corrupt') {
      expect(kv.getItem(res.quarantineKey!)).toContain('oops');
      expect(res.problem).toMatch(/problem/);
    }
    expect(kv.getItem(DOC_KEY)).toContain('oops');
    kv.setItem(DOC_KEY, 'not json');
    expect(loadDoc(kv, 'later').status).toBe('corrupt');
  });

  it('keeps one backup per day, the newest seven', () => {
    const kv = new FakeStore();
    let rev = -1;
    for (let day = 1; day <= 10; day++) {
      const today = `2027-03-${String(day).padStart(2, '0')}`;
      const res = saveDoc(kv, docWith(`Day ${day}`), { expectedRev: rev, today, now: `${today}T12:00:00Z` });
      if (res.ok) rev = res.rev;
    }
    const backups = listBackups(kv).filter((b) => b.kind === 'daily');
    expect(backups.map((b) => b.label)).toEqual(['2027-03-10', '2027-03-09', '2027-03-08', '2027-03-07', '2027-03-06', '2027-03-05', '2027-03-04']);
    expect(readBackup(kv, backups[6]!.key)?.gardens[0]?.name).toBe('Day 4');
  });

  it('takes snapshots before risky changes and lists them', () => {
    const kv = new FakeStore();
    expect(takeSnapshot(kv, docWith('Before import'), 'before import 7.x', '2027-03-01T09:00:00Z')).toBe(
      'gardensync.v8.snapshot.before-import-7-x@2027-03-01T09:00:00Z',
    );
    const snaps = listBackups(kv).filter((b) => b.kind === 'snapshot');
    expect(snaps).toHaveLength(1);
    expect(snaps[0]?.label).toBe('before-import-7-x');
    expect(readBackup(kv, 'gardensync_state')).toBeNull();
  });

  it('reports a full browser plainly after trying to make room', () => {
    const kv = new FakeStore();
    kv.quotaBytes = 50;
    const res = saveDoc(kv, docWith('Big garden'), { expectedRev: -1, today: '2027-03-01', now: 't' });
    expect(res).toMatchObject({ ok: false, reason: 'quota' });
  });

  it('never overwrites a save it cannot read, nor the daily backup', () => {
    for (const stored of ['not json', '{"schemaVersion":2,"rev":0,"savedAt":"t","doc":{}}', '{"schemaVersion":1,"rev":"x"}', 'null']) {
      const kv = new FakeStore();
      kv.setItem(DOC_KEY, stored);
      kv.setItem('gardensync.v8.backup.2027-03-01', 'yesterday');
      const res = saveDoc(kv, docWith('Mine'), { expectedRev: -1, today: '2027-03-01', now: 't' });
      expect(res).toMatchObject({ ok: false, reason: 'unknown-format' });
      expect(kv.getItem(DOC_KEY)).toBe(stored);
      expect(kv.getItem('gardensync.v8.backup.2027-03-01')).toBe('yesterday');
    }
  });

  it('reads the stored revision without validating the whole document', () => {
    const kv = new FakeStore();
    // A document DocSchema would reject, in a well-formed envelope: the light read still sees rev 4.
    kv.setItem(DOC_KEY, '{"schemaVersion":1,"rev":4,"savedAt":"t","doc":{"gardens":"oops"}}');
    expect(storedRev(kv)).toEqual({ kind: 'rev', rev: 4 });
    expect(saveDoc(kv, docWith('A'), { expectedRev: 3, today: '2027-03-01', now: 't' })).toEqual({ ok: false, reason: 'conflict', theirRev: 4 });
    expect(saveDoc(kv, docWith('A'), { expectedRev: 4, today: '2027-03-01', now: 't' })).toEqual({ ok: true, rev: 5 });
    expect(storedRev(new FakeStore())).toEqual({ kind: 'none' });
  });

  it('keeps one quarantine copy per distinct damaged save, the newest three', () => {
    const kv = new FakeStore();
    kv.setItem(DOC_KEY, 'broken 1');
    const first = loadDoc(kv, '2027-03-01T08:00:00Z');
    const again = loadDoc(kv, '2027-03-01T09:00:00Z');
    expect(first.status === 'corrupt' && again.status === 'corrupt' && again.quarantineKey === first.quarantineKey).toBe(true);
    const quarantined = () => [...kv.map.keys()].filter((k) => k.startsWith('gardensync.v8.quarantine.')).sort();
    expect(quarantined()).toHaveLength(1);
    for (let i = 2; i <= 5; i++) {
      kv.setItem(DOC_KEY, `broken ${i}`);
      loadDoc(kv, `2027-03-0${i}T08:00:00Z`);
    }
    expect(quarantined().map((k) => kv.getItem(k))).toEqual(['broken 3', 'broken 4', 'broken 5']);
  });

  it('says so when the quarantine copy could not be written', () => {
    const kv = new FakeStore();
    kv.setItem(DOC_KEY, 'broken and large'.repeat(10));
    kv.quotaBytes = 170;
    const res = loadDoc(kv, '2027-03-01T08:00:00Z');
    expect(res.status).toBe('corrupt');
    if (res.status === 'corrupt') {
      expect(res.quarantineKey).toBeNull();
      expect(res.note).toMatch(/could not be written/);
    }
    expect(kv.getItem(DOC_KEY)).toContain('broken');
  });

  it('keeps every snapshot, even two with the same label', () => {
    const kv = new FakeStore();
    takeSnapshot(kv, docWith('First'), 'before import', '2027-03-01T09:00:00Z');
    takeSnapshot(kv, docWith('Second'), 'before import', '2027-03-01T10:00:00Z');
    const snaps = listBackups(kv).filter((b) => b.kind === 'snapshot');
    expect(snaps.map((b) => b.label)).toEqual(['before-import', 'before-import']);
    expect(snaps.map((b) => readBackup(kv, b.key)?.gardens[0]?.name)).toEqual(['Second', 'First']);
  });

  it('loads a save whose records do not fit together as needs-repair, with a repaired copy', () => {
    const kv = new FakeStore();
    const doc = docWith('Home');
    const broken: GardenDoc = {
      ...doc,
      gardens: [
        {
          ...doc.gardens[0]!,
          containers: [{ id: 'bed1', form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 2, rows: 2, rotation: 0 }],
          plantings: [
            { id: 'p1', containerId: 'bed1', plantId: 'kale', cells: { col: 0, row: 0, w: 1, h: 1 }, count: 1, method: 'transplant', anchor: { kind: 'auto', window: 'spring', season: 2027, offsetDays: 0 } },
            { id: 'p2', containerId: 'gone', plantId: 'kale', count: 1, method: 'transplant', anchor: { kind: 'auto', window: 'spring', season: 2027, offsetDays: 0 } },
          ],
          harvests: [{ id: 'h1', plantId: 'kale', plantingId: 'p2', date: '2027-06-01', grams: 100 }],
        },
      ],
      settings: { ...doc.settings, activeGardenId: 'nowhere' },
    };
    kv.setItem(DOC_KEY, JSON.stringify({ schemaVersion: 1, rev: 2, savedAt: 't', doc: broken }));
    const res = loadDoc(kv, '2027-03-02T08:00:00Z');
    expect(res.status).toBe('needs-repair');
    if (res.status !== 'needs-repair') return;
    expect(res.problems.map((p) => p.code).sort()).toEqual(['missing-active-garden', 'missing-container']);
    expect(res.remaining).toEqual([]);
    expect(res.doc).toEqual(broken);
    const g = res.repaired.gardens[0]!;
    expect(g.plantings.map((p) => p.id)).toEqual(['p1']);
    expect(g.harvests[0]).toEqual({ id: 'h1', plantId: 'kale', date: '2027-06-01', grams: 100 });
    expect(res.repaired.settings.activeGardenId).toBe('g1');
    expect(res.rev).toBe(2);
    expect(kv.getItem(res.quarantineKey!)).toContain('nowhere');
  });

  it('replaces an unreadable save only when the recovery screen asks to', () => {
    const kv = new FakeStore();
    kv.setItem(DOC_KEY, '{"schemaVersion":99,"rev":4}');
    expect(saveDoc(kv, docWith('A'), { expectedRev: -1, today: '2027-03-01', now: 't' })).toMatchObject({ ok: false, reason: 'unknown-format' });
    expect(saveDoc(kv, docWith('A'), { expectedRev: -1, today: '2027-03-01', now: 't', replaceUnreadable: true })).toEqual({ ok: true, rev: 0 });
    expect(loadDoc(kv, 't2').status).toBe('ok');
  });
});
