import { type Page } from '@playwright/test';
import {
  test, expect, gotoApp, chord, startCustom, readDb, dayRow, seedDb, store, today, answer, kpis, confusions, openProgress,
  FIXED_NOW, TODAY, M,
} from './app';
import { LETTERS as L } from './braille';

const events = async (page: Page) => (await readDb(page))?.events ?? [];
const pollEvents = (page: Page, n: number, timeout = 5_000) =>
  expect.poll(async () => (await events(page)).length, { timeout }).toBe(n);
/** A chord's keys: [dot (0 for the space bar), down, up] in ms from the first key down */
const expectKeys = (keys: number[][], dots: number[]) => {
  expect(keys.map((k) => k[0])).toEqual(dots);
  for (const [, down, up] of keys) expect(up).toBeGreaterThanOrEqual(down);
};
test('an exercise records each sign with what was expected and typed, and its day adds them up', async ({ page }) => {
  await gotoApp(page);
  const day = await today(page);
  await startCustom(page, 'hd');
  await chord(page, L.h);
  await chord(page, L.b); // d expected
  await page.click('#banner [data-act="retry"]');
  await chord(page, L.d);
  await expect(page.locator('#done')).toBeVisible();

  await pollEvents(page, 4);
  const [h, wrong, d, done] = await events(page);
  expect(h).toMatchObject({ v: 1, type: 'sign', mode: 'ex', ex: 'custom:0', ch: 'h', k: 'h', exp: M('125'), got: M('125'), ok: true, first: true, hint: false, dt: null, lift: false });
  expect(wrong).toMatchObject({ type: 'sign', ch: 'd', k: 'd', exp: M('145'), got: M('12'), ok: false, first: true, dt: expect.any(Number) });
  expect(d).toMatchObject({ type: 'sign', k: 'd', got: M('145'), ok: true, first: false });
  expect(done).toMatchObject({ type: 'done', mode: 'ex', ex: 'custom:0', signs: 2, errors: 1, hints: 0, accuracy: 67 });
  expectKeys(h.keys, [1, 2, 5]);
  expectKeys(wrong.keys, [1, 2]);
  expectKeys(d.keys, [1, 4, 5]);
  expect(new Set([h, wrong, d, done].map((e) => e.id)).size).toBe(4);
  let row = await dayRow(page, day);
  expect(row).toMatchObject({ signs: 3, errors: 1, hints: 0, done: 1 });
  expect(row.bySign.h.slice(0, 2)).toEqual([1, 0]);
  expect(row.bySign.d.slice(0, 2)).toEqual([1, 1]);

  // Again, with a hint on h: a hinted sign counts as missed
  await page.click('#done-again');
  await page.click('#btn-hint');
  await chord(page, L.h);
  await chord(page, L.d);
  await expect(page.locator('#done')).toBeVisible();
  await expect.poll(async () => (await dayRow(page, day))?.done).toBe(2);
  row = await dayRow(page, day);
  expect(row).toMatchObject({ signs: 5, errors: 1, hints: 1, done: 2 });
  expect(row.bySign.h.slice(0, 2)).toEqual([2, 1]);
  expect(row.bySign.d.slice(0, 2)).toEqual([2, 1]);
});

test('free typing records signs, erasures, new lines and unknown cells, and « Progrès » reads the corrections', async ({ page }) => {
  await gotoApp(page);
  const day = await today(page);
  await chord(page, L.d);
  await page.keyboard.press('Backspace');
  await chord(page, L.h);
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await chord(page, '5'); // no sign
  await pollEvents(page, 6);
  const free = await events(page);
  expect(free.map((e) => [e.mode, e.type, e.ch ?? null, e.at])).toEqual([
    ['free', 'sign', 'd', 0], ['free', 'erase', 'd', 0], ['free', 'sign', 'h', 0],
    ['free', 'sign', 'espace', 1], ['free', 'newline', null, 2], ['free', 'sign', '?', 3],
  ]);
  expect(free.map((e) => e.got)).toEqual([M('145'), M('145'), M('125'), 0, undefined, M('5')]);
  expect(free[0].dt).toBeNull();
  for (const e of free.slice(1)) expect(e.dt).toEqual(expect.any(Number));
  expectKeys(free[0].keys, [1, 4, 5]);
  expectKeys(free[2].keys, [1, 2, 5]);
  expectKeys(free[3].keys, [0]);
  expectKeys(free[5].keys, [5]);
  expect(await dayRow(page, day)).toMatchObject({ freeSigns: 4, freeErrors: 1, freeErased: 1 });

  // And an exercise where d was typed for c
  await startCustom(page, 'c');
  await chord(page, L.d);
  await page.click('#banner [data-act="retry"]');
  await chord(page, L.c);
  await pollEvents(page, 9);

  await openProgress(page);
  const cf = await confusions(page);
  expect(cf).toContainEqual(expect.stringMatching(/^h→d 1 fois, dont 1 en libre$/));
  expect(cf).toContainEqual(expect.stringMatching(/^c→d 1 fois$/));
  expect((await kpis(page, 'section'))['Signes inconnus']).toMatch(/^1 \| 25 %/);
});

