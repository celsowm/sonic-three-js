#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const MODEL_ID_PATTERN = /([0-9a-f]{32})/i;
const DEFAULT_OUTPUT_DIR = path.resolve('assets', 'models', 'sketchfab');
const DEFAULT_PROFILE_DIR = path.resolve('.playwright', 'sketchfab-profile');
const DEFAULT_EDGE_PROFILE_DIR = path.resolve('.playwright', 'sketchfab-edge-profile');

function usage() {
  console.log('Usage: npm run sketchfab:download:browser -- <sketchfab-model-url-or-id> [more...]');
  console.log('');
  console.log('Options:');
  console.log('  --out <dir>       Output directory (default: assets/models/sketchfab)');
  console.log('  --profile <dir>   Persistent Playwright browser profile');
  console.log('  --edge            Launch Microsoft Edge instead of Playwright Chromium');
  console.log('  --browser-path    Browser executable path');
}

function defaultEdgePath() {
  const candidates = [
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe') : null,
  ].filter(Boolean);

  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

function extractModelId(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  return trimmed.match(MODEL_ID_PATTERN)?.[1] ?? null;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'model';
}

function parseArgs(argv) {
  const inputs = [];
  let outDir = DEFAULT_OUTPUT_DIR;
  let profileDir = DEFAULT_PROFILE_DIR;
  let browserPath = '';
  let useEdge = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      outDir = path.resolve(argv[++i] ?? DEFAULT_OUTPUT_DIR);
      continue;
    }
    if (arg === '--profile') {
      profileDir = path.resolve(argv[++i] ?? DEFAULT_PROFILE_DIR);
      continue;
    }
    if (arg === '--browser-path') {
      browserPath = path.resolve(argv[++i] ?? '');
      continue;
    }
    if (arg === '--edge') {
      useEdge = true;
      profileDir = DEFAULT_EDGE_PROFILE_DIR;
      browserPath = defaultEdgePath() ?? '';
      continue;
    }
    if (arg.startsWith('-')) continue;
    inputs.push(arg);
  }

  return { inputs, outDir, profileDir, browserPath };
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function fetchModelInfo(modelId) {
  const response = await fetch(`https://api.sketchfab.com/v3/models/${modelId}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sketchfab model API error for ${modelId}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
  }

  return response.json();
}

function modelPageUrl(modelId, fallbackInput) {
  if (/^https?:\/\//i.test(String(fallbackInput))) return String(fallbackInput);
  return `https://sketchfab.com/3d-models/${modelId}`;
}

async function dismissCookieBanner(page) {
  for (const name of [/Reject All/i, /Confirm My Choices/i, /Allow All/i, /Close/i]) {
    const button = page.getByRole('button', { name });
    if (await button.count().catch(() => 0)) {
      await button.first().click({ timeout: 2500 }).catch(() => {});
      return;
    }
  }
}

async function waitForUserDownload(page, outputPath) {
  console.log(`Use the opened browser to log in if needed and download this model.`);
  console.log(`Waiting for the browser download event...`);

  while (true) {
    if (page.isClosed()) {
      throw new Error('Browser page was closed before a download started.');
    }

    const download = await page.waitForEvent('download', { timeout: 300000 }).catch(() => null);

    if (download) {
      await download.saveAs(outputPath);
      return {
        suggestedFilename: download.suggestedFilename(),
        path: outputPath,
      };
    }

    if (page.isClosed()) {
      throw new Error('Browser page was closed before a download started.');
    }

    await page.bringToFront();
    await page.getByRole('button', { name: /Download 3D Model/i }).click({ timeout: 10000 }).catch(() => {});
  }
}

async function main() {
  const { inputs, outDir, profileDir, browserPath } = parseArgs(process.argv.slice(2));

  if (inputs.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  await ensureDir(outDir);
  await ensureDir(profileDir);

  const context = await chromium.launchPersistentContext(profileDir, {
    acceptDownloads: true,
    executablePath: browserPath || undefined,
    headless: false,
  });
  const page = context.pages()[0] ?? await context.newPage();
  const results = [];

  try {
    for (const input of inputs) {
      const modelId = extractModelId(input);
      if (!modelId) {
        throw new Error(`No valid Sketchfab model ID found in "${input}"`);
      }

      const model = await fetchModelInfo(modelId);
      const modelDir = path.join(outDir, `${slugify(model.slug ?? model.name)}-${modelId}`);
      await ensureDir(modelDir);

      const targetPath = path.join(modelDir, `${slugify(model.slug ?? model.name)}-browser-download.zip`);
      await page.goto(modelPageUrl(modelId, input), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissCookieBanner(page);
      await page.getByRole('button', { name: /Download 3D Model/i }).click({ timeout: 30000 }).catch(() => {});

      const download = await waitForUserDownload(page, targetPath);
      const metadataPath = path.join(modelDir, 'browser-download.json');
      await writeFile(metadataPath, JSON.stringify({
        id: modelId,
        name: model.name,
        sourceUrl: page.url(),
        downloadedAt: new Date().toISOString(),
        suggestedFilename: download.suggestedFilename,
        downloadPath: download.path,
      }, null, 2));

      results.push({
        id: modelId,
        name: model.name,
        downloadPath: download.path,
        metadataPath,
      });
    }
  } finally {
    await context.close();
  }

  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
