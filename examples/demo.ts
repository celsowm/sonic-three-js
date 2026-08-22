import type { LevelDefinition } from '../src';
import {
  Stage,
  HUD,
  LevelLoader,
  LoadingScreen,
  ResultsOverlay,
  DebugOverlay,
} from '../src';

export interface DemoOptions {
  /** Start with the debug overlay enabled. */
  debug?: boolean;
  /** Title shown on the stage-clear screen. */
  actName?: string;
}

/** Reads demo flags from the page URL, e.g. `green-hill.html?debug=1`. */
const wantsDebugFromUrl = (): boolean =>
  new URLSearchParams(window.location.search).has('debug');

/**
 * Shared demo bootstrap: loading screen, HUD, pause/restart keys, results
 * screens and the debug overlay, all wired through public engine APIs.
 */
export async function runDemo(level: LevelDefinition, options: DemoOptions = {}): Promise<void> {
  const containerId = 'game-container';
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`#${containerId} not found`);

  const loading = new LoadingScreen(containerId);
  const stage = new Stage(containerId, {
    engine: {
      renderer: {
        cameraMode: level.camera.mode,
        fov: level.camera.fov,
      },
    },
  });
  const hud = new HUD(containerId);
  const results = new ResultsOverlay(containerId);
  const debug = new DebugOverlay(containerId, stage, options.debug ?? wantsDebugFromUrl());

  const pauseOverlay = document.createElement('div');
  pauseOverlay.style.position = 'absolute';
  pauseOverlay.style.inset = '0';
  pauseOverlay.style.display = 'none';
  pauseOverlay.style.alignItems = 'center';
  pauseOverlay.style.justifyContent = 'center';
  pauseOverlay.style.background = 'rgba(5, 12, 22, 0.65)';
  pauseOverlay.style.backdropFilter = 'blur(6px)';
  pauseOverlay.style.zIndex = '20';
  pauseOverlay.style.fontFamily = "'Press Start 2P', monospace, sans-serif";
  pauseOverlay.style.color = '#ffe600';
  pauseOverlay.style.fontSize = '32px';
  pauseOverlay.style.letterSpacing = '4px';
  pauseOverlay.style.textShadow = '4px 4px 0 #000, 0 0 20px rgba(255, 230, 0, 0.6)';
  pauseOverlay.innerText = 'PAUSED';
  container.appendChild(pauseOverlay);

  const loader = new LevelLoader({
    // Serve the engine's assets from the deploy base (Vite's BASE_URL is "/"
    // in dev and "/sonic-three-js/" on GitHub Pages).
    assetBase: `${import.meta.env.BASE_URL}assets/`,
    onProgress: (loaded, total) => loading.update(loaded, total),
  });

  let finished = false;

  stage.engine.onUpdate(deltaTime => {
    if (stage.player) {
      hud.update(stage.player);
    }
    debug.update(deltaTime);
  });

  const restart = async (): Promise<void> => {
    finished = false;
    results.hide();
    pauseOverlay.style.display = 'none';
    hud.reset();
    stage.resume();
    stage.unload();
    const { player } = await loader.load(stage, level);
    // dev helper: spawn somewhere else via ?x=&y= (e.g. to inspect the loop)
    const params = new URLSearchParams(window.location.search);
    if (params.has('x') || params.has('y')) {
      player.x = Number(params.get('x') ?? level.player.x);
      player.y = Number(params.get('y') ?? level.player.y + 60);
    }
    stage.updateCamera();
  };

  stage.engine.events.on('stageCleared', ({ score, rings }) => {
    if (finished) return;
    finished = true;
    stage.pause();
    hud.pause();

    const timeBonus = Math.max(0, 5000 - hud.elapsed * 50);
    const ringBonus = rings * 100;
    results.show(
      options.actName ? `${options.actName} CLEAR` : 'STAGE CLEAR',
      [
        { label: 'TIME BONUS', value: String(timeBonus) },
        { label: 'RING BONUS', value: String(ringBonus) },
        { label: 'TOTAL SCORE', value: String(score + timeBonus + ringBonus) },
      ],
      'PLAY AGAIN',
      () => void restart(),
    );
  });

  stage.engine.events.on('gameOver', () => {
    if (finished) return;
    finished = true;
    stage.pause();
    hud.pause();
    results.show(
      'GAME OVER',
      [{ label: 'SCORE', value: String(stage.player?.score ?? 0) }],
      'TRY AGAIN',
      () => void restart(),
    );
  });

  // demo-level keys, handled outside the engine so they work while paused
  window.addEventListener('keydown', event => {
    if (event.code === 'KeyP' || event.code === 'Escape') {
      if (finished) return;
      if (stage.isPaused) {
        stage.resume();
        hud.resume();
        pauseOverlay.style.display = 'none';
      } else {
        stage.pause();
        hud.pause();
        pauseOverlay.style.display = 'flex';
      }
    } else if (event.code === 'KeyR') {
      void restart();
    } else if (event.code === 'F3') {
      event.preventDefault();
      debug.toggle();
    }
  });

  await restart();
  loading.destroy();
  stage.start();
}
