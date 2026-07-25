import { listModels } from '@huggingface/hub';
import pLimit from 'p-limit';
import type { ModelInfo } from '../types/index.js';

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function extractParamCount(modelId: string): number | null {
  const match = /(\d+\.?\d*)\s*[Bb]/.exec(modelId);
  if (!match) return null;
  return parseFloat(match[1]) * 1e9;
}

export function estimateVramMB(params: number): { fp16: number; int8: number; int4: number } {
  return {
    fp16: Math.round(params * 2 * 1.2 / 1e6),
    int8: Math.round(params * 1 * 1.2 / 1e6),
    int4: Math.round(params * 0.5 * 1.2 / 1e6),
  };
}

const DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchModel(modelId: string, token?: string): Promise<ModelInfo | null> {
  const url = `https://huggingface.co/api/models/${modelId}?full=true`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const doFetch = async (): Promise<Response> => {
    return fetch(url, { headers });
  };

  let response = await doFetch();

  if (response.status === 429) {
    await sleep(DELAY_MS);
    response = await doFetch();
    if (response.status === 429) {
      throw new RateLimitError('HuggingFace API rate limit exceeded. Set HF_TOKEN env var for higher limits.');
    }
  }

  if (response.status === 404) {
    return null;
  }

  // 401 = gated model requiring auth — skip gracefully instead of crashing
  if (response.status === 401 || response.status === 403) {
    console.warn(`[canirun] Skipping gated model '${modelId}' (requires HF_TOKEN with access grant).`);
    return null;
  }

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();

  // Extract parameterCount: prefer safetensors.total, fallback to regex on modelId
  let parameterCount: number | null = data.safetensors?.total ?? null;
  if (parameterCount === null) {
    parameterCount = extractParamCount(modelId);
  }

  const estimatedVramMB = parameterCount
    ? estimateVramMB(parameterCount)
    : { fp16: null, int8: null, int4: null };

  return {
    id: data.modelId ?? modelId,
    name: data.modelId ?? modelId,
    parameterCount,
    estimatedVramMB,
    task: data.pipeline_tag ?? 'unknown',
    likes: data.likes ?? 0,
    gated: data.gated === true || data.gated === 'auto' || data.gated === 'manual',
  };
}

// Curated list of popular, always-public models (no token required).
// Covers a range of sizes so users see ✔/⚠/❌ verdicts on their hardware.
const CURATED_MODELS = [
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
  'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
  'Qwen/Qwen2.5-72B-Instruct',
  'Qwen/Qwen2.5-32B-Instruct',
  'Qwen/Qwen2.5-14B-Instruct',
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen2.5-3B-Instruct',
  'Qwen/Qwen2.5-1.5B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3',
  'mistralai/Mistral-Small-3.1-24B-Instruct-2503',
  'microsoft/phi-2',
  'microsoft/Phi-3.5-mini-instruct',
  'HuggingFaceTB/SmolLM2-1.7B-Instruct',
  'stabilityai/stablelm-2-1_6b',
  'bigscience/bloom-7b1',
];

export async function fetchTopModels(limit: number, token?: string): Promise<ModelInfo[]> {
  // With a token: fetch live top-liked models from HF API (may include gated ones the user has access to)
  // Without token: use curated public list — works out of the box for every user
  const modelIds = token
    ? await fetchTopModelIds(limit, token)
    : CURATED_MODELS.slice(0, limit);

  const limiter = pLimit(5);
  const results = await Promise.all(
    modelIds.map((id) => limiter(() => fetchModel(id, token)))
  );

  return results.filter((m): m is ModelInfo => m !== null);
}

async function fetchTopModelIds(limit: number, token: string): Promise<string[]> {
  const entries: string[] = [];
  for await (const model of listModels({
    sort: 'likes',
    limit,
    accessToken: token,
  })) {
    if (model.id) entries.push(model.id);
    if (entries.length >= limit) break;
  }
  return entries;
}
