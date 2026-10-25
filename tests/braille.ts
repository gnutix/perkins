// French braille (non abrégé), written out here so the tests check the app against the standard
// rather than against itself. A sign is a string of dots: '125' is h, '' the space bar.
export const LETTERS: Record<string, string> = {
  a: '1', b: '12', c: '14', d: '145', e: '15', f: '124', g: '1245', h: '125', i: '24', j: '245',
  k: '13', l: '123', m: '134', n: '1345', o: '135', p: '1234', q: '12345', r: '1235', s: '234', t: '2345',
  u: '136', v: '1236', w: '2456', x: '1346', y: '13456', z: '1356',
  ç: '12346', é: '123456', à: '12356', è: '2346', ù: '23456',
  â: '16', ê: '126', î: '146', ô: '1456', û: '156', ë: '1246', ï: '12456', ü: '1256', œ: '246',
};
export const PUNCT: Record<string, string> = {
  ',': '2', ';': '23', ':': '25', '.': '256', '?': '26', '!': '235', '"': '2356',
  '(': '236', ')': '356', "'": '3', '-': '36',
};
// Antoine notation, after the number sign
export const DIGITS: Record<string, string> = {
  1: '16', 2: '126', 3: '146', 4: '1456', 5: '156', 6: '1246', 7: '12456', 8: '1256', 9: '246', 0: '3456',
};
export const CAP = '46';
export const NUM = '6';
export const SPACE = '';

const isLetter = (c: string) => LETTERS[c.toLowerCase()] !== undefined;
const isUpper = (c: string) => c !== c.toLowerCase();

/** The signs of each character: a capital takes 4-6, a word in capitals 4-6 twice, a number 6. */
export function toUnits(text: string): { ch: string; cells: string[] }[] {
  const chars = [...text];
  return chars.map((c, i) => {
    if (c === ' ') return { ch: c, cells: [SPACE] };
    if (DIGITS[c]) return { ch: c, cells: DIGITS[chars[i - 1]] ? [DIGITS[c]] : [NUM, DIGITS[c]] };
    if (isLetter(c)) {
      let start = i, end = i;
      while (start > 0 && isLetter(chars[start - 1])) start--;
      while (end < chars.length && isLetter(chars[end])) end++;
      const word = chars.slice(start, end);
      const caps = word.length > 1 && word.every(isUpper);
      const sign = caps ? (i === start ? [CAP, CAP] : []) : isUpper(c) ? [CAP] : [];
      return { ch: c, cells: [...sign, LETTERS[c.toLowerCase()]] };
    }
    if (PUNCT[c]) return { ch: c, cells: [PUNCT[c]] };
    throw new Error(`no braille for ${JSON.stringify(c)} in the test table`);
  });
}
/** The signs to type for a text, one after the other */
export const toCells = (text: string) => toUnits(text).flatMap((u) => u.cells);

export const maskOf = (dots: string) => [...dots].reduce((m, d) => m | (1 << (+d - 1)), 0);

const BY_DOTS = new Map(Object.entries(LETTERS).map(([c, d]) => [d, c]));
/** The letter a sign stands for, outside a number */
export const letterOf = (dots: string) => BY_DOTS.get(dots);
