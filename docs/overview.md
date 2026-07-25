# canIrun: Beginner-Friendly Overview

Welcome to **canIrun**! This guide is tailored for junior developers—especially those new to TypeScript, hardware detection, and CLI development. We'll walk through the codebase step by step, using real code, diagrams, and practical explanations.

---

## 1. What is canIrun?

### Plain-English Intro

**canIrun** is a command-line tool that helps you figure out which popular AI models you can run on your local computer—based on your hardware specs (CPU, RAM, and GPU). It checks your system, fetches model requirements from HuggingFace, and tells you whether you can run each model comfortably, marginally (with restrictions), or not at all.

#### Problem Solved
*"Can I run Llama-3-7B on my laptop, or do I need to use cloud inference?"*

Instead of guessing, canIrun:
- Detects your hardware (including Apple Silicon quirks, discrete GPUs, RAM)
- Fetches a curated list of models and their requirements
- Compares model VRAM needs to your available resources
- Outputs easy-to-read verdicts

#### Concrete Example
```shell
canirun --list
```
Displays:
```
Hardware: Apple M2 Pro | 32 GB RAM | Apple Silicon (~24 GB effective VRAM)

Model                                    Req VRAM    Avail    Verdict
─────────────────────────────────────────────────────────────────────
meta-llama/Llama-3-7B                    16.8 GB    24 GB   ✔ Runs in full FP16 precision.
mistralai/Mistral-7B-v0.1                15.4 GB    24 GB   ✔ Runs in full FP16 precision.
google/gemma-2-27b                       64.8 GB    24 GB   ✘ Insufficient VRAM.
```
---

## 2. Big-Picture Flow: ASCII Diagram

```
        +-------------+       +-------------------+       +-----------------+      +--------------------+      +--------------+
        | CLI (canirun) | --> | Hardware Detection | --> | Model Fetching  | --> | VRAM Scoring        | --> | Verdicts      |
        +-------------+       +-------------------+       +-----------------+      +--------------------+      +--------------+
  CLI options          |      |   CPU, RAM, GPU    |      | HuggingFace API |      |   FP16 / INT4 math  |      |  ✔ Marginal ✘ ? |
  (e.g. --list,        |      |   Apple/Intel/NV   |------| curated + top   |      |  Formula-based      |      |  Chalk/color  |
  --model, --json)     |      +-------------------+      +-----------------+      +--------------------+      +--------------+
```

---

## 3. Project Structure: Annotated Directory Tree

```
canirun/
├── src/
│   ├── cli.ts               # Entry-point CLI logic (commander, dotenv, orchestration)
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces (hardware, models, results)
│   ├── hardware/
│   │   └── detector.ts      # Hardware detection (systeminformation, Apple/NV/AMD logic)
│   ├── api/
│   │   └── hfClient.ts      # HuggingFace API client (model fetching, curation, retry, p-limit)
│   ├── engine/
│   │   └── compatibility.ts # VRAM formulas, scoring, verdict computation
│   ├── output/
│   │   └── formatter.ts     # Table output, Chalk color, JSON serialization
├── tests/
│   ├── cli.integration.test.ts        # End-to-end CLI flag handling, output checks
│   ├── output/formatter.test.ts       # Hardware summary, JSON validation
│   ├── engine/compatibility.test.ts   # VRAM scoring logic, edge cases
│   ├── api/hfClient.test.ts           # API call mocking, retry logic
│   ├── hardware/detector.test.ts      # Hardware detection, Apple/NV/AMD fixture tests
├── dist/                   # Compiled output (after build)
├── docs/overview.md        # This file — comprehensive guide
├── README.md               # Quickstart, usage, install instructions
├── package.json            # Project config, scripts, dependencies
├── tsconfig.json           # TypeScript config (strict, CommonJS)
├── Formula/canirun.rb      # Homebrew formula for Mac install
```

**Notes:**
- Every module is single-purpose; navigation is beginner-friendly.
- Tests are organized by module for clarity.
---

