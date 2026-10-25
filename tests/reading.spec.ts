import { test, expect, gotoApp, chord, freeText, startLesson, exMeta, doneStats, store, readMeta, readCurrent, answer } from './app';
import { letterOf, LETTERS, PUNCT, DIGITS, CAP, NUM, LETTERS as L } from './braille';

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await page.click('#tab-read');
});

test('Lecture hides the machine; a letters round refuses a wrong letter, shows one on request, ends, and Enter goes on', async ({ page }) => {
  await expect(page.locator('#machine')).toBeHidden();
  await page.click('#read-pick [data-set="0"]'); // a à j
  const cur = page.locator('#read-sheet .ru.cur');

  const expected = letterOf(await readCurrent(page))!;
  await answer(page, expected === 'a' ? 'b' : 'a');
  await expect(cur).toHaveClass(/\berr\b/);
  expect(await readMeta(page)).toMatch(/0\/20 · 1 erreur$/);
  await answer(page, expected);
  expect(await readMeta(page)).toMatch(/1\/20 · 1 erreur$/);

  await page.click('#read-show');
  await expect(cur).toHaveClass(/\bshown\b/);
  await expect(cur.locator('b')).toHaveText(letterOf(await readCurrent(page))!);
  for (let i = 1; i < 20; i++) await answer(page, letterOf(await readCurrent(page))!);

  await expect(page.locator('#read-done')).toBeVisible();
  expect(await doneStats(page, '#read-done-stats')).toMatchObject({ Précision: '95 %', Erreurs: '1', Montrés: '1' });
  expect(await store(page, 'reading')).toEqual({ 'letters:aj': { acc: 95, secs: expect.any(Number) } });
  await page.keyboard.press('Enter');
  await expect(page.locator('#read-done')).toBeHidden();
  expect(await readMeta(page)).toMatch(/^Lettres k à t · 0\/20/);
});

test('passages compare capitals and accents exactly, and take iOS quotes, apostrophes and decomposed accents', async ({ page }) => {
  // « Le Corbeau, honteux et confus… »
  await page.click('#read-pick [data-fable="6"]');
  await answer(page, 'l');
  expect(await readMeta(page)).toMatch(/ 0\/\d+ · 1 erreur$/);
  await answer(page, 'L');
  expect(await readMeta(page)).toMatch(/ 1\/\d+ · 1 erreur$/);

  // « Vous êtes le Phénix des hôtes… »: ê as one character, é as e + accent, o refused for ô
  await page.click('#btn-read-list');
  await page.click('#read-pick [data-fable="2"]');
  await answer(page, 'Vous ê');
  await answer(page, 'tes le Phénix des h');
  expect(await readMeta(page)).toMatch(/ 25\/\d+ · 0 erreur$/);
  await answer(page, 'o');
  expect(await readMeta(page)).toMatch(/ 25\/\d+ · 1 erreur$/);
  await answer(page, 'ô');
  expect(await readMeta(page)).toMatch(/ 26\/\d+ · 1 erreur$/);

  // A whole passage typed as iOS does it, with ’ and “ ”: no error
  await page.click('#btn-read-list');
  await page.click('#read-pick [data-fable="4"]');
  await answer(page, 'Le Renard s’en saisit, et dit: “Mon bon Monsieur, Apprenez que tout flatteur');
  await expect(page.locator('#read-done')).toBeVisible();
  expect(await doneStats(page, '#read-done-stats')).toMatchObject({ Précision: '100 %', Erreurs: '0', Montrés: '0' });
});

test('random words use only the signs of their level, and two rounds at a level differ', async ({ page }) => {
  const upTo = (last: string) => Object.keys(LETTERS).slice(0, Object.keys(LETTERS).indexOf(last) + 1);
  const accents = upTo('œ');
  const levels = [upTo('j'), upTo('t'), upTo('z'), accents, accents, accents, accents].map((letters, wi) => new Set([
    ...letters.map((c) => LETTERS[c]),
    ...(wi >= 4 ? [CAP] : []),
    ...(wi >= 5 ? [',', '.', '?', '!', ';', ':'].map((c) => PUNCT[c]) : []),
    ...(wi >= 6 ? [NUM, ...Object.values(DIGITS)] : []),
  ]));
  const round = async (wi: number) => {
    await page.click(`#read-pick [data-words="${wi}"]`);
    const cells = await page.$$eval('#read-sheet svg.bc', (svgs) => svgs.map((s) => window.__t.dots(s)));
    await page.click('#btn-read-list');
    return cells;
  };
  for (const [wi, allowed] of levels.entries()) {
    for (let n = 0; n < 2; n++) {
      const cells = await round(wi);
      expect(cells.length, `level ${wi}`).toBeGreaterThan(20);
      expect(cells.filter((d) => !allowed.has(d)), `level ${wi}: signs outside the level`).toEqual([]);
    }
  }
  expect((await round(0)).join(' ')).not.toBe((await round(0)).join(' '));
});

test('after Lecture, the Perkins keys work again in Libre and Exercices, and the reading layout is undone', async ({ page }) => {
  const vars = () => page.evaluate(() => ['--vvh', '--vvt'].map((v) => document.documentElement.style.getPropertyValue(v)));
  await page.click('#read-pick [data-set="0"]');
  await answer(page, letterOf(await readCurrent(page))!);
  await expect(page.locator('html')).toHaveClass(/\breading\b/);
  expect((await vars())[0]).not.toBe('');

  await page.click('#tab-free');
  await expect(page.locator('#machine')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/\breading\b/);
  expect(await vars()).toEqual(['', '']);
  await chord(page, L.a);
  expect(await freeText(page)).toBe('a');

  await startLesson(page, 0, 0);
  await chord(page, L.a);
  expect(await exMeta(page)).toContain('1/19');

  // The round waits where it was
  await page.click('#tab-read');
  await expect(page.locator('#machine')).toBeHidden();
  expect(await readMeta(page)).toMatch(/ 1\/20 /);
  await page.click('#tab-free');
  await chord(page, L.b);
  expect(await freeText(page)).toBe('ab');
});
