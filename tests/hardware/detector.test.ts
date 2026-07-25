import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectHardware } from '../../src/hardware/detector.js';

vi.mock('systeminformation', () => ({
  default: {
    cpu: vi.fn(),
    mem: vi.fn(),
    graphics: vi.fn(),
  },
}));

// Import the mocked module to control return values per test
import si from 'systeminformation';

const siMock = si as {
  cpu: ReturnType<typeof vi.fn>;
  mem: ReturnType<typeof vi.fn>;
  graphics: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('detectHardware()', () => {
  it('T8-1: Apple Silicon M2 with 32 GB RAM → totalVramMB=24576, isAppleSilicon=true', async () => {
    siMock.cpu.mockResolvedValue({ brand: 'Apple M2 Pro', physicalCores: 10, cores: 10 });
    // 32 GB in bytes
    siMock.mem.mockResolvedValue({ total: 32 * 1024 * 1024 * 1024 });
    siMock.graphics.mockResolvedValue({
      controllers: [
        { vramDynamic: true, vram: 0, vendor: 'Apple', model: 'Apple M2 Pro', metalVersion: 'Apple GPU Family 9 v1' },
      ],
    });

    const hw = await detectHardware();

    expect(hw.isAppleSilicon).toBe(true);
    expect(hw.totalVramMB).toBe(24576); // 32 * 1024 * 0.75
    expect(hw.gpus).toHaveLength(1);
    expect(hw.gpus[0].name).toBe('Apple GPU (unified memory)');
    expect(hw.gpus[0].vramDynamic).toBe(true);
    expect(hw.gpus[0].type).toBe('apple-silicon');
    expect(hw.ramGB).toBe(32);
  });

  it('T8-2: Intel Mac with discrete 8192 MB GPU → totalVramMB=8192, isAppleSilicon=false', async () => {
    siMock.cpu.mockResolvedValue({ brand: 'Intel Core i9', physicalCores: 8, cores: 16 });
    siMock.mem.mockResolvedValue({ total: 16 * 1024 * 1024 * 1024 });
    siMock.graphics.mockResolvedValue({
      controllers: [
        { vramDynamic: false, vram: 8192, vendor: 'AMD', model: 'AMD Radeon Pro 5500M' },
      ],
    });

    const hw = await detectHardware();

    expect(hw.isAppleSilicon).toBe(false);
    expect(hw.totalVramMB).toBe(8192);
    expect(hw.gpus).toHaveLength(1);
    expect(hw.gpus[0].type).toBe('dedicated');
    expect(hw.gpus[0].vramMB).toBe(8192);
  });

  it('T8-3: No GPU / integrated only → totalVramMB=0', async () => {
    siMock.cpu.mockResolvedValue({ brand: 'Intel Core i5', physicalCores: 4, cores: 8 });
    siMock.mem.mockResolvedValue({ total: 8 * 1024 * 1024 * 1024 });
    siMock.graphics.mockResolvedValue({
      controllers: [
        { vramDynamic: false, vram: 0, vendor: 'Intel', model: 'Intel Iris Plus' },
      ],
    });

    const hw = await detectHardware();

    expect(hw.isAppleSilicon).toBe(false);
    expect(hw.totalVramMB).toBe(0);
    expect(hw.gpus[0].type).toBe('integrated');
    expect(hw.gpus[0].vramMB).toBe(0);
  });

  it('T8-4: si.graphics() throws → returns empty gpus[], totalVramMB=0, does not crash', async () => {
    siMock.cpu.mockResolvedValue({ brand: 'Apple M1', physicalCores: 8, cores: 8 });
    siMock.mem.mockResolvedValue({ total: 16 * 1024 * 1024 * 1024 });
    siMock.graphics.mockRejectedValue(new Error('GPU detection failed'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hw = await detectHardware();

    expect(hw.gpus).toHaveLength(0);
    expect(hw.totalVramMB).toBe(0);
    expect(hw.isAppleSilicon).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[canirun] Warning: Could not detect GPU'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });

  it('T8-5: si.cpu() throws → returns "Unknown CPU", does not crash', async () => {
    siMock.cpu.mockRejectedValue(new Error('CPU detection failed'));
    siMock.mem.mockResolvedValue({ total: 8 * 1024 * 1024 * 1024 });
    siMock.graphics.mockResolvedValue({ controllers: [] });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hw = await detectHardware();

    expect(hw.cpu).toBe('Unknown CPU');
    expect(hw.cores).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[canirun] Warning: Could not detect CPU'),
      expect.anything(),
    );

    warnSpy.mockRestore();
  });
});
