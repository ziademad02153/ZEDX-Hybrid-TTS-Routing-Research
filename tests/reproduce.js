const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'zedx-tts-reproduce-'));
// Frozen reference results are never overwritten by this command.
for (const folder of ['simulator', 'config', 'data/raw']) {
  fs.cpSync(path.join(root, folder), path.join(scratch, folder), {recursive: true});
}
fs.mkdirSync(path.join(scratch, 'results'));
console.log('Isolated reproduction directory:', scratch);
const run = spawnSync(process.execPath, [path.join(scratch, 'simulator/run_final_v12.js')], {cwd: scratch, stdio: 'inherit'});
assert.equal(run.status, 0, 'Simulator must finish successfully');
const outputs = [
  'extended_baseline_results_v12_final.csv', 'extended_per_seed_results_v12_final.csv',
  'robustness_piper_failure_v12_final.csv', 'robustness_qmin_v12_final.csv',
  'robustness_cloud_penalty_v12_final.csv'
];
for (const file of outputs) {
  assert.deepEqual(fs.readFileSync(path.join(scratch, 'results', file)), fs.readFileSync(path.join(root, 'results', file)), file + ' differs from frozen reference');
  console.log('Byte-identical:', file);
}
console.log('PASS: all five numeric result files reproduced exactly. Timestamped logs are not compared.');