test('reading answers are recorded and counted per sign, and an answer after a 30 s pause has no time', async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW });
  await gotoApp(page);
  await page.click('#tab-read');
  await page.click('#read-pick [data-fable="0"]'); // "Hé! bonjour, Monsieur du Corbeau…
  await answer(page, '"');
  await answer(page, 'h'); // a capital is expected
  await answer(page, 'H');
  await page.click('#read-show');
  await answer(page, 'é');
  await expect.poll(async () => (await dayRow(page, TODAY))?.readSigns).toBe(4);

  const row = await dayRow(page, TODAY);
  expect(row.readErrors).toBe(1);
  expect(Object.fromEntries(Object.entries(row.readBySign).map(([k, s]) => [k, (s as number[]).slice(0, 2)])))
    .toEqual({ '"': [1, 0], maj: [1, 1], é: [1, 1] });
  const read = await events(page);
  expect(read.map((e) => [e.type, e.ch, e.got, e.k, e.ok, e.first, e.hint])).toEqual([
    ['read', '"', '"', '"', true, true, false],
    ['read', 'H', 'h', 'maj', false, true, false],
    ['read', 'H', 'H', 'h', true, false, false],
    ['read', 'é', 'é', 'é', true, true, true],
  ]);
  expect(read[0].dt).toBeNull();
  for (const e of read.slice(1)) expect(e.dt).toEqual(expect.any(Number));

  await openProgress(page);
  const reading = await kpis(page, 'section');
  expect(reading['Signes lus']).toBe('3');
  expect(reading['Justes']).toBe('75 %');

  // Back to the passage after more than 30 s
  await page.click('#progress-back');
  await page.keyboard.press('Escape');
  await page.click('#tab-read');
  await page.clock.fastForward(31_000);
  await answer(page, '!');
  await pollEvents(page, 5);
  expect((await events(page))[4]).toMatchObject({ ch: '!', ok: true, dt: null });
});

test('a v1 journal (commit a02e13b) becomes v2 with every record kept and counted', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const YESTERDAY = '2026-10-20';
  const at = (day: string, i: number) => new Date(`${day}T10:0${i}:00+02:00`).getTime();
  const sign = (day: string, i: number, k: string, got: string, o = {}) => ({
    v: 1, t: at(day, i), type: 'sign', mode: 'ex', ex: 'aj:1', ch: k, k, exp: M(L[k]), got: M(got),
    ok: L[k] === got, first: true, hint: false, dt: i ? 900 : null, keys: [[1, 0, 80]], lift: false, ...o,
  });
  const v1Events = [
    sign(YESTERDAY, 0, 'b', L.b), sign(YESTERDAY, 1, 'a', L.a), sign(YESTERDAY, 2, 'c', L.c), sign(YESTERDAY, 3, 'a', L.a),
    { v: 1, t: at(YESTERDAY, 4), type: 'done', mode: 'ex', ex: 'aj:1', signs: 4, errors: 0, hints: 0, ms: 2700, accuracy: 100 },
    sign(TODAY, 0, 'h', L.d), sign(TODAY, 1, 'h', L.h, { first: false }), sign(TODAY, 2, 'a', L.a), sign(TODAY, 3, 'c', L.c),
  ];
  const v1Days = [
    { day: YESTERDAY, ms: 2700, signs: 4, errors: 0, hints: 0, done: 1, bySign: { b: [1, 0, 0, 0], a: [2, 0, 1800, 2], c: [1, 0, 900, 1] } },
    { day: TODAY, ms: 2700, signs: 4, errors: 1, hints: 0, done: 0, bySign: { h: [1, 1, 0, 0], a: [1, 0, 900, 1], c: [1, 0, 900, 1] } },
  ];
  await seedDb(page, { version: 1, events: v1Events, days: v1Days });
  await gotoApp(page);
  await openProgress(page);

  const db = (await readDb(page))!;
  expect(db.version).toBe(2);
  expect(db.indexes).toEqual(['id', 't']);
  expect(db.events).toEqual(v1Events);
  expect(db.days).toEqual(v1Days);
  const head = await kpis(page, '.pg > .kpis');
  expect(head['Signes tapés']).toBe('8');
  expect(head['Précision']).toMatch(/^88 %/);
  expect(head['Jours d’affilée']).toBe('2');
  expect(await confusions(page)).toContainEqual(expect.stringMatching(/^h→d 1 fois/));

  // A new sign lands in today's v1 row
  await page.click('#progress-back');
  await page.click('#picker-free');
  await chord(page, L.a);
  await expect.poll(async () => (await dayRow(page, TODAY))?.freeSigns).toBe(1);
  expect(await dayRow(page, TODAY)).toMatchObject({ signs: 4, errors: 1, bySign: v1Days[1].bySign });
  const after = (await readDb(page))!.events;
  expect(after).toHaveLength(10);
  expect(after[9]).toMatchObject({ type: 'sign', mode: 'free', ch: 'a', id: expect.any(String) });
});

