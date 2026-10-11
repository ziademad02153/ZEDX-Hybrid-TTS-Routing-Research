import csv, math

from pathlib import Path
path = Path(__file__).resolve().parents[1] / 'data/processed/mos_cleaned.csv'

# Aggregate by participant and provider
data = {}
with open(path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        pid = row['participant_id']
        prov = row['provider']
        if pid not in data:
            data[pid] = {'elevenlabs': {'nat': [], 'int': [], 'ovr': []}, 'piper': {'nat': [], 'int': [], 'ovr': []}}
        data[pid][prov]['nat'].append(float(row['naturalness']))
        data[pid][prov]['int'].append(float(row['intelligibility']))
        data[pid][prov]['ovr'].append(float(row['overall']))

participants = sorted(list(data.keys()))
print(f"Total participants: {len(participants)}")

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

for dim, dim_label in [('nat', 'Naturalness'), ('int', 'Intelligibility'), ('ovr', 'Overall Quality')]:
    el_means = [sum(data[p]['elevenlabs'][dim]) / len(data[p]['elevenlabs'][dim]) for p in participants]
    pi_means = [sum(data[p]['piper'][dim]) / len(data[p]['piper'][dim]) for p in participants]

    mean_el = sum(el_means) / len(el_means)
    std_el = math.sqrt(sum((v - mean_el)**2 for v in el_means) / (len(el_means) - 1))

    mean_pi = sum(pi_means) / len(pi_means)
    std_pi = math.sqrt(sum((v - mean_pi)**2 for v in pi_means) / (len(pi_means) - 1))

    w_stat, p_val, r_rb, effect_r, z = wilcoxon_signed_rank(el_means, pi_means)

    print(f"=== {dim_label} ===")
    print(f"ElevenLabs Mean: {mean_el:.4f} (SD = {std_el:.4f})")
    print(f"Piper Mean:      {mean_pi:.4f} (SD = {std_pi:.4f})")
    print(f"Wilcoxon W:      {w_stat:.1f}, z: {z:.4f}, p: {p_val:.6e}")
    print(f"Rank-Biserial r_rb:            {r_rb:.4f}")
    print(f"Wilcoxon effect size r (|z|/sqrt(N)): {effect_r:.4f}")
    print()
