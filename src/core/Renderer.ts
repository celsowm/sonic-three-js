import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export type RenderQualityPreset = 'classic' | 'balanced' | 'cinematic';
export type AntialiasingMode = 'native' | 'smaa' | 'none';

export interface BloomOptions {
  strength?: number;
  radius?: number;
  threshold?: number;
}

export interface AmbientOcclusionOptions {
  kernelRadius?: number;
  minDistance?: number;
  maxDistance?: number;
}

export interface RendererVisualOptions {
  /**
   * `classic` keeps the old direct-rendering path. `balanced` adds PBR-friendly
   * tone mapping and shadows. `cinematic` also enables SSAO, bloom and SMAA.
   */
  quality?: RenderQualityPreset;
  /** Caps devicePixelRatio so high-DPI displays do not explode fill-rate. */
  maxPixelRatio?: number;
  /** Override the preset's shadow-map setting. */
  shadows?: boolean;
  /** Exposure used by the ACES tone mapper. */
  exposure?: number;
  /** False disables bloom even for the cinematic preset. */
  bloom?: false | BloomOptions;
  /** False disables SSAO even for the cinematic preset. */
  ambientOcclusion?: false | AmbientOcclusionOptions;
  /** Antialiasing strategy. SMAA is only created when post-processing is active. */
  antialias?: AntialiasingMode;
}

export interface RendererOptions extends RendererVisualOptions {
  cameraMode?: 'side-scroller' | 'perspective';
  visibleHeight?: number;
  /** Vertical field of view in degrees for `perspective` camera mode. */
  fov?: number;
}

export interface SceneEnvironmentOptions {
  fog?: false | {
    color?: number;
    near?: number;
    far?: number;
  };
  hemisphere?: {
    skyColor?: number;
    groundColor?: number;
    intensity?: number;
  };
  sun?: {
    color?: number;
    intensity?: number;
    /** Position offset from the current camera focus. */
    position?: Partial<THREE.Vector3Like>;
  };
  rim?: {
    color?: number;
    intensity?: number;
    /** Position offset from the current camera focus. */
    position?: Partial<THREE.Vector3Like>;
  };
}

interface ResolvedVisualProfile {
  quality: RenderQualityPreset;
  maxPixelRatio: number;
  shadows: boolean;
  exposure: number;
  antialias: AntialiasingMode;
  postProcessing: boolean;
  bloom: BloomOptions | false;
  ambientOcclusion: AmbientOcclusionOptions | false;
}

interface ResolvedEnvironment {
  fog: { color: number; near: number; far: number };
  hemisphere: { skyColor: number; groundColor: number; intensity: number };
  sun: { color: number; intensity: number; position: { x: number; y: number; z: number } };
  rim: { color: number; intensity: number; position: { x: number; y: number; z: number } };
}

const DEFAULT_ENVIRONMENT: ResolvedEnvironment = {
  fog: { color: 0x8ed8f7, near: 300, far: 1800 },
  hemisphere: { skyColor: 0xe8f7ff, groundColor: 0x3d661e, intensity: 0.75 },
  sun: { color: 0xfffaed, intensity: 1.15, position: { x: 50, y: 120, z: 80 } },
  rim: { color: 0x70b0ff, intensity: 0.35, position: { x: -40, y: -20, z: -50 } },
};