test('a connection closed under the app reopens, and an aborted write is retried, each event stored once', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.__conns = [];
    w.__abortNext = 0;
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (this: IDBFactory, ...args: [string, number?]) {
      const req = open.apply(this, args);
      if (args[1] === 2) req.addEventListener('success', () => w.__conns.push(req.result));
      return req;
    };
    // Aborted once its requests are queued, as when iOS cuts a page off in the background
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: any[]) {
      const t = transaction.apply(this, args as any);
      if (w.__abortNext > 0 && args[1] === 'readwrite') { w.__abortNext--; Promise.resolve().then(() => t.abort()); }
      return t;
    } as any;
  });
  await gotoApp(page);
  const day = await today(page);
  const conns = () => page.evaluate(() => (window as any).__conns.length);
  await chord(page, L.a);
  await pollEvents(page, 1);
  expect(await conns()).toBe(1);

  await page.evaluate(() => (window as any).__conns.forEach((db: IDBDatabase) => db.close()));
  await chord(page, L.b);
  await pollEvents(page, 2);
  expect(await conns()).toBe(2);

  await page.evaluate(() => { (window as any).__abortNext = 1; });
  await chord(page, L.c);
  await pollEvents(page, 3);
  expect(await page.evaluate(() => (window as any).__abortNext)).toBe(0);
  expect(await conns()).toBe(3); // retried at once, on a new connection
  const all = await events(page);
  expect(all.map((e) => e.ch)).toEqual(['a', 'b', 'c']);
  expect(new Set(all.map((e) => e.id)).size).toBe(3);
  expect(await dayRow(page, day)).toMatchObject({ freeSigns: 3 });
  expect(await store(page, 'journal-outbox')).toBeNull();
});

test('with IndexedDB refused, events wait in the outbox, « Progrès » says so, and they move in once it is back', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.__idbDown = true;
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (this: IDBFactory, ...args: [string, number?]) {
      if (w.__idbDown) throw new DOMException('refusé pour le test', 'UnknownError');
      return open.apply(this, args);
    };
  });
  await gotoApp(page);
  const day = await today(page);
  for (const c of [L.a, L.b, L.c]) await chord(page, c);
  const box = await store(page, 'journal-outbox');
  expect(box.map((e: any) => e.ch)).toEqual(['a', 'b', 'c']);

  await openProgress(page);
  await expect(page.locator('.pg-note')).toContainText('3');

  await page.evaluate(() => { (window as any).__idbDown = false; });
  await expect.poll(() => store(page, 'journal-outbox'), { timeout: 15_000 }).toBeNull();
  expect((await events(page)).map((e) => e.ch)).toEqual(['a', 'b', 'c']);
  expect(await dayRow(page, day)).toMatchObject({ freeSigns: 3 });
  await page.click('#progress-back');
  await page.click('#picker-progress');
  await expect(page.locator('.pg-note')).toHaveCount(0);
  expect((await kpis(page, 'section'))['Signes écrits']).toBe('3');
});

test('replaying an event already stored changes neither the events nor the day', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const ev = { v: 1, id: 'test.1', t: FIXED_NOW.getTime(), type: 'sign', mode: 'free', got: M('1'), ch: 'a', at: 0, dt: 500, keys: [[1, 0, 90]], lift: false };
  const row = {
    day: TODAY, ms: 500, signs: 0, errors: 0, hints: 0, done: 0, bySign: {}, readSigns: 0, readErrors: 0, readMs: 0, readBySign: {},
    freeSigns: 1, freeErrors: 0, freeErased: 0, freeMs: 500, freeTime: 500, freeTimed: 1,
  };
  await seedDb(page, { events: [ev], days: [row] });
  // Stored, but its answer was lost: still in the outbox at the next launch
  await gotoApp(page, { 'journal-outbox': [ev] });
  await expect.poll(() => store(page, 'journal-outbox'), { timeout: 10_000 }).toBeNull();
  const db = (await readDb(page))!;
  expect(db.events).toEqual([ev]);
  expect(db.days).toEqual([row]);
});
