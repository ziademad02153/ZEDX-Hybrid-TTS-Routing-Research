/**
 * ZEDX-TTS Simulator V12 FIXED
 *
 * Changes vs extended_simulator.js (archived as v12_invalid_pre_state_fix):
 *   1. HALF_OPEN probe logic corrected:
 *        SUCCESS -> CLOSED (cbWindow=[], cbOpenTime=0)
 *        FAILURE -> OPEN   (cbOpenTime=currentTime, halfOpenToOpenReopens++)
 *   2. Separated counters:
 *        closedToOpenTrips, halfOpenToOpenReopens,
 *        halfOpenProbeSuccesses, halfOpenProbeFailures,
 *        directHardFailureFallbacks, circuitBreakerFallbacks,
 *        cloudFailedAttempts, finalPiperCount
 *   3. Cloud failure penalty latency (sensitivity: 500/1000/2000 ms).
 *        el tried+failed -> piper fallback: e2e = penalty + piperLat
 *        CB OPEN direct  -> piper:          e2e = piperLat
 *        Cloud-only fail : dropped,         penalty recorded separately
 *   4. Q_min affects QVR classification ONLY. Routing is unchanged.
 *   5. Piper failure sensitivity: 0%, 0.1%, 1%.
 *      If EL fails AND Piper fails, request is DROPPED.
 *   6. THIS RUN: 10 seeds x 1000 requests (intermediate validation).
 *   7. Evaluation traces: runIndex 2..5 ONLY.
 *
 * Experiment size:
 *   6 scenarios x 5 policies x 10 seeds x 1000 reqs = 300,000 policy-level evaluations
 *   NOTE: Same workload used for all 5 policies per seed - not 5 independent samples.
 *
 * FROZEN: V11 code/results and draft_final.md are NOT touched.
 */
'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

class SeededRandom {
  constructor(seed) { this.seed = seed; }
  next() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }
  nextExponential(lambda) { return -Math.log(1 - this.next()) / lambda; }
}

const MOS_EL    = 4.439;
const MOS_PIPER = 3.578;

const configRaw = fs.readFileSync(
  path.join(__dirname, '../config/simulation_config_v12_fixed.json'), 'utf8'
).replace(/^\uFEFF/, '');
const config = JSON.parse(configRaw);

const CB_STRIKES      = config.circuit_breaker.strikes;
const CB_WINDOW_SEC   = config.circuit_breaker.window_sec;
const CB_COOLDOWN_SEC = config.circuit_breaker.cooldown_sec;
const EL_PRICE        = config.pricing.elevenlabs_per_char;
const LAMBDA          = 1.0;

const tracesRaw  = fs.readFileSync(
  path.join(__dirname, '../data/raw/phase2_unified_traces.jsonl'), 'utf8'
);
const allTraces  = tracesRaw.split('\n').filter(Boolean).map(function(l) { return JSON.parse(l); });
const evalTraces = allTraces.filter(function(t) { return t.runIndex >= 2 && t.runIndex <= 5; });

const blocks = {};
var discarded = 0;
for (var ti = 0; ti < evalTraces.length; ti++) {
  var t = evalTraces[ti];
  if (!blocks[t.blockId]) blocks[t.blockId] = {};
  blocks[t.blockId][t.provider] = t;
}

const pairedTraces = { short: [], medium: [], long: [] };
var bids = Object.keys(blocks);
for (var bi = 0; bi < bids.length; bi++) {
  var b = blocks[bids[bi]];
  if (b.elevenlabs && b.piper &&
      b.elevenlabs.textCategory === b.piper.textCategory &&
      b.elevenlabs.textId       === b.piper.textId) {
    pairedTraces[b.elevenlabs.textCategory].push({ el: b.elevenlabs, piper: b.piper });
  } else { discarded++; }
}

const NUM_SEEDS     = 10;
const REQS_PER_SEED = 1000;

