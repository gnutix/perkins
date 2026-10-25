import { test, expect, gotoApp, chord, typeCells, freeText, store } from './app';
import { CAP, NUM, LETTERS as L, DIGITS as D, PUNCT as P } from './braille';

test('each cell reads in context: capitals, a word in capitals, numbers, accents and unknown cells', async ({ page }) => {
  await gotoApp(page);
  // Capital sign twice, a, b, space, a, number sign, 1, 0, a
  await typeCells(page, [CAP, CAP, L.a, L.b, '', L.a, NUM, D[1], D[0], L.a]);
  expect(await freeText(page)).toBe('AB a10a');

  await page.keyboard.press('Enter');
  // B, o, n · C F F in capitals until the comma · 12 · accents · dot 5 alone, which is no sign
  await typeCells(page, [CAP, L.b, L.o, L.n, '', CAP, CAP, L.c, L.f, L.f, P[','], L.a, '', NUM, D[1], D[2], L.a, '',
    L['é'], L['ç'], L['à'], L['œ'], L['ô'], '', '5']);
  expect(await freeText(page)).toBe('AB a10a\nBon CFF,a 12a éçàœô ?');
  await expect(page.locator('#free-view .cell.ind b')).toHaveText(['maj', 'maj', 'num', 'maj', 'maj', 'maj', 'num']);
  await expect(page.locator('#free-view .cell.unk b')).toHaveText(['?']);
});

test('Backspace erases, Enter starts a line, « Tout effacer » asks twice, and the text survives a reload', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('#free-view .empty')).toBeVisible();
  await typeCells(page, [L.a, L.b, L.c]);
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await chord(page, L.d);
  expect(await freeText(page)).toBe('ab\nd');
  await expect(page.locator('#free-view .nl')).toHaveCount(1);

  await page.reload();
  expect(await freeText(page)).toBe('ab\nd');

  const clear = page.locator('#btn-clear');
  await clear.click();
  await expect(clear).toHaveText('Tout effacer ?');
  expect(await freeText(page)).toBe('ab\nd');
  await clear.click();
  await expect(page.locator('#free-view .empty')).toBeVisible();
  expect(await store(page, 'free')).toEqual([]);
  await page.reload();
  await expect(page.locator('#free-view .empty')).toBeVisible();
});
