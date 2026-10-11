# Methods and limits of interpretation

## Frozen experiment

- Cloud trace model: `eleven_multilingual_v2`.
- Local trace model: `ar_JO-kareem-medium` (the old local environment note naming `low` was inconsistent and is not included).
- Collection trace hardware metadata: Intel Core i5-1235U, Windows build 22631, approximately 16 GB RAM.
- Original evaluation log: Node.js 22.12.0 on Windows x64.
- Evaluation pairs: runs 2–5, 32 pairs per short/medium/long category, 0 discarded pairs. Run 1 was used for configuration work.
- Nominal arrivals: Poisson rate 1 request/second; workload length mixture 70% short, 20% medium, 10% long.
- Circuit breaker: 5 failures within 30 seconds, 30-second cooldown, a half-open probe. Parameters are fixed rather than learned online.
- Provider naturalness constants: cloud 4.439, local 3.578; quality threshold 4.0 is an evaluation criterion, not a routing decision.
- Cloud marginal price assumption: USD 0.00008 per character. Local API cost zero does not mean compute or electricity is free.

## Latency semantics

The simulator samples measured `ttfbMs`, not `totalMs`. Response columns named `e2e_*` add an assumed cloud failure penalty before local first audio when fallback is required. The default penalty and sensitivity settings are study assumptions, not measurements of every cloud failure. Percentiles in aggregate CSVs are means of the 100 per-seed percentiles, not percentiles pooled over all requests.

This does not establish audio playback completion time, arbitrary hardware performance, production concurrency, queueing capacity, or guaranteed availability. Baseline local failure is zero; the separate sensitivity files vary that assumption.

## Listening study

The published CSV has pseudonyms `listener_01` through `listener_30`. Each participant rates six clips per provider in naturalness, intelligibility, and overall quality. The analysis unit is the participant's provider mean.

The submitted declarations report adult voluntary participation, electronic informed consent, and no prior institutional ethics committee/IRB assessment. This repository does not claim formal approval or retrospective exemption. Editorial assessment of those declarations remains with the journal.

## Live collection is separate

The original collection client calls `/api/admin/benchmark-tts` in the ZEDX application. That application endpoint and its runtime environment are not part of this research replay package. Accordingly, fresh acquisition is not advertised as reproducible from this repository alone. The archived traces can be replayed without provider access.