const scenarios = [
  { id: 'S0_Normal',           elFail: 0,    elLatAdd: 0,    outageStart: 0,   outageDur: 0,  piperLatMult: 1.0 },
  { id: 'S1_RandomFails_5pct', elFail: 0.05, elLatAdd: 0,    outageStart: 0,   outageDur: 0,  piperLatMult: 1.0 },
  { id: 'S2_LatencySpikes',    elFail: 0,    elLatAdd: 1000, outageStart: 0,   outageDur: 0,  piperLatMult: 1.0 },
  { id: 'S3_CloudOutage',      elFail: 0,    elLatAdd: 0,    outageStart: 200, outageDur: 60, piperLatMult: 1.0 },
  { id: 'S4_LocalDegradation', elFail: 0,    elLatAdd: 0,    outageStart: 0,   outageDur: 0,  piperLatMult: 2.0 },
  { id: 'S5_Combined',         elFail: 0.05, elLatAdd: 1000, outageStart: 0,   outageDur: 0,  piperLatMult: 1.5 },
];

const policies = [
  'Cloud-only', 'Local-only', 'Static-Length', 'Adaptive', 'CloudWithPerRequestFallback'
];

const CLOUD_PENALTY_MS_VALUES = [500, 1000, 2000];
const PIPER_FAIL_RATES        = [0.0, 0.001, 0.01];
const Q_MIN_VALUES            = [3.5, 4.0, 4.5];

const invariantViolations = [];
const perSeedRows = [];

