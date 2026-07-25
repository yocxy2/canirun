export interface GpuInfo {
  name: string;
  vramMB: number;
  vramDynamic: boolean;
  type: 'dedicated' | 'integrated' | 'apple-silicon';
}

export interface HardwareProfile {
  cpu: string;
  cores: number;
  ramGB: number;
  gpus: GpuInfo[];
  totalVramMB: number;
  platform: 'darwin' | 'linux' | 'win32';
  isAppleSilicon: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  parameterCount: number | null;
  estimatedVramMB: {
    fp16: number | null;
    int8: number | null;
    int4: number | null;
  };
  task: string;
  likes: number;
  gated: boolean;
}

export type CompatStatus = 'compatible' | 'marginal' | 'incompatible' | 'unknown';

export interface CompatResult {
  modelId: string;
  modelName: string;
  status: CompatStatus;
  symbol: '✔' | '⚠' | '❌' | '?';
  requiredVramMB: number | null;
  availableVramMB: number;
  recommendation: string;
  gated: boolean;
}

export interface CliOptions {
  model?: string;
  list?: boolean;
  json?: boolean;
  hfToken?: string;
}
