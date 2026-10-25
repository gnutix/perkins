import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { type AddressInfo } from 'node:net';
import { test, expect } from './app';

// The app's own files, served by a small server of the test's own so the page can change between
// launches, with the GitHub Pages cache header (10 minutes) and without the Google Fonts links
test.use({ serviceWorkers: 'allow', routeFonts: false });

test('one profile, three launches while the page changes: each shows the newest, and the last opens without the server', async ({ context, page }) => {
  let version = 'A';
  const file = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url));
  const index = () => file('index.html').toString()
    .replace(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g, '')
    .replace('<title>Six Points</title>', `<title>Six Points ${version}</title>`);
  const server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    const [body, type] = path === '/' || path === '/index.html' ? [index(), 'text/html; charset=utf-8']
      : path === '/sw.js' ? [file('sw.js'), 'text/javascript']
      : path === '/icon.svg' ? [file('icon.svg'), 'image/svg+xml']
      : path === '/apple-touch-icon.png' ? [file('apple-touch-icon.png'), 'image/png'] : [null, ''];
    if (body === null) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=600' }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const errors: string[] = [];
  const launch = async () => {
    const tab = await context.newPage();
    tab.on('pageerror', (e) => errors.push(String(e)));
    await tab.goto(url);
    return tab;
  };

  try {
    await page.close();
    let tab = await launch();
    await expect(tab).toHaveTitle('Six Points A');
    await tab.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await tab.close();

    version = 'B';
    tab = await launch();
    await expect(tab).toHaveTitle('Six Points B');
    expect(await tab.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await tab.close();

    version = 'C';
    tab = await launch();
    await expect(tab).toHaveTitle('Six Points C');
    await tab.close();

    // The server gone (no network): the last copy still opens
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    tab = await launch();
    await expect(tab).toHaveTitle('Six Points C');
    await expect(tab.locator('#machine')).toBeVisible();
    await expect(tab.locator('#tab-free')).toHaveAttribute('aria-selected', 'true');
  } finally {
    server.closeAllConnections();
    server.close();
  }
  expect(errors).toEqual([]);
});
