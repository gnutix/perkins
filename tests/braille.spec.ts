import { test, expect, gotoApp, startCustom, exUnits, typeCells, freeText } from './app';
import { toUnits } from './braille';

// « Montrer le braille du modèle » draws every expected cell under its letter: that is how the
// tests read the app's French → braille without reaching into it
const u = (ch: string, ...cells: string[]) => ({ ch, cells });

test('French → braille → French: exercises draw the standard cells, which read back as the same text', async ({ page }) => {
  await gotoApp(page, { settings: { showBraille: true } });
  const cellsOf = async (text: string) => { await startCustom(page, text); return exUnits(page); };

  await test.step('the signs, written out', async () => {
    expect(await cellsOf("J'ai 13 chats.")).toEqual([
      u('J', '46', '245'), u("'", '3'), u('a', '1'), u('i', '24'), u(' ', ''),
      u('1', '6', '16'), u('3', '146'), u(' ', ''),
      u('c', '14'), u('h', '125'), u('a', '1'), u('t', '2345'), u('s', '234'), u('.', '256'),
    ]);
    expect(await cellsOf('Élise œuf 2')).toEqual([
      u('É', '46', '123456'), u('l', '123'), u('i', '24'), u('s', '234'), u('e', '15'), u(' ', ''),
      u('œ', '246'), u('u', '136'), u('f', '124'), u(' ', ''), u('2', '6', '126'),
    ]);
    // Guillemets become 2-3-5-6, and the spaces inside them go
    expect(await cellsOf('Ça « va » ?')).toEqual([
      u('Ç', '46', '12346'), u('a', '1'), u(' ', ''), u('"', '2356'), u('v', '1236'), u('a', '1'), u('"', '2356'),
      u(' ', ''), u('?', '26'),
    ]);
    // A word in capitals: the capital sign twice, before its first letter only
    expect((await cellsOf('le train des CFF')).slice(-3)).toEqual([u('C', '46', '46', '14'), u('F', '124'), u('F', '124')]);
    expect(await cellsOf("L'ONU")).toEqual([u('L', '46', '123'), u("'", '3'), u('O', '46', '46', '135'), u('N', '1345'), u('U', '136')]);
  });

  const texts = ['Le 14 juillet, Noël!', "J'ai 13 chats.", 'Élise œuf 2', 'le train des CFF', 'BONJOUR Marie', "L'ONU",
    'JEAN-PIERRE', 'A et B', 'OK 12', 'McDonald', 'ÉTÉ'];
  const drawn: string[][] = [];
  await test.step('every text, against the rules in tests/braille.ts', async () => {
    for (const text of texts) {
      const units = await cellsOf(text);
      expect(units, text).toEqual(toUnits(text));
      drawn.push(units.flatMap((x) => x.cells));
    }
  });

  await test.step('typed back in Libre, one text per line', async () => {
    await page.click('#tab-free');
    for (const [i, cells] of drawn.entries()) {
      if (i) await page.keyboard.press('Enter');
      await typeCells(page, cells);
    }
    expect((await freeText(page)).split('\n')).toEqual(texts);
  });
});
