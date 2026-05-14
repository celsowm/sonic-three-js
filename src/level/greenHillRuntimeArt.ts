import * as THREE from 'three';
import type { RuntimeDecorationDefinition, TerrainDefinition } from './LevelDefinition';

const doubleSided = THREE.DoubleSide;

const plane = (width: number, height: number, color: number): THREE.Mesh => new THREE.Mesh(
  new THREE.PlaneGeometry(width, height),
  new THREE.MeshBasicMaterial({ color, side: doubleSided }),
);

const ellipse = (
  radius: number,
  color: number,
  scaleX = 1,
  scaleY = 1,
  segments = 24,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, segments),
    new THREE.MeshBasicMaterial({ color, side: doubleSided }),
  );
  mesh.scale.set(scaleX, scaleY, 1);
  return mesh;
};

const withPosition = <T extends THREE.Object3D>(object: T, x: number, y: number, z = 0): T => {
  object.position.set(x, y, z);
  return object;
};

const addStripedTrunk = (group: THREE.Group, height: number, width: number, z: number): void => {
  group.add(withPosition(plane(width, height, 0x7d4417), 0, height / 2, z));

  for (let y = 3; y < height; y += 3) {
    group.add(withPosition(plane(width + 0.2, 0.55, 0xb7681f), 0, y, z + 0.03));
    group.add(withPosition(plane(width - 0.45, 0.18, 0x4c240b), 0, y, z + 0.05));
  }
};

const buildBackdrop = (): THREE.Object3D => {
  const group = new THREE.Group();

  group.add(withPosition(plane(220, 7, 0x5bb8d9), 0, -4, -0.2));
  group.add(withPosition(plane(220, 4, 0xa9e2f5), 0, -1.5, -0.18));

  [
    [-70, 10, 2.2, 0x397d63],
    [-20, 16, 2.9, 0x5da58b],
    [36, 12, 2.3, 0x4f967e],
    [82, 9, 2.0, 0x3c7f66],
  ].forEach(([x, radius, stretch, color]) => {
    group.add(withPosition(ellipse(radius as number, color as number, stretch as number, 0.55, 28), x as number, 1.5, -0.15));
  });

  [
    [-60, 21],
    [10, 30],
    [68, 23],
  ].forEach(([x, y]) => {
    group.add(withPosition(ellipse(5.2, 0xf8fcff, 1.6, 0.62), x, y, -0.1));
    group.add(withPosition(ellipse(4.2, 0xf8fcff, 1.45, 0.58), x + 6, y + 0.8, -0.09));
    group.add(withPosition(ellipse(3.8, 0xf8fcff, 1.3, 0.52), x - 5.7, y - 0.3, -0.08));
  });

  return group;
};

const buildPalm = (): THREE.Object3D => {
  const group = new THREE.Group();

  addStripedTrunk(group, 34, 3.1, 0);

  const leafSpecs = [
    { x: -8.5, y: 31.2, w: 10.5, h: 4.2, z: -0.08, rot: 0.7, color: 0x188d21 },
    { x: -5.6, y: 34.8, w: 10, h: 4.0, z: -0.04, rot: 0.24, color: 0x21a92d },
    { x: 0, y: 36.3, w: 8.8, h: 4.5, z: 0.02, rot: 0, color: 0x27b131 },
    { x: 5.8, y: 34.6, w: 10, h: 4.0, z: -0.04, rot: -0.24, color: 0x21a92d },
    { x: 8.6, y: 31, w: 10.5, h: 4.2, z: -0.08, rot: -0.7, color: 0x188d21 },
  ];

  leafSpecs.forEach(({ x, y, w, h, z, rot, color }) => {
    const leaf = withPosition(plane(w, h, color), x, y, z);
    leaf.rotation.z = rot;
    group.add(leaf);
  });

  return group;
};

const buildSunflower = (): THREE.Object3D => {
  const group = new THREE.Group();
  group.add(withPosition(plane(0.5, 6.8, 0x1a8c20), 0, 3.4, 0));
  const leafLeft = withPosition(plane(2.2, 0.7, 0x209f2a), -0.8, 2.5, -0.02);
  leafLeft.rotation.z = 0.55;
  group.add(leafLeft);
  const leafRight = withPosition(plane(2.1, 0.7, 0x209f2a), 0.85, 3.15, -0.02);
  leafRight.rotation.z = -0.5;
  group.add(leafRight);

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    const petal = withPosition(ellipse(0.78, 0xf8d536, 1.35, 0.48, 18), Math.cos(angle) * 1.3, 7.4 + Math.sin(angle) * 0.25, -0.04);
    petal.rotation.z = angle;
    group.add(petal);
  }

  group.add(withPosition(ellipse(0.95, 0x6d3c14, 1.15, 1), 0, 7.4, 0.02));
  return group;
};

