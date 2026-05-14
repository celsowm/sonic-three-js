#!/usr/bin/env node

import AdmZip from 'adm-zip';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ZIP_NAME = 'GameCube - Sonic Adventure 2_ Battle - Objects - Palm Tree (Green Hill).zip';
const ZIP_PATH = path.join(os.homedir(), 'Downloads', ZIP_NAME);
const OUTPUT_DIR = path.resolve('assets', 'models', 'elements', 'green-hill-palm-tree');
const SOURCE_DIR = path.join(OUTPUT_DIR, 'source');
const SOURCE_SUBDIR = path.join(SOURCE_DIR, 'Green Hill Palm Tree');
const OBJ_PATH = path.join(SOURCE_SUBDIR, 'yasi.obj');
const MTL_PATH = path.join(SOURCE_SUBDIR, 'yasi.mtl');
const TEXTURE_PATH = path.join(SOURCE_SUBDIR, 'hill_obj.png');
const OUTPUT_GLB = path.join(OUTPUT_DIR, 'green-hill-palm-tree.glb');
const OUTPUT_METADATA = path.join(OUTPUT_DIR, 'metadata.json');

function align4(value) {
  return (value + 3) & ~3;
}

function paddedBuffer(buffer, pad = 0) {
  const output = Buffer.alloc(align4(buffer.length), pad);
  buffer.copy(output);
  return output;
}

function parseMtl(source) {
  const materials = new Map();
  let current = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [keyword, ...values] = line.split(/\s+/);
    if (keyword === 'newmtl') {
      current = { name: values.join(' '), texture: null, color: [0.8, 0.8, 0.8, 1] };
      materials.set(current.name, current);
    } else if (keyword === 'map_Kd' && current) {
      current.texture = values.join(' ');
    } else if (keyword === 'Kd' && current) {
      current.color = values.slice(0, 3).map(Number).concat(1);
    }
  }

  return materials;
}

function parseObj(source) {
  const positions = [[0, 0, 0]];
  const uvs = [[0, 0]];
  const normals = [[0, 0, 1]];
  const primitives = new Map();
  let currentMaterial = 'default';

  const primitiveFor = material => {
    if (!primitives.has(material)) {
      primitives.set(material, {
        material,
        vertexMap: new Map(),
        positions: [],
        uvs: [],
        normals: [],
        indices: [],
      });
    }
    return primitives.get(material);
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const [keyword, ...values] = line.split(/\s+/);
    if (keyword === 'v') {
      positions.push(values.slice(0, 3).map(Number));
    } else if (keyword === 'vt') {
      const [u, v] = values.slice(0, 2).map(Number);
      uvs.push([u, 1 - v]);
    } else if (keyword === 'vn') {
      normals.push(values.slice(0, 3).map(Number));
    } else if (keyword === 'usemtl') {
      currentMaterial = values.join(' ');
    } else if (keyword === 'f') {
      const primitive = primitiveFor(currentMaterial);
      const face = values.map(token => {
        if (!primitive.vertexMap.has(token)) {
          const [positionIndex, uvIndex, normalIndex] = token.split('/').map(value => Number(value || 0));
          primitive.vertexMap.set(token, primitive.positions.length / 3);
          primitive.positions.push(...positions[positionIndex]);
          primitive.uvs.push(...(uvs[uvIndex] ?? [0, 0]));
          primitive.normals.push(...(normals[normalIndex] ?? [0, 0, 1]));
        }
        return primitive.vertexMap.get(token);
      });

      for (let index = 1; index < face.length - 1; index++) {
        primitive.indices.push(face[0], face[index], face[index + 1]);
      }
    }
  }

  return [...primitives.values()];
}

function componentBounds(values, componentCount) {
  const min = Array(componentCount).fill(Infinity);
  const max = Array(componentCount).fill(-Infinity);

  for (let index = 0; index < values.length; index += componentCount) {
    for (let component = 0; component < componentCount; component++) {
      const value = values[index + component];
      min[component] = Math.min(min[component], value);
      max[component] = Math.max(max[component], value);
    }
  }

  return { min, max };
}

