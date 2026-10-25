import { type Page } from '@playwright/test';
import { test, expect, gotoApp, chord, typeCells, openPicker, startCustom, exText, exTitle, store } from './app';
import { toUnits, LETTERS as L } from './braille';

/**
 * Types a text from the start; each h is first typed as d (then « Réessayer »), until `missed.n`
 * reaches `upTo`. With `stop`, the typing stops right after that last miss. Returns where it stopped.
 */
async function typeMissingH(page: Page, text: string, missed: { n: number }, upTo: number, stop = false) {
  const units = toUnits(text);
  for (const [i, unit] of units.entries()) {
    if (unit.ch === 'h' && missed.n < upTo) {
      await chord(page, L.d);
      await page.click('#banner [data-act="retry"]');
      await typeCells(page, unit.cells);
      if (++missed.n === upTo && stop) return i + 1;
    } else await typeCells(page, unit.cells);
  }
  return units.length;
}

const weakSigns = '#weak .wsigns > .wk';
const pairs = '#weak .cf';

test('a sign shows up as weak at 2 misses in 10, not 1 in 5, with the pair mixed up; Réglages erases it all', async ({ page }) => {
  await gotoApp(page);
  await startCustom(page, 'hhhhh');
  const missed = { n: 0 };
  await typeMissingH(page, 'hhhhh', missed, 1);
  await expect(page.locator('#done')).toBeVisible();
  expect(await store(page, 'stats')).toEqual({ h: ['d', '', '', '', ''] });
  await page.click('#done-list');
  await expect(page.locator(weakSigns)).toHaveCount(0);
  await expect(page.locator(pairs)).toHaveCount(0);

  await page.click('#picker-close');
  await page.click('#done-again');
  await typeMissingH(page, 'hhhhh', missed, 2);
  await page.click('#done-list');
  await expect(page.locator(weakSigns)).toHaveCount(1);
  await expect(page.locator(`${weakSigns} b`)).toHaveText('h');
  await expect(page.locator(`${weakSigns} small`)).toHaveText('20 %');
  await expect(page.locator(pairs)).toHaveCount(1);
  await expect(page.locator(`${pairs} b`)).toHaveText(['h', 'd']);
  await expect(page.locator(`${pairs} > small`)).toHaveText('2 fois');

  // Réglages, from Libre (the end screen covers the bar)
  await page.click('#picker-free');
  await page.click('#btn-settings');
  const reset = page.locator('#stats-reset');
  await reset.click();
  await expect(reset).toHaveText('Oui, effacer');
  await reset.click();
  await expect(page.locator('#toast')).toHaveText('Erreurs effacées');
  expect(await store(page, 'stats')).toEqual({});
  await page.click('#settings-close');
  await openPicker(page);
  await expect(page.locator(weakSigns)).toHaveCount(0);
  await expect(page.locator(pairs)).toHaveCount(0);
});

test('« Choisir mes lettres » h and d: an a–j drill that runs to the end, replays, renews, and counts 11 d for h', async ({ page }) => {
  test.slow(); // three or four drills typed key by key
  await gotoApp(page);
  await openPicker(page);
  await page.click('#weak [data-act="pick"]');
  await page.click('#weak .pchip[data-k="h"]');
  await page.click('#weak .pchip[data-k="d"]');
  await expect(page.locator('#weak .pchip[aria-pressed="true"]')).toHaveCount(2);
  await page.click('#pick-go');
  expect(await exTitle(page)).toBe('Mes lettres');
  expect(await store(page, 'pick')).toEqual(['h', 'd']);

  // Nothing practised yet beyond a–j: the drill holds to those letters
  const first = await exText(page);
  expect(first).toMatch(/^[a-j ]+$/);
  expect(first.split(' ')).toEqual(expect.arrayContaining(['h', 'd', 'hd', 'dh', 'hdh']));
  await typeCells(page, toUnits(first).flatMap((u) => u.cells));
  await expect(page.locator('#done')).toBeVisible();
  await expect(page.locator('#done-next')).toHaveText('Autre entraînement');
  await page.click('#done-again');
  expect(await exText(page)).toBe(first);

  // From a clean record, d typed for every h until 11 misses
  await page.click('#btn-settings');
  await page.click('#stats-reset');
  await page.click('#stats-reset');
  await page.click('#settings-close');
  const missed = { n: 0 };
  let at = await typeMissingH(page, first, missed, 11, true);
  while (missed.n < 11) {
    await page.click('#done-again');
    expect(await exText(page)).toBe(first);
    at = await typeMissingH(page, first, missed, 11, true);
  }
  expect((await store(page, 'stats')).h).toEqual(Array(11).fill('d'));
  await openPicker(page);
  await expect(page.locator(`${weakSigns}:has(b:text-is("h")) small`)).toHaveText('100 %');
  await expect(page.locator(`${pairs} b`)).toHaveText(['h', 'd']);
  await expect(page.locator(`${pairs} > small`)).toHaveText('11 fois');

  // Back to the drill, to its end, then another one
  await page.click('#picker-close');
  await typeCells(page, toUnits(first).slice(at).flatMap((u) => u.cells));
  await expect(page.locator('#done')).toBeVisible();
  await page.click('#done-next');
  const second = await exText(page);
  expect(await exTitle(page)).toBe('Mes lettres');
  expect(second).not.toBe(first);
  expect(second).toMatch(/^[a-j ]+$/);
});
