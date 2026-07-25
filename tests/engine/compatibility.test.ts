import { describe, it, expect } from 'vitest';
import { scoreModel, scoreModels, getEffectiveVramMB } from '../../src/engine/compatibility.js';
import type { HardwareProfile, ModelInfo } from '../../src/types/index.js';

// --- Fixtures ---

const hw32gb: HardwareProfile = {
  cpu: 'Apple M2 Pro', cores: 10, ramGB: 32,
  gpus: [{ name: 'Apple M2 Pro', vramMB: 24576, vramDynamic: true, type: 'apple-silicon' }],
  totalVramMB: 24576, platform: 'darwin', isAppleSilicon: true,
};

const hw8gb: HardwareProfile = {
  cpu: 'Intel Core i7', cores: 8, ramGB: 16,
  gpus: [{ name: 'NVIDIA RTX 3060', vramMB: 8192, vramDynamic: false, type: 'dedicated' }],
  totalVramMB: 8192, platform: 'darwin', isAppleSilicon: false,
};

const hwCpuOnly: HardwareProfile = {
  cpu: 'Intel Core i5', cores: 4, ramGB: 16,
  gpus: [], totalVramMB: 0, platform: 'linux', isAppleSilicon: false,
};

// 7B model: fp16=16800, int8=8400, int4=4200
const model7b: ModelInfo = {
  id: 'meta-llama/Llama-3-7B', name: 'Llama-3-7B',
  parameterCount: 7e9,
  estimatedVramMB: { fp16: 16800, int8: 8400, int4: 4200 },
  task: 'text-generation', likes: 1000, gated: false,
};

// 70B model: fp16=168000, int4=42000
const model70b: ModelInfo = {
  id: 'meta-llama/Llama-3-70B', name: 'Llama-3-70B',
  parameterCount: 70e9,
  estimatedVramMB: { fp16: 168000, int8: 84000, int4: 42000 },
  task: 'text-generation', likes: 2000, gated: false,
};

// Unknown size model
const modelUnknown: ModelInfo = {
  id: 'some/unknown-model', name: 'unknown-model',
  parameterCount: null,
  estimatedVramMB: { fp16: null, int8: null, int4: null },
  task: 'unknown', likes: 0, gated: false,
};

// --- Tests ---

describe('compatibility engine', () => {
  describe('getEffectiveVramMB', () => {
    it('returns totalVramMB when GPU is present', () => {
      expect(getEffectiveVramMB(hw32gb)).toBe(24576);
    });

    it('returns 50% of RAM (in MB) when no GPU (CPU-only)', () => {
      // 16 GB * 1024 * 0.5 = 8192 MB
      expect(getEffectiveVramMB(hwCpuOnly)).toBe(8192);
    });
  });

  describe('scoreModel', () => {
    it('T14: 32GB Apple Silicon + 7B model → compatible (24576 >= 16800)', () => {
      const result = scoreModel(model7b, hw32gb);
      expect(result.status).toBe('compatible');
      expect(result.symbol).toBe('✔');
      expect(result.requiredVramMB).toBe(16800);
      expect(result.availableVramMB).toBe(24576);
    });

    it('T15: 8GB GPU + 7B model → marginal (8192 >= 4200 but < 16800)', () => {
      const result = scoreModel(model7b, hw8gb);
      expect(result.status).toBe('marginal');
      expect(result.symbol).toBe('⚠');
      expect(result.requiredVramMB).toBe(4200);
      expect(result.availableVramMB).toBe(8192);
    });

    it('8GB GPU + 70B model → incompatible (8192 < 42000)', () => {
      const result = scoreModel(model70b, hw8gb);
      expect(result.status).toBe('incompatible');
      expect(result.symbol).toBe('❌');
      expect(result.requiredVramMB).toBe(42000);
      expect(result.availableVramMB).toBe(8192);
    });

    it('unknown size model → unknown status', () => {
      const result = scoreModel(modelUnknown, hw32gb);
      expect(result.status).toBe('unknown');
      expect(result.symbol).toBe('?');
      expect(result.requiredVramMB).toBeNull();
    });

    it('CPU-only (16GB RAM) + 7B model → marginal (8192 >= 4200 but < 16800)', () => {
      const result = scoreModel(model7b, hwCpuOnly);
      expect(result.status).toBe('marginal');
      expect(result.symbol).toBe('⚠');
      // effective VRAM = 16 * 1024 * 0.5 = 8192
      expect(result.availableVramMB).toBe(8192);
      expect(result.requiredVramMB).toBe(4200);
    });
  });

  describe('scoreModels', () => {
    it('T16: returns array of results with correct length', () => {
      const models = [model7b, model70b, modelUnknown];
      const results = scoreModels(models, hw32gb);
      expect(results).toHaveLength(3);
      expect(results[0].modelId).toBe('meta-llama/Llama-3-7B');
      expect(results[1].modelId).toBe('meta-llama/Llama-3-70B');
      expect(results[2].modelId).toBe('some/unknown-model');
    });
  });
});
