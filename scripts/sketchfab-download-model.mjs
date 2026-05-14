#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import AdmZip from 'adm-zip';

const MODEL_ID_PATTERN = /([0-9a-f]{32})/i;
const DEFAULT_OUTPUT_DIR = path.resolve('assets', 'models', 'sketchfab');
const DEFAULT_FORMAT = 'auto';
const FORMAT_ORDER = ['glb', 'gltf', 'usdz'];
const TOKEN_ENV_VARS = ['SKETCHFAB_ACCESS_TOKEN', 'SKETCHFAB_API_TOKEN', 'SKETCHFAB_TOKEN'];

function usage() {
  console.log('Usage: npm run sketchfab:download -- <sketchfab-model-url-or-id> [more...]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run sketchfab:download -- https://sketchfab.com/3d-models/classic-sonic-37c9d8f34fcc4740a50e8149931a3226');
  console.log('  npm run sketchfab:download -- 37c9d8f34fcc4740a50e8149931a3226 fa58f582a6f4425ba303c1b0cf3f34c8');
  console.log('');
  console.log('Options:');
  console.log('  --out <dir>   Output directory (default: assets/models/sketchfab)');
  console.log('  --format <f>  Preferred format: auto, glb, gltf, usdz, source');
  console.log('  --token <t>   Sketchfab OAuth access token');
  console.log('  --json        Print machine-readable output');
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

function readTokenFromEnv() {
  for (const key of TOKEN_ENV_VARS) {
    const token = String(process.env[key] ?? '').trim();
    if (token) return token;
  }

  return '';
}

function parseArgs(argv) {
  const inputs = [];
  let outDir = DEFAULT_OUTPUT_DIR;
  let json = false;
  let format = DEFAULT_FORMAT;
  let token = readTokenFromEnv();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      outDir = path.resolve(argv[++i] ?? DEFAULT_OUTPUT_DIR);
      continue;
    }
    if (arg === '--format') {
      format = String(argv[++i] ?? DEFAULT_FORMAT).toLowerCase();
      continue;
    }
    if (arg === '--token') {
      token = String(argv[++i] ?? '').trim();
      continue;
    }
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg.startsWith('-')) continue;
    inputs.push(arg);
  }

  return { inputs, outDir, json, format, token };
}