## 4. Entry Point: `src/cli.ts` — Line-by-Line Walkthrough

We start here because it's the user-facing entrypoint. This file orchestrates everything.

### The Shebang Line
```ts
#!/usr/bin/env node
```
Tells your OS to run this file with Node.js as a CLI.

---

### Environment Setup (`dotenv`)
```ts
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

// Load .env silently: ~/.canirun/.env first, then cwd/.env as fallback
dotenv.config({ path: path.join(os.homedir(), '.canirun', '.env'), quiet: true });
dotenv.config({ quiet: true });
```
Loads environment variables for API tokens, etc. Order matters: try user home first, fallback to current dir.

---

### Commander: Parsing CLI Flags

```ts
import { Command } from 'commander';

const program = new Command();

program
  .name('canirun')
  .description('CLI to evaluate AI model compatibility on local hardware')
  .version('0.1.0')
  .option('--list', 'List top-20 AI models with compatibility verdicts')
  .option('--model <name>', 'Evaluate a specific model from HuggingFace Hub')
  .option('--json', 'Output results as JSON')
  .helpOption('-h, --help', 'Display help information');
```
**Key concept:** Commander makes it easy to define user-friendly CLI flags.

---

### Main Action: Hardware Detection, Fetch, Scoring

```ts
program.action(async (options) => {
  const token = process.env.HF_TOKEN;

  // Show help if no flags
  if (!options.list && !options.model) {
    program.help();
    return;
  }

  let hw;
  try {
    hw = await detectHardware();             // Hardware detection
  } catch (err) {
    console.error('[canirun] Fatal: Could not detect hardware.', err);
    process.exit(1);
  }

  try {
    if (options.list) {
      const models = await fetchTopModels(20, token);  // Fetch models
      const results = scoreModels(models, hw);         // Score
      if (options.json) {
        console.log(toJson(results, hw));              // JSON output
      } else {
        printTable(results, hw);                      // Table output
      }
    } else if (options.model) {
      const model = await fetchModel(options.model, token);
      if (!model) {
        console.error(`[canirun] Model '${options.model}' not found on HuggingFace Hub.`);
        process.exit(1);
      }
      const result = scoreModel(model, hw);
      if (options.json) {
        console.log(toJson([result], hw));
      } else {
        printTable([result], hw);
      }
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error('[canirun] HuggingFace API rate limit exceeded. Set HF_TOKEN env var for higher limits.');
      process.exit(1);
    }
    if (err instanceof Error && err.message.includes('fetch')) {
      console.error('[canirun] Could not connect to HuggingFace. Check your internet connection.');
      process.exit(1);
    }
    console.error('[canirun] Unexpected error:', err);
    process.exit(1);
  }
});

program.parseAsync(process.argv);
```

**Main takeaways:**
- Detects hardware first.
- Fetches and evaluates models.
- Error handling is robust: hardware errors, API errors, rate limits, and unknowns are handled gracefully.

---

## 5. Module Deep-Dives

### A. `src/types/index.ts`: Interfaces & Compile-Time Safety

TypeScript interfaces create the shapes your data must follow, helping catch errors before runtime.

#### Core Interfaces:
```ts
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
```
**Why:** These enforce structure, ensuring all modules agree on data shapes. Compile-time safety saves debugging time.

---

### B. `src/hardware/detector.ts`: Hardware Detection & Apple Silicon Logic

Detects CPU, RAM, GPU(s), and handles platform differences.

#### Key logic: Apple Silicon
```ts
function isAppleSiliconController(controller) {
  if (controller.vramDynamic === true) return true;
  if (controller.vendor?.toLowerCase().includes('apple')) return true;
  if (/apple[0-9]+/i.test(controller.metalVersion ?? '')) return true;
  return false;
}
... // Later
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
}
```
**Fallbacks**
- If no GPU detected, uses 50% of RAM as VRAM. Ensures the CLI doesn't crash for odd hardware.

