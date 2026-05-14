#!/usr/bin/env node

const MODEL_ID_PATTERN = /([0-9a-f]{32})/i;

function usage() {
  console.log('Usage: npm run sketchfab:info -- <sketchfab-model-url-or-id> [more...]');
  console.log('');
  console.log('Examples:');
  console.log('  npm run sketchfab:info -- https://sketchfab.com/3d-models/classic-sonic-37c9d8f34fcc4740a50e8149931a3226');
  console.log('  npm run sketchfab:info -- 37c9d8f34fcc4740a50e8149931a3226');
}

function extractModelId(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;

  if (MODEL_ID_PATTERN.test(trimmed)) {
    return trimmed.match(MODEL_ID_PATTERN)?.[1] ?? null;
  }

  return null;
}

function parseArgs(argv) {
  const inputs = argv.filter(arg => !arg.startsWith('-'));
  return {
    inputs,
    json: argv.includes('--json'),
  };
}

async function fetchModelInfo(modelId) {
  const response = await fetch(`https://api.sketchfab.com/v3/models/${modelId}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sketchfab API error for ${modelId}: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
  }

  return response.json();
}

function formatOutput(model) {
  return {
    id: model.uid,
    name: model.name,
    animationCount: model.animationCount,
    isDownloadable: model.isDownloadable,
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

async function main() {
  const { inputs, json } = parseArgs(process.argv.slice(2));

  if (inputs.length === 0) {
    usage();
    process.exitCode = 1;
    return;
  }

  const modelIds = inputs
    .map(extractModelId)
    .filter(Boolean);

  if (modelIds.length === 0) {
    console.error('No valid Sketchfab model ID found in the provided input.');
    process.exitCode = 1;
    return;
  }

  const results = [];

  for (const modelId of modelIds) {
    const model = await fetchModelInfo(modelId);
    results.push(formatOutput(model));
  }

  if (json) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    return;
  }

  for (const result of results) {
    console.log(`Model: ${result.name}`);
    console.log(`ID: ${result.id}`);
    console.log(`animationCount: ${result.animationCount}`);
    console.log(`isDownloadable: ${result.isDownloadable}`);
    console.log(`license: ${result.license?.label ?? 'unknown'}`);
    if (result.license?.requirements) {
      console.log(`requirements: ${result.license.requirements}`);
    }
    if (result.license?.url) {
      console.log(`licenseUrl: ${result.license.url}`);
    }
    console.log('');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
