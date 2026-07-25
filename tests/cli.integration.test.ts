import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';

const CLI = path.resolve(__dirname, '../dist/cli.js');

describe('CLI integration', () => {
  it('--help prints usage and exits 0', () => {
    const result = spawnSync('node', [CLI, '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('canirun');
    expect(result.stdout).toContain('--list');
    expect(result.stdout).toContain('--model');
  });

  it('--version prints version and exits 0', () => {
    const result = spawnSync('node', [CLI, '--version'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('0.1.0');
  });

  it('no flags shows help and exits 0', () => {
    const result = spawnSync('node', [CLI], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
  });

  it('unknown flag exits non-zero', () => {
    const result = spawnSync('node', [CLI, '--unknown-flag'], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
  });

  it.skipIf(!process.env.HF_TOKEN)('--list --json outputs valid JSON with hardware field', async () => {
    const result = spawnSync('node', [CLI, '--list', '--json'], {
      encoding: 'utf8',
      env: { ...process.env },
      timeout: 30000,
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('hardware');
    expect(parsed).toHaveProperty('results');
    expect(Array.isArray(parsed.results)).toBe(true);
  });
});
