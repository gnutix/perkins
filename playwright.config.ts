import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// The browsers come from the flake devshell (PLAYWRIGHT_BROWSERS_PATH), built for one Playwright
// release: the npm package must be that same release, or it looks for browser revisions that are
// not there. Say so plainly instead of Playwright's « run npx playwright install », which is the
// wrong advice here.
const driver = process.env.PLAYWRIGHT_DRIVER_VERSION;
const installed = JSON.parse(readFileSync(new URL('./node_modules/@playwright/test/package.json', import.meta.url), 'utf8')).version;
if (driver && driver !== installed) {
  throw new Error(`@playwright/test is ${installed} but the devshell browsers are for ${driver}: pin @playwright/test to ${driver} in package.json and run npm install.`);
}

const PORT = 8790;

// Her phone: an iPhone SE (2nd gen) held sideways, as a home-screen web app
const phone = {
  viewport: { width: 667, height: 375 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The laptop is shared: never more than 4 at once
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Each key press is a round trip to the browser (15 to 30 ms here), and some tests type a lot
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'fr-CH',
    timezoneId: 'Europe/Zurich',
    // Each test registers its own service worker only when it asks to (service-worker.spec.ts)
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Pure data checks on the script in index.html, no browser
    { name: 'data', testMatch: /data\.spec\.ts$/ },
    { name: 'chromium', testIgnore: /data\.spec\.ts$/, use: { browserName: 'chromium', ...phone } },
    { name: 'webkit', testIgnore: /data\.spec\.ts$/, use: { browserName: 'webkit', ...phone } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
