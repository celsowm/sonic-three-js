#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const MODEL_ID_PATTERN = /([0-9a-f]{32})/i;
const DEFAULT_OUTPUT_DIR = path.resolve('assets', 'models', 'sketchfab');
const DEFAULT_DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');
const DOWNLOAD_EXTENSIONS = new Set(['.zip', '.glb', '.gltf', '.usdz', '.fbx', '.obj', '.blend', '.rar', '.7z']);
const PARTIAL_EXTENSIONS = new Set(['.crdownload', '.tmp', '.download']);

function usage() {
  console.log('Usage: npm run sketchfab:download:manual -- <sketchfab-model-url-or-id> [more...]');
  console.log('');
  console.log('Options:');
  console.log('  --out <dir>        Output directory (default: assets/models/sketchfab)');
  console.log('  --downloads <dir>  Downloads directory to watch (default: ~/Downloads)');
  console.log('  --timeout <sec>    Wait time per model (default: 900)');
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
  let downloadsDir = DEFAULT_DOWNLOADS_DIR;
  let timeoutMs = 15 * 60 * 1000;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      outDir = path.resolve(argv[++i] ?? DEFAULT_OUTPUT_DIR);
      continue;
    }
    if (arg === '--downloads') {
      downloadsDir = path.resolve(argv[++i] ?? DEFAULT_DOWNLOADS_DIR);
      continue;
    }
    if (arg === '--timeout') {
      timeoutMs = Number(argv[++i] ?? 900) * 1000;
      continue;
    }
    if (arg.startsWith('-')) continue;
    inputs.push(arg);
  }

  return { inputs, outDir, downloadsDir, timeoutMs };
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
  return `https://sketchfab.com/3d-models/${modelId}#download`;
}

function openInDefaultBrowser(url) {
  if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '', url], { windowsHide: true });
    return;
  }

  if (process.platform === 'darwin') {
    execFile('open', [url]);
    return;
  }

  execFile('xdg-open', [url]);
}

async function snapshotDownloads(downloadsDir) {
  const entries = await readdir(downloadsDir, { withFileTypes: true });
  const files = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = path.join(downloadsDir, entry.name);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat) continue;

    files.set(filePath, {
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
    });
  }

  return files;
}

function isCompletedDownload(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (PARTIAL_EXTENSIONS.has(ext)) return false;
  return DOWNLOAD_EXTENSIONS.has(ext);
}

async function waitForNewDownload(downloadsDir, before, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let candidate = null;
  let stableCount = 0;
  let lastSize = -1;

  while (Date.now() < deadline) {
    const current = await snapshotDownloads(downloadsDir);
    const newFiles = [...current.entries()]
      .filter(([filePath, file]) => !before.has(filePath) && isCompletedDownload(filePath) && file.size > 0)
      .sort((a, b) => b[1].mtimeMs - a[1].mtimeMs);

    if (newFiles.length > 0) {
      const [filePath, file] = newFiles[0];
      if (candidate === filePath && file.size === lastSize) {
        stableCount += 1;
      } else {
        candidate = filePath;
        stableCount = 0;
        lastSize = file.size;
      }

      if (stableCount >= 2) {
        return filePath;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for a new download in ${downloadsDir}`);
}

async function moveDownloadedFile(sourcePath, modelDir, model) {
  const originalExt = path.extname(sourcePath);
  const destination = path.join(modelDir, `${slugify(model.slug ?? model.name)}-manual-download${originalExt}`);

  if (existsSync(destination)) {
    const parsed = path.parse(destination);
    const timestamped = path.join(parsed.dir, `${parsed.name}-${Date.now()}${parsed.ext}`);
    await rename(sourcePath, timestamped);
    return timestamped;
  }

  await rename(sourcePath, destination);
  return destination;
}

async function main() {
  const { inputs, outDir, downloadsDir, timeoutMs } = parseArgs(process.argv.slice(2));

  if (inputs.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  await ensureDir(outDir);

  const results = [];

  for (const input of inputs) {
    const modelId = extractModelId(input);
    if (!modelId) {
      throw new Error(`No valid Sketchfab model ID found in "${input}"`);
    }

    const model = await fetchModelInfo(modelId);
    const modelDir = path.join(outDir, `${slugify(model.slug ?? model.name)}-${modelId}`);
    await ensureDir(modelDir);

    const before = await snapshotDownloads(downloadsDir);
    const url = modelPageUrl(modelId, input);

    console.log(`Opening ${model.name}`);
    console.log(`Download it in your regular browser. Watching ${downloadsDir}`);
    openInDefaultBrowser(url);

    const downloadedPath = await waitForNewDownload(downloadsDir, before, timeoutMs);
    const movedPath = await moveDownloadedFile(downloadedPath, modelDir, model);
    const metadataPath = path.join(modelDir, 'manual-download.json');

    await writeFile(metadataPath, JSON.stringify({
      id: modelId,
      name: model.name,
      sourceUrl: url,
      downloadedAt: new Date().toISOString(),
      originalDownloadPath: downloadedPath,
      downloadPath: movedPath,
    }, null, 2));

    results.push({
      id: modelId,
      name: model.name,
      downloadPath: movedPath,
      metadataPath,
    });
  }

  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
