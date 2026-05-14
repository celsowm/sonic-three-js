#!/usr/bin/env node

import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';

const OUTPUT_DIR = path.resolve('assets', 'models', 'elements', 'green-hill-environment');
const BLENDER_SCRIPT = path.resolve('scripts', 'generate-green-hill-environment.py');
const METADATA_PATH = path.join(OUTPUT_DIR, 'metadata.json');

const EXPECTED_ASSETS = [
  'green-hill-terrain-set.glb',
  'green-hill-loop.glb',
  'green-hill-props.glb',
  'green-hill-background.glb',
];

async function canRun(command, args = ['--version']) {
  const result = spawnSync(command, args, { stdio: 'ignore', shell: false });
  return result.status === 0 || result.error === undefined && result.signal === null;
}

async function findBlender() {
  if (await canRun('blender')) {
    return 'blender';
  }

  const blenderFoundationDir = 'C:\\Program Files\\Blender Foundation';
  try {
    const entries = await readdir(blenderFoundationDir, { withFileTypes: true });
    const installedVersions = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('Blender '))
      .map(entry => path.join(blenderFoundationDir, entry.name, 'blender.exe'))
      .sort()
      .reverse();

    for (const candidate of installedVersions) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Keep looking.
      }
    }
  } catch {
    // Fall back to static paths below.
  }

  const commonPaths = [
    'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
  ];

  for (const candidate of commonPaths) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  return null;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function installBlender() {
  if (await canRun('winget', ['--version'])) {
    try {
      await run('winget', [
        'install',
        'BlenderFoundation.Blender',
        '-e',
        '--accept-source-agreements',
        '--accept-package-agreements',
      ]);
      return;
    } catch (error) {
      console.warn(`winget install failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (await canRun('choco', ['--version'])) {
    await run('choco', ['install', 'blender', '-y']);
    return;
  }

  throw new Error('Blender is not installed and neither winget nor choco is available.');
}

async function assertGeneratedFiles() {
  for (const asset of EXPECTED_ASSETS) {
    await access(path.join(OUTPUT_DIR, asset), constants.R_OK);
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  let blender = await findBlender();
  if (!blender) {
    console.log('Blender not found. Installing Blender...');
    await installBlender();
    blender = await findBlender();
  }

  if (!blender) {
    throw new Error('Blender installation finished, but blender.exe was not found.');
  }

  await run(blender, ['--background', '--factory-startup', '--python', BLENDER_SCRIPT, '--', OUTPUT_DIR]);
  await assertGeneratedFiles();

  const metadata = JSON.parse(await readFile(METADATA_PATH, 'utf8'));
  metadata.generatedAt = new Date().toISOString();
  await writeFile(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(`Created Green Hill environment assets in ${path.relative(process.cwd(), OUTPUT_DIR)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
