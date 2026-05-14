import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Mesh, type Node } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';

const ORIGINAL_GLB = 'assets/models/sketchfab/animations-classic-sonic-sonic-runners-fa58f582a6f4425ba303c1b0cf3f34c8/animations-classic-sonic-sonic-runners-manual-download.glb';
const DERIVED_GLB = 'assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb';

function readGlbAnimationNames(filePath: string): string[] {
  const buffer = readFileSync(filePath);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));

  return (json.animations ?? []).map((animation: { name?: string }) => animation.name ?? '');
}

function multiplyMatrix(a: number[], b: number[]): number[] {
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

function composeMatrix(node: Node): number[] {
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

function transformPoint(matrix: number[], point: number[]): number[] {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ];
}

function meshCenter(mesh: Mesh, matrix: number[]): number[] {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const vertex: number[] = [];

  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION');
    if (!position) continue;

    for (let index = 0; index < position.getCount(); index++) {
      const point = transformPoint(matrix, position.getElement(index, vertex));
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
    }
  }

  return min.map((value, axis) => (value + max[axis]) / 2);
}

function collectMeshCenters(node: Node, parentMatrix: number[] | null, centers = new Map<string, number[]>()) {
  const matrix = parentMatrix
    ? multiplyMatrix(parentMatrix, composeMatrix(node))
    : composeMatrix(node);
  const mesh = node.getMesh();

  if (mesh) {
    centers.set(mesh.getName(), meshCenter(mesh, matrix));
  }

  for (const child of node.listChildren()) {
    collectMeshCenters(child, matrix, centers);
  }

  return centers;
}

describe('Classic Sonic Runners asset', () => {
  it('creates a derived GLB with idle while preserving the downloaded original', () => {
    const originalAnimations = readGlbAnimationNames(ORIGINAL_GLB);
    const derivedAnimations = readGlbAnimationNames(DERIVED_GLB);

    expect(statSync(ORIGINAL_GLB).size).toBeGreaterThan(0);
    expect(statSync(DERIVED_GLB).size).toBeGreaterThan(0);
    expect(originalAnimations).not.toContain('idle');
    expect(derivedAnimations).toContain('idle');

    for (const animation of originalAnimations) {
      expect(derivedAnimations).toContain(animation);
    }
  });

  it('orients Sonic to face +X for side-scroller movement', async () => {
    const document = await new NodeIO().read(DERIVED_GLB);
    const centers = new Map<string, number[]>();

    for (const scene of document.getRoot().listScenes()) {
      for (const child of scene.listChildren()) {
        collectMeshCenters(child, null, centers);
      }
    }

    const body = centers.get('Mesh_Body_0_chr_classicsonic_body_0');
    const mouth = centers.get('Mesh_Body_1_chr_classicsonic_mouth_0');
    const eyes = centers.get('Mesh_Body_2_chr_classicsonic_eye_0');

    expect(body).toBeDefined();
    expect(mouth).toBeDefined();
    expect(eyes).toBeDefined();
    expect(mouth![0]).toBeGreaterThan(body![0]);
    expect(eyes![0]).toBeGreaterThan(body![0]);
  });

  it('uses a hand-authored idle instead of the crouched landing frame', async () => {
    const document = await new NodeIO().read(DERIVED_GLB);
    const root = document.getRoot();
    const hips = root.listNodes().find(node => node.getName() === 'Hips_05');
    const idle = root.listAnimations().find(animation => animation.getName() === 'idle');
    const hipsTranslationChannel = idle?.listChannels().find(channel => (
      channel.getTargetNode()?.getName() === 'Hips_05' &&
      channel.getTargetPath() === 'translation'
    ));
    const output = hipsTranslationChannel?.getSampler()?.getOutput();
    const firstFrame = output?.getElement(0, []);
    const breathingFrame = output?.getElement(1, []);

    expect(hips).toBeDefined();
    expect(idle).toBeDefined();
    expect(idle!.listChannels().length).toBe(42);
    expect(firstFrame).toEqual(hips!.getTranslation());
    expect(firstFrame![1]).toBeGreaterThan(0.29);
    expect(breathingFrame![1]).toBeGreaterThan(firstFrame![1]);
  });

  it('closes Sonic hands in the hand-authored idle', async () => {
    const document = await new NodeIO().read(DERIVED_GLB);
    const idle = document.getRoot().listAnimations().find(animation => animation.getName() === 'idle');
    const leftMiddleFinger = idle?.listChannels().find(channel => (
      channel.getTargetNode()?.getName() === 'Middle1_L_025' &&
      channel.getTargetPath() === 'rotation'
    ));
    const rightMiddleFinger = idle?.listChannels().find(channel => (
      channel.getTargetNode()?.getName() === 'Middle1_R_040' &&
      channel.getTargetPath() === 'rotation'
    ));
    const leftFingerFrame = leftMiddleFinger?.getSampler()?.getOutput()?.getElement(0, []);
    const rightFingerFrame = rightMiddleFinger?.getSampler()?.getOutput()?.getElement(0, []);

    expect(leftFingerFrame).toBeDefined();
    expect(rightFingerFrame).toBeDefined();
    expect(leftFingerFrame![2]).toBeGreaterThan(0.6);
    expect(rightFingerFrame![2]).toBeGreaterThan(0.6);
  });

  it('uses a blended lowered arm pose instead of a raised fist pose', async () => {
    const document = await new NodeIO().read(DERIVED_GLB);
    const root = document.getRoot();
    const idle = root.listAnimations().find(animation => animation.getName() === 'idle');
    const backArmSource = root.listAnimations().find(animation => animation.getName() === 'sc_dashring_loop');
    const forwardArmSource = root.listAnimations().find(animation => animation.getName() === 'sc_landing.ma');
    const upperArmChannel = idle?.listChannels().find(channel => (
      channel.getTargetNode()?.getName() === 'UpperArm_L_020' &&
      channel.getTargetPath() === 'rotation'
    ));
    const backUpperArmChannel = backArmSource?.listChannels().find(channel => (
      channel.getTargetNode()?.getName() === 'UpperArm_L_020' &&
      channel.getTargetPath() === 'rotation'
    ));
    const forwardUpperArmChannel = forwardArmSource?.listChannels().find(channel => (
      channel.getTargetNode()?.getName() === 'UpperArm_L_020' &&
      channel.getTargetPath() === 'rotation'
    ));
    const idleUpperArmFrame = upperArmChannel?.getSampler()?.getOutput()?.getElement(0, []);
    const backUpperArmFrame = backUpperArmChannel?.getSampler()?.getOutput()?.getElement(0, []);
    const forwardUpperArmFrame = forwardUpperArmChannel?.getSampler()?.getOutput()?.getElement(0, []);

    expect(backUpperArmFrame).toBeDefined();
    expect(forwardUpperArmFrame).toBeDefined();
    expect(idleUpperArmFrame).toBeDefined();
    expect(idleUpperArmFrame).not.toEqual(backUpperArmFrame);
    expect(idleUpperArmFrame).not.toEqual(forwardUpperArmFrame);
  });
});
