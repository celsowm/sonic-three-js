import { Stage, HUD, LevelLoader, greenHillAct1 } from '../src';

const stage = new Stage('game-container');
const hud = new HUD('game-container');
const loader = new LevelLoader();
const { player } = await loader.load(stage, greenHillAct1);

stage.engine.onUpdate(() => hud.update(player));

stage.start();
