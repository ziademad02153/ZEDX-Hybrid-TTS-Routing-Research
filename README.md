# Fault-Resilient Cloud–Local Routing for Arabic Text-to-Speech

Research code and frozen evaluation artifacts for **Fault-Resilient Cloud-Local Routing for Arabic Text-to-Speech: A Trace-Driven and Perceptual Evaluation**.

**Publication status:** submitted to the *International Journal of Speech Technology* (Springer Nature), October 2026. Not accepted or peer-reviewed at the time of this repository release.

## What is evaluated

Five routing policies are compared using paired Arabic ElevenLabs/Piper latency traces: cloud only, local only, static length routing, cloud with per-request fallback, and a stateful circuit breaker. The evaluation uses six simulated scenarios, 100 seeds per scenario, and 10,000 requests per seed: **6 million workload requests and 30 million baseline policy decisions**. Additional sensitivity sweeps are included.

The listening dataset contains 360 clip ratings from 30 eligible participants. The trace dataset contains 240 records; 192 held-out records form 96 cloud/local pairs. Run 1 is excluded from the evaluation split.

## Reproduce the simulation

Requires **Node.js 22 or newer**. The simulation and verification commands use only Node's standard library: no API keys, model downloads, cloud requests, or npm dependencies are needed.

```sh
git clone https://github.com/ziademad02153/ZEDX-Hybrid-TTS-Routing-Research.git
cd ZEDX-Hybrid-TTS-Routing-Research
npm run verify
npm run reproduce
```

`verify` checks checksums, every baseline aggregate against its 100 seed rows, trace pairing, and MOS dataset structure. `reproduce` runs the complete original evaluation in a new temporary directory, then compares all five numeric output CSVs byte for byte against the frozen results. The temporary path is printed for inspection. The reference files are not overwritten.

`npm run simulate` runs the original script **in place and overwrites files in `results/`**. Prefer `reproduce` for validation.

## Reproduce the statistical analysis

Requires **Python 3.10 or newer**, with no third-party packages.

```sh
python analysis/mos_statistics.py
python analysis/paired_statistics.py
```

The MOS analysis first averages ratings within each participant and provider. The paired simulation analysis treats seed outcomes as paired observations; it does not treat millions of simulated requests as independent statistical samples. Both use a tie-corrected asymptotic Wilcoxon signed-rank calculation with continuity correction. Simulation p-values are adjusted using Holm correction within each scenario's six-metric family.

## Repository map

| Path | Contents |
| --- | --- |
| `simulator/run_final_v12.js` | Authoritative frozen evaluation runner |
| `simulator/final_simulator_v12_fixed.js` | Historical companion required by the original runner's checksum list; not the evaluation entry point |
| `config/` | Frozen circuit-breaker, pricing, and workload configuration |
| `data/raw/` | Provider measurement traces |
| `data/processed/` | Anonymized eligible-participant MOS ratings |
| `results/` | Frozen per-seed, aggregate, sensitivity, invariant, and execution artifacts |
| `figures/` | Three archived manuscript figures in PNG and PDF formats |
| `analysis/` | Portable MOS and paired-seed statistical analysis |
| `tests/` | Artifact validation and isolated full reproduction |
| `supplementary/` | Statistical audit preserved from the submitted supplement |
| `docs/` | Methods, provenance, publication exclusions, and verification notes |

## Reading the results

In the sustained simulated cloud outage (S3), mean failed cloud attempts fall from **59.18** with per-request fallback to **6.00** with the circuit breaker, a reduction of **89.9%**. Mean per-seed p95 response latency falls from **1292.55 ms to 1253.00 ms**. This is a scenario-specific result, not a universal superiority or availability claim. Under intermittent failures, per-request fallback can preserve higher estimated perceptual quality.

The `e2e_*` column names are retained for compatibility with the submitted artifacts. They measure simulated **time to first audio response**, including an assumed failed-cloud penalty before local fallback. They do **not** measure completion of speech generation or playback. See [methods and limitations](docs/METHODS.md).

## Scope and publication

This repository supports replay of existing traces and ratings. It is not a deployment of ZEDX, a concurrent-user load test, or a self-contained live provider benchmark. No participant contact details, submission correspondence, manuscript drafts, model weights, or generated speech recordings are included.

The submitted supplement is preserved unchanged; its opening paragraph contains an earlier working title. The title at the top of this README is the submitted manuscript title. Repository maintenance corrections do not modify the frozen experimental results or the submitted manuscript.

No license has been granted in this release. Do not infer permission to redistribute third-party models or speech recordings. A reuse license and archival DOI can be added separately after the author selects the terms.

See [release verification](docs/VERIFICATION.md) for the checks actually performed before publication.
