import * as THREE from 'three';
import { Stage, Player, Ring, Badnik, Monitor, FinishSign, HUD } from '../src';

const stage = new Stage('game-container');
const hud = new HUD('game-container');

// Create Player
const player = new Player(0, 50);
stage.addEntity(player);

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
