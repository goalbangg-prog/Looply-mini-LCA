"""Looply 재분석: 원자료(7개 영향 전부)에서 시작. 항목을 통째로 버리지 않고, 영향별로 쓸 수 있는 값만 쓴다.
실행: python3 analysis/reanalysis.py  -> data/analysis_results.json, data/clusters_k*.csv
"""
import json, numpy as np, pandas as pd
from scipy.stats import spearmanr
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score, adjusted_rand_score

df = pd.read_csv("data/lca_factors_clean.csv", encoding="utf-8-sig")
df["단위"] = df["단위"].str.strip()
COLS = list(df.columns[4:])
KEY = dict(zip(["자원","탄소","오존","산성","부영","스모그","물"], COLS))
SHORT = {"탄소":"탄소발자국","자원":"자원발자국","산성":"산성비","부영":"부영양화","스모그":"광화학스모그","물":"물소모","오존":"오존층영향"}
R = {}

# 1) 영향별 채워진 비율 (대분류별)
cov = {}
for st, g in df.groupby("대분류"):
    cov[st] = {"항목수": int(len(g)), **{SHORT[k]: round(float(g[c].notna().mean()*100), 1) for k, c in KEY.items()}}
R["coverage_by_stage"] = cov

# 2) 분석 범위: 원료 및 에너지 생산 + kg
base = df[(df["대분류"]=="원료 및 에너지 생산") & (df["단위"]=="kg")].copy()
R["base_n"] = int(len(base))
R["coverage_base"] = {SHORT[k]: round(float(base[c].notna().mean()*100), 1) for k, c in KEY.items()}
# 수돗물·공업용수는 '재료'가 아니라 물 자체라 값이 1000배 작아 따로 둔다
util = base[base["구분"]=="수자원"]
base = base[base["구분"]!="수자원"].copy()
R["utility_water"] = util["원료_에너지"].tolist()
R["pool_n"] = int(len(base))

# 3) 묶을 때 쓸 영향: 원료·kg 항목에서 85% 이상 채워진 것만
cov_pool = {k: float(base[c].notna().mean()) for k, c in KEY.items()}
FEAT = [k for k, v in cov_pool.items() if v >= 0.85]
R["feature_rule"] = "원료·kg 항목에서 85% 이상 채워진 영향만 묶는 데 사용"
R["coverage_pool"] = {SHORT[k]: round(v*100, 1) for k, v in cov_pool.items()}
R["features"] = [SHORT[k] for k in FEAT]
fc = [KEY[k] for k in FEAT]
d = base.dropna(subset=fc).copy()
R["cluster_n"] = int(len(d)); R["cluster_excluded_n"] = int(len(base)-len(d))

# 4) 빠진 항목이 어느 쪽에 쏠리는지 (구분별)
t = pd.DataFrame({"전체": base["구분"].value_counts(), "분석": d["구분"].value_counts()}).fillna(0).astype(int)
t["빠진비율"] = ((t["전체"]-t["분석"])/t["전체"]*100).round(0).astype(int)
R["bias_by_category"] = t.reset_index().rename(columns={"구분":"구분"}).to_dict("records")
core3 = base.dropna(subset=[KEY[k] for k in ["탄소","자원","산성"]])
R["core3_n"] = int(len(core3))
t3 = pd.DataFrame({"전체": base["구분"].value_counts(), "핵심3": core3["구분"].value_counts()}).fillna(0).astype(int)
R["bias_core3"] = {i: int(r["핵심3"]) for i, r in t3.iterrows()}
# 비교: 예전 방식(5개 영향 모두 필요)
old = base.dropna(subset=[KEY[k] for k in ["탄소","자원","산성","부영","물"]])
R["old_rule_n"] = int(len(old))