for (var si = 0; si < scenarios.length; si++) {
  var scen = scenarios[si];

  for (var seed = 1; seed <= NUM_SEEDS; seed++) {
    var timeRng     = new SeededRandom(seed);
    var workloadRng = new SeededRandom(seed + 1000);
    var faultRng    = new SeededRandom(seed + 2000);

    var workload = [];
    var tNow = 0;
    for (var ri = 0; ri < REQS_PER_SEED; ri++) {
      tNow += timeRng.nextExponential(LAMBDA);
      var r   = workloadRng.next();
      var cat = r > 0.9 ? 'long' : r > 0.7 ? 'medium' : 'short';
      var pool = pairedTraces[cat];
      var pair = pool[Math.floor(workloadRng.next() * pool.length)];
      var isInOutage = scen.outageDur > 0 && tNow >= scen.outageStart && tNow < scen.outageStart + scen.outageDur;
      var hardFailed = faultRng.next() < scen.elFail || isInOutage;
      var spiked     = faultRng.next() < 0.20;
      var piperRoll  = faultRng.next();
      workload.push({ time: tNow, cat: cat, el: pair.el, piper: pair.piper, hardFailed: hardFailed, spiked: spiked, piperRoll: piperRoll });
    }

    var wlHashInput = workload.map(function(req) {
      return req.time.toFixed(6) + ',' + req.cat + ',' + (req.el.blockId||'') + ',' + req.hardFailed + ',' + req.piperRoll.toFixed(8);
    }).join('|');
    var workloadHash = crypto.createHash('sha256').update(wlHashInput).digest('hex');

    for (var pi = 0; pi < policies.length; pi++) {
      var policy = policies[pi];

      var cbState    = 'CLOSED';
      var cbOpenTime = 0;
      var cbWindow   = [];

      var closedToOpenTrips          = 0;
      var halfOpenToOpenReopens      = 0;
      var halfOpenProbeSuccesses     = 0;
      var halfOpenProbeFailures      = 0;
      var directHardFailureFallbacks = 0;
      var circuitBreakerFallbacks    = 0;
      var cloudFailedAttempts        = 0;

      var decisionLog = [];

      for (var di = 0; di < workload.length; di++) {
        var req = workload[di];

        if (policy === 'Adaptive' && cbState === 'OPEN' && (req.time - cbOpenTime) >= CB_COOLDOWN_SEC) {
          cbState = 'HALF_OPEN';
        }

        var decision, isProbe = false;
        if      (policy === 'Cloud-only')                  { decision = 'el'; }
        else if (policy === 'Local-only')                  { decision = 'piper'; }
        else if (policy === 'Static-Length')               { decision = req.cat === 'short' ? 'piper' : 'el'; }
        else if (policy === 'CloudWithPerRequestFallback') { decision = 'el'; }
        else {
          if      (cbState === 'OPEN')      { decision = 'piper'; }
          else if (cbState === 'HALF_OPEN') { decision = 'el'; isProbe = true; }
          else                              { decision = 'el'; }
        }

        var elAttempted = false, elFailed = false;
        var elRawLat = 0, piperLat = 0;
        var finalProvider, routeReason;
        var finalOk = false, finalCost = 0, finalMos = 0;

        if (decision === 'el') {
          elAttempted = true;
          if (req.hardFailed) {
            elFailed = true;
            cloudFailedAttempts++;
          } else {
            elRawLat = req.el.ttfbMs + (req.spiked ? scen.elLatAdd : 0);
          }
        }

        if (policy === 'Adaptive') {
          if (elAttempted && elFailed) {
            if (cbState === 'CLOSED') {
              cbWindow = cbWindow.filter(function(tw) { return (req.time - tw) <= CB_WINDOW_SEC; });
              cbWindow.push(req.time);
              if (cbWindow.length >= CB_STRIKES) {
                cbState = 'OPEN'; cbOpenTime = req.time; cbWindow = []; closedToOpenTrips++;
              }
            } else if (cbState === 'HALF_OPEN') {
              cbState = 'OPEN'; cbOpenTime = req.time;
              halfOpenProbeFailures++; halfOpenToOpenReopens++;
            }
          } else if (elAttempted && !elFailed && isProbe) {
            cbState = 'CLOSED'; cbWindow = []; cbOpenTime = 0;
            halfOpenProbeSuccesses++;
          }
        }

        if (!elAttempted) {
          if (policy === 'Adaptive' && cbState !== 'CLOSED' && cbState !== 'HALF_OPEN') {
            routeReason = 'circuit_breaker'; circuitBreakerFallbacks++;
          } else {
            routeReason = 'static_or_local';
          }
          finalProvider = 'piper';
          piperLat = req.piper.ttfbMs * scen.piperLatMult;
          finalOk = true; finalCost = 0; finalMos = MOS_PIPER;
        } else if (!elFailed) {
          routeReason = isProbe ? 'probe_success' : 'primary';
          finalProvider = 'el'; finalOk = true;
          finalCost = req.el.textLength * EL_PRICE; finalMos = MOS_EL;
        } else {
          if (policy === 'Adaptive' || policy === 'CloudWithPerRequestFallback' ||
              (policy === 'Static-Length' && decision === 'el')) {
            routeReason = 'direct_hard_failure_fallback'; directHardFailureFallbacks++;
            finalProvider = 'piper';
            piperLat = req.piper.ttfbMs * scen.piperLatMult;
            finalOk = true; finalCost = 0; finalMos = MOS_PIPER;
          } else {
            routeReason = 'dropped'; finalProvider = 'dropped'; finalOk = false;
          }
        }

        decisionLog.push({
          finalProvider: finalProvider, routeReason: routeReason,
          elAttempted: elAttempted, elFailed: elFailed,
          piperLat: piperLat, elRawLat: elRawLat,
          finalOk: finalOk, finalCost: finalCost, finalMos: finalMos,
          piperRoll: req.piperRoll
        });
      }

      var finalPiperCount_baseline = decisionLog.filter(function(d) { return d.finalProvider === 'piper'; }).length;
      var directPiperRoutes = decisionLog.filter(function(d) { return d.finalProvider === 'piper' && d.routeReason === 'static_or_local'; }).length;
      var expectedPiper = directHardFailureFallbacks + circuitBreakerFallbacks + directPiperRoutes;
      if (expectedPiper !== finalPiperCount_baseline) {
        invariantViolations.push({ type: 'piper_count_mismatch', scen: scen.id, seed: seed, policy: policy, expected: expectedPiper, actual: finalPiperCount_baseline });
      }

      for (var pfri = 0; pfri < PIPER_FAIL_RATES.length; pfri++) {
        var piperFailRate = PIPER_FAIL_RATES[pfri];
        for (var qmi = 0; qmi < Q_MIN_VALUES.length; qmi++) {
          var qMin = Q_MIN_VALUES[qmi];
          for (var cpi = 0; cpi < CLOUD_PENALTY_MS_VALUES.length; cpi++) {
            var cloudPenaltyMs = CLOUD_PENALTY_MS_VALUES[cpi];

            var successCount = 0, mosSum = 0, qvCount = 0, totalCost = 0;
            var piperCount = 0, cloudFails = 0;
            var successLats = [], endToEndLats = [];

            for (var dli = 0; dli < decisionLog.length; dli++) {
              var d = decisionLog[dli];
              if (d.elFailed) cloudFails++;

              var dropped = false;
              if (d.finalProvider === 'dropped') { dropped = true; }
              else if (d.finalProvider === 'piper' && d.piperRoll < piperFailRate) { dropped = true; }

              if (dropped) {
                if (d.elFailed) endToEndLats.push(cloudPenaltyMs);
                continue;
              }

              successCount++;
              mosSum += d.finalMos;
              totalCost += d.finalCost;
              if (d.finalMos < qMin) qvCount++;
              if (d.finalProvider === 'piper') piperCount++;

              var ttfb = d.finalProvider === 'el' ? d.elRawLat : d.piperLat;
              successLats.push(ttfb);

              var e2e;
              if (d.elFailed && d.finalProvider === 'piper') {
                e2e = cloudPenaltyMs + d.piperLat;
              } else { e2e = ttfb; }
              endToEndLats.push(e2e);
            }

            var pct = function(arr, p) {
              if (arr.length === 0) return null;
              var s = arr.slice().sort(function(a,b){return a-b;});
              return s[Math.floor(s.length * p)];
            };

            var successRate = successCount / REQS_PER_SEED;
            var dropRate    = 1 - successRate;
            var condMos     = successCount > 0 ? mosSum / successCount : 0;
            var utilityMos  = successRate * condMos;
            var qvr         = successCount > 0 ? qvCount / successCount : 0;
            var piperUsage  = piperCount / REQS_PER_SEED;
            var costPer1k   = (totalCost / REQS_PER_SEED) * 1000;

            perSeedRows.push({
              piperFailRate: piperFailRate, qMin: qMin, cloudPenaltyMs: cloudPenaltyMs,
              scenario: scen.id, policy: policy, seed: seed,
              successRate: successRate, dropRate: dropRate, condMos: condMos,
              utilityMos: utilityMos, qvr: qvr, piperUsage: piperUsage, costPer1k: costPer1k,
              ttfb_p50:  pct(successLats, 0.50), ttfb_p95:  pct(successLats, 0.95), ttfb_p99:  pct(successLats, 0.99),
              e2e_p50:   pct(endToEndLats, 0.50), e2e_p95: pct(endToEndLats, 0.95), e2e_p99:  pct(endToEndLats, 0.99),
              cloudFailedAttempts: cloudFails,
              directHardFailureFallbacks: directHardFailureFallbacks,
              circuitBreakerFallbacks: circuitBreakerFallbacks,
              closedToOpenTrips: closedToOpenTrips,
              halfOpenToOpenReopens: halfOpenToOpenReopens,
              halfOpenProbeSuccesses: halfOpenProbeSuccesses,
              halfOpenProbeFailures: halfOpenProbeFailures,
              finalPiperCount: piperCount,
              workloadHash: workloadHash
            });
          }
        }
      }
    }
  }
}

