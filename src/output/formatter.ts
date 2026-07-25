import chalk from 'chalk';
import type { CompatResult, HardwareProfile } from '../types/index.js';

function formatVramMB(mb: number | null): string {
  if (mb === null) return '  ?  ';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function colorSymbol(symbol: '✔' | '⚠' | '❌' | '?'): string {
  switch (symbol) {
    case '✔': return chalk.green(symbol);
    case '⚠': return chalk.yellow(symbol);
    case '❌': return chalk.red(symbol);
    default:   return chalk.gray(symbol);
  }
}

export function printTable(results: CompatResult[], hw: HardwareProfile): void {
  // Print hardware summary line
  const hwLine = buildHardwareSummary(hw);
  console.log('\n' + chalk.bold('Hardware:') + ' ' + hwLine + '\n');

  // Column headers
  const header = [
    'Model'.padEnd(40),
    'Req VRAM'.padStart(10),
    'Avail'.padStart(10),
    'Verdict',
  ].join('  ');
  console.log(chalk.bold(header));
  console.log('─'.repeat(header.length));

  // Rows
  for (const r of results) {
    const name = r.modelName.length > 39 ? r.modelName.slice(0, 37) + '...' : r.modelName;
    const row = [
      name.padEnd(40),
      formatVramMB(r.requiredVramMB).padStart(10),
      formatVramMB(r.availableVramMB).padStart(10),
      colorSymbol(r.symbol) + ' ' + r.recommendation,
    ].join('  ');
    console.log(row);
  }
  console.log('');
}

export function buildHardwareSummary(hw: HardwareProfile): string {
  const gpu = hw.isAppleSilicon
    ? `Apple Silicon (~${formatVramMB(hw.totalVramMB)} effective VRAM)`
    : hw.gpus.length > 0
      ? `${hw.gpus[0].name} (${formatVramMB(hw.totalVramMB)} VRAM)`
      : 'No GPU (CPU inference)';
  return `${hw.cpu} | ${hw.ramGB} GB RAM | ${gpu}`;
}

export function toJson(results: CompatResult[], hw: HardwareProfile): string {
  const output = {
    hardware: {
      cpu: hw.cpu,
      cores: hw.cores,
      ramGB: hw.ramGB,
      totalVramMB: hw.totalVramMB,
      isAppleSilicon: hw.isAppleSilicon,
      gpus: hw.gpus,
    },
    results,
    generatedAt: new Date().toISOString(),
  };
  return JSON.stringify(output, null, 2);
}
