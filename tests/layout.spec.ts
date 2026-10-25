import { test, expect, hasFonts, gotoApp, seedDb, chord, typeText, startLesson, openPicker, openProgress, expectFits, answer, FIXED_NOW, TODAY } from './app';
import { LETTERS as L } from './braille';

// Her phone held sideways, then upright with the Safari bars
for (const viewport of [{ width: 667, height: 375 }, { width: 375, height: 553 }]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('no mode scrolls sideways, and the bar keeps all its buttons on screen', async ({ page }) => {
      test.skip(!hasFonts, 'measured with the app fonts, which come from the devshell (SIX_POINTS_FONTS)');
      await page.clock.setFixedTime(FIXED_NOW);
      await seedDb(page, {
        days: [{ day: TODAY, ms: 900_000, signs: 80, errors: 9, hints: 1, done: 2, bySign: { h: [10, 4, 9000, 6], maj: [6, 1, 4000, 5] },
          readSigns: 20, readErrors: 2, readMs: 60_000, readBySign: { a: [6, 1, 3000, 5] },
          freeSigns: 30, freeErrors: 1, freeErased: 2, freeMs: 100_000, freeTime: 20_000, freeTimed: 12 }],
      });
      await gotoApp(page, { progress: { 'aj:0': 100, 'kt:1': 90 } });

      await typeText(page, 'Bonjour Marie, le CFF a 12 ans.');
      await page.keyboard.press('Enter');
      await chord(page, L.a);
      await expectFits(page, 'Libre');
      await page.click('#btn-size');
      await expectFits(page, 'Libre, text size panel');
      await page.click('#btn-size');

      await openPicker(page);
      await expectFits(page, 'exercise list');
      await page.click('#weak [data-act="pick"]');
      await expectFits(page, 'exercise list, letters to pick');
      await startLesson(page, 7, 2); // the fable's longest line
      await expectFits(page, 'Exercices');
      await chord(page, L.a); // wrong: the banner and its buttons
      await expectFits(page, 'Exercices, mistake');
      await page.click('#banner [data-act="hint"]');
      await expectFits(page, 'Exercices, hint');

      await openProgress(page);
      await page.click('.sg[data-k="h"]');
      await expectFits(page, 'Progrès');
      await page.click('#progress-back');
      await page.click('#picker-close');

      await page.click('#tab-read');
      await expectFits(page, 'Lecture, list');
      await page.click('#read-pick [data-words="6"]');
      await expectFits(page, 'Lecture, words');
      await page.click('#btn-read-list');
      await page.click('#read-pick [data-fable="2"]');
      await answer(page, 'Vous');
      await expectFits(page, 'Lecture, fable');
      await page.click('#btn-read-list');
      await page.click('#read-pick [data-set="4"]');
      await expectFits(page, 'Lecture, letters');

      await page.click('#btn-settings');
      await expectFits(page, 'Réglages');
      await expect(page.locator('#settings .panel')).toBeInViewport({ ratio: 1 });
    });
  });
}
