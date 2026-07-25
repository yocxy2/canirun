import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fetchModel, extractParamCount, estimateVramMB, RateLimitError } from '../../src/api/hfClient.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock setTimeout to avoid actual delays in tests
vi.useFakeTimers();

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to create a mock Response
function mockResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 404 ? 'Not Found' : status === 429 ? 'Too Many Requests' : 'OK',
    json: async () => body,
  } as unknown as Response;
}

describe('fetchModel()', () => {
  it('T9-1: happy path — returns ModelInfo with parameterCount from safetensors.total', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, {
        modelId: 'meta-llama/Llama-3-8B',
        safetensors: { total: 8_000_000_000 },
        pipeline_tag: 'text-generation',
        likes: 1234,
        gated: false,
      })
    );

    const result = await fetchModel('meta-llama/Llama-3-8B');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('meta-llama/Llama-3-8B');
    expect(result!.parameterCount).toBe(8_000_000_000);
    expect(result!.task).toBe('text-generation');
    expect(result!.likes).toBe(1234);
    // fp16: 8e9 * 2 * 1.2 / 1e6 = 19200
    expect(result!.estimatedVramMB.fp16).toBe(19200);
    expect(result!.estimatedVramMB.int8).toBe(9600);
    expect(result!.estimatedVramMB.int4).toBe(4800);
  });

  it('T9-2: missing safetensors, has "7B" in ID → parameterCount=7e9 via regex', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, {
        modelId: 'mistralai/Mistral-7B-Instruct',
        safetensors: null,
        pipeline_tag: 'text-generation',
        likes: 500,
        gated: false,
      })
    );

    const result = await fetchModel('mistralai/Mistral-7B-Instruct');

    expect(result).not.toBeNull();
    expect(result!.parameterCount).toBe(7e9);
    // fp16: 7e9 * 2 * 1.2 / 1e6 = 16800
    expect(result!.estimatedVramMB.fp16).toBe(16800);
  });

  it('T9-3: 404 → returns null', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(404, {}));

    const result = await fetchModel('nonexistent/model');

    expect(result).toBeNull();
  });

  it('T9-4: 429 → waits 2s → retries → success on second call', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(429, {}))
      .mockResolvedValueOnce(
        mockResponse(200, {
          modelId: 'some/model',
          safetensors: { total: 7_000_000_000 },
          pipeline_tag: 'text-generation',
          likes: 100,
          gated: false,
        })
      );

    const promise = fetchModel('some/model');

    // Advance timers to trigger the sleep(2000)
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).not.toBeNull();
    expect(result!.parameterCount).toBe(7_000_000_000);
  });

  it('T9-5: 429 → retries → still 429 → throws RateLimitError', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(429, {}))
      .mockResolvedValueOnce(mockResponse(429, {}));

    let caughtError: unknown;
    const promise = fetchModel('some/model').catch((err) => {
      caughtError = err;
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(caughtError).toBeInstanceOf(RateLimitError);
  });
});

describe('extractParamCount()', () => {
  it('T11-1: "Llama-3-7B" → 7e9', () => {
    expect(extractParamCount('Llama-3-7B')).toBe(7e9);
  });

  it('T11-2: "gemma-2-27b" → 27e9', () => {
    expect(extractParamCount('gemma-2-27b')).toBe(27e9);
  });

  it('T11-3: "some-model-no-size" → null', () => {
    expect(extractParamCount('some-model-no-size')).toBeNull();
  });
});

describe('estimateVramMB()', () => {
  it('7B params → correct fp16/int8/int4', () => {
    const result = estimateVramMB(7e9);
    expect(result.fp16).toBe(16800);  // 7e9 * 2 * 1.2 / 1e6
    expect(result.int8).toBe(8400);   // 7e9 * 1 * 1.2 / 1e6
    expect(result.int4).toBe(4200);   // 7e9 * 0.5 * 1.2 / 1e6
  });

  it('72B params → correct estimates', () => {
    const result = estimateVramMB(72e9);
    expect(result.fp16).toBe(172800); // 72e9 * 2 * 1.2 / 1e6
    expect(result.int8).toBe(86400);
    expect(result.int4).toBe(43200);
  });
});
