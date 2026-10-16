// node tests/stats.test.js — js/stats.js 핵심 함수 검산 (외부 의존성 없음)
global.window = global; require('../js/stats.js'); const S = window.S || global.S;
const eq = (a, b, m, t = 1e-9) => { if (!(Math.abs(a - b) <= t)) { console.error('FAIL', m, a, b); process.exitCode = 1; } else console.log('ok  ', m); };
eq(S.mean([1, 2, 3, 4]), 2.5, 'mean'); eq(S.median([5, 1, 3]), 3, 'median'); eq(S.median([1, 2, 3, 4]), 2.5, 'median even');
eq(S.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 'pearson +1'); eq(S.pearson([1, 2, 3], [3, 2, 1]), -1, 'pearson -1');
eq(S.spearman([1, 10, 100, 1000], [1, 2, 3, 4]), 1, 'spearman monotone');
eq(S.spearman([1, 2, 2, 3], [1, 2, 2, 3]), 1, 'spearman ties');
eq(S.ari([0, 0, 1, 1], [1, 1, 0, 0]), 1, 'ARI label-permutation invariant');

// 몬테카를로: 로그정규 곱의 평균은 합 × exp(σ²/2)에 수렴해야 한다
{ const g = 1.5, r = S.montecarlo([10, 5, 1], g, 40000, 3), exp = 16 * Math.exp(Math.log(g) ** 2 / 2); eq(r.mean / exp, 1, 'montecarlo mean ≈ analytic', 0.01); eq(r.share.reduce((a, b) => a + b, 0), 1, 'variance shares sum to 1', 1e-9); eq(r.share[0] > r.share[1] ? 1 : 0, 1, 'largest item has largest share'); }
