# Release provenance

The release was curated from the author's local research archive on 11 October 2026. Original local materials were retained. The source runner, configuration, trace records, and five numeric result CSVs were copied without changing experimental values.

The MOS file comes from the anonymized submitted supplementary CSV. Original participant UUIDs, excluded-participant records, and raw screening responses were not included. The portable MOS analysis changes its input path, uses `erfc` for stable normal-tail probabilities, and handles an all-zero difference sample with a consistent return signature. The paired-seed analysis and artifact verification scripts were added for this release.

`SHA256SUMS.txt` is the checksum manifest for the curated release. The original simulator generates its own manifest in the isolated reproduction directory; those generated execution timestamps are not expected to match the archived log.

## Intentionally omitted

- Cover letter, author declarations, submission correspondence and tracking identifiers.
- Main manuscript PDFs/DOCX files, draft versions, editing helpers and stale audit summaries.
- Model binaries, generated audio, dependency folders and cache files.
- App-specific README, architecture instructions and unrelated product files.
- Legacy collection scripts containing a hard-coded admin authorization value or depending on an absent application endpoint.
- Original analysis/tests with absolute output paths into a different application repository.

The preserved submitted statistical audit refers to an `export_paired_csv.py` script not found in the local archive. `analysis/paired_statistics.py` provides an explicit, portable implementation instead; it is not represented as the missing original file.

## Statistical transcription notes

Recalculation gives MOS effect-size `r = |z| / sqrt(30)` of 0.8607 for naturalness and 0.8160 for intelligibility. The preserved audit reports 0.8590 and 0.8150, respectively, despite the same underlying z-statistics. Overall quality gives 0.8603. Means, standard deviations, signed-rank W, rank-biserial values, and reported significance conclusions agree. These small effect-size transcription discrepancies are disclosed rather than silently editing the submitted supplement.

The paired analysis uses stable normal-tail probabilities, which can differ from previously transcribed extreme-tail p-values. Holm-corrected significance remains below 0.001 for the listed comparisons. Fresh analysis stdout is authoritative for this release's recalculation; the submitted audit remains a historical document.

The historical `results/sensitivity_results_v3.csv` is included to resolve the parameter-selection reference in the frozen configuration. It is a tuning artifact, not one of the five CSVs verified by full reproduction. The three archived figures were copied, not regenerated during packaging.
