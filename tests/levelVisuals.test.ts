import { describe, expect, it } from 'vitest';
import { greenHillAct1 } from '../src/levels/greenHillAct1';

describe('Green Hill visual target', () => {
  it('opts into the cinematic rendering pipeline', () => {
    expect(greenHillAct1.rendering?.quality).toBe('cinematic');
    expect(greenHillAct1.rendering?.shadows).toBe(true);
    expect(greenHillAct1.rendering?.ambientOcclusion).not.toBe(false);
    expect(greenHillAct1.rendering?.bloom).not.toBe(false);
  });

  it('uses real depth layers instead of a flat sky-only background', () => {
    const layerTypes = new Set(greenHillAct1.background.map(layer => layer.type));
    expect(layerTypes).toContain('gradient-band');
    expect(layerTypes).toContain('cloud-field');
    expect(layerTypes).toContain('ridge-band');
  });

  it('packs dense scenery through model-scatter definitions', () => {
    const scatter = greenHillAct1.decorations.filter(decoration => decoration.type === 'model-scatter');
    const instanceCount = scatter.reduce((sum, decoration) => sum + decoration.instances.length, 0);

    expect(scatter.length).toBeGreaterThan(5);
    expect(instanceCount).toBeGreaterThan(80);
  });
});