var expectedRows = scenarios.length * NUM_SEEDS * policies.length *
  PIPER_FAIL_RATES.length * Q_MIN_VALUES.length * CLOUD_PENALTY_MS_VALUES.length;
if (perSeedRows.length !== expectedRows) {
  invariantViolations.push({ type: 'row_count_mismatch', expected: expectedRows, actual: perSeedRows.length });
}

var nanCount = 0;
for (var nri = 0; nri < perSeedRows.length; nri++) {
  var row = perSeedRows[nri];
  var keys = Object.keys(row);
  for (var ki = 0; ki < keys.length; ki++) {
    if (typeof row[keys[ki]] === 'number' && isNaN(row[keys[ki]])) { nanCount++; break; }
  }
}
if (nanCount > 0) invariantViolations.push({ type: 'nan_values', count: nanCount });

var PER_SEED_PATH = path.join(__dirname, '../results/per_seed_results_v12_fixed_intermediate.csv');
var psKeys = Object.keys(perSeedRows[0]);
fs.writeFileSync(PER_SEED_PATH,
  psKeys.join(',') + '\n' +
  perSeedRows.map(function(row) { return psKeys.map(function(k) { return row[k] !== undefined ? row[k] : ''; }).join(','); }).join('\n')
);

var baselineRows = perSeedRows.filter(function(row) {
  return row.piperFailRate === 0.0 && row.qMin === 4.0 && row.cloudPenaltyMs === 1000;
});
var agg = {};
for (var ai = 0; ai < baselineRows.length; ai++) {
  var row = baselineRows[ai];
  var k = row.scenario + '|' + row.policy;
  if (!agg[k]) agg[k] = {
    scenario: row.scenario, policy: row.policy, n: 0,
    successRate: 0, dropRate: 0, condMos: 0, utilityMos: 0, qvr: 0, piperUsage: 0, costPer1k: 0,
    ttfb_p50: 0, ttfb_p95: 0, ttfb_p99: 0, e2e_p50: 0, e2e_p95: 0, e2e_p99: 0,
    cloudFailedAttempts: 0, directHardFailureFallbacks: 0, circuitBreakerFallbacks: 0,
    closedToOpenTrips: 0, halfOpenToOpenReopens: 0, halfOpenProbeSuccesses: 0, halfOpenProbeFailures: 0
  };
  var a = agg[k];
  a.n++;
  var numericKeys = ['successRate','dropRate','condMos','utilityMos','qvr','piperUsage','costPer1k',
    'ttfb_p50','ttfb_p95','ttfb_p99','e2e_p50','e2e_p95','e2e_p99',
    'cloudFailedAttempts','directHardFailureFallbacks','circuitBreakerFallbacks',
    'closedToOpenTrips','halfOpenToOpenReopens','halfOpenProbeSuccesses','halfOpenProbeFailures'];
  for (var ni = 0; ni < numericKeys.length; ni++) {
    a[numericKeys[ni]] += (row[numericKeys[ni]] || 0);
  }
}
var aggRows = Object.values(agg).map(function(a) {
  var numericKeys = ['successRate','dropRate','condMos','utilityMos','qvr','piperUsage','costPer1k',
    'ttfb_p50','ttfb_p95','ttfb_p99','e2e_p50','e2e_p95','e2e_p99',
    'cloudFailedAttempts','directHardFailureFallbacks','circuitBreakerFallbacks',
    'closedToOpenTrips','halfOpenToOpenReopens','halfOpenProbeSuccesses','halfOpenProbeFailures'];
  for (var ni = 0; ni < numericKeys.length; ni++) { a[numericKeys[ni]] /= a.n; }
  return a;
});
var AGG_PATH = path.join(__dirname, '../results/final_simulation_results_v12_fixed_intermediate.csv');
var aggKeys = Object.keys(aggRows[0]).filter(function(k) { return k !== 'n'; });
fs.writeFileSync(AGG_PATH,
  aggKeys.join(',') + '\n' +
  aggRows.map(function(row) { return aggKeys.map(function(k) { return typeof row[k] === 'number' ? row[k].toFixed(6) : row[k]; }).join(','); }).join('\n')
);

