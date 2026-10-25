import { test as base, expect, type Page } from '@playwright/test';
import { toCells } from './braille';

export { expect };

declare global {
  interface Window {
    /** Test helpers, added by an init script (never by the app) */
    __t: { dots(svg: Element): string; visible(sel: string): boolean };
  }
}

// Reads a braille cell drawn by the app (cellSVG): dots 1-3 on the left column, 4-6 on the right
const HELPERS = () => {
  window.__t = {
    dots: (svg) => [...svg.querySelectorAll('circle.on')]
      .map((c) => (+c.getAttribute('cx')! < 10 ? 0 : 3) + (+c.getAttribute('cy')! - 5) / 10 + 1)
      .sort().join(''),
    visible: (sel) => { const e = document.querySelector(sel); return !!e && !e.closest('[hidden]'); },
  };
};

// The app's fonts, from the devshell (flake.nix), served in place of Google Fonts: the layout is
// measured with the letters she sees, and no test needs the network
const FONTS = process.env.SIX_POINTS_FONTS;
const FONT_CSS = !FONTS ? '' : [['Next', 'next'], ['Mono', 'mono']].map(([family, file]) =>
  `@font-face { font-family: "Atkinson Hyperlegible ${family}"; font-weight: 200 800; src: url(https://fonts.gstatic.com/test/${file}.woff2) format("woff2"); }`).join('\n');
export const hasFonts = !!FONTS;

export const test = base.extend<{ routeFonts: boolean; pageErrors: string[] }>({
  routeFonts: [true, { option: true }],
  // Every test: the fonts above, the helpers, and no uncaught error in the page
  pageErrors: [async ({ page, context, routeFonts }, use) => {
    if (routeFonts) {
      await context.route(/^https:\/\/fonts\.googleapis\.com\//, (r) => r.fulfill({ contentType: 'text/css', body: FONT_CSS }));
      await context.route(/^https:\/\/fonts\.gstatic\.com\//, (r) => {
        const file = { next: 'AtkinsonHyperlegibleNext[wght].woff2', mono: 'AtkinsonHyperlegibleMono[wght].woff2' }[r.request().url().match(/test\/(\w+)\.woff2$/)?.[1] ?? ''];
        return file && FONTS ? r.fulfill({ path: `${FONTS}/${file}`, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.fulfill({ status: 404 });
      });
    }
    await context.addInitScript(HELPERS);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await use(errors);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  }, { auto: true }],
});

/** Opens the app with these `sixpoints.*` localStorage entries (once: a reload keeps what the app saved). */
export async function gotoApp(page: Page, storage: Record<string, unknown> = {}) {
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('test-seeded')) return;
    sessionStorage.setItem('test-seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem('sixpoints.' + k, JSON.stringify(v));
  }, { free: [], ...storage });
  await page.goto('/');
}

export const store = (page: Page, key: string) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem('sixpoints.' + k) ?? 'null'), key);

/* ---------- The Perkins keys ---------- */
export const KEY: Record<string, string> = { 1: 'KeyF', 2: 'KeyD', 3: 'KeyS', 4: 'KeyJ', 5: 'KeyK', 6: 'KeyL' };

/** One sign: its keys pressed together, then all released ('' is the space bar). */
export async function chord(page: Page, dots: string) {
  if (dots === '') { await page.keyboard.press('Space'); return; }
  for (const d of dots) await page.keyboard.down(KEY[d]);
  for (const d of dots) await page.keyboard.up(KEY[d]);
}
export async function typeCells(page: Page, cells: string[]) {
  for (const c of cells) await chord(page, c);
}
export const typeText = (page: Page, text: string) => typeCells(page, toCells(text));

/** The machine's preview: how many dots are up, and the label */
export const preview = (page: Page) => page.evaluate(() => ({
  dots: window.__t.dots(document.querySelector('#preview svg')!),
  label: document.querySelector('#preview-label')!.textContent,
}));

/** The keys lit by a hint, as a dot string, plus 'space' */
export const litKeys = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll('.key.hint')].map((k) => (k as HTMLElement).dataset.dot ?? k.getAttribute('data-fn')).sort().join(''));

