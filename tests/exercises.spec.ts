import { test, expect, gotoApp, chord, typeText, openPicker, startCustom, startLesson, exMeta, preview, litKeys, doneStats, store } from './app';
import { CAP, LETTERS as L } from './braille';

const banner = '#banner';

test('« Mon texte »: unknown characters are listed, and a mixed text typed right ends with no error', async ({ page }) => {
  await gotoApp(page);
  await openPicker(page);
  await page.fill('#custom-text', 'Prix: 5 € & 3 % ~');
  const note = page.locator('#custom-note');
  await expect(note).toHaveClass(/\bwarn\b/);
  for (const c of ['€', '&', '%', '~']) await expect(note).toContainText(c);

  const text = "Le CFF a 12 ans, l'été! Ça va? BONJOUR";
  await page.fill('#custom-text', text);
  await expect(note).not.toHaveClass(/\bwarn\b/);
  await page.click('#custom-go');
  await typeText(page, text);
  await expect(page.locator('#done')).toBeVisible();
  expect(await doneStats(page)).toMatchObject({ Précision: '100 %', Erreurs: '0', Indices: '0' });
});

test('a wrong sign stops the keyboard until « Réessayer », and the preview follows', async ({ page }) => {
  await gotoApp(page);
  await startLesson(page, 0, 0); // a b c d e f g h i j
  await chord(page, L.a);
  expect(await preview(page)).toEqual({ dots: '1', label: 'a' });
  expect(await exMeta(page)).toContain('1/19');

  await chord(page, L.b); // a space was expected
  await expect(page.locator(banner)).toHaveClass(/\berr\b/);
  await expect(page.locator(banner)).toContainText('« b »');
  await expect(page.locator('#machine')).toHaveClass(/\blocked\b/);
  expect(await preview(page)).toEqual({ dots: '12', label: 'en pause' });

  // Locked: neither a sign nor the space bar gets through
  await chord(page, L.c);
  await page.keyboard.press('Space');
  expect(await exMeta(page)).toMatch(/1\/19 · 1 erreur$/);

  await page.click(`${banner} [data-act="retry"]`);
  await expect(page.locator(banner)).toBeHidden();
  await expect(page.locator('#machine')).not.toHaveClass(/\blocked\b/);
  expect(await preview(page)).toEqual({ dots: '', label: '' });
  await page.keyboard.press('Space');
  expect(await exMeta(page)).toContain('2/19');
});

test('typing i for î names both, and « Montrer » lights 1-4-6 and nothing else', async ({ page }) => {
  await gotoApp(page);
  await startLesson(page, 7, 0); // Maître Corbeau, sur un arbre perché,
  for (const c of [CAP, L.m, L.a, L.i]) await chord(page, c);
  await expect(page.locator(banner)).toContainText('« i »');
  await expect(page.locator(banner)).toContainText('il fallait « î »');
  await expect(page.locator('#machine')).toHaveClass(/\blocked\b/);

  await page.click(`${banner} [data-act="hint"]`);
  await expect(page.locator(banner)).toHaveClass(/\bhint\b/);
  expect(await litKeys(page)).toBe('146');
  await expect(page.locator('#machine')).not.toHaveClass(/\blocked\b/);
  expect(await preview(page)).toEqual({ dots: '', label: '' });
  await chord(page, L['î']);
  expect(await litKeys(page)).toBe('');
  expect(await exMeta(page)).toMatch(/3\/36 · 1 erreur$/);
});

test('« Indice » on a word in capitals groups the two capital signs and lights 4 and 6', async ({ page }) => {
  await gotoApp(page);
  await startLesson(page, 4, 5); // BONJOUR Marie
  await page.click('#btn-hint');
  await expect(page.locator('#btn-hint')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(banner)).toContainText('mot en majuscules, points 4-6 deux fois');
  expect(await litKeys(page)).toBe('46');
  await chord(page, CAP);
  expect(await litKeys(page)).toBe('46');
  await chord(page, CAP);
  expect(await litKeys(page)).toBe('12');
  await chord(page, L.b);
  // The hint was for that letter only
  expect(await litKeys(page)).toBe('');
  await expect(page.locator('#btn-hint')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#btn-hint');
  expect(await litKeys(page)).toBe('135');
  await page.click('#btn-hint');
  expect(await litKeys(page)).toBe('');
});

test('the end screen shows accuracy, errors and time, the lesson turns green, and Space goes on', async ({ page }) => {
  await gotoApp(page);
  await startLesson(page, 0, 0);
  await chord(page, L.a);
  await chord(page, L.b);
  await page.click(`${banner} [data-act="retry"]`);
  await typeText(page, ' b c d e f g h i j');

  await expect(page.locator('#done')).toBeVisible();
  const stats = await doneStats(page);
  expect(stats).toMatchObject({ Précision: '95 %', Erreurs: '1', Indices: '0' }); // 19 signs, 1 error
  expect(stats.Temps).toMatch(/^\d+:\d\d$/);
  expect(await preview(page)).toEqual({ dots: '', label: '' });
  expect(await store(page, 'progress')).toEqual({ 'aj:0': 95 });

  await page.click('#done-list');
  const chip = page.locator('#lesson-list .chip[data-li="0"][data-i="0"]');
  await expect(chip).toHaveClass(/\bdone\b/);
  await expect(chip).toHaveAttribute('aria-label', /95 %/);
  await expect(page.locator('#lesson-list .chip.done')).toHaveCount(1);

  await page.click('#picker-close');
  await expect(page.locator('#done')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#done')).toBeHidden();
  expect(await exMeta(page)).toContain('exercice 2/4');
});
