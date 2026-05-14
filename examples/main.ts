import { Stage, HUD, LevelLoader, greenHillAct1 } from '../src';

const stage = new Stage('game-container', {
  engine: {
    renderer: {
      cameraMode: 'side-scroller',
      visibleHeight: greenHillAct1.camera.visibleHeight,
    },
  },
  camera: {
    followOffsetX: greenHillAct1.camera.followOffsetX,
    followOffsetY: greenHillAct1.camera.followOffsetY,
  },
});
const hud = new HUD('game-container');
const loader = new LevelLoader();
const { player } = await loader.load(stage, greenHillAct1);

const origUpdate = stage.engine['update'].bind(stage.engine);
stage.engine['update'] = (dt: number) => {
  origUpdate(dt);
  hud.update(player);
};

stage.start();