#### Example Return Shape
```ts
return {
  cpu,
  cores,
  ramGB,
  gpus,
  totalVramMB,
  platform: process.platform as 'darwin' | 'linux' | 'win32',
  isAppleSilicon,
};
```

---

### C. `src/api/hfClient.ts`: HuggingFace Client, Model Curation, API Handling

#### Model Fetching Logic
```ts
export async function fetchModel(modelId: string, token?: string): Promise<ModelInfo | null> {
  const url = `https://huggingface.co/api/models/${modelId}?full=true`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  ...
  // Checks for 429 (rate limit): retries after delay
  if (response.status === 429) {
    await sleep(DELAY_MS);
    response = await doFetch();
    if (response.status === 429) {
      throw new RateLimitError('HuggingFace API rate limit exceeded. Set HF_TOKEN env var for higher limits.');
    }
  }
  // Handles gated models gracefully
  if (response.status === 401 || response.status === 403) {
    console.warn(`[canirun] Skipping gated model '${modelId}' (requires HF_TOKEN with access grant).`);
    return null;
  }
}
```
**Curated Model List:**
- Ensures --list works for all users, even without an API token.
- Supports live top models for advanced users with tokens.

#### p-limit for Parallel Fetching
```ts
const limiter = pLimit(5);
const results = await Promise.all(
  modelIds.map((id) => limiter(() => fetchModel(id, token)))
);
```
**Why:** Keeps API calls fast without overwhelming HuggingFace (max 5 concurrent).

---

### D. `src/engine/compatibility.ts`: VRAM Formulas, Scoring Tiers

Calculates if your hardware can truly run a model.

#### Main Formula
```ts
function getEffectiveVramMB(hw: HardwareProfile): number {
  // If no GPU, use 50% of RAM as CPU-inference budget
  if (hw.totalVramMB === 0) {
    return Math.round(hw.ramGB * 1024 * 0.5);
  }
  return hw.totalVramMB;
}
```
#### Verdict Computation
```ts
if (availVramMB >= fp16) {
  return { status: 'compatible', symbol: '✔', recommendation: 'Runs in full FP16 precision.' };
} else if (availVramMB >= int4) {
  return { status: 'marginal', symbol: '⚠', recommendation: 'Runs with INT4 quantization only.' };
} else {
  return { status: 'incompatible', symbol: '✘', recommendation: 'Insufficient VRAM.' };
}
```

---

### E. `src/output/formatter.ts`: Table Rendering, Chalk v4/v5, JSON Output

#### Table Output
```ts
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
}
```

#### Chalk Version Handling
- Uses Chalk v4, which has slightly different syntax from v5.
- Colorizes verdicts: green for ✔, yellow for ⚠, red for ✘, gray for ?

#### JSON Output
```ts
export function toJson(results: CompatResult[], hw: HardwareProfile): string {
  const output = {
    hardware: {...},
    results,
    generatedAt: new Date().toISOString(),
  };
  return JSON.stringify(output, null, 2);
}
```
---

## 6. Test Suite: Coverage, Mocking, Running

**canIrun** uses [Vitest](https://vitest.dev/) for unit and integration tests, with clear separation by module.

#### Run All Tests
```shell
npm test
```

### Overview

| File                           | Covers                              |
| ------------------------------ | ----------------------------------- |
| cli.integration.test.ts        | CLI flag handling, output, exits     |
| hardware/detector.test.ts      | Detection logic, Apple/NV/AMD cases  |
| engine/compatibility.test.ts   | VRAM scoring, edge cases             |
| api/hfClient.test.ts           | API call success/failure, retry/429  |
| output/formatter.test.ts       | JSON output, table formatting, colors|

#### Mocks & Fixtures
- Mocks `systeminformation` for hardware detection.
- Mocks global `fetch` for API tests.
- Uses fixtures (fake hardware/models) for deterministic testing.

#### Skipped Test (API Token)
```ts
it.skipIf(!process.env.HF_TOKEN)('--list --json outputs valid JSON with hardware field', async () => { ... });
```
Skips live API tests if token is absent.

---

## 7. Key Concepts for Juniors

### Type Guards
```ts
if (err instanceof RateLimitError) { ... }
```
Ensures safe error handling (TypeScript-specific).

### Async/Await
```ts
const hw = await detectHardware();
```
All hardware/network calls are asynchronous. Makes CLI responsive.

### ESM vs CJS
- Project uses CommonJS (`type": "commonjs"` in package.json).
- Allows easy CLI execution and compatibility with most Node tooling.

