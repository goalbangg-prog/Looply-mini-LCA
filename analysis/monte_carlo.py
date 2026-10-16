"""몬테카를로 불확도 예시 (NumPy).

계산기 '예시 구성'(시멘트 1,000 kg, 알루미늄 200 kg, HDPE 50 kg, 매립 100 kg, 육상수송 5 ton·km)의
탄소발자국 합계에 불확도를 가정하여 분포를 구한다. 웹앱(js/stats.js의 S.montecarlo)과 같은 방식이다.

원자료에는 불확도 정보가 없으므로 기하표준편차(GSD)는 '가정'이다. 결과는 실제 오차범위가 아니라
'가정한 불확도가 합계에 어떻게 전파되는가'를 보여 주는 시나리오이다.
실행: python analysis/monte_carlo.py  ->  data/montecarlo_example.json
"""
import json, pathlib
import numpy as np, pandas as pd
from scipy.stats import spearmanr

root = pathlib.Path(__file__).resolve().parent.parent
df = pd.read_csv(root / "data" / "lca_factors_clean.csv")
col_name = "원료_에너지"
col_carbon = next(c for c in df.columns if "탄소" in c)
basket = [("1종 포틀랜드 시멘트", 1000), ("알루미늄 판", 200), ("고밀도 폴리에틸렌", 50), ("생활폐기물 위생매립", 100), ("BCT", 5)]
vals, names = [], []
for n, q in basket:
    r = df[df[col_name] == n]
    if len(r) and pd.notna(r.iloc[0][col_carbon]):
        vals.append(float(r.iloc[0][col_carbon]) * q); names.append(n)
vals = np.array(vals)
out = {"items": names, "deterministic": float(vals.sum()), "scenarios": {}}
for gsd in (1.1, 1.3, 1.5, 2.0):
    rng = np.random.default_rng(7)
    sig = np.log(gsd)
    draws = vals[None, :] * np.exp(sig * rng.standard_normal((20000, len(vals))))  # 중앙값 보존 로그정규
    tot = draws.sum(axis=1)
    rho = np.array([spearmanr(draws[:, k], tot)[0] for k in range(len(vals))])
    share = rho**2 / (rho**2).sum()
    out["scenarios"][str(gsd)] = {
        "p5": float(np.percentile(tot, 5)), "p50": float(np.percentile(tot, 50)), "p95": float(np.percentile(tot, 95)),
        "mean": float(tot.mean()), "analytic_mean": float(vals.sum() * np.exp(sig**2 / 2)),
        "variance_share": dict(zip(names, map(float, share))),
    }
    print(gsd, {k: round(v, 1) for k, v in out["scenarios"][str(gsd)].items() if k in ("p5", "p50", "p95", "mean", "analytic_mean")})
(root / "data" / "montecarlo_example.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