/* ---------- Free typing ---------- */
/** The French under the cells, as plain text (capital and number signs left out, like the copy button) */
export const freeText = (page: Page) => page.$eval('#free-view', (v) => {
  let s = '';
  for (const n of v.querySelectorAll('.cell, .nl')) {
    if (n.classList.contains('nl')) s += '\n';
    else if (n.classList.contains('space')) s += ' ';
    else if (!n.classList.contains('ind')) s += n.querySelector('b')!.textContent;
  }
  return s;
});

/* ---------- Exercises ---------- */
/** Opens the exercise list the way she would: the end screen's button, the bar's list button, or the tab */
export async function openPicker(page: Page) {
  for (let i = 0; i < 2; i++) {
    const button = await page.evaluate(() => (window.__t.visible('#picker') ? null
      : window.__t.visible('#done') ? '#done-list' : window.__t.visible('#btn-lessons') ? '#btn-lessons' : '#tab-ex'));
    if (!button) break;
    await page.click(button);
  }
  await expect(page.locator('#picker')).toBeVisible();
}
export async function startCustom(page: Page, text: string) {
  await openPicker(page);
  await page.fill('#custom-text', text);
  await page.click('#custom-go');
  await expect(page.locator('#ex-view')).toBeVisible();
}
export async function startLesson(page: Page, li: number, i: number) {
  await openPicker(page);
  await page.click(`#lesson-list .chip[data-li="${li}"][data-i="${i}"]`);
  await expect(page.locator('#ex-view')).toBeVisible();
}
/** The exercise text, as shown above the cells */
export const exText = (page: Page) => page.$$eval('#ex-sheet .u', (us) =>
  us.map((u) => (u.classList.contains('space') ? ' ' : u.querySelector('.ch')!.textContent)).join(''));
/** Each character of the exercise with the cells drawn under it (all of them with « Montrer le braille du modèle ») */
export const exUnits = (page: Page) => page.$$eval('#ex-sheet .u', (us) => us.map((u) => ({
  ch: u.classList.contains('space') ? ' ' : u.querySelector('.ch')!.textContent!,
  cells: [...u.querySelectorAll('svg.bc')].map((svg) => window.__t.dots(svg)),
})));
/** The title in the bar (« Mes lettres », « Signe h »…), whichever meta line the orientation shows */
export const exTitle = (page: Page) => page.evaluate(() =>
  document.querySelector(window.__t.visible('#ex-meta') ? '#ex-meta b' : '#ex-meta-inline b')!.textContent);
export const exMeta = (page: Page) => page.evaluate(() =>
  document.querySelector(window.__t.visible('#ex-meta') ? '#ex-meta' : '#ex-meta-inline')!.textContent!);
/** An end screen's figures, by label: '#done-stats' (exercises) or '#read-done-stats' (reading) */
export const doneStats = (page: Page, sel = '#done-stats') => page.$$eval(`${sel} .stat`, (ss) =>
  Object.fromEntries(ss.map((s) => [s.querySelector('span')!.textContent, s.querySelector('b')!.textContent])));

/* ---------- Practice journal (IndexedDB) ---------- */
// 2026-10-21 is a Wednesday; the projects run in Europe/Zurich
export const FIXED_NOW = new Date('2026-10-21T12:00:00+02:00');
export const TODAY = '2026-10-21';
export const M = (dots: string) => [...dots].reduce((m, d) => m | (1 << (+d - 1)), 0);

