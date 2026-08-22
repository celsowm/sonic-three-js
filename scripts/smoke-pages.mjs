#!/usr/bin/env node
/**
 * Smoke test for the built demo pages.
 * Serves `dist-pages/` (or any base URL via SMOKE_URL) with Playwright and
 * asserts the demos load without failed asset requests or console errors.
 *
 * Usage:
 *   node scripts/smoke-pages.mjs                        # local vite preview
 *   SMOKE_URL=https://celsowm.github.io/sonic-three-js/ node scripts/smoke-pages.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const BASE_URL = process.env.SMOKE_URL ?? 'http://localhost:4173/sonic-three-js/';
// Pages that must render a live WebGL canvas.
const CANVAS_PAGES = new Set(['examples/green-hill.html', 'examples/physics-sandbox.html']);
const PAGES = ['examples/index.html', ...CANVAS_PAGES];

const startPreview = () => new Promise((resolve, reject) => {
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  const ready = data => {
    if (String(data).includes('Local:')) resolve(server);
  };
  server.stdout.on('data', ready);
  server.stderr.on('data', ready);
  server.on('error', reject);
  setTimeout(() => reject(new Error('vite preview did not start in 30s')), 30000);
});

const isUsingLocalPreview = !process.env.SMOKE_URL;
const server = isUsingLocalPreview ? await startPreview() : null;

let failed = false;
try {
  const browser = await chromium.launch();
  for (const pagePath of PAGES) {
    const url = new URL(pagePath, BASE_URL).href;
    const page = await browser.newPage();
    const failures = [];
    const consoleErrors = [];
    page.on('response', response => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(String(error)));

    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    // Give async GLB/texture loads time to settle on the demo pages.
    await page.waitForTimeout(8000);

    if (CANVAS_PAGES.has(pagePath)) {
      const hasCanvas = await page.locator('#game-container canvas').count() > 0;
      if (!hasCanvas) {
        failures.push(`no canvas rendered on ${url}`);
      }
    }
    if (failures.length > 0 || consoleErrors.length > 0) {
      failed = true;
      console.error(`FAIL ${url}`);
      for (const line of [...failures, ...consoleErrors]) console.error(`  ${line}`);
    } else {
      console.log(`PASS ${url}`);
    }
    await page.close();
  }
  await browser.close();
} finally {
  if (server) server.kill();
}
if (failed) {
  console.error('Smoke test FAILED');
  process.exit(1);
}
console.log('Smoke test PASSED');
