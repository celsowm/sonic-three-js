import * as THREE from 'three';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setSize() {}
    render() {}
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

import { Renderer } from '../src/core/Renderer';
import { Stage } from '../src/entities/Stage';
import { Player } from '../src/entities/Player';

describe('Side-scroller camera', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'game-container';
    Object.defineProperty(container, 'clientWidth', { value: 1280, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 720, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('uses an orthographic side-scroller camera by default', () => {
    const renderer = new Renderer('game-container', { visibleHeight: 90 });
    const camera = renderer.camera;

    expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect((camera as THREE.OrthographicCamera).top).toBe(45);
    expect((camera as THREE.OrthographicCamera).bottom).toBe(-45);
    expect((camera as THREE.OrthographicCamera).right).toBeCloseTo(80);
    expect((camera as THREE.OrthographicCamera).left).toBeCloseTo(-80);
  });

  it('follows the player with explicit side-scroller offsets', () => {
    const stage = new Stage('game-container', {
      camera: {
        followOffsetX: 22,
        followOffsetY: 24,
      },
    });
    const player = new Player(10, 5);

    stage.addEntity(player);
    stage.updateCamera();

    expect(stage.engine.renderer.camera.position.x).toBe(32);
    expect(stage.engine.renderer.camera.position.y).toBe(29);
  });
});

describe('Perspective camera', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'game-container';
    Object.defineProperty(container, 'clientWidth', { value: 1280, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 720, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('places the camera so the gameplay plane keeps the requested visible height', () => {
    const renderer = new Renderer('game-container', { cameraMode: 'perspective', visibleHeight: 96, fov: 40 });
    const camera = renderer.camera as THREE.PerspectiveCamera;

    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(camera.fov).toBe(40);
    // distance = (visibleHeight / 2) / tan(fov / 2)
    const expected = 48 / Math.tan(THREE.MathUtils.degToRad(20));
    expect(camera.position.z).toBeCloseTo(expected, 6);
  });

  it('keeps the calibrated distance when the visible height changes', () => {
    const renderer = new Renderer('game-container', { cameraMode: 'perspective', visibleHeight: 96, fov: 40 });

    renderer.setVisibleHeight(120);
    const camera = renderer.camera as THREE.PerspectiveCamera;
    expect(camera.position.z).toBeCloseTo(60 / Math.tan(THREE.MathUtils.degToRad(20)), 6);
    expect(camera.aspect).toBeCloseTo(1280 / 720, 6);
  });
});
