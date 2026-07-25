import type { HardwareProfile, ModelInfo, CompatResult } from '../types/index.js';

function formatMB(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

export function getEffectiveVramMB(hw: HardwareProfile): number {
  // If no GPU, use 50% of RAM as CPU-inference budget
  if (hw.totalVramMB === 0) {
    return Math.round(hw.ramGB * 1024 * 0.5);
  }
  return hw.totalVramMB;
}

export function scoreModel(model: ModelInfo, hw: HardwareProfile): CompatResult {
  const availVramMB = getEffectiveVramMB(hw);
  const { fp16, int4 } = model.estimatedVramMB;

  // Unknown size
  if (model.parameterCount === null || fp16 === null || int4 === null) {
    return {
      modelId: model.id,
      modelName: model.name,
      status: 'unknown',
      symbol: '?',
      requiredVramMB: null,
      availableVramMB: availVramMB,
      recommendation: 'Size unknown. Cannot estimate VRAM requirements.',
      gated: model.gated,
    };
  }

  if (availVramMB >= fp16) {
    return {
      modelId: model.id,
      modelName: model.name,
      status: 'compatible',
      symbol: '✔',
      requiredVramMB: fp16,
      availableVramMB: availVramMB,
      recommendation: 'Runs in full FP16 precision.',
      gated: model.gated,
    };
  }

  if (availVramMB >= int4) {
    return {
      modelId: model.id,
      modelName: model.name,
      status: 'marginal',
      symbol: '⚠',
      requiredVramMB: fp16,   // show fp16 req so user knows the full cost
      availableVramMB: availVramMB,
      recommendation: `Runs with INT4 quantization only (needs ${formatMB(int4)} min). Expect reduced quality.`,
      gated: model.gated,
    };
  }

  return {
    modelId: model.id,
    modelName: model.name,
    status: 'incompatible',
    symbol: '❌',
    requiredVramMB: int4,
    availableVramMB: availVramMB,
    recommendation: 'Insufficient VRAM. Consider cloud inference or a smaller model.',
    gated: model.gated,
  };
}

export function scoreModels(models: ModelInfo[], hw: HardwareProfile): CompatResult[] {
  return models.map(model => scoreModel(model, hw));
}
