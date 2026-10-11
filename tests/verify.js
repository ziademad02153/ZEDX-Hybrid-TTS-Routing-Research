const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function csv(file) {
  const [header, ...rows] = fs.readFileSync(path.join(root, file), 'utf8').trim().split(/\r?\n/);
  const keys = header.split(',');
  return rows.map(row => Object.fromEntries(row.split(',').map((v, i) => [keys[i], v])));
}
const seeds = csv('results/extended_per_seed_results_v12_final.csv');
assert.equal(seeds.length, 3000);
assert.equal(new Set(seeds.map(r => [r.scenario, r.policy, r.seed].join('|'))).size, 3000);
const aggregate = csv('results/extended_baseline_results_v12_final.csv');
assert.equal(aggregate.length, 30);
for (const row of aggregate) {
  const group = seeds.filter(r => r.scenario === row.scenario && r.policy === row.policy);
  assert.equal(group.length, 100);
  for (const key of Object.keys(row).slice(2)) {
    const mean = group.reduce((sum, r) => sum + Number(r[key]), 0) / 100;
    assert.ok(Number.isFinite(mean));
    assert.ok(Math.abs(mean - Number(row[key])) <= 0.00000051, `${row.scenario}/${row.policy}/${key}`);
  }
}
const traces = fs.readFileSync(path.join(root, 'data/raw/phase2_unified_traces.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
assert.equal(traces.length, 240);
const heldOut = traces.filter(r => r.runIndex >= 2 && r.runIndex <= 5);
assert.equal(heldOut.length, 192);
const blocks = new Map();
for (const row of heldOut) {
  if (!blocks.has(row.blockId)) blocks.set(row.blockId, new Set());
  blocks.get(row.blockId).add(row.provider);
}
assert.equal(blocks.size, 96);
for (const providers of blocks.values()) assert.deepEqual([...providers].sort(), ['elevenlabs', 'piper']);
const mos = csv('data/processed/mos_cleaned.csv');
assert.equal(mos.length, 360);
assert.equal(new Set(mos.map(r => r.participant_id)).size, 30);
for (const row of mos) {
  assert.match(row.participant_id, /^listener_\d{2}$/);
  for (const key of ['naturalness','intelligibility','overall']) assert.ok(Number(row[key]) >= 1 && Number(row[key]) <= 5);
}
for (const line of fs.readFileSync(path.join(root, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/)) {
  const [hash, file] = line.split('  ');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash, file);
}
console.log('PASS: checksums, all baseline aggregates, unique seed rows, trace pairs, and anonymized MOS structure.');