var ROB_KEYS = ['piperFailRate','qMin','cloudPenaltyMs','scenario','policy',
  'successRate','dropRate','condMos','utilityMos','qvr','piperUsage','cloudFailedAttempts','e2e_p50','e2e_p95','e2e_p99'];
var robAgg = {};
for (var rbi = 0; rbi < perSeedRows.length; rbi++) {
  var row = perSeedRows[rbi];
  var k = row.piperFailRate + '|' + row.qMin + '|' + row.cloudPenaltyMs + '|' + row.scenario + '|' + row.policy;
  if (!robAgg[k]) robAgg[k] = {
    piperFailRate: row.piperFailRate, qMin: row.qMin, cloudPenaltyMs: row.cloudPenaltyMs,
    scenario: row.scenario, policy: row.policy, n: 0,
    successRate: 0, dropRate: 0, condMos: 0, utilityMos: 0, qvr: 0, piperUsage: 0,
    cloudFailedAttempts: 0, e2e_p50: 0, e2e_p95: 0, e2e_p99: 0
  };
  var a = robAgg[k]; a.n++;
  var rk = ['successRate','dropRate','condMos','utilityMos','qvr','piperUsage','cloudFailedAttempts','e2e_p50','e2e_p95','e2e_p99'];
  for (var ri2 = 0; ri2 < rk.length; ri2++) a[rk[ri2]] += (row[rk[ri2]] || 0);
}
var robRows = Object.values(robAgg).map(function(a) {
  var rk = ['successRate','dropRate','condMos','utilityMos','qvr','piperUsage','cloudFailedAttempts','e2e_p50','e2e_p95','e2e_p99'];
  for (var ri2 = 0; ri2 < rk.length; ri2++) a[rk[ri2]] /= a.n;
  return a;
});
var ROB_PATH = path.join(__dirname, '../results/robustness_sensitivity_v12_fixed_intermediate.csv');
fs.writeFileSync(ROB_PATH,
  ROB_KEYS.join(',') + '\n' +
  robRows.map(function(row) { return ROB_KEYS.map(function(k) { return typeof row[k] === 'number' ? row[k].toFixed(6) : row[k]; }).join(','); }).join('\n')
);

