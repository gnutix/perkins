import { test, expect, gotoApp, chord, freeText, preview, KEY, FIXED_NOW } from './app';

test('a sign is written once every key is up, with the dots of all the keys pressed (real Perkins)', async ({ page }) => {
  await gotoApp(page);
  await page.keyboard.down(KEY[1]);
  expect(await preview(page)).toEqual({ dots: '1', label: 'a' });
  await page.keyboard.down(KEY[2]);
  expect(await preview(page)).toEqual({ dots: '12', label: 'b' });
  await page.keyboard.up(KEY[1]);
  // Dot 1 is embossed already: still b, and nothing written while dot 2 is held, however long
  expect(await preview(page)).toEqual({ dots: '12', label: 'b' });
  await page.waitForTimeout(250);
  expect(await freeText(page)).toBe('');
  await page.keyboard.up(KEY[2]);
  expect(await freeText(page)).toBe('b');
  expect(await preview(page)).toEqual({ dots: '12', label: 'b' });

  // Space, Enter and Backspace
  await page.keyboard.press('Space');
  await chord(page, '1');
  await page.keyboard.press('Enter');
  await chord(page, '14');
  expect(await freeText(page)).toBe('b a\nc');
  await page.keyboard.press('Backspace');
  expect(await freeText(page)).toBe('b a\n');
  await page.keyboard.press('Backspace');
  expect(await freeText(page)).toBe('b a');
});

test('« Retirer un point en relâchant »: a key let go early loses its dot, keys let go together keep it', async ({ page }) => {
  // A paused clock makes the gaps between releases exact
  await page.clock.install({ time: FIXED_NOW });
  await gotoApp(page, { settings: { liftToFix: true } });
  await page.clock.pauseAt(FIXED_NOW.getTime() + 60_000);

  // 1 + 2, then 2 let go, 1 held 300 ms: a
  await page.keyboard.down(KEY[1]);
  await page.keyboard.down(KEY[2]);
  await page.keyboard.up(KEY[2]);
  await page.clock.runFor(300);
  expect(await preview(page)).toEqual({ dots: '1', label: 'a' });
  await page.keyboard.up(KEY[1]);
  expect(await freeText(page)).toBe('a');

  // 1 + 2 let go 60 ms apart: still b
  await page.keyboard.down(KEY[1]);
  await page.keyboard.down(KEY[2]);
  await page.keyboard.up(KEY[1]);
  await page.clock.runFor(60);
  await page.keyboard.up(KEY[2]);
  expect(await freeText(page)).toBe('ab');

  // 1 + 2 + 4 let go one by one, 120 ms apart: each within the grace of the one before, so f
  await page.keyboard.down(KEY[1]);
  await page.keyboard.down(KEY[2]);
  await page.keyboard.down(KEY[4]);
  await page.keyboard.up(KEY[1]);
  await page.clock.runFor(120);
  await page.keyboard.up(KEY[2]);
  await page.clock.runFor(120);
  await page.keyboard.up(KEY[4]);
  expect(await freeText(page)).toBe('abf');
});

test('several fingers on the on-screen keys make one sign (touch, as on her iPhone)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'multi-touch is sent through the Chrome DevTools Protocol');
  await gotoApp(page);
  const cdp = await page.context().newCDPSession(page);
  const finger = async (dot: number, id: number) => {
    const b = (await page.locator(`.key[data-dot="${dot}"]`).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, id };
  };
  const touch = (type: 'touchStart' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const one = await finger(1, 1), two = await finger(2, 2), four = await finger(4, 3);

  // One finger, then a second: both keys down, nothing written yet
  await touch('touchStart', [one]);
  await touch('touchStart', [one, two]);
  await expect(page.locator('.key.down')).toHaveCount(2);
  expect(await preview(page)).toEqual({ dots: '12', label: 'b' });
  expect(await freeText(page)).toBe('');
  // All lifted (the protocol lifts every finger at once, one pointerup after the other)
  await touch('touchEnd', []);
  await expect(page.locator('.key.down')).toHaveCount(0);
  expect(await freeText(page)).toBe('b');

  // Three fingers, both hands
  await touch('touchStart', [four]);
  await touch('touchStart', [four, one]);
  await touch('touchStart', [four, one, two]);
  await expect(page.locator('.key.down')).toHaveCount(3);
  await touch('touchEnd', []);
  expect(await freeText(page)).toBe('bf');
});

for (const liftToFix of [false, true]) {
  test(`six fingers make é on an iPhone, which follows five and cancels them all past that${liftToFix ? ' (« Retirer un point en relâchant »)' : ''}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'multi-touch is sent through the Chrome DevTools Protocol');
    await gotoApp(page, { settings: { liftToFix } });
    const cdp = await page.context().newCDPSession(page);
    const fingers = await Promise.all([1, 2, 3, 4, 6].map(async (dot, i) => {
      const b = (await page.locator(`.key[data-dot="${dot}"]`).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: i + 1 };
    }));
    const touch = (type: 'touchStart' | 'touchCancel', touchPoints: typeof fingers) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

    // Five fingers down (dot 5 left for last), then the sixth: iOS sends nothing but a cancel
    for (let i = 1; i <= 5; i++) await touch('touchStart', fingers.slice(0, i));
    await expect(page.locator('.key.down')).toHaveCount(5);
    await touch('touchCancel', []);
    await expect(page.locator('.key.down')).toHaveCount(0);
    expect(await freeText(page)).toBe('é');

    // Six fingers landing together, as logged on her iPhone with ?debug: dots 2 and 3 reported
    // together, the other four never, and 36 ms later the cancel
    await touch('touchStart', [fingers[1], fingers[2]]);
    await expect(page.locator('.key.down')).toHaveCount(2);
    await touch('touchCancel', []);
    await expect(page.locator('.key.down')).toHaveCount(0);
    expect(await freeText(page)).toBe('éé');
    expect(await preview(page)).toEqual({ dots: '123456', label: 'é' });
  });
}

test('?debug lists the raw touch and pointer events, to see what the phone sends', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'multi-touch is sent through the Chrome DevTools Protocol');
  await page.goto('/?debug');
  const cdp = await page.context().newCDPSession(page);
  const b = (await page.locator('.key[data-dot="1"]').boundingBox())!;
  const one = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [one] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  const log = await page.locator('#debug-log').textContent();
  // Milliseconds from the first event; touch and pointer events come in the browser's own order
  expect(log).toMatch(/^ +0 /);
  for (const line of [/touchstart \[1\] on screen 1$/m, /down #\d+ dot 1 held 0$/m, /touchcancel \[1\] on screen 0$/m, /cancel #\d+ dot 1 held 1$/m]) {
    expect(log).toMatch(line);
  }
});

test('without ?debug, no event log', async ({ page }) => {
  await gotoApp(page);
  await chord(page, '1');
  await expect(page.locator('#debug-log')).toHaveCount(0);
});