function createGlb(primitives, materials, textureBuffer) {
  const buffers = [];
  const bufferViews = [];
  const accessors = [];
  const gltfMaterials = [];
  const gltfPrimitives = [];
  let byteOffset = 0;

  const pushBufferView = (buffer, target) => {
    const view = { buffer: 0, byteOffset, byteLength: buffer.length };
    if (target) view.target = target;
    bufferViews.push(view);
    buffers.push(buffer);
    byteOffset += buffer.length;
    return bufferViews.length - 1;
  };

  const pushAccessor = (array, componentType, type, target, minMax = null) => {
    const buffer = paddedBuffer(Buffer.from(array.buffer));
    const bufferView = pushBufferView(buffer, target);
    const accessor = {
      bufferView,
      byteOffset: 0,
      componentType,
      count: array.length / (type === 'SCALAR' ? 1 : type === 'VEC2' ? 2 : 3),
      type,
    };
    if (minMax) {
      accessor.min = minMax.min;
      accessor.max = minMax.max;
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };

  const textureView = pushBufferView(paddedBuffer(textureBuffer), null);

  for (const material of materials.values()) {
    gltfMaterials.push({
      name: material.name,
      pbrMetallicRoughness: {
        baseColorFactor: material.color,
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      doubleSided: true,
    });
  }

  const materialIndexes = new Map([...materials.keys()].map((name, index) => [name, index]));

  for (const primitive of primitives) {
    const positionArray = new Float32Array(primitive.positions);
    const uvArray = new Float32Array(primitive.uvs);
    const normalArray = new Float32Array(primitive.normals);
    const indexArray = new Uint32Array(primitive.indices);

    gltfPrimitives.push({
      attributes: {
        POSITION: pushAccessor(positionArray, 5126, 'VEC3', 34962, componentBounds(primitive.positions, 3)),
        NORMAL: pushAccessor(normalArray, 5126, 'VEC3', 34962),
        TEXCOORD_0: pushAccessor(uvArray, 5126, 'VEC2', 34962),
      },
      indices: pushAccessor(indexArray, 5125, 'SCALAR', 34963),
      material: materialIndexes.get(primitive.material) ?? 0,
    });
  }

  const binary = Buffer.concat(buffers);
  const json = {
    asset: { version: '2.0', generator: 'sonic-three-js create-green-hill-palm-tree-asset' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Green Hill Palm Tree', mesh: 0 }],
    meshes: [{ name: 'Green Hill Palm Tree', primitives: gltfPrimitives }],
    materials: gltfMaterials,
    textures: [{ source: 0 }],
    images: [{ name: 'hill_obj.png', mimeType: 'image/png', bufferView: textureView }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 10497, wrapT: 10497 }],
    bufferViews,
    accessors,
    buffers: [{ byteLength: binary.length }],
  };

  for (const texture of json.textures) {
    texture.sampler = 0;
  }

  const jsonBuffer = paddedBuffer(Buffer.from(JSON.stringify(json)), 0x20);
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonBuffer, binaryHeader, binary]);
}

async function main() {
  if (!existsSync(ZIP_PATH)) {
    throw new Error(`Palm tree ZIP not found at ${ZIP_PATH}`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await rm(SOURCE_DIR, { recursive: true, force: true });
  await mkdir(SOURCE_DIR, { recursive: true });

  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(SOURCE_DIR, true);

  const [objSource, mtlSource, textureBuffer] = await Promise.all([
    readFile(OBJ_PATH, 'utf8'),
    readFile(MTL_PATH, 'utf8'),
    readFile(TEXTURE_PATH),
  ]);

  const materials = parseMtl(mtlSource);
  const primitives = parseObj(objSource);
  const glb = createGlb(primitives, materials, textureBuffer);

  await writeFile(OUTPUT_GLB, glb);
  await writeFile(OUTPUT_METADATA, JSON.stringify({
    name: 'Green Hill Palm Tree',
    sourceArchive: ZIP_PATH,
    sourceFiles: [
      path.relative(process.cwd(), OBJ_PATH).replaceAll(path.sep, '/'),
      path.relative(process.cwd(), MTL_PATH).replaceAll(path.sep, '/'),
      path.relative(process.cwd(), TEXTURE_PATH).replaceAll(path.sep, '/'),
    ],
    outputPath: path.relative(process.cwd(), OUTPUT_GLB).replaceAll(path.sep, '/'),
    runtimeFormat: 'glb',
    orientation: 'Original OBJ coordinates; Y is up.',
    recommendedExampleScale: 0.35,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  console.log(`Created ${path.relative(process.cwd(), OUTPUT_GLB)}`);
  console.log(`Created ${path.relative(process.cwd(), OUTPUT_METADATA)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
