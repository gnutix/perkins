import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Properties of the app's data and pure functions, checked in Node over many cases a browser test
// could not cover: the parts of the script they need are cut out of index.html by its section comments.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
const between = (from: string, to: string) => {
  const a = script.indexOf(from), b = script.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`index.html: no section from « ${from} » to « ${to} »`);
  return script.slice(a, b);
};
const app = new Function(`
  ${between('/* ---------- French braille', '/* ---------- Storage')}
  let progress = {}, stats = {}, picked = [];
  const store = { get: (k, d) => (k === 'progress' ? progress : d) };
  ${between('/* ---------- Weak spots', '/* ---------- Rendering')}
  ${between('const READ_SETS', 'const oneOf')}
  const setProgress = (p) => { progress = p; };
  return { LETTERS, PUNCT, DIGITS, WORDS, LESSONS, FABLE_READ, transcribe, decode, plainText, normalize, makeDrill, setProgress };
`)();

test('the word list has no duplicates, and only letters the braille table knows', () => {
  const words: string[] = app.WORDS;
  expect(words.length).toBeGreaterThan(2000);
  expect(words.filter((w, i) => words.indexOf(w) !== i)).toEqual([]);
  expect(words.filter((w) => ![...w].every((c) => app.LETTERS[c] !== undefined))).toEqual([]);
});

test('every lesson text and fable passage transcribes without a skipped character, and reads back the same', () => {
  const texts: string[] = [...app.LESSONS.flatMap((l: any) => l.items), ...app.FABLE_READ];
  for (const text of texts) {
    const { units, skipped } = app.transcribe(text);
    expect(skipped, text).toEqual([]);
    expect(app.plainText(app.decode(units.flatMap((u: any) => u.cells))), text).toBe(app.normalize(text));
  }
});

test('300 random weak-spot drills all fit in 70 characters and transcribe fully', () => {
  const kinds = {
    letter: Object.keys(app.LETTERS),
    punct: Object.keys(app.PUNCT),
    digit: Object.keys(app.DIGITS),
  };
  const any = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  for (let n = 0; n < 300; n++) {
    // Practised up to a random lesson, 1 to 6 signs of any kind, and up to 2 pairs of the same kind
    app.setProgress(Object.fromEntries(app.LESSONS.slice(0, 1 + Math.floor(Math.random() * app.LESSONS.length)).map((l: any) => [`${l.id}:0`, 100])));
    const targets = new Set<string>();
    const size = 1 + Math.floor(Math.random() * 6);
    while (targets.size < size) {
      const r = Math.random();
      targets.add(r < 0.6 ? any(kinds.letter) : r < 0.75 ? any(kinds.punct) : r < 0.85 ? any(kinds.digit) : r < 0.93 ? 'maj' : 'num');
    }
    const list = [...targets];
    const pairs: string[][] = [];
    for (const group of Object.values(kinds)) {
      const same = list.filter((k) => group.includes(k));
      if (same.length >= 2 && pairs.length < 2 && Math.random() < 0.7) pairs.push([same[0], same[1]]);
    }
    const text: string = app.makeDrill(list, pairs);
    const where = `${JSON.stringify(list)} ${JSON.stringify(pairs)} → ${JSON.stringify(text)}`;
    expect(text.length, where).toBeLessThanOrEqual(70);
    const { units, skipped } = app.transcribe(text);
    expect(skipped, where).toEqual([]);
    expect(units.length, where).toBeGreaterThan(0);
  }
});
