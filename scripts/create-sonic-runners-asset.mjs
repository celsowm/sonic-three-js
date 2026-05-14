#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Accessor, AnimationSampler, NodeIO } from '@gltf-transform/core';

const SOURCE_DIR = path.resolve(
  'assets',
  'models',
  'sketchfab',
  'animations-classic-sonic-sonic-runners-fa58f582a6f4425ba303c1b0cf3f34c8',
);
const SOURCE_GLB = path.join(SOURCE_DIR, 'animations-classic-sonic-sonic-runners-manual-download.glb');
const SOURCE_METADATA = path.join(SOURCE_DIR, 'metadata.json');
const SOURCE_DOWNLOAD_METADATA = path.join(SOURCE_DIR, 'manual-download.json');
const OUTPUT_DIR = path.resolve('assets', 'models', 'sonic', 'classic-sonic-runners');
const OUTPUT_GLB = path.join(OUTPUT_DIR, 'classic-sonic-runners.glb');
const OUTPUT_METADATA = path.join(OUTPUT_DIR, 'metadata.json');
const IDLE_ANIMATION = 'idle';
const IDLE_DURATION = 1.2;
const MODEL_ROOT_NODE = 'ClassicSonicRunners_2_5D_Root';
const MODEL_FORWARD_ROTATION_Y = Math.PI / 2;
const ARM_BACK_SOURCE_ANIMATION = 'sc_dashring_loop';
const ARM_FORWARD_SOURCE_ANIMATION = 'sc_landing.ma';
const ARM_FORWARD_BLEND = 0.2;
const FIST_SOURCE_ANIMATION = 'sc_run_loop';
const MANUAL_IDLE_CHANNELS = [
  { node: 'Hips_05', path: 'translation', bobY: 0.008 },
  { node: 'Hips_05', path: 'rotation' },
  { node: 'Spine_049', path: 'rotation' },
  { node: 'Head_06', path: 'rotation' },
  { node: 'Shoulder_L_019', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'UpperArm_L_020', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'ForeArm_L_021', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'Hand_L_022', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'Shoulder_R_034', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'UpperArm_R_035', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'ForeArm_R_036', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'Hand_R_037', path: 'rotation', sourceBlend: [ARM_BACK_SOURCE_ANIMATION, ARM_FORWARD_SOURCE_ANIMATION, ARM_FORWARD_BLEND] },
  { node: 'Index1_L_023', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Index2_L_024', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Middle1_L_025', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Middle2_L_026', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Pinky1_L_027', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Pinky2_L_028', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Ring1_L_029', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Ring2_L_030', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Thumb1_L_031', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Thumb2_L_032', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Index1_R_038', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Index2_R_039', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Middle1_R_040', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Middle2_R_041', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Pinky1_R_042', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Pinky2_R_043', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Ring1_R_044', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Ring2_R_045', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Thumb1_R_046', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Thumb2_R_047', path: 'rotation', sourceAnimation: FIST_SOURCE_ANIMATION },
  { node: 'Pelvis_L_08', path: 'rotation' },
  { node: 'Thigh_L_09', path: 'rotation' },
  { node: 'Calf_L_010', path: 'rotation' },
  { node: 'Foot_L_011', path: 'rotation' },
  { node: 'Toe_L_00', path: 'rotation' },
  { node: 'Pelvis_R_013', path: 'rotation' },
  { node: 'Thigh_R_014', path: 'rotation' },
  { node: 'Calf_R_015', path: 'rotation' },
  { node: 'Foot_R_016', path: 'rotation' },
  { node: 'Toe_R_018', path: 'rotation' },
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function repeatedKeyframes(values) {
  const elementSize = values[0].length;
  const output = new Float32Array(elementSize * values.length);

  for (let frame = 0; frame < values.length; frame++) {
    for (let i = 0; i < elementSize; i++) {
      output[frame * elementSize + i] = values[frame][i];
    }
  }

  return output;
}

function firstAnimationValue(root, animationName, nodeName, targetPath) {
  const animation = root.listAnimations().find(candidate => candidate.getName() === animationName);
  const channel = animation?.listChannels().find(candidate => (
    candidate.getTargetNode()?.getName() === nodeName &&
    candidate.getTargetPath() === targetPath
  ));
  const output = channel?.getSampler()?.getOutput();
  const value = output?.getElement(0, []);

  if (!animation || !channel || !output || !value) {
    throw new Error(`Animation value "${animationName}:${nodeName}:${targetPath}" not found in ${SOURCE_GLB}`);
  }

  return value;
}

function normalizeQuaternion(quaternion) {
  const length = Math.hypot(...quaternion);
  return quaternion.map(value => value / length);
}

function slerpQuaternion(from, to, amount) {
  let target = [...to];
  let dot = from.reduce((sum, value, index) => sum + value * target[index], 0);

  if (dot < 0) {
    target = target.map(value => -value);
    dot = -dot;
  }

  if (dot > 0.9995) {
    return normalizeQuaternion(from.map((value, index) => value + amount * (target[index] - value)));
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sinTheta = Math.sin(theta);
  const fromScale = Math.sin((1 - amount) * theta) / sinTheta;
  const toScale = Math.sin(amount * theta) / sinTheta;

  return from.map((value, index) => value * fromScale + target[index] * toScale);
}

function blendedAnimationValue(root, sourceBlend, nodeName, targetPath) {
  const [fromAnimation, toAnimation, amount] = sourceBlend;
  const from = firstAnimationValue(root, fromAnimation, nodeName, targetPath);
  const to = firstAnimationValue(root, toAnimation, nodeName, targetPath);

  if (targetPath === 'rotation') {
    return slerpQuaternion(from, to, amount);
  }

  return from.map((value, index) => value + amount * (to[index] - value));
}

function createManualIdleAnimation(document) {
  const root = document.getRoot();
  const existingIdle = root.listAnimations().find(animation => animation.getName() === IDLE_ANIMATION);
  if (existingIdle) {
    existingIdle.dispose();
  }

  const buffer = root.listBuffers()[0] ?? document.createBuffer();
  const idle = document.createAnimation(IDLE_ANIMATION);
  const timeline = new Float32Array([0, IDLE_DURATION / 2, IDLE_DURATION]);

  for (const channelDefinition of MANUAL_IDLE_CHANNELS) {
    const targetNode = root.listNodes().find(node => node.getName() === channelDefinition.node);
    if (!targetNode) {
      throw new Error(`Manual idle target "${channelDefinition.node}" not found in ${SOURCE_GLB}`);
    }

    const targetPath = channelDefinition.path;
    const baseValue = channelDefinition.sourceBlend
      ? blendedAnimationValue(root, channelDefinition.sourceBlend, channelDefinition.node, targetPath)
      : channelDefinition.sourceAnimation
      ? firstAnimationValue(root, channelDefinition.sourceAnimation, channelDefinition.node, targetPath)
      : targetPath === 'translation'
        ? targetNode.getTranslation()
        : targetNode.getRotation();
    const values = [baseValue, [...baseValue], baseValue];
    if (targetPath === 'translation' && channelDefinition.bobY) {
      values[1][1] += channelDefinition.bobY;
    }

    const input = document.createAccessor(`${IDLE_ANIMATION}_${targetNode.getName()}_${targetPath}_input`)
      .setArray(timeline)
      .setType(Accessor.Type.SCALAR)
      .setBuffer(buffer);

    const output = document.createAccessor(`${IDLE_ANIMATION}_${targetNode.getName()}_${targetPath}_output`)
      .setArray(repeatedKeyframes(values))
      .setType(targetPath === 'translation' ? Accessor.Type.VEC3 : Accessor.Type.VEC4)
      .setBuffer(buffer);

    const sampler = document.createAnimationSampler(`${IDLE_ANIMATION}_${targetNode.getName()}_${targetPath}`)
      .setInput(input)
      .setOutput(output)
      .setInterpolation(AnimationSampler.Interpolation.LINEAR);

    const channel = document.createAnimationChannel(`${IDLE_ANIMATION}_${targetNode.getName()}_${targetPath}`)
      .setTargetNode(targetNode)
      .setTargetPath(targetPath)
      .setSampler(sampler);

    idle.addSampler(sampler).addChannel(channel);
  }

  if (idle.listChannels().length === 0) {
    throw new Error('Manual idle generation did not create any animation channels.');
  }

  return idle;
}

function orientModelForSideScroller(document) {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) {
    throw new Error(`No scene found in ${SOURCE_GLB}`);
  }

  for (const node of root.listNodes()) {
    if (node.getName() === MODEL_ROOT_NODE) {
      node.dispose();
    }
  }

  const sceneChildren = [...scene.listChildren()];
  const halfAngle = MODEL_FORWARD_ROTATION_Y / 2;
  const sideScrollerRoot = document.createNode(MODEL_ROOT_NODE)
    .setRotation([0, Math.sin(halfAngle), 0, Math.cos(halfAngle)]);

  scene.addChild(sideScrollerRoot);
  for (const child of sceneChildren) {
    sideScrollerRoot.addChild(child);
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const sourceMetadata = await readJson(SOURCE_METADATA);
  const sourceDownloadMetadata = await readJson(SOURCE_DOWNLOAD_METADATA).catch(() => null);
  const io = new NodeIO();
  const document = await io.read(SOURCE_GLB);
  const originalAnimations = document.getRoot().listAnimations().map(animation => animation.getName());
  const idle = createManualIdleAnimation(document);
  orientModelForSideScroller(document);

  await io.write(OUTPUT_GLB, document);

  const metadata = {
    name: 'Classic Sonic Runners',
    derivedFrom: sourceMetadata.name,
    sourceLocalPath: path.relative(process.cwd(), SOURCE_GLB).replaceAll(path.sep, '/'),
    sourceUrl: sourceDownloadMetadata?.sourceUrl ?? `https://sketchfab.com/3d-models/${sourceMetadata.id}`,
    sourceSketchfabId: sourceMetadata.id,
    license: sourceMetadata.license,
    changes: [
      `Added hand-authored "${IDLE_ANIMATION}" animation from a manual composite pose with lowered arms, closed fists, and a subtle body bob.`,
      'Rotated the model root +90 degrees around Y so Sonic faces +X for 2.5D side-scroller movement.',
      'Kept all original animation clips from the downloaded GLB.',
    ],
    animationSource: {
      sourceAnimation: null,
      generatedAnimation: IDLE_ANIMATION,
      authoring: 'manual-composite-pose',
      armBlend: {
        from: ARM_BACK_SOURCE_ANIMATION,
        to: ARM_FORWARD_SOURCE_ANIMATION,
        amount: ARM_FORWARD_BLEND,
      },
      fistSourceAnimation: FIST_SOURCE_ANIMATION,
      keyframes: [0, IDLE_DURATION / 2, IDLE_DURATION],
      interpolation: 'LINEAR',
      channelCount: idle.listChannels().length,
      channels: MANUAL_IDLE_CHANNELS,
      preservedAnimations: originalAnimations,
    },
    downloadedAt: sourceDownloadMetadata?.downloadedAt ?? null,
    generatedAt: new Date().toISOString(),
    outputPath: path.relative(process.cwd(), OUTPUT_GLB).replaceAll(path.sep, '/'),
  };

  await writeFile(OUTPUT_METADATA, JSON.stringify(metadata, null, 2));

  console.log(`Created ${path.relative(process.cwd(), OUTPUT_GLB)}`);
  console.log(`Created ${path.relative(process.cwd(), OUTPUT_METADATA)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
