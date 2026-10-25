import { test, expect, gotoApp, chord, startLesson, store } from './app';
import { LETTERS as L } from './braille';

const sizes = (page: import('@playwright/test').Page) => page.evaluate(() =>
  ['--bs', '--fs'].map((v) => document.documentElement.style.getPropertyValue(v)));

test('« Aa » sliders size the braille and the French, and the sizes stay after a reload', async ({ page }) => {
  await gotoApp(page);
  await chord(page, L.a);
  const cell = page.locator('#free-view .cell.char svg').first();
  const width = (await cell.boundingBox())!.width;

  await page.click('#btn-size');
  await expect(page.locator('#size-pop')).toBeVisible();
  await page.locator('#size-braille').fill('150');
  await page.locator('#size-fr').fill('200');
  expect(await sizes(page)).toEqual(['1.5', '2']);
  await expect(page.locator('#size-braille-val')).toHaveText('150 %');
  await expect(page.locator('#size-fr-val')).toHaveText('200 %');
  expect((await cell.boundingBox())!.width).toBeCloseTo(width * 1.5, 0);
  // Tapping the paper closes the panel
  await page.click('#free-view');
  await expect(page.locator('#size-pop')).toBeHidden();

  await page.reload();
  expect(await sizes(page)).toEqual(['1.5', '2']);
  await page.click('#btn-size');
  await expect(page.locator('#size-braille')).toHaveValue('150');
  await expect(page.locator('#size-fr')).toHaveValue('200');
  await page.click('#size-reset');
  expect(await sizes(page)).toEqual(['1', '1']);
  expect(await store(page, 'settings')).toMatchObject({ brailleSize: 100, frSize: 100 });
});

test('Réglages are kept after a reload, and « Arrêt sur erreur » off lets typing go on after a mistake', async ({ page }) => {
  await gotoApp(page);
  await page.click('#btn-settings');
  await expect(page.locator('#set-stop')).toBeChecked();
  await page.uncheck('#set-stop');
  await page.check('#set-braille');
  await page.check('#set-lift');
  await page.uncheck('#set-sound');
  await page.uncheck('#set-preview');
  await page.click('#settings-close');

  await page.reload();
  expect(await store(page, 'settings')).toMatchObject({ stopOnError: false, showBraille: true, liftToFix: true, sound: false, preview: false });
  await page.click('#btn-settings');
  await expect(page.locator('#set-stop')).not.toBeChecked();
  await expect(page.locator('#set-braille')).toBeChecked();
  await expect(page.locator('#set-lift')).toBeChecked();
  await expect(page.locator('#set-sound')).not.toBeChecked();
  await expect(page.locator('#set-preview')).not.toBeChecked();
  await page.click('#settings-close');

  await startLesson(page, 0, 0);
  // The model's braille is drawn in grey under the letters still to type
  await expect(page.locator('#ex-sheet .u.cur svg.ghost circle.on')).toHaveCount(1);
  await chord(page, L.b);
  await expect(page.locator('#banner')).toHaveClass(/\berr\b/);
  await expect(page.locator('#banner [data-act="retry"]')).toHaveCount(0);
  await expect(page.locator('#machine')).not.toHaveClass(/\blocked\b/);
  await chord(page, L.a);
  await expect(page.locator('#banner')).toBeHidden();
});
