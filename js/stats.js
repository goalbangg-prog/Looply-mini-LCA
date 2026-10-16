/* 통계 도구 모음 (외부 라이브러리 없이 직접 구현). Python(scikit-learn/scipy) 결과와 맞는지 tests에서 비교했다. */
(function (g) {
  const S = {};
  S.mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  S.std = a => { const m = S.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
  S.median = a => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null; };
  S.quantile = (a, q) => { const b = [...a].sort((x, y) => x - y), p = (b.length - 1) * q, i = Math.floor(p); return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i); };
  // 같은 값은 평균 순위를 준다 (scipy.stats.rankdata 와 같은 방식)
  S.rank = a => {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let t = i; t <= j; t++) r[idx[t][1]] = avg; i = j + 1; }
    return r;
  };
  S.pearson = (x, y) => { const mx = S.mean(x), my = S.mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN; };
  S.spearman = (x, y) => S.pearson(S.rank(x), S.rank(y));
  // 값 v 가 기준 집합 ref 에서 차지하는 위치 (0~100). 작은 값은 0에 가깝다.
  S.percentile = (ref, v) => { let below = 0, eq = 0; for (const x of ref) { if (x < v) below++; else if (x === v) eq++; } return (below + eq / 2) / ref.length * 100; };

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const d2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; };
  function kmeansOnce(X, k, rand) {
    const n = X.length, dim = X[0].length, C = [X[Math.floor(rand() * n)].slice()];
    while (C.length < k) { // k-means++ 초기화
      const w = X.map(x => Math.min(...C.map(c => d2(x, c)))), tot = w.reduce((s, v) => s + v, 0);
      let r = rand() * tot, i = 0; for (; i < n - 1; i++) { r -= w[i]; if (r <= 0) break; } C.push(X[i].slice());
    }
    let lab = new Array(n).fill(-1);
    for (let it = 0; it < 300; it++) {
      let changed = false;
      for (let i = 0; i < n; i++) { let b = 0, bd = Infinity; for (let c = 0; c < k; c++) { const dd = d2(X[i], C[c]); if (dd < bd) { bd = dd; b = c; } } if (lab[i] !== b) { lab[i] = b; changed = true; } }
      const sum = Array.from({ length: k }, () => new Array(dim).fill(0)), cnt = new Array(k).fill(0);
      for (let i = 0; i < n; i++) { cnt[lab[i]]++; for (let j = 0; j < dim; j++) sum[lab[i]][j] += X[i][j]; }
      for (let c = 0; c < k; c++) if (cnt[c]) for (let j = 0; j < dim; j++) C[c][j] = sum[c][j] / cnt[c];
      if (!changed) break;
    }
    let inertia = 0; for (let i = 0; i < n; i++) inertia += d2(X[i], C[lab[i]]);
    return { lab, centers: C, inertia };
  }
  // 여러 번 돌려 inertia(군집 안 흩어짐)가 가장 작은 결과를 쓴다. 같은 seed면 항상 같은 결과.
  S.kmeans = (X, k, runs = 10, seed = 42) => {
    const all = []; for (let s = 0; s < runs; s++) all.push(kmeansOnce(X, k, rng(seed + s)));
    const best = all.reduce((a, b) => (b.inertia < a.inertia ? b : a)); best.runs = all; return best;
  };
  // 여러 시작점(seed)에서 따로 돌린 결과가 가장 좋은 결과와 얼마나 같은가 (ARI 평균, 1이면 항상 같음)
  S.stability = (X, k, best, seeds = 10) => {
    let tot = 0; for (let s = 0; s < seeds; s++) tot += S.ari(best.lab, S.kmeans(X, k, 10, 1000 + s * 97).lab);
    return tot / seeds;
  };
  S.silhouette = (X, lab, k) => {
    const n = X.length, D = X.map(a => X.map(b => Math.sqrt(d2(a, b)))), sizes = new Array(k).fill(0); lab.forEach(l => sizes[l]++);
    let tot = 0;
    for (let i = 0; i < n; i++) {
      if (sizes[lab[i]] < 2) continue; // 1개짜리 군집은 0점
      const sum = new Array(k).fill(0); for (let j = 0; j < n; j++) if (j !== i) sum[lab[j]] += D[i][j];
      const a = sum[lab[i]] / (sizes[lab[i]] - 1); let b = Infinity; for (let c = 0; c < k; c++) if (c !== lab[i] && sizes[c]) b = Math.min(b, sum[c] / sizes[c]);
      tot += (b - a) / Math.max(a, b);
    }
    return tot / n;
  };
  S.ari = (a, b) => {
    const n = a.length, tab = {}, ra = {}, rb = {};
    for (let i = 0; i < n; i++) { const key = a[i] + '_' + b[i]; tab[key] = (tab[key] || 0) + 1; ra[a[i]] = (ra[a[i]] || 0) + 1; rb[b[i]] = (rb[b[i]] || 0) + 1; }
    const c2 = x => x * (x - 1) / 2, sum = o => Object.values(o).reduce((s, v) => s + c2(v), 0);
    const idx = sum(tab), ea = sum(ra), eb = sum(rb), exp = ea * eb / c2(n), mx = (ea + eb) / 2;
    return mx === exp ? 1 : (idx - exp) / (mx - exp);
  };
  S.standardizeLog = M => { // M: 행=항목, 열=영향 (모두 양수)
    const L = M.map(r => r.map(Math.log10)), dim = L[0].length, mu = [], sd = [];
    for (let j = 0; j < dim; j++) { const col = L.map(r => r[j]); mu.push(S.mean(col)); sd.push(S.std(col) || 1); }
    return L.map(r => r.map((v, j) => (v - mu[j]) / sd[j]));
  };
  g.S = S;
})(window);