### dotenv
- Loads API tokens/config from `.env` files, seamlessly.

### p-limit
- Restricts parallel API requests to avoid rate limiting.

### Shebang Line
- The `#!/usr/bin/env node` line at the start of `cli.ts` ensures the script runs as a CLI on Mac/Linux.

### Error Handling
- Catches all fatal errors and exits gracefully. No silent failures for users.

---

## 8. Common Tasks / How-To

### Add a New Model to Curated List
Edit `src/api/hfClient.ts`, CURATED_MODELS array:
```ts
const CURATED_MODELS = [
  ...
  'meta-llama/Llama-3-7B', // Add your model here
];
```

### Change VRAM Formula
Edit `src/engine/compatibility.ts`, `getEffectiveVramMB` function:
```ts
function getEffectiveVramMB(hw: HardwareProfile): number {
  // Adjust to 60% RAM for CPU-only if needed
  if (hw.totalVramMB === 0) {
    return Math.round(hw.ramGB * 1024 * 0.6);
  }
  return hw.totalVramMB;
}
```

### Add a CLI Flag
Edit `src/cli.ts`, add .option:
```ts
program.option('--yourflag', 'Description');
```
And handle it in the main action.

### Run All Tests
```shell
npm test
```

### Update FP16/INT4 Formula
Edit `src/api/hfClient.ts`, `estimateVramMB`:
```ts
return {
  fp16: Math.round(params * 2 * 1.2 / 1e6),   // tweak multiplier if needed
  int8: Math.round(params * 1 * 1.2 / 1e6),
  int4: Math.round(params * 0.5 * 1.2 / 1e6),
};
```
---

## 9. Architecture Decisions & Tradeoffs

### Homebrew Support
- Formula/canirun.rb provided for easy Mac install
- Streamlines UX for non-developers

### CommonJS
- Used for easiest CLI support (Node compatibility > ESM quirks)

### Curated Model List
- Guarantees functionality out of the box for new users
- Enables extension for advanced/tokener users

### Chalk@4
- Preferred for wide Node version support and compatibility

### p-limit(5)
- Ensures fast fetching without overwhelming HuggingFace

---

## 10. Known Limitations

- Test suite skips live API interaction without HF_TOKEN (for safety)
- VRAM formulas are heuristic—not exact; real-world differences may exist
- Only checks RAM/VRAM, not SSD space or bandwidth
- Gated models (requires HF_TOKEN grant) are skipped automatically
- In some edge hardware cases (e.g., rare ARM chips), detection may be imperfect, but robust fallbacks prevent crashes

---

## 11. Next Steps for Juniors

If you want to extend canIrun or learn more:

- Add new models to the curated list and re-run the CLI
- Experiment with VRAM formulas; see how changes affect verdicts
- Add your own CLI flags (e.g., --filter <task-type>)
- Write new test cases for edge hardware
- Try switching the output formatting to use cli-table3 for even fancier table display
- Explore TypeScript interfaces—add safety checks, more properties
- Help document known hardware quirks from your own machines

---

## References
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [Vitest: Testing Framework](https://vitest.dev/)
- [Commander: CLI Parser](https://npmjs.com/package/commander)
- [chalk: Terminal Colors](https://npmjs.com/package/chalk)
- [dotenv: Env Vars](https://npmjs.com/package/dotenv)
- [p-limit: Async Throttle](https://npmjs.com/package/p-limit)
- [systeminformation: Hardware Detection](https://npmjs.com/package/systeminformation)

---

**Happy hacking! – The canIrun team**
