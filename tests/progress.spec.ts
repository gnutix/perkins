import { type Page } from '@playwright/test';
import {
  test, expect, gotoApp, seedDb, openPicker, openProgress, kpis, confusions, typeText, exText, exTitle, store, expectFits,
  FIXED_NOW, TODAY, M,
} from './app';

const row = (o: object) => ({
  day: TODAY, ms: 0, signs: 0, errors: 0, hints: 0, done: 0, bySign: {}, readSigns: 0, readErrors: 0, readMs: 0, readBySign: {},
  freeSigns: 0, freeErrors: 0, freeErased: 0, freeMs: 0, freeTime: 0, freeTimed: 0, ...o,
});
const t0 = FIXED_NOW.getTime() - 3_600_000;
const ev = (i: number, o: object) => ({ v: 1, id: `seed.${i}`, t: t0 + i * 1000, ...o });
const exSign = (i: number, k: string, exp: string, got: string, first = true) =>
  ev(i, { type: 'sign', mode: 'ex', ex: 'aj:2', ch: k, k, exp: M(exp), got: M(got), ok: false, first, hint: false, dt: 800 });

test('« Progrès » opens from the exercise list, is empty at first, and closes with the arrow or Escape', async ({ page }) => {
  await gotoApp(page);
  await openProgress(page);
  await expect(page.locator('#progress-body .empty')).toBeVisible();
  await expect(page.locator('#progress-body .kpis')).toHaveCount(0);
  await page.click('#progress-back');
  await expect(page.locator('#progress')).toBeHidden();
  await expect(page.locator('#picker')).toBeVisible();
  await page.click('#picker-progress');
  await page.keyboard.press('Escape');
  await expect(page.locator('#progress')).toBeHidden();
  await expect(page.locator('#picker')).toBeVisible();
});

test('with a journal, « Progrès » shows the headline figures, the days, every sign and the mix-ups', async ({ page }) => {
  // Wednesday 21 October: this week is the 19th to the 21st, the 15th was last week
  await page.clock.setFixedTime(FIXED_NOW);
  await seedDb(page, {
    days: [
      row({ day: '2026-10-21', ms: 25 * 60_000, signs: 100, errors: 10, done: 2,
        bySign: { h: [10, 4, 40_000, 6], d: [10, 1, 45_000, 9], a: [20, 0, 40_000, 20], b: [3, 0, 6_000, 3] },
        freeSigns: 20, freeErrors: 2, freeErased: 1, freeMs: 120_000, freeTime: 30_000, freeTimed: 15 }),
      row({ day: '2026-10-20', ms: 10 * 60_000, signs: 50, errors: 5, bySign: { e: [5, 0, 5_000, 5] } }),
      row({ day: '2026-10-19', ms: 5 * 60_000, signs: 30 }),
      row({ day: '2026-10-15', ms: 20 * 60_000, signs: 60, errors: 12 }),
    ],
    events: [
      exSign(0, 'h', '125', '145'), exSign(1, 'h', '125', '145'), exSign(2, 'h', '125', '145'),
      // In free typing: d written, erased, then h in its place
      ev(3, { type: 'sign', mode: 'free', got: M('145'), ch: 'd', at: 5, dt: 400 }),
      ev(4, { type: 'erase', mode: 'free', got: M('145'), ch: 'd', at: 5, dt: 300 }),
      ev(5, { type: 'sign', mode: 'free', got: M('125'), ch: 'h', at: 5, dt: 500 }),
      exSign(6, 'e', '15', '24'), exSign(7, 'e', '15', '24'),
      exSign(8, 'a', '1', '12', false), // not a first try: no mix-up
    ],
  });
  await gotoApp(page);
  await openProgress(page);

  const head = await kpis(page, '.pg > .kpis');
  expect(head['Aujourd’hui']).toBe('25 min');
  expect(head['Cette semaine']).toBe('40 min');
  expect(head['Jours d’affilée']).toBe('3');
  expect(head['Signes tapés']).toBe('260'); // 240 in exercises, 20 in free typing
  expect(head['Précision']).toMatch(/^89 %/); // 213 right of 240

  // Practice per day: four days with bars, today selected
  const day = page.locator('.chart[data-chart="day"]');
  await expect(day.locator('path.bar')).toHaveCount(4);
  await expect(day.locator('path.bar.sel')).toHaveCount(1);
  const readout = (await page.locator('#rd-day').textContent())!.replace(/\s+/g, ' ');
  expect(readout).toMatch(/25 min · 120 \D+ · 90 %/);
  // Two weeks with data: accuracy and speed per week
  await expect(page.locator('#rd-acc b')).toHaveText(/^92\s%$/); // 165 right of 180
  await expect(page.locator('#rd-spm b')).toHaveText('21'); // 58 signs timed in 166 s
  await expect(page.locator('.chart[data-chart="acc"] circle.dot')).toHaveCount(2);

  // Every sign, coloured by its misses at first try
  const tile = (k: string) => page.locator(`.sg[data-k="${k}"]`);
  await expect(tile('h')).toHaveClass(/\bm3\b/);
  await expect(tile('h').locator('small')).toHaveText([/^40\s%$/, /^6,7\ss$/]);
  await expect(tile('d')).toHaveClass(/\bm1\b/);
  await expect(tile('d').locator('small').first()).toHaveText(/^10\s%$/);
  await expect(tile('a')).not.toHaveClass(/\bm\d\b/);
  await expect(tile('a').locator('small').first()).toHaveText(/^0\s%$/);
  await expect(tile('b')).toHaveClass(/\bfew\b/);
  await expect(tile('b').locator('small').first()).toHaveText('peu');
  await expect(tile('z')).toHaveClass('sg');
  await tile('h').click();
  await expect(tile('h')).toHaveAttribute('aria-pressed', 'true');
  const detail = (await page.locator('#sg-detail').textContent())!.replace(/\s+/g, ' ');
  expect(detail).toMatch(/\b10\b.*\b4\b.*40 %/);
  expect(detail).toContain('d (4 fois)');

  // The mix-ups: expected → typed, with those corrected in free typing
  expect(await confusions(page)).toEqual(['h→d 4 fois, dont 1 en libre', 'e→i 2 fois']);
});

