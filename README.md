# Looply — LCA 환경영향 데이터 분석

> 환경성적표지 평가계수 398개를 원자료부터 다시 정제하고, **값이 비어 있는 곳까지 숫자로 확인한 뒤** 분석한 데이터 포트폴리오

**[웹앱 열기](https://goalbangg-prog.github.io/Looply-mini-LCA/)** · [재분석 노트북](notebooks/reanalysis_sklearn.ipynb) · [전처리 노트북](notebooks/data_preprocessing.ipynb) · [재분석 코드](analysis/reanalysis.py) · [변경 이력](docs/CHANGELOG.md) · [검증 기록](docs/TEST_REPORT.md)

## 이 프로젝트가 보여 주는 것

| | |
|---|---|
| 데이터 | 한국환경산업기술원 환경성적표지 평가계수(2021-08-02), 398개 항목 × 환경영향 7종 |
| 도구 | Python(pandas·NumPy·SciPy·scikit-learn), JavaScript, Plotly.js, GitHub Pages |
| 화면 | 분석 리포트 · 환경영향 계산 · 데이터 탐색 · 묶어 보기(군집) — PC 전용(너비 1180px 이상) |
| 성격 | 개인 학습·취업 포트폴리오. ISO 14040/14044를 따른 LCA나 인증 결과가 아닙니다 |

## 재분석에서 알아낸 것

1. **자료가 비어 있는 곳이 많습니다.** 연료원별 사용·화학반응공정(158개)은 탄소발자국만 있고, 오존층영향은 원료 단계의 93%가 비어 있어 분석에서 뺐습니다. 광화학스모그(원료 단계 78%)는 쓸 수 있어서 계산기와 분석에 새로 넣었습니다.
2. **빠진 항목이 한쪽으로 쏠립니다.** 5개 영향이 모두 있는 142개/187개만 분석에 들어가는데, 에너지(78%)와 건축자재(57%)가 많이 빠집니다. 웹앱은 영향을 고를 때마다 이 비율을 바로 보여 줍니다.
3. **탄소만 보면 놓치는 것이 있습니다.** 탄소는 자원·산성화·부영양화와 같이 움직이지만(순위 상관 0.7~0.8) 물소모와는 약합니다(0.3). 탄소 순위보다 다른 영향 순위가 40점 이상 높은 원료가 187개 중 25개(골판지, 트랜지스터, 유리면 등)입니다.
4. **군집은 참고용입니다.** 무리 수는 미리 정한 규칙(안정성 0.95 이상 · 가장 작은 무리 10% 이상 · Davies-Bouldin 최소)으로 3개가 나왔지만 실루엣은 0.33으로 경계가 흐리고, 묶는 영향을 바꾸면 일치도가 0.55~0.69로 떨어집니다. 재료 구분(건축자재·금속 등)과 무리도 잘 맞지 않습니다.

## 화면 구성

- **분석 리포트:** 핵심 발견 3가지 → 자료 범위 → 영향끼리의 관계 → 묶기 결과와 신뢰도 → 말할 수 있는 것/없는 것 → 방법과 출처
- **환경영향 계산:** 이름 검색 + 대분류→구분→항목 선택. 항목을 고르면 계수와 "같은 단계·같은 단위 항목 중 어느 정도인지"를 보여 줍니다. 값이 없는 영향은 0이 아니라 "자료 없음"으로 표시하고, 합계에는 몇 건이 반영됐는지 적습니다. CSV 저장 지원.
- **데이터 탐색:** 순위 · 분포 · 구분별 비교 · 두 영향 비교 · 상관표. 값이 몇 개인지와 읽는 법을 함께 보여 줍니다.
- **묶어 보기:** 쓸 영향과 무리 수를 직접 바꾸며 실루엣·안정성·무리별 배수를 확인합니다. 기본 설정에서는 Python(scikit-learn) 결과와의 일치도를 바로 계산해 보여 줍니다.

## 폴더

```text
index.html            # 진입점
css/style.css
js/  data.js results.js   # 계수 데이터 / Python 분석 결과
     stats.js             # 순위 상관·KMeans(k-means++)·실루엣·ARI를 직접 구현
     common.js report.js calc.js explore.js cluster.js main.js
analysis/reanalysis.py    # 원자료부터 다시 하는 분석 (결과: data/analysis_results.json)
data/  lca_factors_clean.csv  clusters_k3.csv  web_kmeans_k3.csv  analysis_results.json
notebooks/  reanalysis_sklearn.ipynb  data_preprocessing.ipynb
docs/  CHANGELOG.md  TEST_REPORT.md
```

## 다시 돌려 보기

```bash
pip install pandas numpy scipy scikit-learn matplotlib jupyter
python analysis/reanalysis.py            # data/analysis_results.json 갱신
jupyter notebook notebooks/reanalysis_sklearn.ipynb
python -m http.server 8000               # http://localhost:8000 (차트는 Plotly CDN 필요)
```

`data/analysis_results.json`을 바꾸면 `js/results.js`에 같은 내용(`window.LCA_RESULTS=`)으로 복사해야 화면에 반영됩니다.

## 해석의 경계

- 계수는 2021년 기준 평균값이며 환경성적표지 인증 값이 아닙니다. 제품 비교·의사결정에 그대로 쓰면 안 됩니다.
- 단위가 다른 항목은 한 줄로 비교하지 않았습니다. 분석 범위는 '원료 및 에너지 생산' · kg(수돗물·공업용수 제외) 187개입니다.
- 상관은 인과가 아니고, 군집은 공식 분류나 환경성능 순위가 아닙니다.
- 원자료 이용·재배포 조건은 별도 확인이 필요합니다.

AI 도구를 개발 보조에 활용했고, 숫자는 pandas·SciPy·scikit-learn으로 다시 계산해 웹 결과와 맞춰 보았습니다([검증 기록](docs/TEST_REPORT.md)).