const resolveVisualProfile = (options: RendererVisualOptions): ResolvedVisualProfile => {
  const quality = options.quality ?? 'classic';
  const cinematic = quality === 'cinematic';
  const balanced = quality === 'balanced';

  return {
    quality,
    maxPixelRatio: Math.max(1, options.maxPixelRatio ?? (cinematic ? 1.8 : balanced ? 1.6 : 1.5)),
    shadows: options.shadows ?? quality !== 'classic',
    exposure: options.exposure ?? (cinematic ? 1.08 : balanced ? 1.04 : 1),
    antialias: options.antialias ?? (cinematic ? 'smaa' : 'native'),
    postProcessing: cinematic,
    bloom: options.bloom === false
      ? false
      : cinematic
        ? { strength: 0.24, radius: 0.28, threshold: 0.82, ...options.bloom }
        : false,
    ambientOcclusion: options.ambientOcclusion === false
      ? false
      : cinematic
        ? { kernelRadius: 7, minDistance: 0.001, maxDistance: 0.035, ...options.ambientOcclusion }
        : false,
  };
};

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;

  private readonly container: HTMLElement;
  private readonly cameraMode: 'side-scroller' | 'perspective';
  private visibleHeight: number;
  private readonly fov: number;
  private readonly visualProfile: ResolvedVisualProfile;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private sunOffset = new THREE.Vector3(50, 120, 80);
  private rimOffset = new THREE.Vector3(-40, -20, -50);
  private composer: EffectComposer | null = null;
  private ssaoPass: SSAOPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private smaaPass: SMAAPass | null = null;
  private readonly onWindowResize = (): void => this.resize();

  constructor(containerId: string, options: RendererOptions = {}) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;

    this.scene = new THREE.Scene();
    this.cameraMode = options.cameraMode ?? 'side-scroller';
    this.visibleHeight = options.visibleHeight ?? 100;
    this.fov = options.fov ?? 40;
    this.visualProfile = resolveVisualProfile(options);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.cameraMode === 'side-scroller') {
      const aspect = width / height;
      const visibleWidth = this.visibleHeight * aspect;
      this.camera = new THREE.OrthographicCamera(
        visibleWidth / -2,
        visibleWidth / 2,
        this.visibleHeight / 2,
        this.visibleHeight / -2,
        0.1,
        1000,
      );
      this.camera.position.z = 50;
    } else {
      this.camera = new THREE.PerspectiveCamera(this.fov, width / height, 0.1, 2000);
      // Distance calibrated so z=0 keeps the same gameplay framing as the
      // orthographic camera while scenery can still use real depth/parallax.
      this.camera.position.z = (this.visibleHeight / 2) / Math.tan(THREE.MathUtils.degToRad(this.fov / 2));
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: this.visualProfile.antialias === 'native',
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    if (typeof this.renderer.setPixelRatio === 'function') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.visualProfile.maxPixelRatio));
    }
    this.container.appendChild(this.renderer.domElement);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.visualProfile.exposure;

    if (this.visualProfile.shadows && this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.hemiLight = new THREE.HemisphereLight(
      DEFAULT_ENVIRONMENT.hemisphere.skyColor,
      DEFAULT_ENVIRONMENT.hemisphere.groundColor,
      DEFAULT_ENVIRONMENT.hemisphere.intensity,
    );
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(
      DEFAULT_ENVIRONMENT.sun.color,
      DEFAULT_ENVIRONMENT.sun.intensity,
    );
    this.sunLight.castShadow = this.visualProfile.shadows;
    if (this.visualProfile.shadows) {
      this.configureSunShadow();
    }
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(
      DEFAULT_ENVIRONMENT.rim.color,
      DEFAULT_ENVIRONMENT.rim.intensity,
    );
    this.scene.add(this.rimLight);

    this.configureEnvironment();
    if (this.visualProfile.postProcessing) {
      this.createPostProcessing(width, height);
    }

    window.addEventListener('resize', this.onWindowResize);
  }

  /** Apply per-level atmosphere without rebuilding the renderer. */
  public configureEnvironment(options: SceneEnvironmentOptions = {}): void {
    if (options.fog === false) {
      this.scene.fog = null;
    } else {
      this.scene.fog = new THREE.Fog(
        options.fog?.color ?? DEFAULT_ENVIRONMENT.fog.color,
        options.fog?.near ?? DEFAULT_ENVIRONMENT.fog.near,
        options.fog?.far ?? DEFAULT_ENVIRONMENT.fog.far,
      );
    }

    this.hemiLight.color.setHex(options.hemisphere?.skyColor ?? DEFAULT_ENVIRONMENT.hemisphere.skyColor);
    this.hemiLight.groundColor.setHex(options.hemisphere?.groundColor ?? DEFAULT_ENVIRONMENT.hemisphere.groundColor);
    this.hemiLight.intensity = options.hemisphere?.intensity ?? DEFAULT_ENVIRONMENT.hemisphere.intensity;

    this.sunLight.color.setHex(options.sun?.color ?? DEFAULT_ENVIRONMENT.sun.color);
    this.sunLight.intensity = options.sun?.intensity ?? DEFAULT_ENVIRONMENT.sun.intensity;
    this.sunOffset.set(
      options.sun?.position?.x ?? DEFAULT_ENVIRONMENT.sun.position.x,
      options.sun?.position?.y ?? DEFAULT_ENVIRONMENT.sun.position.y,
      options.sun?.position?.z ?? DEFAULT_ENVIRONMENT.sun.position.z,
    );

    this.rimLight.color.setHex(options.rim?.color ?? DEFAULT_ENVIRONMENT.rim.color);
    this.rimLight.intensity = options.rim?.intensity ?? DEFAULT_ENVIRONMENT.rim.intensity;
    this.rimOffset.set(
      options.rim?.position?.x ?? DEFAULT_ENVIRONMENT.rim.position.x,
      options.rim?.position?.y ?? DEFAULT_ENVIRONMENT.rim.position.y,
      options.rim?.position?.z ?? DEFAULT_ENVIRONMENT.rim.position.z,
    );

    this.syncCameraRelativeLights();
  }

  public get quality(): RenderQualityPreset {
    return this.visualProfile.quality;
  }

  public get shadowsEnabled(): boolean {
    return this.visualProfile.shadows;
  }

  private configureSunShadow(): void {
    const shadow = this.sunLight.shadow;
    shadow.mapSize.set(
      this.visualProfile.quality === 'cinematic' ? 2048 : 1024,
      this.visualProfile.quality === 'cinematic' ? 2048 : 1024,
    );
    shadow.bias = -0.00035;
    shadow.normalBias = 0.025;
    shadow.camera.near = 1;
    shadow.camera.far = 500;
    shadow.camera.left = -130;
    shadow.camera.right = 130;
    shadow.camera.top = 110;
    shadow.camera.bottom = -100;
  }

  private createPostProcessing(width: number, height: number): void {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.visualProfile.ambientOcclusion) {
      const options = this.visualProfile.ambientOcclusion;
      const ssao = new SSAOPass(this.scene, this.camera, width, height);
      ssao.kernelRadius = options.kernelRadius ?? 7;
      ssao.minDistance = options.minDistance ?? 0.001;
      ssao.maxDistance = options.maxDistance ?? 0.035;
      composer.addPass(ssao);
      this.ssaoPass = ssao;
    }

    if (this.visualProfile.bloom) {
      const options = this.visualProfile.bloom;
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        options.strength ?? 0.24,
        options.radius ?? 0.28,
        options.threshold ?? 0.82,
      );
      composer.addPass(bloom);
      this.bloomPass = bloom;
    }

    if (this.visualProfile.antialias === 'smaa') {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, this.visualProfile.maxPixelRatio);
      const smaa = new SMAAPass(width * pixelRatio, height * pixelRatio);
      composer.addPass(smaa);
      this.smaaPass = smaa;
    }

    // SMAA operates in linear-sRGB; OutputPass must remain last so tone mapping
    // and output color-space conversion happen after anti-aliasing.
    composer.addPass(new OutputPass());

    this.composer = composer;
  }

  private syncCameraRelativeLights(): void {
    const focusX = this.camera.position.x;
    const focusY = this.camera.position.y - this.visibleHeight * 0.18;

    this.sunLight.position.set(
      focusX + this.sunOffset.x,
      focusY + this.sunOffset.y,
      this.sunOffset.z,
    );
    this.sunLight.target.position.set(focusX, focusY, -12);
    this.sunLight.target.updateMatrixWorld();

    this.rimLight.position.set(
      focusX + this.rimOffset.x,
      focusY + this.rimOffset.y,
      this.rimOffset.z,
    );
    this.rimLight.target.position.set(focusX, focusY, -8);
    this.rimLight.target.updateMatrixWorld();
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.position.z = (this.visibleHeight / 2) / Math.tan(THREE.MathUtils.degToRad(this.fov / 2));
      this.camera.updateProjectionMatrix();
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      const aspect = width / height;
      const visibleWidth = this.visibleHeight * aspect;
      this.camera.left = visibleWidth / -2;
      this.camera.right = visibleWidth / 2;
      this.camera.top = this.visibleHeight / 2;
      this.camera.bottom = this.visibleHeight / -2;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
  }

  public render(): void {
    this.syncCameraRelativeLights();
    if (this.composer) {
      this.composer.render();
      return;
    }
    this.renderer.render(this.scene, this.camera);
  }

  public setVisibleHeight(visibleHeight: number): void {
    if (visibleHeight <= 0) {
      throw new Error('Visible height must be greater than zero.');
    }

    this.visibleHeight = visibleHeight;
    this.resize();
  }

  public destroy(): void {
    window.removeEventListener('resize', this.onWindowResize);
    (this.ssaoPass as unknown as { dispose?: () => void } | null)?.dispose?.();
    (this.bloomPass as unknown as { dispose?: () => void } | null)?.dispose?.();
    (this.smaaPass as unknown as { dispose?: () => void } | null)?.dispose?.();
    (this.composer as unknown as { dispose?: () => void } | null)?.dispose?.();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
