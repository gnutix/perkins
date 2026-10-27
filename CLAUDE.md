# Six Points

A Perkins brailler trainer for French braille, built for one person: the owner's girlfriend, who uses it
daily on an iPhone SE 2nd gen as a home-screen web app. `README.md` describes the features; this file is
what a session needs to change them safely.

## Shipping

- A push to `main` is a deploy: GitHub Pages serves the repo root at https://gnutix.github.io/perkins/
  (legacy build, about a minute). Check it with
  `gh api repos/gnutix/perkins/pages/builds/latest --jq '.status + " " + .commit[0:7]'`.
- It reaches her phone at the next launch: `sw.js` fetches the app's files network-first (bypassing
  Pages' 10-minute cache), fonts cache-first. There is no staging, so run the test suite before pushing.
- Everything committed is public, served as is. Built-in texts must be public domain (La Fontaine is in;
  a Harry Potter extract was refused): she can paste her own texts into « Mon texte », which stay on her phone.

## Code

- One `index.html`: CSS, markup, one IIFE script. No build step, no runtime dependency except Google Fonts
  (Atkinson Hyperlegible Next and Mono). Script sections are marked `/* ---------- Name ---------- */`:
  French braille (tables, `transcribe`, `decode`), Lessons, Storage, Practice journal, Chord engine,
  Exercises, Weak spots (incl. the `WORDS` list and drills), Rendering, Picker/settings, Progress
  (dashboard), Text size, Bar, Reading.
- Match the existing style: small helpers, template strings, `render*` functions, sparse comments,
  colours through the `:root` tokens. The look is deliberately single-theme (paper over a graphite
  machine), so no dark mode. Toggle visibility with the `hidden` attribute.
- UI copy is French, plain and direct, no emoji.

## Constraints

- Screen: 667×375 held sideways (main use) and 375×553 upright. Check both. The top bar in Exercices,
  upright, is the tightest fit.
- Perkins keys go through pointer events, with real multi-touch on the phone. A sign is written when every
  key is up, and a dot stays once its key went down, as on a real Perkins. « Retirer un point en relâchant »
  is an opt-in with a 150 ms grace. `#machine` cancels touch events so iOS doesn't zoom or run its
  three-finger gestures.
- An iPhone follows five touches at most: a sixth cancels them all and is never reported. So a
  `pointercancel` while five dots are held stands for the sixth dot, which is how é (1-2-3-4-5-6) gets written.
- Lecture uses the native iOS keyboard: the input stays a real focusable field with text ≥ 16px,
  autocorrect off, and the view sized from `visualViewport`.
- Braille is French uncontracted (CBFU): capital ⠨ (4-6), a word in capitals ⠨⠨, number sign ⠠ (6) plus
  Antoine digits. Texts are written with no space before ? ! : ; (accepted as is).

## Her data: never lose it

- localStorage, prefix `sixpoints.`: `settings`, `free` (free-typing text), `progress`
  (`'<lessonId>:<index>'` → best %), `custom`, `stats` (weak spots: last 20 outcomes per sign), `pick`,
  `reading`, `journal-outbox`. Since lesson progress is keyed by index, only append items to a lesson in
  `LESSONS`; never insert, reorder or remove them.
- IndexedDB `sixpoints`, version 2: `events` (autoIncrement, index `t`, unique index `id`) and `days`
  (keyPath `day`, local `YYYY-MM-DD`). Her phone has held real data since 2026-10-25. To change the schema,
  bump the version and migrate in `onupgradeneeded` from `oldVersion`. Never delete or recreate a store.
  Old records must stay readable (events carry `v`; day rows are filled in on read).
- Each journal write goes to the localStorage outbox first, then to IndexedDB. A failed write must never
  interrupt practice. Nothing leaves the phone, and there is no export (her choice).
- Removing the home-screen icon deletes all of it: never suggest it as a fix.

## Tests

```bash
nix develop -c npm ci                 # once, and after a change to package-lock.json
nix develop -c npx playwright test    # Chromium + WebKit + Node data checks
```

- The flake's dev shell provides Node, Python, the browsers (`playwright-driver.browsers`, nixpkgs pinned
  in `flake.lock`) and the app's fonts, which the tests serve themselves so no test needs the network.
  `@playwright/test` must stay at nixpkgs' `playwright-driver` version; the config refuses to run otherwise.
- `workers: 4` at most: the laptop is shared.
- Expected braille is written out in `tests/braille.ts`; don't derive expected values from the app.
- Add tests with each fix or feature. The owner wants every check written during development kept in the
  suite, so regressions stay covered.
- For a quick headless check outside the suite: Chromium's `--virtual-time-budget` doesn't wait for
  IndexedDB, so anything touching the journal needs Playwright or real time.

## Word list

`WORDS` (about 2,400 common words, letters only) feeds the weak-spots drills and Lecture's random words.
Check every addition against the French Hunspell dictionary:

```bash
D=$(nix build --no-link --print-out-paths nixpkgs#hunspellDicts.fr-any)/share/hunspell/fr-toutesvariantes
printf '%s\n' mot1 mot2 | nix shell nixpkgs#hunspell -c hunspell -d "$D" -l   # prints the rejected ones
```

« müesli » (Swiss spelling) is the one word kept despite the dictionary.

## As designed, despite appearances

- The exercise list, « Progrès » and the end screens cover the top bar, so Réglages can't be reached
  from there.
- Upright in Exercices, the « Aa » button goes 4 px past the edge, but only when the web font fails to load.
