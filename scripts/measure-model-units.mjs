#!/usr/bin/env node

import { NodeIO } from '@gltf-transform/core';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_DECIMALS = 3;

function usage() {
  console.log(`Usage:
  npm run assets:measure -- <model.glb> [--scale <number>] [--json]

Examples:
  npm run assets:measure -- assets/models/elements/green-hill-palm-tree/green-hill-palm-tree.glb
  npm run assets:measure -- assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb --scale 8
`);
}

function parseArgs(argv) {
  const options = {
    filePath: null,
    scale: 1,
    json: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--scale') {
      const value = Number(argv[++index]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--scale must be a positive number.');
      }
      options.scale = value;
    } else if (!options.filePath) {
      options.filePath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function multiplyMatrix(a, b) {
  const output = Array(16).fill(0);

  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let index = 0; index < 4; index++) {
        output[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
      }
    }
  }

  return output;
}

function composeMatrix(node) {
  const [x, y, z, w] = node.getRotation();
  const [sx, sy, sz] = node.getScale();
  const [tx, ty, tz] = node.getTranslation();
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(matrix, point) {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ];
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
    vertexCount: 0,
  };
}

function includePoint(bounds, point) {
  for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis], point[axis]);
    bounds.max[axis] = Math.max(bounds.max[axis], point[axis]);
  }
  bounds.vertexCount++;
}

function visitNode(node, parentMatrix, sceneBounds, meshBounds) {
  const matrix = parentMatrix
    ? multiplyMatrix(parentMatrix, composeMatrix(node))
    : composeMatrix(node);
  const mesh = node.getMesh();

  if (mesh) {
    const currentMeshBounds = meshBounds.get(mesh.getName()) ?? emptyBounds();

    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;

      const vertex = [];
      for (let index = 0; index < position.getCount(); index++) {
        const point = transformPoint(matrix, position.getElement(index, vertex));
        includePoint(sceneBounds, point);
        includePoint(currentMeshBounds, point);
      }
    }

    meshBounds.set(mesh.getName(), currentMeshBounds);
  }

  for (const child of node.listChildren()) {
    visitNode(child, matrix, sceneBounds, meshBounds);
  }
}

function finalizeBounds(bounds, scale) {
  const min = bounds.min.map(value => value * scale);
  const max = bounds.max.map(value => value * scale);
  const size = max.map((value, axis) => value - min[axis]);
  const center = min.map((value, axis) => (value + max[axis]) / 2);

  return {
    min,
    max,
    size,
    center,
    vertexCount: bounds.vertexCount,
  };
}

function round(value, decimals = DEFAULT_DECIMALS) {
  return Number(value.toFixed(decimals));
}

function roundedBounds(bounds) {
  return {
    min: bounds.min.map(value => round(value)),
    max: bounds.max.map(value => round(value)),
    size: bounds.size.map(value => round(value)),
    center: bounds.center.map(value => round(value)),
    vertexCount: bounds.vertexCount,
  };
}

async function measureGlb(filePath, scale) {
  const document = await new NodeIO().read(filePath);
  const root = document.getRoot();
  const sceneBounds = emptyBounds();
  const meshBounds = new Map();

  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) {
      visitNode(child, null, sceneBounds, meshBounds);
    }
  }

  if (sceneBounds.vertexCount === 0) {
    throw new Error(`No POSITION vertices found in ${filePath}`);
  }

  return {
    file: path.relative(process.cwd(), filePath).replaceAll(path.sep, '/'),
    scale,
    unitBounds: roundedBounds(finalizeBounds(sceneBounds, 1)),
    scaledBounds: roundedBounds(finalizeBounds(sceneBounds, scale)),
    meshes: [...meshBounds.entries()].map(([name, bounds]) => ({
      name,
      ...roundedBounds(finalizeBounds(bounds, scale)),
    })),
  };
}

function printReport(report) {
  console.log(`Model: ${report.file}`);
  console.log(`Scale: ${report.scale}`);
  console.log('');
  console.log('Raw units:');
  console.log(`  size   x=${report.unitBounds.size[0]} y=${report.unitBounds.size[1]} z=${report.unitBounds.size[2]}`);
  console.log(`  min    x=${report.unitBounds.min[0]} y=${report.unitBounds.min[1]} z=${report.unitBounds.min[2]}`);
  console.log(`  max    x=${report.unitBounds.max[0]} y=${report.unitBounds.max[1]} z=${report.unitBounds.max[2]}`);
  console.log(`  center x=${report.unitBounds.center[0]} y=${report.unitBounds.center[1]} z=${report.unitBounds.center[2]}`);
  console.log('');
  console.log('Scaled game units:');
  console.log(`  size   x=${report.scaledBounds.size[0]} y=${report.scaledBounds.size[1]} z=${report.scaledBounds.size[2]}`);
  console.log(`  min    x=${report.scaledBounds.min[0]} y=${report.scaledBounds.min[1]} z=${report.scaledBounds.min[2]}`);
  console.log(`  max    x=${report.scaledBounds.max[0]} y=${report.scaledBounds.max[1]} z=${report.scaledBounds.max[2]}`);
  console.log(`  center x=${report.scaledBounds.center[0]} y=${report.scaledBounds.center[1]} z=${report.scaledBounds.center[2]}`);
  console.log('');
  console.log(`Meshes: ${report.meshes.length}`);
  for (const mesh of report.meshes) {
    console.log(`  ${mesh.name || '(unnamed)'}: size x=${mesh.size[0]} y=${mesh.size[1]} z=${mesh.size[2]}, vertices=${mesh.vertexCount}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  if (!options.filePath) {
    usage();
    throw new Error('Missing model path.');
  }

  const filePath = path.resolve(options.filePath);
  await stat(filePath);

  if (path.extname(filePath).toLowerCase() !== '.glb') {
    throw new Error('Only .glb files are supported right now.');
  }

  const report = await measureGlb(filePath, options.scale);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printReport(report);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
