import * as THREE from 'three';

export interface RendererOptions {
  cameraMode?: 'side-scroller' | 'perspective';
  visibleHeight?: number;
  /** Vertical field of view in degrees for `perspective` camera mode. */
  fov?: number;
}

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private cameraMode: 'side-scroller' | 'perspective';
  private visibleHeight: number;
  private readonly fov: number;
  private readonly onWindowResize = (): void => this.resize();

  constructor(containerId: string, options: RendererOptions = {}) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;

    this.scene = new THREE.Scene();
    this.cameraMode = options.cameraMode ?? 'side-scroller';
    this.visibleHeight = options.visibleHeight ?? 100;
    this.fov = options.fov ?? 40;

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
      this.camera = new THREE.PerspectiveCamera(this.fov, width / height, 0.1, 1000);
      // distance calibrated so the z=0 gameplay plane keeps the same visible
      // height as the orthographic view (art and gameplay framing unchanged)
      this.camera.position.z = (this.visibleHeight / 2) / Math.tan(THREE.MathUtils.degToRad(this.fov / 2));
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Atmospheric linear fog
    this.scene.fog = new THREE.Fog(0x8ed8f7, 300, 1800);

    // Hemisphere light for vibrant sky-to-ground ambient fill
    const hemiLight = new THREE.HemisphereLight(0xe8f7ff, 0x3d661e, 0.75);
    this.scene.add(hemiLight);

    // Warm directional sun light
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.15);
    dirLight.position.set(50, 120, 80);
    this.scene.add(dirLight);

    // Subtle rim light from opposite side
    const rimLight = new THREE.DirectionalLight(0x70b0ff, 0.35);
    rimLight.position.set(-40, -20, -50);
    this.scene.add(rimLight);

    window.addEventListener('resize', this.onWindowResize);
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
  }

  public render(): void {
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
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
