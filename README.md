# canIrun

> CLI to evaluate which AI models can run on your local hardware.

---

**Project status: Under active development. This project is intended for learning purposes only.**

- Inspired by [canIrun.ia](https://canirun.ia)
- Currently, only a curated set of models is available. We are actively exploring methods to fetch more models from HuggingFace Hub and other sources.

---

## Install

### Via Homebrew (recommended)
```bash
brew tap estephanobrusa/canirun
brew install canirun
```

### From source
```bash
git clone https://github.com/estephanobrusa/canirun
cd canirun
npm install
npm run build
npm link
```

## Usage

```bash
# List top-20 AI models with compatibility verdicts
canirun --list

# Check a specific model
canirun --model meta-llama/Llama-3-7B

# JSON output (for scripting)
canirun --list --json
canirun --model mistralai/Mistral-7B --json
```

## Output

```
Hardware: Apple M2 Pro | 32 GB RAM | Apple Silicon (~24 GB effective VRAM)

Model                                    Req VRAM    Avail    Verdict
─────────────────────────────────────────────────────────────────────
meta-llama/Llama-3-7B                    16.8 GB    24 GB   ✔ Runs in full FP16 precision.
mistralai/Mistral-7B-v0.1                15.4 GB    24 GB   ✔ Runs in full FP16 precision.
google/gemma-2-27b                       64.8 GB    24 GB   ❌ Insufficient VRAM. Consider cloud inference.
```

## Verdicts

| Symbol | Meaning |
|--------|---------|
| ✔ | Compatible — runs in full FP16 precision |
| ⚠ | Marginal — requires INT4 quantization |
| ❌ | Incompatible — insufficient VRAM |
| ? | Unknown — model size could not be determined |

## API Rate Limits

For higher rate limits, set your HuggingFace token:
```bash
export HF_TOKEN=hf_your_token_here
```

## Hardware Detection

- **Apple Silicon**: Detects unified memory; uses 75% of total RAM as effective VRAM budget
- **NVIDIA/AMD**: Reads dedicated VRAM via system information
- **CPU-only**: Uses 50% of system RAM for CPU-based inference estimation

## Development

```bash
npm run dev     # Run with tsx (no build needed)
npm run build   # Compile TypeScript → dist/
npm test        # Run vitest
```

## License

MIT
