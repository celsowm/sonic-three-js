import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Stage, Player, Ring, Badnik, Monitor, FinishSign, HUD } from '../src';

const SONIC_RUNNERS_MODEL_URL = new URL(
  '../assets/models/sonic/classic-sonic-runners/classic-sonic-runners.glb',
  import.meta.url,
).href;

const stage = new Stage('game-container');
const hud = new HUD('game-container');

// Create Player
const player = new Player(0, 50);
stage.addEntity(player);

const loader = new GLTFLoader();
loader.load(
  SONIC_RUNNERS_MODEL_URL,
  gltf => {
    player.setAnimatedModel(gltf.scene, gltf.animations, {
      scale: 8,
      offset: { x: 0, y: -5, z: 0 },
    });
  },
  undefined,
  error => {
    console.warn('Failed to load Sonic Runners model, using placeholder player.', error);
  },
);

// Create some Rings
for (let i = 0; i < 5; i++) {
  stage.addEntity(new Ring(30 + i * 20, 10));
}

// Create a Badnik
stage.addEntity(new Badnik(150, 10, 30));

// Create a Monitor
stage.addEntity(new Monitor(250, 10, 'rings'));

// Create Finish Sign
stage.addEntity(new FinishSign(400, 10));

// Add a simple floor mesh directly to scene for visual reference
const floorGeo = new THREE.PlaneGeometry(1000, 50);
const floorMat = new THREE.MeshLambertMaterial({ color: 0x228822 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -5;
stage.engine.renderer.scene.add(floor);

// Update HUD every frame hook
const origUpdate = stage.engine['update'].bind(stage.engine);
stage.engine['update'] = (dt: number) => {
  origUpdate(dt);
  hud.update(player);
};

// Start the game loop
stage.start();