# 5) k-means (로그 → 표준화), k=2..6
X = StandardScaler().fit_transform(np.log10(d[fc].values))
pca = np.round(__import__("sklearn.decomposition", fromlist=["PCA"]).PCA().fit(X).explained_variance_ratio_, 3).tolist()
R["pca_ratio"] = pca
rows, models = [], {}
for k in range(2, 7):
    ms = [KMeans(k, n_init=10, random_state=s).fit(X) for s in range(20)]
    m = min(ms, key=lambda z: z.inertia_); models[k] = m
    ari = float(np.mean([adjusted_rand_score(m.labels_, z.labels_) for z in ms]))
    rows.append({"k": k, "실루엣": round(float(silhouette_score(X, m.labels_)),3), "DB": round(float(davies_bouldin_score(X, m.labels_)),2),
                 "안정성": round(ari,2), "크기": sorted(np.bincount(m.labels_).tolist(), reverse=True), "최소군집": int(np.bincount(m.labels_).min())})
R["k_scores"] = rows

# 6) 다른 특성 조합과의 일치도 (같은 항목끼리 비교)
def labels_for(cols, k):
    dd = base.dropna(subset=cols)
    Z = StandardScaler().fit_transform(np.log10(dd[cols].values))
    m = min([KMeans(k, n_init=10, random_state=s).fit(Z) for s in range(10)], key=lambda z: z.inertia_)
    return pd.Series(m.labels_, index=dd.index)
K = None  # 아래에서 정함
R["_sens_pending"] = True

# k 선택 규칙(미리 정해 둔 기준): 안정성 0.95 이상, 가장 작은 군집이 전체의 10% 이상인 k 중 Davies-Bouldin이 가장 낮은 k
ok = [r for r in rows if r["안정성"] >= 0.95 and r["최소군집"] >= 0.10*len(d)]
K = min(ok, key=lambda r: r["DB"])["k"] if ok else 3
R["chosen_k"] = K
R["k_rule"] = "안정성 0.95 이상 · 가장 작은 군집이 전체의 10% 이상 · 그중 Davies-Bouldin이 가장 낮은 k"
R["k_candidates"] = [r["k"] for r in ok]
m = models[K]; d["cluster_raw"] = m.labels_
# 군집 번호는 탄소 중앙값이 낮은 순서로 1,2,3...
order = d.groupby("cluster_raw")[KEY["탄소"]].median().sort_values().index.tolist()
remap = {o: i+1 for i, o in enumerate(order)}; d["군집"] = d["cluster_raw"].map(remap)