async function fetchModelRecord(modelId) {
  const response = await fetch(`https://sketchfab.com/i/models/${modelId}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sketchfab model record error for ${modelId}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
  }
  return response.json();
}

async function fetchDownloadInfo(modelId, token) {
  if (!token) return null;

  const response = await fetch(`https://api.sketchfab.com/v3/models/${modelId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Sketchfab download API rejected the configured token for ${modelId} (${response.status} ${response.statusText}). ` +
        `The download endpoint requires a valid Sketchfab user OAuth access token with permission to download the model.${text ? ` ${text}` : ''}`
      );
    }

    throw new Error(`Sketchfab download API error for ${modelId}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
  }

  return response.json();
}

function pickThumbnail(model) {
  const images = model?.thumbnails?.images ?? [];
  if (images.length === 0) return null;
  return [...images].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] ?? null;
}

function pickPublicDownloadUrl(model) {
  const files = model?.files ?? [];
  const first = files.find(file => file?.osgjsUrl);
  return first?.osgjsUrl ?? null;
}

function pickArchiveEntry(downloadInfo, preferredFormat) {
  if (!downloadInfo) return null;

  const requested = preferredFormat === 'auto' ? null : preferredFormat;
  const available = FORMAT_ORDER.filter(format => downloadInfo[format]?.url);

  if (requested) {
    const selected = downloadInfo[requested];
    if (selected?.url) {
      return { format: requested, url: selected.url, size: selected.size ?? null };
    }
    return null;
  }

  for (const format of FORMAT_ORDER) {
    const selected = downloadInfo[format];
    if (selected?.url) {
      return { format, url: selected.url, size: selected.size ?? null };
    }
  }

  return available.length > 0 ? { format: available[0], url: downloadInfo[available[0]].url, size: downloadInfo[available[0]].size ?? null } : null;
}

function describeTokenSource() {
  return TOKEN_ENV_VARS.find(key => String(process.env[key] ?? '').trim()) ?? null;
}

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed for ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, buffer);
  return buffer.length;
}

async function extractZipArchive(archivePath, targetDir) {
  const zip = new AdmZip(archivePath);
  zip.extractAllTo(targetDir, true);
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function summarize(model, options) {
  return {
    id: model.uid,
    name: model.name,
    slug: model.slug,
    animationCount: model.animationCount,
    isDownloadable: !!options.downloadUrl || !!options.downloadInfo,
    downloadStrategy: options.downloadStrategy,
    downloadFormat: options.downloadFormat,
    downloadUrl: options.downloadUrl,
    availableArchives: (model.archivesStatus ?? []).filter(entry => entry?.exists).map(entry => entry.type),
    thumbnailUrl: options.thumbnailUrl,
    license: model.license
      ? {
          label: model.license.label,
          fullName: model.license.fullName,
          slug: model.license.slug,
          requirements: model.license.requirements,
          url: model.license.url,
        }
      : null,
  };
}

function buildOutputBase(model, modelId, outDir) {
  const folderName = `${slugify(model.slug ?? model.name)}-${modelId}`;
  return path.join(outDir, folderName);
}

async function main() {
  const { inputs, outDir, json, format, token } = parseArgs(process.argv.slice(2));

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

    const model = await fetchModelRecord(modelId);
    const thumbnail = pickThumbnail(model);
    const downloadInfo = await fetchDownloadInfo(modelId, token).catch(error => {
      if (!token) return null;
      throw error;
    });
    const archiveEntry = pickArchiveEntry(downloadInfo, format);
    const downloadUrl = token ? null : pickPublicDownloadUrl(model);

    if (token && !archiveEntry?.url) {
      const tokenSource = describeTokenSource();
      throw new Error(
        `Sketchfab download API did not return a downloadable archive for ${modelId} using ${tokenSource ?? 'the configured token'}`
      );
    }

    const modelDir = buildOutputBase(model, modelId, outDir);
    await ensureDir(modelDir);

    const metadataPath = path.join(modelDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(summarize(model, {
      downloadInfo,
      downloadStrategy: archiveEntry ? 'official-download-api' : 'public-fallback',
      downloadFormat: archiveEntry?.format ?? 'source',
      downloadUrl,
      thumbnailUrl: thumbnail?.url ?? null,
    }), null, 2));

    let downloadPath = null;
    let downloadBytes = 0;
    let downloadFormat = 'source';

    if (archiveEntry?.url) {
      downloadFormat = archiveEntry.format;
      if (archiveEntry.format === 'gltf') {
        const archivePath = path.join(modelDir, 'model-gltf.zip');
        downloadBytes = await downloadFile(archiveEntry.url, archivePath);
        const extractedDir = path.join(modelDir, 'gltf');
        await ensureDir(extractedDir);
        await extractZipArchive(archivePath, extractedDir);
        downloadPath = extractedDir;
      } else {
        const extension = archiveEntry.format === 'glb' ? '.glb' : '.usdz';
        downloadPath = path.join(modelDir, `${slugify(model.slug ?? model.name)}${extension}`);
        downloadBytes = await downloadFile(archiveEntry.url, downloadPath);
      }
    } else if (downloadUrl) {
      downloadFormat = 'source';
      const parsed = new URL(downloadUrl);
      const fileName = path.basename(parsed.pathname) || 'model.source';
      downloadPath = path.join(modelDir, fileName);
      downloadBytes = await downloadFile(downloadUrl, downloadPath);
    }

    let thumbnailPath = null;
    if (thumbnail?.url) {
      const ext = path.extname(new URL(thumbnail.url).pathname) || '.jpg';
      thumbnailPath = path.join(modelDir, `thumbnail${ext}`);
      await downloadFile(thumbnail.url, thumbnailPath);
    }

    results.push({
      id: modelId,
      name: model.name,
      folder: modelDir,
      downloadPath,
      downloadBytes,
      thumbnailPath,
      animationCount: model.animationCount,
      license: model.license?.label ?? null,
      downloadFormat,
    });
  }

  if (json) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    return;
  }

  for (const result of results) {
    console.log(`Model: ${result.name}`);
    console.log(`Saved to: ${result.folder}`);
    console.log(`animationCount: ${result.animationCount}`);
    console.log(`license: ${result.license ?? 'unknown'}`);
    console.log(`model file: ${result.downloadPath ?? 'not available'}`);
    console.log(`thumbnail: ${result.thumbnailPath ?? 'not available'}`);
    console.log('');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