/** The journal as the app (v2) or an older version (v1, commit a02e13b) creates it, filled before the app opens it. */
export async function seedDb(page: Page, { version = 2, events = [] as object[], days = [] as object[] }) {
  await page.goto('/__seed__'); // a 404 page on the app's origin: the app does not run there
  await page.evaluate(async ({ version, events, days }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('sixpoints', version);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore('events', { autoIncrement: true });
        store.createIndex('t', 't');
        req.result.createObjectStore('days', { keyPath: 'day' });
        if (version >= 2) store.createIndex('id', 'id', { unique: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['events', 'days'], 'readwrite');
      for (const e of events) tx.objectStore('events').add(e);
      for (const d of days) tx.objectStore('days').put(d);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { version, events, days });
}

export type Journal = { version: number; indexes: string[]; events: any[]; days: any[] };
/** What the journal holds now, or null before the app has created it */
export const readDb = (page: Page) => page.evaluate(() => new Promise<Journal | null>((resolve) => {
  const req = indexedDB.open('sixpoints');
  req.onupgradeneeded = () => req.transaction!.abort(); // not there yet: leave its creation to the app
  req.onerror = () => resolve(null);
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction(['events', 'days']);
    const store = tx.objectStore('events');
    const indexes = [...store.indexNames].sort();
    const events = store.getAll(), days = tx.objectStore('days').getAll();
    tx.oncomplete = () => { db.close(); resolve({ version: db.version, indexes, events: events.result, days: days.result }); };
  };
}));
export const dayRow = async (page: Page, day: string) => (await readDb(page))?.days.find((d) => d.day === day);
/** Today in the page's own calendar */
export const today = (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

/* ---------- Layout ---------- */
/** Nothing scrolls sideways, and every button of the top bar (and of an open overlay's head) is on screen */
export async function expectFits(page: Page, where: string) {
  test.skip(!hasFonts, 'measured with the app fonts, which come from the devshell (SIX_POINTS_FONTS)');
  const r = await page.evaluate(async () => {
    await document.fonts.ready;
    const W = innerWidth, H = innerHeight, off: string[] = [], wide: string[] = [];
    // The bar stays put; an overlay's head scrolls with it, so only its width counts
    for (const b of document.querySelectorAll('.bar button, .overlay:not([hidden]) .overlay-head button')) {
      const rect = b.getBoundingClientRect();
      if (!rect.width) continue; // hidden in this mode
      const inBar = !!b.closest('.bar');
      if (rect.left < 0 || rect.right > W + 0.5 || (inBar && (rect.top < 0 || rect.bottom > H + 0.5))) off.push(b.id || b.textContent!.trim());
    }
    for (const s of document.querySelectorAll('.view, .overlay, #ex-sheet, #read-sheet, #read-pick')) {
      if (s.closest('[hidden]')) continue;
      if (s.scrollWidth > s.clientWidth + 1) wide.push(`#${s.id} ${s.scrollWidth}>${s.clientWidth}`);
    }
    const fonts = ['600 14px "Atkinson Hyperlegible Next"', '600 11px "Atkinson Hyperlegible Mono"'].every((f) => document.fonts.check(f));
    return { W, scrollWidth: document.documentElement.scrollWidth, off, wide, fonts };
  });
  expect(r.fonts, `${where}: the app fonts are loaded`).toBe(true);
  const width = page.viewportSize()!.width;
  expect(r.W, `${where}: viewport width`).toBe(width);
  expect(r.scrollWidth, `${where}: page width`).toBeLessThanOrEqual(width);
  expect(r.off, `${where}: bar buttons off screen`).toEqual([]);
  expect(r.wide, `${where}: panes scrolling sideways`).toEqual([]);
}

/* ---------- Reading ---------- */
export const readMeta = (page: Page) => page.evaluate(() =>
  document.querySelector(window.__t.visible('#read-meta') ? '#read-meta' : '#read-meta-inline')!.textContent!);
/** The dots of the sign to read now (the letter, after a capital or number sign) */
export const readCurrent = (page: Page) => page.evaluate(() =>
  window.__t.dots(document.querySelector('#read-sheet .ru.cur .rc:last-child svg')!));
/** Types on the phone's keyboard: the field gets the text and an input event */
export const answer = (page: Page, text: string) => page.fill('#read-input', text);

/* ---------- « Progrès » ---------- */
/** The figures of a group of kpis, by label, spaces normalised */
export const kpis = (page: Page, sel: string) => page.$$eval(`${sel} .kpi`, (ks) => Object.fromEntries(ks.map((k) => [
  k.querySelector('span')!.textContent, [...k.querySelectorAll('b, small')].map((e) => e.textContent!.replace(/\s+/g, ' ')).join(' | '),
])));
export const confusions = (page: Page) => page.$$eval('.cf-list .cf', (cfs) => cfs.map((cf) =>
  [...cf.querySelectorAll('.wk b')].map((b) => b.textContent).join('→') + ' ' + cf.querySelector(':scope > small')!.textContent!.replace(/\s+/g, ' ')));
export async function openProgress(page: Page) {
  await openPicker(page);
  await page.click('#picker-progress');
  await expect(page.locator('#progress-body')).not.toHaveClass(/loading/);
}