# 7) 군집 설명: 7개 영향 전부의 중앙값과, 값이 있는 항목 수
prof = []
for c, g in d.groupby("군집"):
    rec = {"군집": int(c), "항목수": int(len(g))}
    for k, col in KEY.items():
        s = g[col].dropna()
        rec[SHORT[k]] = {"중앙값": float(s.median()) if len(s) else None, "n": int(len(s))}
    rec["구분"] = g["구분"].value_counts().to_dict()
    rec["예시"] = g.sort_values(KEY["탄소"])["원료_에너지"].iloc[[0, len(g)//2, -1]].tolist()
    prof.append(rec)
R["cluster_profile"] = prof
R["cluster_members"] = {str(int(i)): int(c) for i, c in d["군집"].items()}
R["cluster_overall_median"] = {SHORT[k]: float(d[col].median()) for k, col in KEY.items() if k != "오존"}
# 구분이 군집을 얼마나 설명하나 (순수도): 구분별로 가장 많은 군집의 비율
ct = pd.crosstab(d["구분"], d["군집"])
big = ct[ct.sum(axis=1) >= 8]
R["category_purity"] = {i: round(float(r.max()/r.sum()*100),0) for i, r in big.iterrows()}
R["category_by_cluster"] = {int(c): ct[c].to_dict() for c in ct.columns}

# 8) 민감도: 특성을 바꿔도 같은 군집이 나오나 (공통 항목, ARI)
sens = {}
for name, cs in {"3개(탄소·자원·산성)": ["탄소","자원","산성"], "5개(+부영양화)": ["탄소","자원","산성","부영","물"], "6개(+스모그)": ["탄소","자원","산성","부영","물","스모그"]}.items():
    lab = labels_for([KEY[c] for c in cs], K)
    common = lab.index.intersection(d.index)
    sens[name] = {"n": int(len(lab)), "공통": int(len(common)), "ARI": round(float(adjusted_rand_score(d.loc[common,"군집"], lab.loc[common])),2)}
R["sensitivity"] = sens
R.pop("_sens_pending")

# 9) 상관 (순위 상관, 영향별로 쓸 수 있는 쌍만) - 전체 pool
names = [k for k in KEY if k != "오존"]
mat = {}
for a in names:
    for b in names:
        if a < b or a == b: continue
        s = base[[KEY[a], KEY[b]]].dropna()
        mat[f"{SHORT[a]}|{SHORT[b]}"] = {"rho": round(float(spearmanr(s.iloc[:,0], s.iloc[:,1])[0]),2), "n": int(len(s))}
R["spearman_pairs"] = mat
within = {}
for c, g in base.groupby("구분"):
    s = g[[KEY["탄소"], KEY["자원"]]].dropna()
    if len(s) >= 10: within[c] = {"rho": round(float(spearmanr(s.iloc[:,0], s.iloc[:,1])[0]),2), "n": int(len(s))}
R["within_category_carbon_resource"] = within

# 10) 탄소만 보면 놓치는 것: 순위(백분위) 차이
pct = pd.DataFrame(index=base.index)
for k in ["탄소","자원","산성","부영","스모그","물"]:
    pct[k] = base[KEY[k]].rank(pct=True)*100
hid = []
for idx, r in pct.iterrows():
    best = None
    for k in ["자원","산성","부영","스모그","물"]:
        if pd.notna(r[k]):
            diff = r[k]-r["탄소"]
            if best is None or diff > best[1]: best = (k, diff)
    if best and best[1] >= 40:
        hid.append({"이름": base.loc[idx,"원료_에너지"], "구분": base.loc[idx,"구분"], "탄소순위(%)": round(float(r["탄소"]),0),
                    "더큰영향": SHORT[best[0]], "그영향순위(%)": round(float(pct.loc[idx,best[0]]),0), "차이": round(float(best[1]),0)})
hid.sort(key=lambda x: -x["차이"])
R["hidden_burden"] = hid[:15]; R["hidden_burden_n"] = len(hid)
# 반대: 탄소는 높은데 다른 영향은 낮은 항목
R["carbon_top10"] = base.nlargest(10, KEY["탄소"])[["구분","원료_에너지",KEY["탄소"]]].rename(columns={KEY["탄소"]:"탄소"}).to_dict("records")
# 값의 폭
c = base[KEY["탄소"]]
R["carbon_range"] = {"min": float(c.min()), "median": float(c.median()), "max": float(c.max()), "배율": round(float(c.max()/c.min()),0), "p10": float(c.quantile(.1)), "p90": float(c.quantile(.9))}

# 11) 다른 단계의 쓸 수 있는 범위
R["stage_notes"] = {
 "연료원별 사용": "탄소발자국만 있음 (다른 6개 영향은 전부 비어 있음)",
 "화학반응공정": "탄소발자국만 있음, 단위가 제각각",
 "폐기물 처리": f"항목 {int((df['대분류']=='폐기물 처리').sum())}개, 영향 값은 약 60~75%만 채워짐",
 "수송": "ton.km 기준 10개, 영향별로 50~100% 채워짐"}

out = d[["대분류","구분","원료_에너지","단위"]+fc+["군집"]]
out.to_csv(f"data/clusters_k{K}.csv", encoding="utf-8-sig", index=True, index_label="행번호")
json.dump(R, open("data/analysis_results.json","w"), ensure_ascii=False, indent=1)
print(json.dumps({k:R[k] for k in ["base_n","pool_n","features","cluster_n","old_rule_n","coverage_pool","pca_ratio","k_scores","chosen_k","sensitivity","category_purity","carbon_range","hidden_burden_n"]}, ensure_ascii=False, indent=1))