var invariantsReport = {
  generatedAt: new Date().toISOString(),
  runDescription: NUM_SEEDS + ' seeds x ' + REQS_PER_SEED + ' requests (intermediate validation)',
  experimentSize: {
    scenarios: scenarios.length, policies: policies.length,
    seeds: NUM_SEEDS, requestsPerSeed: REQS_PER_SEED,
    workloadRequestsTotal: scenarios.length * NUM_SEEDS * REQS_PER_SEED,
    policyLevelEvaluationsTotal: scenarios.length * policies.length * NUM_SEEDS * REQS_PER_SEED,
    note: 'Same workload used for all 5 policies per seed. Policy-level evaluations are NOT independent observations.'
  },
  traceInfo: {
    runIndexUsed: '2..5', runIndex1Used: false,
    pairedPairs: { short: pairedTraces.short.length, medium: pairedTraces.medium.length, long: pairedTraces.long.length },
    discardedBlocks: discarded
  },
  cbParameters: { strikes: CB_STRIKES, windowSec: CB_WINDOW_SEC, cooldownSec: CB_COOLDOWN_SEC },
  invariantChecks: {
    piperCountMismatches: invariantViolations.filter(function(v){return v.type==='piper_count_mismatch';}).length,
    determinismNote: 'Workload hash stored per seed for cross-run verification',
    rowCountExpected: expectedRows, rowCountActual: perSeedRows.length,
    rowCountMatch: perSeedRows.length === expectedRows,
    nanValuesFound: nanCount,
    halfOpenProbeLogic: 'SUCCESS: cbState=CLOSED, cbWindow=[], cbOpenTime=0 | FAILURE: cbState=OPEN, cbOpenTime=currentTime, halfOpenToOpenReopens++'
  },
  violations: invariantViolations,
  sensitivityDimensions: {
    piperFailRates: PIPER_FAIL_RATES,
    qMinValues: Q_MIN_VALUES,
    cloudPenaltyMsValues: CLOUD_PENALTY_MS_VALUES,
    qMinNote: 'Q_min changes QVR classification only. Routing decisions are unaffected.',
    cloudPenaltyNote: 'Cloud failure penalty is a SENSITIVITY dimension. It is NOT a value measured from traces.'
  }
};

var INV_PATH = path.join(__dirname, '../results/invariants_report_v12_fixed.json');
fs.writeFileSync(INV_PATH, JSON.stringify(invariantsReport, null, 2));

var filesToHash = [PER_SEED_PATH, AGG_PATH, ROB_PATH, INV_PATH];
var shaLines = filesToHash.map(function(fp) {
  var hash = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
  return hash + '  ' + path.basename(fp);
});
var SHA_PATH = path.join(__dirname, '../results/SHA256SUMS_v12_fixed.txt');
fs.writeFileSync(SHA_PATH, shaLines.join('\n') + '\n');

console.log('');
console.log('=== V12 FIXED - Intermediate Run Complete ===');
console.log('Seeds: ' + NUM_SEEDS + '  |  Reqs/Seed: ' + REQS_PER_SEED + '  |  Scenarios: ' + scenarios.length + '  |  Policies: ' + policies.length);
console.log('Per-seed rows: ' + perSeedRows.length + '  (expected: ' + expectedRows + ')');
console.log('Row count match: ' + (perSeedRows.length === expectedRows));
console.log('Invariant violations: ' + invariantViolations.length);
console.log('NaN values: ' + nanCount);
console.log('Discarded unpaired blocks: ' + discarded);
console.log('');
console.log('Files written:');
[PER_SEED_PATH, AGG_PATH, ROB_PATH, INV_PATH, SHA_PATH].forEach(function(f) { console.log('  ' + f); });
console.log('');
console.log('SHA256SUMS:');
shaLines.forEach(function(l) { console.log('  ' + l); });
if (invariantViolations.length > 0) {
  console.log('');
  console.log('VIOLATIONS:');
  invariantViolations.forEach(function(v) { console.log('  ' + JSON.stringify(v)); });
} else {
  console.log('');
  console.log('All invariant checks passed.');
}
