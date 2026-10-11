"""Paired seed comparisons; no third-party dependencies or file writes."""
import csv, math, statistics
from pathlib import Path
def wilcoxon_signed_rank(x, y):
    diffs = [xi - yi for xi, yi in zip(x, y)]
    nz = [d for d in diffs if abs(d) > 1e-12]
    nr = len(nz)
    if nr == 0:
        return 0.0, 1.0, 0.0, 0.0, 0.0
    
    abs_d = [abs(d) for d in nz]
    sorted_indices = sorted(range(nr), key=lambda i: abs_d[i])
    
    ranks = [0.0] * nr
    i = 0
    tie_counts = []
    while i < nr:
        j = i
        while j + 1 < nr and abs(abs_d[sorted_indices[j+1]] - abs_d[sorted_indices[i]]) < 1e-12:
            j += 1
        tie_len = j - i + 1
        tie_counts.append(tie_len)
        avg_rank = (i + 1 + j + 1) / 2.0
        for k in range(i, j + 1):
            ranks[sorted_indices[k]] = avg_rank
        i = j + 1
        
    w_plus = sum(ranks[k] for k in range(nr) if nz[k] > 0)
    w_minus = sum(ranks[k] for k in range(nr) if nz[k] < 0)
    w_stat = min(w_plus, w_minus)
    
    total_w = w_plus + w_minus
    r_rb = (w_plus - w_minus) / total_w if total_w > 0 else 0.0
    
    mean_w = nr * (nr + 1) / 4.0
    tie_adjust = sum((t**3 - t) / 2.0 for t in tie_counts)
    var_w = (nr * (nr + 1) * (2 * nr + 1) - tie_adjust) / 24.0
    sd_w = math.sqrt(var_w) if var_w > 0 else 1.0
    
    if w_plus > mean_w:
        z = (w_plus - mean_w - 0.5) / sd_w
    elif w_plus < mean_w:
        z = (w_plus - mean_w + 0.5) / sd_w
    else:
        z = 0.0
        
    # p-value approx
    p_val = math.erfc(abs(z) / math.sqrt(2.0))
    effect_r = abs(z) / math.sqrt(len(x))
    return w_stat, p_val, r_rb, effect_r, z


root = Path(__file__).resolve().parents[1]
with (root / 'results/extended_per_seed_results_v12_final.csv').open(encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
metrics = ['condMos', 'qvr', 'costPer1k', 'e2e_p95', 'e2e_p99', 'cloudFailedAttempts']
print('scenario,metric,n,nonzero,mean_difference,W,z,p,holm_p,rank_biserial_r,r')
for scenario in ['S1_RandomFails_5pct', 'S3_CloudOutage', 'S5_Combined']:
    paired = {p: {int(x['seed']): x for x in rows if x['scenario'] == scenario and x['policy'] == p}
              for p in ['Adaptive', 'CloudWithPerRequestFallback']}
    assert set(paired['Adaptive']) == set(range(1, 101)) == set(paired['CloudWithPerRequestFallback'])
    results = []
    for metric in metrics:
        x = [float(paired['Adaptive'][s][metric]) for s in range(1, 101)]
        y = [float(paired['CloudWithPerRequestFallback'][s][metric]) for s in range(1, 101)]
        w, p, rb, _, z = wilcoxon_signed_rank(x, y)
        differences = [a-b for a,b in zip(x,y)]
        results.append(dict(metric=metric, n=len(x), nonzero=sum(abs(d)>1e-12 for d in differences),
                            difference=statistics.mean(differences), W=w, z=z, p=p, rb=rb, r=z/math.sqrt(len(x))))
    running = 0.0
    for i, item in enumerate(sorted(results, key=lambda v:v['p'])):
        running = max(running, min(1.0, (len(results)-i)*item['p']))
        item['holm'] = running
    for v in results:
        print(f"{scenario},{v['metric']},{v['n']},{v['nonzero']},{v['difference']:.9f},{v['W']:.6f},{v['z']:.6f},{v['p']:.9g},{v['holm']:.9g},{v['rb']:.6f},{v['r']:.6f}")
