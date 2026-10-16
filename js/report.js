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
    const funnel = [['전체 평가계수', D.length, ''], ['원료 및 에너지 생산 단계', nStage, `${D.length - nStage}건 제외 (다른 단계는 단위와 영향범주 구성이 달라 함께 비교할 수 없음)`], ['기준 단위가 kg인 항목', nKg, `${nStage - nKg}건 제외 (kg이 아닌 다른 단위)`], ['수자원(상수·공업용수) 제외', POOL.length, `${nKg - POOL.length}건 제외 (재료가 아닌 용수이고 계수가 1,000배 이상 작음)`], [`군집 분석 대상 (${RES.features.length}개 범주 모두 값이 있는 항목)`, RES.cluster_n, `${POOL.length - RES.cluster_n}건 제외 (5개 범주 중 값이 빈 것이 있음)`]];

    $('report').innerHTML = `
    <section class="hero">
      <span class="eyebrow">LOOPLY · LCA DATA ANALYSIS</span>
      <h1>환경성적표지 평가계수 ${D.length}개,<br><span class="hl">무엇을 말하고 무엇을 말하지 못하는가</span></h1>
      <p class="lead">값이 비어 있는 곳(결측) 확인 → 영향범주끼리의 관계(상관) → 수송·폐기 단계 비교 → 비슷한 항목 묶기(군집 분석) 순서로 살펴보고, 각 결과를 어디까지 믿을 수 있는지도 함께 짚었습니다.</p>
      <div class="finds">
        <div class="find"><b>${cw.rho.toFixed(2)}<small>ρ</small></b><h3>탄소발자국과 물소모의 순위상관(ρ)</h3><p>탄소발자국은 자원발자국(ρ ${ca.rho.toFixed(2)})·산성화(ρ ${cs.rho.toFixed(2)})와는 순위가 거의 함께 움직이지만, 물소모와는 약하게만 이어집니다(n=${cw.n}). 탄소가 낮다고 물 부담까지 낮다고 볼 수는 없다는 뜻입니다.</p></div>
        <div class="find"><b>${hid.length}<small>/ ${POOL.length}</small></b><h3>탄소는 낮은데 다른 범주는 높은 원료</h3><p>탄소 백분위(전체 중 위치)보다 다른 영향범주의 백분위가 40%p 이상 높은 원료입니다. 예: ${hid.slice(0, 3).map(h => `${esc(h.r.name)}(${NAME[h.k]})`).join(', ')}.</p></div>
        <div class="find"><b>${onlyCarbon}<small>/ ${D.length}</small></b><h3>탄소발자국 외에는 값이 없는 항목</h3><p>연료원별 사용·화학반응공정 단계는 탄소발자국만 제공됩니다. 오존층영향은 ${D.length}건 중 ${ozoneAll}건만 값이 있어(원료 단계 결측률 ${100 - ozPool}%) 분석에서 제외했습니다.</p></div>
      </div>
    </section>

    <section class="sec" data-pane="s1"><span class="eyebrow">01 / Data Structure</span><h2>분석은 <span class="hl">값이 비어 있는 곳</span>을 확인하는 것에서 시작합니다</h2>
      <p class="lead">단계별·영향범주별로 ‘값이 들어 있는 항목의 비율’을 먼저 계산했습니다. 비어 있는 값(결측치)은 0으로 바꾸지 않고 그대로 비워 두었으며, 기준 단위가 다른 항목은 같은 그래프에서 비교하지 않았습니다.</p>
      <div class="grid g-wide"><div class="card"><h3>단계·영향범주별 ‘값이 있는 항목’ 비율</h3><div id="chCover" class="chart h340"></div></div>
        <div class="card"><h3>분석 대상 선별 과정</h3><div class="funnel">${funnel.map(([n, v, note], i) => `<div class="fun${i && i < funnel.length ? '' : ''}"><span>${n}</span><div class="bar"><i style="width:${(v / D.length * 100).toFixed(1)}%"></i></div><b class="num">${v}</b></div>${note ? `<div class="hint" style="margin:-4px 0 4px 0">└ ${note}</div>` : ''}`).join('')}</div></div></div>
      <div class="grid g3" style="margin-top:22px">
        <div class="card"><h3>탄소발자국만 있는 단계</h3><p class="muted" style="margin:0">연료원별 사용(${RES.coverage_by_stage['연료원별 사용']['항목수']}건)과 화학반응공정(${RES.coverage_by_stage['화학반응공정']['항목수']}건)은 탄소발자국 외 범주가 모두 비어 있습니다. 이 단계는 탄소만 계산할 수 있고, 영향범주끼리의 비교는 할 수 없습니다.</p></div>
        <div class="card"><h3>오존층영향: 결측치로 인해 제외</h3><p class="muted" style="margin:0">원료 단계에서 값이 있는 항목이 ${ozPool}%(전체 ${ozoneAll}/${D.length}건)뿐이라 통계 분석에는 쓸 수 없었습니다. 환경영향 계산기에서는 값이 있는 항목에 한해 표시합니다.</p></div>
        <div class="card"><h3>광화학스모그: 선택적으로 사용</h3><p class="muted" style="margin:0">원료 단계에서 값이 있는 항목이 ${Math.round(L.coverage(POOL, 5) * 100)}%라 기본 군집 분석 기준(85%)에는 못 미치지만, 군집 분석 탭에서 직접 추가해 볼 수 있습니다. 다만 추가하면 분석 대상 항목이 줄어듭니다.</p></div>
      </div>
    </section>

    <section class="sec" data-pane="s2"><span class="eyebrow">02 / Impact Relationships</span><h2>탄소발자국만 보면 <span class="hl">다른 환경영향</span>도 알 수 있을까</h2>
      <p class="lead">원료 ${POOL.length}종의 1 kg당 계수로 Spearman 순위상관(ρ: 항목들의 순위가 두 지표에서 얼마나 비슷한지, −1~1)을 계산했습니다. 비교하는 두 값이 모두 있는 항목만 사용했습니다. 아래 그래프는 축을 바꿔 가며 직접 확인할 수 있습니다.</p>
      <div class="grid g-wide">
        <div class="card"><div class="row" style="align-items:flex-end;margin-bottom:8px"><div style="width:180px"><label for="rsX">X축</label><select id="rsX"></select></div><div style="width:180px"><label for="rsY">Y축</label><select id="rsY"></select></div></div><div id="chScatter" class="chart h400"></div><div id="scRead"></div></div>
        <div class="card"><h3>Spearman 순위상관 행렬 (히트맵)</h3><div id="chCorr" class="chart h400"></div><div class="read">ρ가 1에 가까울수록 두 지표에서 항목 순위가 비슷합니다. 물소모와 광화학스모그는 다른 범주와의 상관이 약해 <b>따로 평가</b>해야 합니다. 칸에 마우스를 올리면 비교에 쓰인 항목 수(n)가 나옵니다.</div></div>
      </div>
      <div class="card" style="margin-top:22px"><h3>탄소는 낮은데 다른 범주가 유독 높은 원료 상위 10개</h3>
        <table class="tbl"><thead><tr><th>원료</th><th>구분</th><th>탄소발자국 위치</th><th>가장 크게 벗어난 범주</th><th>그 범주의 위치</th><th class="num">차이(%p)</th></tr></thead><tbody>${hid.slice(0, 10).map(h => `<tr><td>${esc(h.r.name)}</td><td>${esc(h.r.category)}</td><td>${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td><b>${L.topLabel(h.o)}</b></td><td class="num">${h.diff.toFixed(0)}</td></tr>`).join('')}</tbody></table>
        <div class="caution">‘위치’는 원료 ${POOL.length}종의 1 kg당 계수 중 상대적 순위(백분위)입니다. 용도가 다른 소재의 환경성 우열을 가리는 지표가 아니며, 대체 소재를 검토할 때 한쪽이 좋아지면 다른 쪽이 나빠지는 관계(<b>trade-off</b>)가 없는지 점검하는 용도로 보시면 됩니다.</div></div>
    </section>

    <section class="sec" data-pane="s3"><span class="eyebrow">03 / Stage Comparison</span><h2>수송·폐기 단계는 <span class="hl">선택지에 따라 격차</span>가 큽니다</h2>
      <p class="lead">원료가 아닌 단계도 수송수단이나 처리방식에 따라 계수가 수십~수백 배 달라집니다. 영향범주를 바꿔 가며 확인해 보세요. 값이 비어 있는 항목이 많은 범주는 일부만 표시됩니다.</p>
      <div style="width:220px;margin-bottom:14px"><label for="stImpact">영향범주</label><select id="stImpact"></select></div>
      <div class="grid g2"><div class="card"><h3>수송수단별 (1 ton을 1 km 옮길 때)</h3><div id="chTrans" class="chart h340"></div><div id="trRead"></div></div>
        <div class="card"><h3>폐기·처리방식별 (1 kg당, 박스플롯)</h3><div id="chWaste" class="chart h340"></div><div id="wsRead"></div></div></div>
    </section>

    <section class="sec" data-pane="s4"><span class="eyebrow">04 / Cluster Structure</span><h2>비슷한 원료끼리 묶으면 <span class="hl">${K}개 군집</span>이 나오지만 경계는 흐립니다</h2>
      <p class="lead">${RES.features.map(f => f.replace('산성비', '산성화')).join('·')} ${RES.features.length}개 범주를 로그 변환·표준화(평균 0, 표준편차 1로 맞춤)한 뒤 KMeans 군집 분석(비슷한 항목끼리 자동으로 묶는 방법)을 적용했습니다. 대상은 ${RES.cluster_n}건이며 결측치로 인해 ${RES.cluster_excluded_n}건은 제외했습니다.</p>
      <div class="grid g3" id="cluCards"></div>
      <div class="grid g2" style="margin-top:22px"><div class="card"><h3>군집별 중앙값이 전체 중앙값의 몇 배인가 (히트맵)</h3><div id="chClu" class="chart h340"></div></div><div class="card"><h3>구분과 군집의 관계</h3><div id="chComp" class="chart h340"></div><div class="read">같은 구분의 원료가 여러 군집에 흩어져 있어, 구분(소재군)만으로는 환경영향 수준을 짐작하기 어렵습니다.</div></div></div>
      <div class="card" style="margin-top:22px"><h3>군집 수(k)를 이렇게 정했습니다</h3>
        <table class="tbl"><thead><tr><th>군집 수</th><th class="num">실루엣 계수<br><small class="muted">클수록 뚜렷</small></th><th class="num">Davies–Bouldin<br><small class="muted">작을수록 좋음</small></th><th class="num">안정성(ARI)<br><small class="muted">1이면 매번 동일</small></th><th>군집 크기</th></tr></thead><tbody>${kScores.map(s => `<tr${s.k === K ? ' style="background:#e8f0fc;font-weight:700"' : ''}><td>k = ${s.k}${s.k === K ? ' ◀ 선택' : ''}</td><td class="num">${s.실루엣.toFixed(3)}</td><td class="num">${s.DB.toFixed(2)}</td><td class="num">${s.안정성.toFixed(2)}</td><td>${s.크기.join(' / ')}</td></tr>`).join('')}</tbody></table>
        <div class="read"><b>결과를 보기 전에 정해 둔 기준:</b> ① 안정성(초기값을 바꿔 다시 돌려도 같은 결과) 0.95 이상 ② 가장 작은 군집이 전체의 10% 이상 ③ ①②를 만족하는 후보(k = ${RES.k_candidates.join(', ')}) 중 Davies–Bouldin(군집끼리 겹치는 정도)이 가장 낮은 것 → k = ${K}. k=2와 k=3의 실루엣 차이(${kScores[0].실루엣.toFixed(3)} 대 ${kScores[1].실루엣.toFixed(3)})는 사실상 같아서, 해석하기 쉬운 쪽도 함께 고려했습니다.</div>
        <div class="caution"><b>한계:</b> 실루엣 0.33은 군집 경계가 흐리다는 뜻입니다(0.5 이상이어야 뚜렷한 편). 묶는 데 쓰는 범주를 바꾸면 결과도 달라집니다. 핵심 3범주(탄소·자원·산성화)만 쓰면 기본 결과와의 일치도(ARI)가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}, 광화학스모그를 더하면 ${sens['6개(+스모그)'].ARI.toFixed(2)}입니다. 따라서 이 결과는 <b>탐색용 분류</b>이며 공식 분류나 환경성능 등급으로 쓸 수 없습니다.</div>
        <div style="margin-top:14px"><button class="btn" id="goCluster">군집 분석 탭에서 직접 조건을 바꿔 보기 →</button></div></div>
    </section>

    <section class="sec" data-pane="s5"><span class="eyebrow">05 / Interpretation Scope</span><h2>이 데이터로 <span class="hl">말할 수 있는 것과 없는 것</span></h2>
      <div class="yesno" style="margin-top:14px">
        <div class="card yes"><h3>해석 가능</h3><ul>
          <li>같은 단계·같은 단위(1 kg 등) 항목끼리 <b>계수가 상대적으로 큰지 작은지</b> 비교</li>
          <li>영향범주끼리의 <b>상관 구조</b>와 범주별 <b>결측 구조</b> 파악</li>
          <li>수송수단·처리방식 같은 대안 사이의 <b>대략적인 격차</b> 1차 스크리닝</li>
          <li>고른 항목·수량 기준의 <b>부분 산정</b>과 기여도(hotspot, 결과를 좌우하는 항목) 파악</li></ul></div>
        <div class="card no"><h3>해석 불가</h3><ul>
          <li>제품·서비스의 <b>전과정평가 결과</b> (시스템 경계, 기능단위, 전과정 목록(LCI)이 없음)</li>
          <li>기능이 다른 소재 사이의 <b>친환경성 우열</b></li>
          <li>계수의 <b>산출 근거와 불확도</b> (원자료에 불확도 정보가 없음)</li>
          <li><b>최신성</b>: 2021년 자료라 현재의 공정·전력 구성과 다를 수 있음</li></ul></div>
      </div>
    </section>

    <section class="sec" data-pane="s6"><span class="eyebrow">06 / Methods & Sources</span><h2>분석 방법과 <span class="hl">출처</span>는 따로 모았습니다</h2>
      <p class="lead">사용한 통계 기법의 설명, 생활 환산 기준의 출처, 기술 스택과 코드 링크는 ‘방법·출처’ 탭에 정리했습니다.</p>
      <button class="btn" id="goNotes">방법·출처 보기 →</button>
    </section>`;

    // ---- 차트 ----
    const stages = L.STAGES.filter(s => RES.coverage_by_stage[s]), cv = (s, k) => RES.coverage_by_stage[s][RKEY[k]];
    const order7 = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'];
    plot('chCover', [{ type: 'heatmap', x: order7.map(k => IMP[J(k)].name), y: stages.map(s => `${s} (${RES.coverage_by_stage[s]['항목수']})`), z: stages.map(s => order7.map(k => cv(s, k))), text: stages.map(s => order7.map(k => Math.round(cv(s, k)) + '%')), texttemplate: '%{text}', zmin: 0, zmax: 100, colorscale: [[0, '#fbe3d6'], [.5, '#e3ecfa'], [1, '#2f6fd0']], showscale: false, hovertemplate: '%{y}<br>%{x}: 값이 있는 항목 %{z:.0f}%<extra></extra>' }],
      { margin: { l: 190, r: 10, t: 10, b: 60 }, xaxis: { tickangle: -20 }, yaxis: { autorange: 'reversed' } });

    // 인터랙티브 산점도
    L.opts($('rsX'), KS6, k => k, k => NAME[k]); L.opts($('rsY'), KS6, k => k, k => NAME[k]); $('rsX').value = '탄소'; $('rsY').value = '물';
    const drawSc = () => {
      const a = $('rsX').value, b = $('rsY').value, ja = J(a), jb = J(b); if (a === b) { L.purge('chScatter'), $('chScatter').innerHTML = '<div class="empty">X축과 Y축에 서로 다른 범주를 골라 주세요.</div>'; $('scRead').innerHTML = ''; return; }
      const p = pair(a, b), pts = p.rows.filter(r => r.v[ja] > 0 && r.v[jb] > 0);
      const up = pts.filter(r => PCT[r.id][b] - PCT[r.id][a] >= 40), dn = pts.filter(r => PCT[r.id][a] - PCT[r.id][b] >= 40), rest = pts.filter(r => !up.includes(r) && !dn.includes(r));
      const tr = (arr, name, color) => ({ type: 'scatter', mode: 'markers', name, x: arr.map(r => r.v[ja]), y: arr.map(r => r.v[jb]), text: arr.map(r => `${r.name} (${r.category})`), marker: { size: 8, color, opacity: .8 }, hovertemplate: `%{text}<br>${NAME[a]} %{x:.3g}<br>${NAME[b]} %{y:.3g}<extra></extra>` });
      plot('chScatter', [tr(rest, '그 외', '#2367d1'), tr(up, `${NAME[b]}가 유독 높은 원료`, '#e08a3c'), tr(dn, `${NAME[a]}가 유독 높은 원료`, '#8a5fb3')], { xaxis: { type: 'log', title: `${NAME[a]} (${IMP[ja].sym} / kg)` }, yaxis: { type: 'log', title: `${NAME[b]} (${IMP[jb].sym} / kg)` }, legend: { orientation: 'h', y: -0.28 }, margin: { l: 80, b: 100 } });
      const w = Math.abs(p.rho) >= .7 ? '강한' : Math.abs(p.rho) >= .4 ? '중간 정도의' : '약한';
      $('scRead').innerHTML = `<div class="read"><b>ρ = ${p.rho.toFixed(2)}</b> (n=${p.n}): ${w} 양의 상관입니다(한쪽이 클수록 다른 쪽도 큰 경향). 색이 다른 점은 두 범주의 순위(백분위) 차이가 40%p 이상 나는 원료로, 주황 ${up.length}건·보라 ${dn.length}건입니다.</div>`;
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
        const hi = tr[tr.length - 1], lo = tr[0]; $('trRead').innerHTML = `<div class="read">${im.name} 기준으로 가장 큰 수단(${esc(hi.category)} · ${esc(hi.name)})은 가장 작은 수단(${esc(lo.category)} · ${esc(lo.name)})의 <b>${L.times(hi.v[j] / lo.v[j])}</b>입니다(${tr.length}개 수단 비교).</div>`;
      } else { L.purge('chTrans'), $('chTrans').innerHTML = `<div class="empty">${im.name}은(는) 수송 단계에 값이 있는 항목이 ${tr.length}건뿐이라(최소 3건 필요) 표시하지 않습니다.</div>`; $('trRead').innerHTML = ''; }
      const ws = D.filter(r => r.stage === '폐기물 처리' && r.unit === 'kg' && r.v[j] > 0), cats = [...new Set(ws.map(r => r.category))].filter(c => ws.filter(r => r.category === c).length >= 2);
      if (cats.length >= 2) {
        plot('chWaste', cats.map((c, i) => ({ type: 'box', name: `${c} (${ws.filter(r => r.category === c).length})`, y: ws.filter(r => r.category === c).map(r => r.v[j]), boxpoints: 'all', jitter: .4, pointpos: 0, text: ws.filter(r => r.category === c).map(r => r.name), marker: { color: L.COLORS[i], size: 6 }, hovertemplate: '%{text}<br>%{y:.3g}<extra></extra>' })), { yaxis: { type: 'log', title: `${im.sym} / kg` }, showlegend: false, margin: { b: 60 } });
        const med = c => S.median(ws.filter(r => r.category === c).map(r => r.v[j])), a = cats.includes('소각') && cats.includes('재활용');
        $('wsRead').innerHTML = `<div class="read">처리방식별 중앙값(박스 속 선): ${cats.map(c => `${esc(c)} ${fmt(med(c))}`).join(' · ')}${a ? ` → 소각은 재활용의 <b>${L.times(med('소각') / med('재활용'))}</b>` : ''}.<br>재활용을 하면 새 자원을 덜 쓰게 되는 효과(회피 부하)가 계수에 반영됐는지는 원자료에 나와 있지 않으므로, 해석 전에 확인이 필요합니다.</div>`;
      } else { L.purge('chWaste'), $('chWaste').innerHTML = `<div class="empty">${im.name}은(는) 폐기 단계에 값이 있는 항목이 부족해 표시하지 않습니다.</div>`; $('wsRead').innerHTML = ''; }
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
    $('goNotes').onclick = () => document.querySelector('[data-tab="notes"]').click();
  }
  L.tabs.report = { build, built: false };
})();
