# Release verification — 11 October 2026

Performed using Node.js and Python on Windows before the repository upload.

## Full simulation

`node tests/reproduce.js` completed successfully in an isolated temporary directory. The original evaluation runner reported 30,000,000 baseline policy decisions and completed its sensitivity sweeps and invariant checks.

All five numeric files were **byte-identical** to the archived reference artifacts:

- `extended_baseline_results_v12_final.csv`
- `extended_per_seed_results_v12_final.csv`
- `robustness_piper_failure_v12_final.csv`
- `robustness_qmin_v12_final.csv`
- `robustness_cloud_penalty_v12_final.csv`

Timestamped execution logs and execution-duration fields were not compared as deterministic outputs.

## Artifact and statistical checks

- All 30 baseline aggregate rows agree with means of their respective 100 per-seed rows to the stored six-decimal precision.
- There are 3,000 unique scenario/policy/seed result rows.
- The held-out trace split has 192 records, forming 96 complete provider pairs.
- The anonymized MOS CSV has 360 ratings from 30 participants.
- Portable MOS calculations recover the archived means, standard deviations, W statistics and significance conclusions.
- Paired simulation analysis recovers S3 p95 mean difference −39.55 ms, W=0; S5 p95 mean difference +17.795 ms, W=58, rank-biserial correlation approximately 0.945921.
- Static secret-pattern scanning of the curated text files found no matches. This is not a guarantee against every possible secret format.
- SHA-256 verification covers the curated release files.

Small statistical transcription differences are disclosed in `PROVENANCE.md`. No claim is made here of independent participant authentication, formal ethics approval, fresh live API measurements, figure regeneration, or production load testing.

The GitHub workflow executes artifact verification, both statistical analyses, and complete reproduction on Linux. Its outcome is reported separately by GitHub Actions; local success does not imply that a remote workflow has already passed.