const buildRock = (): THREE.Object3D => {
  const group = new THREE.Group();
  group.add(withPosition(ellipse(2.2, 0x7a8e99, 1.6, 0.75), 0, 1.9, 0));
  group.add(withPosition(ellipse(1, 0x5b6f7b, 1.15, 0.72), 1.25, 2.35, 0.02));
  group.add(withPosition(ellipse(0.6, 0x576874, 1.15, 0.8), -1.35, 1.35, 0.01));
  return group;
};

const buildTotem = (): THREE.Object3D => {
  const group = new THREE.Group();
  group.add(withPosition(plane(5.2, 12, 0xc97b24), 0, 6, 0));
  group.add(withPosition(plane(4.5, 0.9, 0xe4b23a), 0, 9.1, 0.03));
  group.add(withPosition(plane(4.5, 0.8, 0xe4b23a), 0, 5.7, 0.03));
  group.add(withPosition(plane(0.9, 0.9, 0x26140b), -1.2, 7.6, 0.05));
  group.add(withPosition(plane(0.9, 0.9, 0x26140b), 1.2, 7.6, 0.05));
  group.add(withPosition(plane(2.4, 0.45, 0x26140b), 0, 4.3, 0.05));
  return group;
};

const buildSign = (): THREE.Object3D => {
  const group = new THREE.Group();
  group.add(withPosition(plane(1.1, 8.6, 0x8a4c1b), 0, 4.3, 0));
  group.add(withPosition(plane(9.4, 4.1, 0xe6b43e), 0, 9.2, 0.02));
  group.add(withPosition(plane(7.6, 0.7, 0x3b2513), 0, 9.2, 0.04));
  group.add(withPosition(plane(0.35, 0.35, 0x3b2513), -2.9, 9.2, 0.05));
  group.add(withPosition(plane(0.35, 0.35, 0x3b2513), 2.9, 9.2, 0.05));
  return group;
};

export const createGreenHillRuntimeArt = (art: RuntimeDecorationDefinition['art']): THREE.Object3D => {
  switch (art) {
    case 'green-hill-backdrop':
      return buildBackdrop();
    case 'green-hill-palm':
      return buildPalm();
    case 'green-hill-sunflower':
      return buildSunflower();
    case 'green-hill-rock':
      return buildRock();
    case 'green-hill-totem':
      return buildTotem();
    case 'green-hill-sign':
      return buildSign();
  }
};

export const createGreenHillTerrainVisual = (definition: TerrainDefinition): THREE.Object3D => {
  const group = new THREE.Group();
  const topThickness = 6;
  const bodyHeight = definition.height;
  const checkerRows = 2;
  const checkerCols = Math.max(12, Math.floor(definition.width / 58));
  const checkerWidth = definition.width / checkerCols;
  const checkerHeight = (bodyHeight - topThickness) / checkerRows;

  const body = withPosition(plane(definition.width, bodyHeight, 0x8e5818), 0, -bodyHeight / 2, 0);
  group.add(body);
  group.add(withPosition(plane(definition.width * 0.98, bodyHeight - topThickness, 0x5b270d), 0, -(bodyHeight + topThickness) / 2 + 1, 0.02));
  group.add(withPosition(plane(definition.width + 2, topThickness, 0x2fb332), 0, -topThickness / 2, 0.05));

  for (let row = 0; row < checkerRows; row += 1) {
    for (let col = 0; col < checkerCols; col += 1) {
      const color = (row + col) % 2 === 0 ? 0x814c16 : 0x5a240c;
      group.add(withPosition(
        plane(checkerWidth - 1.2, checkerHeight - 1.2, color),
        -definition.width / 2 + checkerWidth * col + checkerWidth / 2,
        -topThickness - checkerHeight * row - checkerHeight / 2,
        0.04,
      ));
    }
  }

  for (let index = 0; index < checkerCols + 2; index += 1) {
    const blade = withPosition(plane(1.1, 4, 0x2a8f2c), -definition.width / 2 + index * checkerWidth - checkerWidth / 2, -1.7, 0.08);
    blade.rotation.z = ((index % 3) - 1) * 0.12;
    group.add(blade);
  }

  return group;
};
