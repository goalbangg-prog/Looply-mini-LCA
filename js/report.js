/* 분석 리포트 탭: 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다 */
(function () {
  const { $, esc, fmt, IMP, POOL, D, RES, lbl, plot } = L;
  const J = k => IMP.findIndex(i => i.k === k);
  const NAME = { 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성화', 부영: '부영양화', 물: '물소모', 스모그: '광화학스모그' };
  const RKEY = { 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성비', 부영: '부영양화', 스모그: '광화학스모그', 물: '물소모', 오존: '오존층영향' };
  const KS6 = ['탄소', '자원', '산성', '부영', '물', '스모그'];
  const pair = (a, b) => { const rows = POOL.filter(r => r.v[J(a)] != null && r.v[J(b)] != null); return { rho: S.spearman(rows.map(r => r.v[J(a)]), rows.map(r => r.v[J(b)])), n: rows.length, rows }; };

  // 영향범주별 백분위(평균순위 기준, Python 분석과 동일)
  const PCT = (() => { const m = {}; for (const k of KS6) { const j = J(k), rows = POOL.filter(r => r.v[j] != null), rk = S.rank(rows.map(r => r.v[j])); rows.forEach((r, i) => { (m[r.id] = m[r.id] || {})[k] = rk[i] / rows.length * 100; }); } return m; })();
  function hidden() {
    const out = [];
    for (const r of POOL) { const p = PCT[r.id]; let best = null; for (const k of KS6.slice(1)) if (p[k] != null && (!best || p[k] - p['탄소'] > best.diff)) best = { k, diff: p[k] - p['탄소'] }; if (best && best.diff >= 40) out.push({ r, k: best.k, c: p['탄소'], o: p[best.k], diff: best.diff }); }
    return out.sort((a, b) => b.diff - a.diff);
  }

  function build() {
    const cw = pair('탄소', '물'), ca = pair('탄소', '자원'), cs = pair('탄소', '산성'), hid = hidden();
    const ozoneAll = D.filter(r => r.v[6] != null).length, onlyCarbon = D.filter(r => r.v.filter(v => v != null).length === 1).length, ozPool = Math.round(L.coverage(POOL, 6) * 100);
    const kScores = RES.k_scores, K = RES.chosen_k, sens = RES.sensitivity, mem = RES.cluster_members, ov = RES.cluster_overall_median;
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n;
    const funnel = [['전체 평가계수', D.length, ''], ['원료 및 에너지 생산 단계', nStage, `타 단계 ${D.length - nStage}건 제외(단위·영향범주 구성이 상이)`], ['기준 단위 kg', nKg, `타 단위 ${nStage - nKg}건 제외`], ['수자원(상수·공업용수) 제외', POOL.length, `${nKg - POOL.length}건 제외(재료가 아닌 용수, 계수 규모가 1,000배 이상 작음)`], [`${RES.features.length}개 범주 모두 유효 → 군집화 대상`, RES.cluster_n, `결측으로 ${POOL.length - RES.cluster_n}건 제외`]];

    $('report').innerHTML = `
    <section class="hero">
      <span class="eyebrow">LOOPLY · LCA DATA ANALYSIS</span>
      <h1>환경성적표지 평가계수 ${D.length}개,<br><span class="hl">무엇을 말하고 무엇을 말하지 못하는가</span></h1>
      <p class="lead">결측 구조 → 영향범주 간 상관 → 단계별 비교 → 군집 구조 순으로 분석하고, 각 결과의 적용 한계를 함께 제시합니다.</p>
      <div class="finds">
        <div class="find"><b>${cw.rho.toFixed(2)}<small>ρ</small></b><h3>탄소발자국 – 물소모 순위상관</h3><p>탄소발자국은 자원발자국(ρ ${ca.rho.toFixed(2)})·산성화(ρ ${cs.rho.toFixed(2)})와 강한 상관을 보이나 물소모와는 약한 상관(n=${cw.n})에 그칩니다. 탄소 단일 지표는 물 소비 부담의 대리변수가 될 수 없습니다.</p></div>
        <div class="find"><b>${hid.length}<small>/ ${POOL.length}</small></b><h3>탄소 저위 · 타 범주 고위 원료</h3><p>탄소 백분위보다 타 영향범주 백분위가 40%p 이상 높은 원료입니다. 예: ${hid.slice(0, 3).map(h => `${esc(h.r.name)}(${NAME[h.k]})`).join(', ')}.</p></div>
        <div class="find"><b>${onlyCarbon}<small>/ ${D.length}</small></b><h3>탄소발자국 외 전 범주 결측</h3><p>연료원별 사용·화학반응공정 등은 탄소발자국만 제공됩니다. 오존층영향은 ${D.length}건 중 ${ozoneAll}건만 값이 있어(원료 단계 결측률 ${100 - ozPool}%) 분석에서 제외했습니다.</p></div>
      </div>
    </section>

    <section class="sec" data-pane="s1"><span class="eyebrow">01 / Data Structure</span><h2>분석의 출발점은 <span class="hl">결측 구조</span>의 확인입니다</h2>
      <p class="lead">단계별·영향범주별 값 보유율(%)을 먼저 산출했습니다. 결측은 0으로 대체하지 않고 결측으로 유지했으며, 기준 단위가 다른 항목은 같은 축에서 비교하지 않았습니다.</p>
      <div class="grid g-wide"><div class="card"><h3>단계 × 영향범주 값 보유율</h3><div id="chCover" class="chart h340"></div></div>
        <div class="card"><h3>분석 대상 선별 과정</h3><div class="funnel">${funnel.map(([n, v, note], i) => `<div class="fun${i && i < funnel.length ? '' : ''}"><span>${n}</span><div class="bar"><i style="width:${(v / D.length * 100).toFixed(1)}%"></i></div><b class="num">${v}</b></div>${note ? `<div class="hint" style="margin:-4px 0 4px 0">└ ${note}</div>` : ''}`).join('')}</div></div></div>
      <div class="grid g3" style="margin-top:22px">
        <div class="card"><h3>탄소발자국 단독 제공 단계</h3><p class="muted" style="margin:0">연료원별 사용(${RES.coverage_by_stage['연료원별 사용']['항목수']}건)과 화학반응공정(${RES.coverage_by_stage['화학반응공정']['항목수']}건)은 탄소발자국 외 범주가 전부 결측입니다. 해당 단계는 탄소 산정만 가능하며 범주 간 비교는 수행할 수 없습니다.</p></div>
        <div class="card"><h3>오존층영향: 결측치로 인해 제외</h3><p class="muted" style="margin:0">원료 단계 보유율 ${ozPool}%(전체 ${ozoneAll}/${D.length}건)로 통계 분석의 최소 요건을 충족하지 못해 제외했습니다. 계산기에서는 값이 있는 항목에 한해 표시합니다.</p></div>
        <div class="card"><h3>광화학스모그: 선택적 사용</h3><p class="muted" style="margin:0">원료 단계 보유율 ${Math.round(L.coverage(POOL, 5) * 100)}%로 기본 군집화 기준(85%)에는 미달하나 분석에는 활용 가능합니다. 군집 분석 탭에서 범주로 직접 추가할 수 있으며, 추가 시 분석 대상이 감소합니다.</p></div>
      </div>
    </section>

    <section class="sec" data-pane="s2"><span class="eyebrow">02 / Impact Relationships</span><h2>탄소발자국은 <span class="hl">다른 영향범주를 대리</span>하는가</h2>
      <p class="lead">원료 ${POOL.length}종의 1 kg당 계수를 대상으로 Spearman 순위상관을 산출했습니다(쌍별 결측 제외). 축을 바꾸어 범주 간 관계를 직접 확인할 수 있습니다.</p>
      <div class="grid g-wide">
        <div class="card"><div class="row" style="align-items:flex-end;margin-bottom:8px"><div style="width:180px"><label for="rsX">X축</label><select id="rsX"></select></div><div style="width:180px"><label for="rsY">Y축</label><select id="rsY"></select></div></div><div id="chScatter" class="chart h400"></div><div id="scRead"></div></div>
        <div class="card"><h3>Spearman 순위상관행렬</h3><div id="chCorr" class="chart h400"></div><div class="read">ρ가 1에 가까울수록 항목 순위가 함께 움직입니다. 물소모·광화학스모그는 타 범주와의 상관이 상대적으로 약해 <b>범주별 개별 평가</b>가 필요합니다. 셀 호버 시 비교 쌍 수(n)를 표시합니다.</div></div>
      </div>
      <div class="card" style="margin-top:22px"><h3>탄소 백분위 대비 타 범주 백분위 격차 상위 10개 원료</h3>
        <table class="tbl"><thead><tr><th>원료</th><th>구분</th><th>탄소발자국 위치</th><th>격차가 가장 큰 범주</th><th>해당 범주 위치</th><th class="num">격차(%p)</th></tr></thead><tbody>${hid.slice(0, 10).map(h => `<tr><td>${esc(h.r.name)}</td><td>${esc(h.r.category)}</td><td>${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td><b>${L.topLabel(h.o)}</b></td><td class="num">${h.diff.toFixed(0)}</td></tr>`).join('')}</tbody></table>
        <div class="caution">백분위는 원료 ${POOL.length}종의 1 kg당 계수 내 상대 위치입니다. 용도·기능이 다른 소재의 환경성 우열을 의미하지 않으며, 대체 소재 검토 시 <b>범주 간 상쇄(trade-off)</b> 가능성을 점검하는 용도로 해석해야 합니다.</div></div>
    </section>

    <section class="sec" data-pane="s3"><span class="eyebrow">03 / Stage Comparison</span><h2>수송·폐기 단계는 <span class="hl">선택지 간 격차</span>가 큽니다</h2>
      <p class="lead">원료 외 단계 계수도 수단·처리방식에 따라 수십~수백 배 차이가 납니다. 범주를 바꾸어 확인하십시오(범주별 보유율이 낮으면 일부 항목만 표시됩니다).</p>
      <div style="width:220px;margin-bottom:14px"><label for="stImpact">영향범주</label><select id="stImpact"></select></div>
      <div class="grid g2"><div class="card"><h3>수송수단별 (ton·km당)</h3><div id="chTrans" class="chart h340"></div><div id="trRead"></div></div>
        <div class="card"><h3>폐기·처리방식별 (kg당)</h3><div id="chWaste" class="chart h340"></div><div id="wsRead"></div></div></div>
    </section>

    <section class="sec" data-pane="s4"><span class="eyebrow">04 / Cluster Structure</span><h2>군집 구조는 <span class="hl">${K}개 군집</span>으로 요약되나 경계는 모호합니다</h2>
      <p class="lead">${RES.features.map(f => f.replace('산성비', '산성화')).join('·')} ${RES.features.length}개 범주를 로그 변환·표준화한 뒤 KMeans를 적용했습니다(대상 ${RES.cluster_n}건, 결측 ${RES.cluster_excluded_n}건 제외).</p>
      <div class="grid g3" id="cluCards"></div>
      <div class="grid g2" style="margin-top:22px"><div class="card"><h3>군집별 중앙값 배수 (전체 중앙값 대비)</h3><div id="chClu" class="chart h340"></div></div><div class="card"><h3>구분과 군집의 관계</h3><div id="chComp" class="chart h340"></div><div class="read">동일 구분이 여러 군집에 분산되어 있어, 소재군(구분)만으로는 영향 수준을 추정하기 어렵습니다.</div></div></div>
      <div class="card" style="margin-top:22px"><h3>군집 타당성 검토</h3>
        <table class="tbl"><thead><tr><th>군집 수</th><th class="num">실루엣 계수</th><th class="num">Davies–Bouldin</th><th class="num">안정성(ARI 평균)</th><th>군집 크기</th></tr></thead><tbody>${kScores.map(s => `<tr${s.k === K ? ' style="background:#e8f0fc;font-weight:700"' : ''}><td>k = ${s.k}${s.k === K ? ' ◀ 선택' : ''}</td><td class="num">${s.실루엣.toFixed(3)}</td><td class="num">${s.DB.toFixed(2)}</td><td class="num">${s.안정성.toFixed(2)}</td><td>${s.크기.join(' / ')}</td></tr>`).join('')}</tbody></table>
        <div class="read"><b>k 선택 기준(사전 설정):</b> ① 안정성 0.95 이상 ② 최소 군집이 전체의 10% 이상 ③ ①②를 충족하는 후보(k = ${RES.k_candidates.join(', ')}) 중 Davies–Bouldin 최소 → k = ${K}. k=2와 k=3의 실루엣 차이(${kScores[0].실루엣.toFixed(3)} vs ${kScores[1].실루엣.toFixed(3)})는 실질적으로 동일하여 해석 가능성도 함께 고려했습니다.</div>
        <div class="caution"><b>한계:</b> 실루엣 0.33은 군집 경계가 모호함을 의미합니다(0.5 이상이어야 뚜렷). 또한 군집화 범주를 바꾸면 결과가 달라집니다. 핵심 3범주(탄소·자원·산성화)만 사용 시 기본 설정과의 ARI는 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}, 광화학스모그 추가 시 ${sens['6개(+스모그)'].ARI.toFixed(2)}입니다. 따라서 본 결과는 <b>탐색적 분류</b>이며 공식 분류나 환경성능 등급으로 사용할 수 없습니다.</div>
        <div style="margin-top:14px"><button class="btn" id="goCluster">군집 분석 탭에서 조건을 바꿔 보기 →</button></div></div>
    </section>

    <section class="sec" data-pane="s5"><span class="eyebrow">05 / Interpretation Scope</span><h2>이 데이터로 <span class="hl">말할 수 있는 것과 없는 것</span></h2>
      <div class="yesno" style="margin-top:14px">
        <div class="card yes"><h3>해석 가능</h3><ul>
          <li>동일 단계·동일 기준 단위(1 kg 등) 항목 간 <b>상대적 계수 수준</b> 비교</li>
          <li>영향범주 간 <b>상관 구조</b>와 범주별 <b>결측 구조</b> 파악</li>
          <li>수송수단·처리방식 등 <b>대안 간 상대 격차</b>의 1차 스크리닝</li>
          <li>선택 항목·수량 기준 <b>부분 산정</b>과 기여도(hotspot) 파악</li></ul></div>
        <div class="card no"><h3>해석 불가</h3><ul>
          <li>제품·서비스의 <b>전과정평가</b> 결과(시스템 경계·기능단위·LCI 부재)</li>
          <li>기능이 다른 소재 간 <b>친환경성 우열</b></li>
          <li>계수의 <b>산출 근거·불확도</b>(원자료에 불확도 정보 없음)</li>
          <li><b>최신성</b>: 2021년 기준 자료이므로 현재 공정·전력믹스와 다를 수 있음</li></ul></div>
      </div>
    </section>

    <section class="sec" data-pane="s6"><span class="eyebrow">06 / Method & Sources</span><h2>방법과 <span class="hl">재현 가능성</span></h2>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h3>자료 및 처리</h3><ol style="margin:0;padding-left:20px">
          <li>출처: 한국환경산업기술원 환경성적표지 평가계수(2021-08-02) ${D.length}건. 원자료 이용 조건은 별도 확인이 필요합니다.</li>
          <li>“해당없음”은 0이 아닌 결측으로 처리(전 범주 0 이하 값 0건).</li>
          <li>복합키(대분류·구분·항목·단위) 중복 0건, 원료 단계 항목명 중복 0건.</li>
          <li>기준 단위가 다른 항목은 혼합하지 않고 분리 분석.</li>
          <li>계수 분포가 수십만 배에 걸쳐 있어 log₁₀ 변환 후 z-score 표준화하여 군집화.</li>
          <li>생활 환산 기준은 출처를 병기했으며, 보도 인용값은 원문 확인을 권장합니다.</li></ol></div>
        <div class="card"><h3>용어 정의</h3><dl class="gloss" style="margin:0">
          <dt>Spearman ρ</dt><dd>두 변수의 순위 간 상관계수(−1~1). 단조 관계를 측정하며 이상치와 척도 차이에 강건합니다.</dd>
          <dt>실루엣 계수</dt><dd>군집 내 응집도와 군집 간 분리도를 결합한 지표(−1~1). 0.5 이상이면 구조가 뚜렷한 편입니다.</dd>
          <dt>Davies–Bouldin</dt><dd>군집 내 산포 대비 군집 간 거리의 비. 낮을수록 군집 분리가 양호합니다.</dd>
          <dt>ARI (Adjusted Rand Index)</dt><dd>두 군집 결과의 일치도(1 = 동일). 재시행·조건 변경에 대한 안정성 평가에 사용했습니다.</dd>
          <dt>백분위</dt><dd>동일 단계·단위 항목 내 상대 위치. 계수의 절대 크기가 아닌 순위 정보입니다.</dd></dl></div>
      </div>
      <details><summary>코드와 검증 자료</summary><div class="body"><ul>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/analysis/reanalysis.py">analysis/reanalysis.py</a> · 원자료부터의 재분석 코드</li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/notebooks/reanalysis_sklearn.ipynb">notebooks/reanalysis_sklearn.ipynb</a> · 결측 구조·군집·민감도 분석 노트북</li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/docs/TEST_REPORT.md">docs/TEST_REPORT.md</a> · 수행·미수행 검증 기록</li></ul></div></details>
    </section>`;

    // ---- 차트 ----
    const stages = L.STAGES.filter(s => RES.coverage_by_stage[s]), cv = (s, k) => RES.coverage_by_stage[s][RKEY[k]];
    const order7 = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'];
    plot('chCover', [{ type: 'heatmap', x: order7.map(k => IMP[J(k)].name), y: stages.map(s => `${s} (${RES.coverage_by_stage[s]['항목수']})`), z: stages.map(s => order7.map(k => cv(s, k))), text: stages.map(s => order7.map(k => Math.round(cv(s, k)) + '%')), texttemplate: '%{text}', zmin: 0, zmax: 100, colorscale: [[0, '#fbe3d6'], [.5, '#e3ecfa'], [1, '#2f6fd0']], showscale: false, hovertemplate: '%{y}<br>%{x}: 보유율 %{z:.0f}%<extra></extra>' }],
      { margin: { l: 190, r: 10, t: 10, b: 60 }, xaxis: { tickangle: -20 }, yaxis: { autorange: 'reversed' } });

    // 인터랙티브 산점도
    L.opts($('rsX'), KS6, k => k, k => NAME[k]); L.opts($('rsY'), KS6, k => k, k => NAME[k]); $('rsX').value = '탄소'; $('rsY').value = '물';
    const drawSc = () => {
      const a = $('rsX').value, b = $('rsY').value, ja = J(a), jb = J(b); if (a === b) { $('chScatter').innerHTML = '<div class="empty">서로 다른 범주를 선택하십시오.</div>'; $('scRead').innerHTML = ''; return; }
      const p = pair(a, b), pts = p.rows.filter(r => r.v[ja] > 0 && r.v[jb] > 0);
      const up = pts.filter(r => PCT[r.id][b] - PCT[r.id][a] >= 40), dn = pts.filter(r => PCT[r.id][a] - PCT[r.id][b] >= 40), rest = pts.filter(r => !up.includes(r) && !dn.includes(r));
      const tr = (arr, name, color) => ({ type: 'scatter', mode: 'markers', name, x: arr.map(r => r.v[ja]), y: arr.map(r => r.v[jb]), text: arr.map(r => `${r.name} (${r.category})`), marker: { size: 8, color, opacity: .8 }, hovertemplate: `%{text}<br>${NAME[a]} %{x:.3g}<br>${NAME[b]} %{y:.3g}<extra></extra>` });
      plot('chScatter', [tr(rest, '그 외', '#2367d1'), tr(up, `${NAME[b]} 백분위가 40%p 이상 높음`, '#e08a3c'), tr(dn, `${NAME[a]} 백분위가 40%p 이상 높음`, '#8a5fb3')], { xaxis: { type: 'log', title: `${NAME[a]} (${IMP[ja].sym} / kg)` }, yaxis: { type: 'log', title: `${NAME[b]} (${IMP[jb].sym} / kg)` }, legend: { orientation: 'h', y: -0.28 }, margin: { l: 80, b: 100 } });
      const w = Math.abs(p.rho) >= .7 ? '강한' : Math.abs(p.rho) >= .4 ? '중간 정도의' : '약한';
      $('scRead').innerHTML = `<div class="read"><b>ρ = ${p.rho.toFixed(2)}</b> (n=${p.n}): ${w} 양의 단조 관계입니다. 색 표시는 두 범주의 백분위 차이가 40%p 이상인 원료(주황 ${up.length}건·보라 ${dn.length}건)입니다.</div>`;
    };
    $('rsX').onchange = drawSc; $('rsY').onchange = drawSc; drawSc();

    const mat = KS6.map(a => KS6.map(b => (a === b ? 1 : pair(a, b).rho))), nn = KS6.map(a => KS6.map(b => (a === b ? POOL.filter(r => r.v[J(a)] != null).length : pair(a, b).n)));
    plot('chCorr', [{ type: 'heatmap', x: KS6.map(k => NAME[k]), y: KS6.map(k => NAME[k]), z: mat, zmin: -1, zmax: 1, colorscale: [[0, '#c4504a'], [.5, '#ffffff'], [1, '#2367d1']], showscale: false, text: mat.map(r => r.map(v => v.toFixed(2))), texttemplate: '%{text}', customdata: nn, hovertemplate: '%{y} × %{x}<br>ρ %{z:.2f} (n=%{customdata})<extra></extra>' }], { margin: { l: 95, b: 90, t: 10 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -30 } });

    // 수송·폐기 단계 비교
    const stImp = KS6.filter(k => D.filter(r => r.stage === '수송' && r.v[J(k)] != null).length >= 5 || D.filter(r => r.stage === '폐기물 처리' && r.v[J(k)] != null).length >= 5);
    L.opts($('stImpact'), stImp, k => k, k => NAME[k]);
    const drawStage = () => {
      const j = J($('stImpact').value), im = IMP[j];
      const tr = D.filter(r => r.stage === '수송' && r.v[j] > 0).sort((a, b) => a.v[j] - b.v[j]);
      if (tr.length >= 3) {
        plot('chTrans', [{ type: 'bar', orientation: 'h', y: tr.map(r => `${r.category} · ${r.name}`), x: tr.map(r => r.v[j]), marker: { color: tr.map(r => ({ 육상수송: '#2367d1', 해상수송: '#16795f', 항공수송: '#c4504a' }[r.category] || '#6b7a90')) }, hovertemplate: '%{y}<br>%{x:.3g}<extra></extra>' }], { xaxis: { type: 'log', title: `${im.sym} / ton·km` }, yaxis: { automargin: true }, margin: { l: 150 } });
        const hi = tr[tr.length - 1], lo = tr[0]; $('trRead').innerHTML = `<div class="read">${im.name} 기준 최대(${esc(hi.category)} · ${esc(hi.name)})는 최소(${esc(lo.category)} · ${esc(lo.name)})의 <b>${L.times(hi.v[j] / lo.v[j])}</b>입니다(n=${tr.length}).</div>`;
      } else { $('chTrans').innerHTML = `<div class="empty">${im.name}은(는) 수송 단계 유효값이 ${tr.length}건으로 표시 기준(3건) 미달입니다.</div>`; $('trRead').innerHTML = ''; }
      const ws = D.filter(r => r.stage === '폐기물 처리' && r.unit === 'kg' && r.v[j] > 0), cats = [...new Set(ws.map(r => r.category))].filter(c => ws.filter(r => r.category === c).length >= 2);
      if (cats.length >= 2) {
        plot('chWaste', cats.map((c, i) => ({ type: 'box', name: `${c} (${ws.filter(r => r.category === c).length})`, y: ws.filter(r => r.category === c).map(r => r.v[j]), boxpoints: 'all', jitter: .4, pointpos: 0, text: ws.filter(r => r.category === c).map(r => r.name), marker: { color: L.COLORS[i], size: 6 }, hovertemplate: '%{text}<br>%{y:.3g}<extra></extra>' })), { yaxis: { type: 'log', title: `${im.sym} / kg` }, showlegend: false, margin: { b: 60 } });
        const med = c => S.median(ws.filter(r => r.category === c).map(r => r.v[j])), a = cats.includes('소각') && cats.includes('재활용');
        $('wsRead').innerHTML = `<div class="read">구분별 중앙값: ${cats.map(c => `${esc(c)} ${fmt(med(c))}`).join(' · ')}${a ? ` → 소각/재활용 <b>${L.times(med('소각') / med('재활용'))}</b>` : ''}.<br>재활용 계수에 회피 부하(대체 효과)가 반영되었는지 원자료에 명시되어 있지 않아, 해석 전에 확인이 필요합니다.</div>`;
      } else { $('chWaste').innerHTML = `<div class="empty">${im.name}은(는) 폐기 단계 유효값이 부족하여 표시하지 않습니다.</div>`; $('wsRead').innerHTML = ''; }
    };
    $('stImpact').onchange = drawStage; drawStage();

    // 군집 (Python 결과)
    const prof = RES.cluster_profile, ratios = prof.map(p => KS6.map(k => p[RKEY[k]].중앙값 / ov[RKEY[k]]));
    $('cluCards').innerHTML = prof.map((p, i) => {
      const members = Object.entries(mem).filter(([, c]) => c === p.군집).map(([id]) => D[+id]), med = S.median(members.map(m => m.v[0]));
      const ex = members.sort((a, b) => Math.abs(a.v[0] - med) - Math.abs(b.v[0] - med)).slice(0, 5).map(m => esc(m.name)), { title, line } = L.clusterTitle(ratios[i], KS6.map(k => NAME[k]));
      return `<div class="clu"><span class="tag">군집 ${p.군집} · n=${p.항목수}</span><h4>${title}</h4><p style="margin:6px 0">${line}</p><small>대표 항목: ${ex.join(', ')}</small></div>`;
    }).join('');
    plot('chClu', [{ type: 'heatmap', x: KS6.map(k => NAME[k]), y: prof.map(p => `군집 ${p.군집} (n=${p.항목수})`), z: ratios.map(r => r.map(Math.log10)), zmin: -1.5, zmax: 1.5, colorscale: [[0, '#2b6c8f'], [.5, '#fff'], [1, '#c4504a']], showscale: false, text: ratios.map(r => r.map(L.fx)), texttemplate: '%{text}', hovertemplate: '%{y}<br>%{x}: 전체 중앙값의 %{text}<extra></extra>' }], { margin: { l: 130, b: 60, t: 10 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -20 } });
    const cats = [...new Set(Object.values(RES.category_by_cluster).flatMap(o => Object.keys(o)))];
    plot('chComp', Object.keys(RES.category_by_cluster).sort().map((c, i) => ({ type: 'bar', name: `군집 ${c}`, x: cats, y: cats.map(k => RES.category_by_cluster[c][k] || 0), marker: { color: L.COLORS[i] }, hovertemplate: '%{x}: %{y}건<extra>군집 ' + c + '</extra>' })), { barmode: 'stack', yaxis: { title: '항목 수' }, xaxis: { tickangle: -25 }, legend: { orientation: 'h', y: -0.35 }, margin: { b: 110 } });
    $('goCluster').onclick = () => document.querySelector('[data-tab="cluster"]').click();
  }
  L.tabs.report = { build, built: false };
})();
