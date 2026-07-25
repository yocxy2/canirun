import { describe, it, expect } from 'vitest';
import { toJson, buildHardwareSummary } from '../../src/output/formatter.js';
import type { HardwareProfile, CompatResult } from '../../src/types/index.js';

const hwApple: HardwareProfile = {
  cpu: 'Apple M2 Pro',
  cores: 10,
  ramGB: 32,
  gpus: [{ name: 'Apple M2 Pro', vramMB: 24576, vramDynamic: true, type: 'apple-silicon' }],
  totalVramMB: 24576,
  platform: 'darwin',
  isAppleSilicon: true,
};

const hwNvidia: HardwareProfile = {
  cpu: 'Intel Core i9-13900K',
  cores: 24,
  ramGB: 64,
  gpus: [{ name: 'NVIDIA RTX 4090', vramMB: 24576, vramDynamic: false, type: 'dedicated' }],
  totalVramMB: 24576,
  platform: 'linux',
  isAppleSilicon: false,
};

const hwNoGpu: HardwareProfile = {
  cpu: 'Intel Core i7-1165G7',
  cores: 8,
  ramGB: 16,
  gpus: [],
  totalVramMB: 0,
  platform: 'linux',
  isAppleSilicon: false,
};

const sampleResults: CompatResult[] = [
  {
    modelId: 'meta-llama/Llama-2-7b',
    modelName: 'Llama 2 7B',
    status: 'compatible',
    symbol: '✔',
    requiredVramMB: 14336,
    availableVramMB: 24576,
    recommendation: 'Fits in VRAM',
    gated: false,
  },
  {
    modelId: 'meta-llama/Llama-2-70b',
    modelName: 'Llama 2 70B',
    status: 'incompatible',
    symbol: '❌',
    requiredVramMB: 140288,
    availableVramMB: 24576,
    recommendation: 'Requires more VRAM',
    gated: false,
  },
];

describe('toJson', () => {
  it('returns a valid JSON string', () => {
    const result = toJson(sampleResults, hwApple);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('parsed output contains hardware, results, and generatedAt', () => {
    const parsed = JSON.parse(toJson(sampleResults, hwApple));
    expect(parsed).toHaveProperty('hardware');
    expect(parsed).toHaveProperty('results');
    expect(parsed).toHaveProperty('generatedAt');
  });

  it('results array has correct length', () => {
    const parsed = JSON.parse(toJson(sampleResults, hwApple));
    expect(parsed.results).toHaveLength(2);
  });

  it('hardware fields are serialized correctly', () => {
    const parsed = JSON.parse(toJson(sampleResults, hwApple));
    expect(parsed.hardware.cpu).toBe('Apple M2 Pro');
    expect(parsed.hardware.ramGB).toBe(32);
    expect(parsed.hardware.isAppleSilicon).toBe(true);
  });
});

describe('buildHardwareSummary', () => {
  it('includes "Apple Silicon" for Apple Silicon hardware', () => {
    const summary = buildHardwareSummary(hwApple);
    expect(summary).toContain('Apple Silicon');
  });

  it('includes GPU name for discrete GPU hardware', () => {
    const summary = buildHardwareSummary(hwNvidia);
    expect(summary).toContain('NVIDIA RTX 4090');
  });

  it('includes "CPU inference" when no GPU present', () => {
    const summary = buildHardwareSummary(hwNoGpu);
    expect(summary).toContain('CPU inference');
  });
});
