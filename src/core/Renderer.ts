import * as THREE from 'three';

export interface RendererOptions {
  cameraMode?: 'side-scroller' | 'perspective';
  visibleHeight?: number;
}

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private cameraMode: 'side-scroller' | 'perspective';
  private visibleHeight: number;

  constructor(containerId: string, options: RendererOptions | boolean = {}) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;

    this.scene = new THREE.Scene();
    this.cameraMode = typeof options === 'boolean'
      ? (options ? 'side-scroller' : 'perspective')
      : options.cameraMode ?? 'side-scroller';
    this.visibleHeight = typeof options === 'boolean'
      ? 100
      : options.visibleHeight ?? 100;

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
    } else {
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    }

    this.camera.position.z = 50;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
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

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public setVisibleHeight(visibleHeight: number): void {
    if (visibleHeight <= 0) {
      throw new Error('Visible height must be greater than zero.');
    }

    this.visibleHeight = visibleHeight;
    this.onWindowResize();
  }
}
