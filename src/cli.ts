#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

// Load .env silently: ~/.canirun/.env first, then cwd/.env as dev fallback
dotenv.config({ path: path.join(os.homedir(), '.canirun', '.env'), quiet: true });
dotenv.config({ quiet: true });

import { Command } from 'commander';
import { detectHardware } from './hardware/detector.js';
import { fetchTopModels, fetchModel, RateLimitError } from './api/hfClient.js';
import { scoreModel, scoreModels } from './engine/compatibility.js';
import { printTable, toJson } from './output/formatter.js';

const program = new Command();

program
  .name('canirun')
  .description('CLI to evaluate AI model compatibility on local hardware')
  .version('0.1.0');

program
  .option('--list', 'List top-20 AI models with compatibility verdicts')
  .option('--model <name>', 'Evaluate a specific model from HuggingFace Hub')
  .option('--json', 'Output results as JSON')
  .helpOption('-h, --help', 'Display help information');

program.action(async (options) => {
  const token = process.env.HF_TOKEN;

  // Show help if no flags
  if (!options.list && !options.model) {
    program.help();
    return;
  }

  let hw;
  try {
    hw = await detectHardware();
  } catch (err) {
    console.error('[canirun] Fatal: Could not detect hardware.', err);
    process.exit(1);
  }

  try {
    if (options.list) {
      const models = await fetchTopModels(20, token);
      const results = scoreModels(models, hw);
      if (options.json) {
        console.log(toJson(results, hw));
      } else {
        printTable(results, hw);
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