/* ---------- A drill on one sign, from its detail (7ee7b9b) ---------- */
const daysAgo = (n: number) => { const d = new Date(FIXED_NOW); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
async function seedForDrills(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
  await seedDb(page, {
    days: [0, 1, 2, 3, 4].map((n) => row({ day: daysAgo(n), ms: 600_000, signs: 120, errors: 12, done: 3,
      bySign: { h: [8, 3, 6000, 5], d: [7, 2, 5000, 5], a: [12, 0, 9000, 12], e: [10, 1, 7000, 9], 3: [6, 2, 4000, 4], ',': [6, 2, 4000, 4], maj: [6, 1, 4000, 5], num: [6, 0, 3000, 6] } })),
    events: [0, 1, 2, 3, 4, 5].map((i) => (i < 4 ? exSign(i, 'h', '125', '145') : exSign(i, 'd', '145', '125'))),
  });
  await gotoApp(page, {
    stats: { h: ['', 'd', '', 'd', 'd', '', '', 'd', '', ''], d: ['', 'h', '', 'h', '', '', ''], a: ['', '', '', '', '', ''], e: ['', 'a', '', '', '', ''] },
    progress: { 'aj:0': 1, 'aj:1': 1, 'kt:0': 1 },
    pick: ['b', 'f'],
  });
}
const drillButton = (page: Page) => page.locator('#sg-detail [data-drill]');

for (const viewport of [{ width: 375, height: 553 }, { width: 667, height: 375 }]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });
    test('the sign detail offers « S’entraîner sur h », on screen', async ({ page }) => {
      await seedForDrills(page);
      await openProgress(page);
      await page.click('.sg[data-k="h"]');
      await expect(drillButton(page)).toHaveText('S’entraîner sur h');
      await drillButton(page).scrollIntoViewIfNeeded();
      const box = (await drillButton(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await expectFits(page, 'sign detail');
    });
  });
}

test.describe('375×553', () => {
  test.use({ viewport: { width: 375, height: 553 } });

  test('a drill on one sign: letters and capitals only, « Signe h » and its next one, and the other drills unchanged', async ({ page }) => {
    test.slow(); // two drills typed key by key
    await seedForDrills(page);
    await openProgress(page);
    for (const [k, label] of [['3', null], [',', null], ['num', null], ['maj', 'S’entraîner sur les majuscules'], ['a', 'S’entraîner sur a']]) {
      await page.click(`.sg[data-k="${k}"]`);
      if (label) await expect(drillButton(page), k!).toHaveText(label);
      else await expect(drillButton(page), k!).toHaveCount(0);
    }

    await page.click('.sg[data-k="h"]');
    await drillButton(page).click();
    await expect(page.locator('#progress')).toBeHidden();
    await expect(page.locator('#picker')).toBeHidden();
    expect(await exTitle(page)).toBe('Signe h');
    const text = await exText(page);
    expect(text.split(' ')[0]).toBe('h');
    expect(text.split(' ')).toEqual(expect.arrayContaining(['h', 'd', 'hd', 'dh', 'hdh']));
    expect(await store(page, 'pick')).toEqual(['b', 'f']);

    await typeText(page, text);
    await expect(page.locator('#done')).toBeVisible();
    await expect(page.locator('#done-next')).toHaveText('Autre entraînement');
    await page.click('#done-next');
    expect(await exTitle(page)).toBe('Signe h');
    expect((await exText(page)).split(' ')).toContain('hdh');

    // The lessons button and Escape behave as before
    await page.click('#btn-lessons');
    await expect(page.locator('#picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#picker')).toBeHidden();
    expect(await exTitle(page)).toBe('Signe h');

    // Enter on the focused button
    await page.click('#btn-lessons');
    await page.click('#picker-progress');
    await page.click('.sg[data-k="maj"]');
    await drillButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#progress')).toBeHidden();
    expect(await exTitle(page)).toBe('Signe majuscule');
    expect(await exText(page)).toMatch(/\p{Lu}/u);

    await page.click('#btn-lessons');
    await page.click('#picker-progress');
    await page.keyboard.press('Escape');
    await expect(page.locator('#progress')).toBeHidden();
    await expect(page.locator('#picker')).toBeVisible();

    // « Points faibles » and « Mes lettres » as before
    await page.click('#weak [data-act="drill"]');
    expect(await exTitle(page)).toBe('Points faibles');
    await openPicker(page);
    await page.click('#weak [data-act="pick"]');
    await page.click('#weak [data-act="go"]');
    expect(await exTitle(page)).toBe('Mes lettres');
    expect((await exText(page)).split(' ')).toEqual(expect.arrayContaining(['b', 'f']));
    expect(await store(page, 'pick')).toEqual(['b', 'f']);
  });
});
