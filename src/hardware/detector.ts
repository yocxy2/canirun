import si from 'systeminformation';
import type { HardwareProfile, GpuInfo } from '../types/index.js';

function isAppleSiliconController(controller: {
  vramDynamic?: boolean;
  vendor?: string;
  metalVersion?: string | null;
}): boolean {
  if (controller.vramDynamic === true) return true;
  if (controller.vendor?.toLowerCase().includes('apple')) return true;
  if (/apple[0-9]+/i.test(controller.metalVersion ?? '')) return true;
  return false;
}

export async function detectHardware(): Promise<HardwareProfile> {
  // --- CPU ---
  let cpu = 'Unknown CPU';
  let cores = 1;

  try {
    const cpuData = await si.cpu();
    cpu = cpuData.brand || 'Unknown CPU';
    cores = cpuData.physicalCores > 0 ? cpuData.physicalCores : (cpuData.cores ?? 1);
  } catch (err) {
    console.warn('[canirun] Warning: Could not detect CPU information.', err instanceof Error ? err.message : err);
  }

  // --- RAM ---
  let ramGB = 0;
  let totalRamBytes = 0;

  try {
    const memData = await si.mem();
    totalRamBytes = memData.total;
    ramGB = Math.round((memData.total / (1024 ** 3)) * 10) / 10;
  } catch (err) {
    console.warn('[canirun] Warning: Could not detect RAM information.', err instanceof Error ? err.message : err);
  }

  // --- GPU ---
  let gpus: GpuInfo[] = [];
  let totalVramMB = 0;
  let isAppleSilicon = false;

  try {
    const graphicsData = await si.graphics();
    const controllers = graphicsData.controllers ?? [];

    for (const controller of controllers) {
      if (isAppleSiliconController(controller)) {
        // Apple Silicon unified memory — use 75% of total RAM
        const vramBudgetMB = Math.round((totalRamBytes / (1024 * 1024)) * 0.75);
        gpus.push({
          name: 'Apple GPU (unified memory)',
          vramMB: vramBudgetMB,
          vramDynamic: true,
          type: 'apple-silicon',
        });
        isAppleSilicon = true;
      } else if ((controller.vram ?? 0) > 0 && !controller.vramDynamic) {
        // Dedicated GPU
        gpus.push({
          name: controller.model || controller.name || 'Unknown GPU',
          vramMB: controller.vram ?? 0,
          vramDynamic: false,
          type: 'dedicated',
        });
      } else {
        // Integrated GPU
        gpus.push({
          name: controller.model || controller.name || 'Unknown GPU',
          vramMB: controller.vram ?? 0,
          vramDynamic: controller.vramDynamic ?? false,
          type: 'integrated',
        });
      }
    }

    if (isAppleSilicon) {
      // Use 75% of RAM as the VRAM budget for Apple Silicon
      totalVramMB = Math.round((totalRamBytes / (1024 * 1024)) * 0.75);
    } else {
      // Use the max dedicated GPU VRAM, or 0 if none
      const dedicatedVrams = gpus
        .filter((g) => g.type === 'dedicated')
        .map((g) => g.vramMB);
      totalVramMB = dedicatedVrams.length > 0 ? Math.max(...dedicatedVrams) : 0;
    }
  } catch (err) {
    console.warn('[canirun] Warning: Could not detect GPU information.', err instanceof Error ? err.message : err);
    gpus = [];
    totalVramMB = 0;
    isAppleSilicon = false;
  }

  return {
    cpu,
    cores,
    ramGB,
    gpus,
    totalVramMB,
    platform: process.platform as 'darwin' | 'linux' | 'win32',
    isAppleSilicon,
  };
}
