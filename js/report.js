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
    const ozoneAll = D.filter(r => r.v[6] != null).length, onlyCarbon = D.filter(r => r.v.filter(v => v != null).length === 1).length, ozPool = Math.round(L.coverage(POOL, 6) * 100), ozMiss = 100 - ozPool;
    const kScores = RES.k_scores, K = RES.chosen_k, sens = RES.sensitivity, mem = RES.cluster_members, ov = RES.cluster_overall_median;
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n, miss = k => 100 - Math.round(L.coverage(POOL, J(k)) * 100);
    const cb = pair('탄소', '부영');
    const funnel = [['전체 평가계수', D.length, ''], ['원료 및 에너지 생산 단계', nStage, `${D.length - nStage}개 제외: 다른 단계는 단위와 영향 종류가 달라 같이 비교할 수 없습니다.`], ['단위가 kg인 항목', nKg, `${nStage - nKg}개 제외: kg이 아닌 단위(MJ 등)입니다.`], ['수자원(상수·공업용수) 제외', POOL.length, `${nKg - POOL.length}개 제외: 재료가 아니라 용수이고, 값이 1,000배 이상 작습니다.`], ['군집 분석 대상', RES.cluster_n, `${POOL.length - RES.cluster_n}개 제외: 5가지 영향 중 비어 있는 값이 있습니다(결측치).`]];
    const f = RES.cluster_n, ps = RES.sensitivity, ksc = RES.k_scores, ozN = Math.round(L.coverage(POOL, 6) * POOL.length);
    const decisions = [
      ['오존층영향', '분석에서 뺐습니다', `원료 단계에서 값이 있는 항목이 ${100 - ozMiss}%(${ozoneAll}/${D.length}개)뿐이라, 통계로 볼 만한 수가 안 됩니다.`, `넣으면 분석 대상이 ${ozN}개 안팎으로 줄어 우연한 결과가 나올 수 있습니다.`],
      ['결측치', '0으로 채우지 않았습니다', '‘측정하지 않음’과 ‘영향이 0’은 다릅니다. 0으로 채우면 합계와 상관계수가 틀어집니다.', '0으로 채우면 비어 있는 영향이 실제보다 낮아 보입니다.'],
      ['단위가 다른 항목', '섞지 않고 kg 기준 원료만 분석했습니다', `kg, MJ, ton·km는 의미가 달라 한 그래프에서 비교할 수 없습니다. 원료 ${nStage}개 중 ${POOL.length}개가 대상입니다.`, '억지로 환산하면 근거 없는 비교가 됩니다.'],
      ['수자원', '분석에서 뺐습니다', '재료가 아니라 용수이고, 값이 1,000배 이상 작아 분석을 한쪽으로 끌어당깁니다.', '넣으면 ‘값이 낮은 군집’이 수자원 때문에 생길 수 있습니다.'],
      ['로그 변환·표준화', '군집 분석 전에 적용했습니다', '값이 수십만 배까지 차이 나서, 그대로 쓰면 큰 값 몇 개가 결과를 정해 버립니다.', '안 하면 사실상 한두 개 원료가 군집을 결정합니다.'],
      ['군집 수', '결과를 보기 전에 기준을 정해 3개로 골랐습니다', `점수만 보면 2~6개가 ${Math.min(...ksc.map(x => x.실루엣)).toFixed(2)}~${Math.max(...ksc.map(x => x.실루엣)).toFixed(2)}로 거의 같아 고를 수 없습니다. 그래서 안정성·군집 크기·겹침 정도 기준을 먼저 정했습니다.`, '결과를 본 뒤 고르면 보기 좋은 쪽만 택하게 됩니다.'],
      ['군집 결과의 성격', '‘탐색용’이라고 밝혔습니다', `실루엣이 0.33으로 낮고, 묶는 기준을 바꾸면 일치도가 ${ps['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${ps['6개(+스모그)'].ARI.toFixed(2)}로 떨어집니다.`, '등급처럼 보여 주면 근거보다 큰 확신을 주게 됩니다.'],
      ['빠진 항목의 쏠림', '결과와 함께 공개했습니다', `${f}/${POOL.length}개만 분석에 들어갔고, 에너지(78%)·건축자재(57%)가 많이 빠졌습니다.`, '숨기면 전체 원료를 대표하는 결과로 오해합니다.'],
      ['재활용 계수', '해석을 보류했습니다', '재활용으로 새 자원을 덜 쓰는 효과가 계수에 반영됐는지 원자료에 나와 있지 않습니다.', '모르고 소각과 비교하면 결론이 뒤집힐 수 있습니다.'],
      ['불확도', '가정한 값임을 밝히고 시나리오로만 제공했습니다', '원자료에 오차 범위가 없어 실제 불확도는 계산할 수 없습니다.', '±값을 단정하면 정밀해 보이는 가짜 결과가 됩니다.'],
      ['생활 환산 기준', '출처를 밝히고 최신 공개값을 썼습니다', '승용차 값은 확인 가능한 최신 실적이 2020년 판매분이라 한계를 함께 표시했습니다.', '오래된 값을 최신처럼 쓰면 신뢰가 떨어집니다.']
    ];

    $('report').innerHTML = `
    <section class="hero">
      <span class="eyebrow">LOOPLY · LCA DATA ANALYSIS</span>
      <h1>평가계수 ${D.length}개를 뜯어보니,<br><span class="hl">탄소발자국만 봐서는 놓치는 게 많았습니다</span></h1>
      <p class="lead">한국환경산업기술원이 공개한 환경성적표지 평가계수(원료·에너지·수송·폐기물의 환경영향 값) 398개를 분석했습니다. 결측치가 어디에 몰려 있는지, 탄소발자국으로 다른 영향을 알 수 있는지, 비슷한 원료끼리 묶으면 어떻게 나뉘는지를 순서대로 봅니다.</p>
      <div class="finds">
        <div class="find"><b>${cw.rho.toFixed(2)}<small>ρ</small></b><h3>탄소발자국과 물소모는 거의 따로 움직입니다</h3><p>탄소발자국은 자원발자국(${ca.rho.toFixed(2)})·산성화(${cs.rho.toFixed(2)})와는 함께 움직이지만, 물소모와는 ${cw.rho.toFixed(2)}로 낮습니다. 탄소발자국만으로는 물 부담을 알 수 없습니다.</p><small class="fnote">상관계수(ρ): 두 값의 순위가 얼마나 같이 움직이는지. 1에 가까울수록 같이 움직입니다.</small></div>
        <div class="find"><b>${hid.length}<small>/ ${POOL.length}종</small></b><h3>탄소발자국만 보면 놓치는 원료</h3><p>탄소발자국 순위보다 다른 영향의 순위가 40%p 이상 높은 원료입니다. ${hid.slice(0, 3).map(h => `${esc(h.r.name)}(${NAME[h.k]})`).join(', ')} 등이 있습니다.</p></div>
        <div class="find"><b>${onlyCarbon}<small>/ ${D.length}개</small></b><h3>탄소발자국만 있는 항목</h3><p>연료 사용·화학반응 단계는 탄소발자국 외의 값이 모두 비어 있습니다. 오존층영향은 ${D.length}개 중 ${ozoneAll}개만 값이 있어 분석에서 뺐습니다.</p></div>
      </div>
    </section>

    <section class="sec" data-pane="s1"><span class="eyebrow">01 / Missing Data</span><h2><span class="hl">결측치</span>가 어디에 몰려 있는지 봤습니다</h2>
      <p class="lead">결측치를 0으로 채우면 ‘영향이 없다’는 뜻이 되어 결과가 틀어집니다. 그래서 비워 둔 채로 분석했고, 단위가 다른 항목은 서로 비교하지 않았습니다.</p>
      <div class="grid g-wide"><div class="card"><h3>단계별·영향별 결측치 비율 (%)</h3><div id="chCover" class="chart h340"></div><p class="hint">숫자가 클수록(주황) 비어 있는 값이 많습니다.</p></div>
        <div class="card"><h3>분석 대상을 이렇게 걸렀습니다</h3><div class="funnel">${funnel.map(([n, v, note]) => `<div class="fun"><span>${n}</span><div class="bar"><i style="width:${(v / D.length * 100).toFixed(1)}%"></i></div><b class="num">${v}</b></div>${note ? `<div class="hint" style="margin:-4px 0 4px 0">└ ${note}</div>` : ''}`).join('')}</div></div></div>
      <div class="grid g3" style="margin-top:22px">
        <div class="card"><h3>연료 사용·화학반응은 탄소발자국만 있습니다</h3><p class="muted" style="margin:0">연료원별 사용(${RES.coverage_by_stage['연료원별 사용']['항목수']}개)과 화학반응공정(${RES.coverage_by_stage['화학반응공정']['항목수']}개)은 탄소발자국 외의 값이 모두 비어 있어, 탄소발자국만 계산할 수 있습니다.</p></div>
        <div class="card"><h3>오존층영향은 뺐습니다</h3><p class="muted" style="margin:0">원료 단계의 결측치가 ${ozMiss}%입니다. 값이 있는 항목이 너무 적어 분석에서 뺐고, 계산기에서는 값이 있는 항목만 보여 줍니다.</p></div>
        <div class="card"><h3>광화학스모그는 선택 사항입니다</h3><p class="muted" style="margin:0">결측치가 ${miss('스모그')}%라서 기본 분석(결측치 15% 이하만 사용)에는 넣지 않았습니다. 군집 분석 탭에서 직접 추가할 수 있고, 추가하면 분석 대상이 줄어듭니다.</p></div>
      </div>
    </section>

    <section class="sec" data-pane="s2"><span class="eyebrow">02 / Relationships</span><h2>탄소발자국으로 <span class="hl">다른 환경영향</span>도 알 수 있을까요?</h2>
      <p class="lead">원료 ${POOL.length}종에서 탄소발자국이 큰 원료가 다른 영향도 큰지 확인했습니다. Spearman 상관계수(ρ)는 두 지표의 순위가 얼마나 비슷한지를 나타냅니다. 1에 가까울수록 순위가 비슷하고, 0에 가까울수록 관계가 없습니다.</p>
      <div class="grid g-wide">
        <div class="card"><div class="row" style="align-items:flex-end;margin-bottom:8px"><div style="width:180px"><label for="rsX">가로축</label><select id="rsX"></select></div><div style="width:180px"><label for="rsY">세로축</label><select id="rsY"></select></div></div><div id="chScatter" class="chart h400"></div><div id="scRead"></div></div>
        <div class="card"><h3>영향끼리의 상관계수 (파란색일수록 함께 움직임)</h3><div id="chCorr" class="chart h400"></div><div class="read">탄소발자국은 자원발자국(${ca.rho.toFixed(2)})·산성화(${cs.rho.toFixed(2)})·부영양화(${cb.rho.toFixed(2)})와 함께 움직이고, 물소모와는 ${cw.rho.toFixed(2)}로 약합니다. 칸에 마우스를 올리면 비교한 원료 수가 보입니다.</div></div>
      </div>
      <div class="card" style="margin-top:22px"><h3>탄소발자국 순위보다 다른 영향 순위가 훨씬 높은 원료 TOP 10</h3>
        <table class="tbl"><thead><tr><th>원료</th><th>구분</th><th>탄소발자국 순위</th><th>가장 크게 차이 나는 영향</th><th>그 영향의 순위</th><th class="num">순위 차이</th></tr></thead><tbody>${hid.slice(0, 10).map(h => `<tr><td>${esc(h.r.name)}</td><td>${esc(h.r.category)}</td><td>${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td><b>${L.topLabel(h.o)}</b></td><td class="num">${h.diff.toFixed(0)}%p</td></tr>`).join('')}</tbody></table>
        <div class="caution">순위는 원료 ${POOL.length}종 안에서의 상대 위치입니다. 용도가 다른 소재의 우열을 가르는 값은 아닙니다. 대체 소재를 고를 때 ‘탄소발자국은 줄었는데 다른 영향이 늘지 않았는지’ 확인하는 데 쓰세요. 이런 관계를 trade-off(한쪽이 좋아지면 다른 쪽이 나빠지는 관계)라고 합니다.</div></div>
    </section>

    <section class="sec" data-pane="s3"><span class="eyebrow">03 / Transport & Waste</span><h2>수송과 폐기는 <span class="hl">무엇을 고르느냐</span>에 따라 차이가 큽니다</h2>
      <p class="lead">수송수단이나 폐기 방식에 따라 환경영향이 수십~수백 배 차이 납니다. 영향 종류를 바꿔 가며 확인할 수 있습니다.</p>
      <div style="width:220px;margin-bottom:14px"><label for="stImpact">영향 종류</label><select id="stImpact"></select></div>
      <div class="grid g2"><div class="card"><h3>수송수단별 (1톤을 1km 옮길 때)</h3><div id="chTrans" class="chart h340"></div><div id="trRead"></div></div>
        <div class="card"><h3>폐기·처리방식별 (1kg당)</h3><div id="chWaste" class="chart h340"></div><div id="wsRead"></div></div></div>
    </section>

    <section class="sec" data-pane="s4"><span class="eyebrow">04 / Clusters</span><h2>비슷한 원료끼리 묶으면 <span class="hl">${K}개 군집</span>이 나오지만, 경계는 흐립니다</h2>
      <p class="lead">군집 분석: 값의 패턴이 비슷한 항목끼리 자동으로 묶는 방법입니다. ${RES.features.map(f => f.replace('산성비', '산성화')).join('·')} 5가지 값을 비교했고, 5가지가 모두 있는 ${RES.cluster_n}개 원료만 대상으로 했습니다(나머지 ${RES.cluster_excluded_n}개는 결측치 때문에 제외). 값의 차이가 워낙 커서 로그 변환과 표준화(평균 0, 표준편차 1로 맞추는 처리)를 먼저 했습니다.</p>
      <div class="grid g3" id="cluCards"></div>
      <p class="hint">‘○배’는 군집의 중앙값이 전체 중앙값의 몇 배인지입니다. 중앙값은 크기순으로 세웠을 때 가운데 값입니다.</p>
      <div class="grid g2" style="margin-top:22px"><div class="card"><h3>군집별로 어떤 영향이 큰가 (전체 중앙값 대비 배수)</h3><div id="chClu" class="chart h340"></div></div><div class="card"><h3>같은 소재군도 여러 군집에 흩어져 있습니다</h3><div id="chComp" class="chart h340"></div><div class="read">같은 구분(예: 기초화학물질)의 원료가 여러 군집으로 나뉩니다. 소재 종류만으로는 환경영향 수준을 알 수 없습니다.</div></div></div>
      <div class="card" style="margin-top:22px"><h3>군집 수를 ${K}개로 정한 이유</h3>
        <table class="tbl"><thead><tr><th>군집 수</th><th class="num">실루엣 계수<br><small class="muted">클수록 뚜렷</small></th><th class="num">Davies–Bouldin<br><small class="muted">작을수록 덜 겹침</small></th><th class="num">안정성(ARI)<br><small class="muted">1이면 매번 같음</small></th><th>군집 크기</th></tr></thead><tbody>${kScores.map(s => `<tr${s.k === K ? ' style="background:#e8f0fc;font-weight:700"' : ''}><td>${s.k}개${s.k === K ? ' ◀ 선택' : ''}</td><td class="num">${s.실루엣.toFixed(3)}</td><td class="num">${s.DB.toFixed(2)}</td><td class="num">${s.안정성.toFixed(2)}</td><td>${s.크기.join(' / ')}</td></tr>`).join('')}</tbody></table>
        <div class="read"><b>결과를 보기 전에 기준부터 정했습니다.</b> ① 다시 돌려도 같은 결과일 것(안정성 0.95 이상) ② 가장 작은 군집이 전체의 10% 이상일 것 ③ 둘 다 만족하는 후보(${RES.k_candidates.join('개, ')}개) 중 군집끼리 가장 덜 겹치는 것을 고르면 ${K}개입니다. 2개와 3개의 실루엣 점수는 거의 같아서(${kScores[0].실루엣.toFixed(3)} 대 ${kScores[1].실루엣.toFixed(3)}), 해석하기 좋은 3개를 택했습니다.</div>
        <div class="caution"><b>한계:</b> 실루엣 점수가 0.33으로 낮아 군집 경계가 흐립니다(0.5 이상이어야 뚜렷한 편). 묶는 기준인 영향 종류를 바꾸면 결과도 달라집니다. 탄소발자국·자원발자국·산성화 3가지만 쓰면 원래 결과와의 일치도(ARI)가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}, 광화학스모그를 더하면 ${sens['6개(+스모그)'].ARI.toFixed(2)}입니다. 이 군집은 탐색용이며 공식 분류나 환경 등급으로 쓸 수 없습니다.</div>
        <div style="margin-top:14px"><button class="btn" id="goCluster">군집 분석 탭에서 직접 조건을 바꿔 보기 →</button></div></div>
    </section>

    <section class="sec" data-pane="s5"><span class="eyebrow">05 / Scope</span><h2>이 데이터로 <span class="hl">말할 수 있는 것과 없는 것</span></h2>
      <div class="yesno" style="margin-top:14px">
        <div class="card yes"><h3>말할 수 있는 것</h3><ul>
          <li>같은 단계·같은 단위(예: 1kg)의 원료끼리 환경영향 값이 어느 쪽이 큰지</li>
          <li>환경영향끼리 같이 움직이는지, 어떤 값이 비어 있는지</li>
          <li>수송수단·폐기 방식 같은 선택지 사이의 대략적인 차이</li>
          <li>고른 항목과 수량으로 한 부분 계산, 그리고 결과를 좌우하는 항목(hotspot)</li></ul></div>
        <div class="card no"><h3>말할 수 없는 것</h3><ul>
          <li>제품 하나의 전과정평가(LCA) 결과: 어디서 어디까지 계산할지(시스템 경계)와 기준 단위, 항목별 상세 데이터(LCI)가 없습니다.</li>
          <li>기능이 다른 소재끼리 어느 쪽이 더 친환경인지</li>
          <li>계수가 얼마나 정확한지: 원자료에 오차 범위(불확도)가 없습니다.</li>
          <li>지금 시점의 값: 2021년 자료라 현재의 공정이나 전력 구성과 다를 수 있습니다.</li></ul></div>
      </div>
    </section>

    <section class="sec" data-pane="s5b"><span class="eyebrow">06 / My Decisions</span><h2>분석하면서 <span class="hl">내가 내린 판단</span>과 그 이유</h2>
      <p class="lead">정답이 없는 선택을 여러 번 해야 했습니다. 무엇을 어떻게 골랐고, 이유는 무엇이며, 다르게 했다면 어떻게 됐을지 정리했습니다.</p>
      <div class="card"><table class="tbl dec"><thead><tr><th style="width:15%">판단할 문제</th><th style="width:21%">어떻게 했나</th><th>이유</th><th style="width:25%">다르게 했다면</th></tr></thead><tbody>${decisions.map(d => `<tr><td><b>${d[0]}</b></td><td>${d[1]}</td><td>${d[2]}</td><td class="muted">${d[3]}</td></tr>`).join('')}</tbody></table></div>
    </section>

    <section class="sec" data-pane="s6"><span class="eyebrow">07 / Methods & Sources</span><h2>분석 방법과 <span class="hl">출처</span>는 따로 모았습니다</h2>
      <p class="lead">분석 기법 설명, 생활 환산 기준의 출처, 기술 스택, 코드 링크는 ‘방법·출처’ 탭에 있습니다.</p>
      <button class="btn" id="goNotes">방법·출처 보기 →</button>
    </section>`;

    // ---- 차트 ----
    const stages = L.STAGES.filter(s => RES.coverage_by_stage[s]), cv = (s, k) => RES.coverage_by_stage[s][RKEY[k]];
    const order7 = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'];
    plot('chCover', [{ type: 'heatmap', x: order7.map(k => IMP[J(k)].name), y: stages.map(s => `${s} (${RES.coverage_by_stage[s]['항목수']})`), z: stages.map(s => order7.map(k => 100 - cv(s, k))), text: stages.map(s => order7.map(k => Math.round(100 - cv(s, k)) + '%')), texttemplate: '%{text}', zmin: 0, zmax: 100, colorscale: [[0, '#2f6fd0'], [.35, '#cfe0f7'], [.7, '#f6d9c0'], [1, '#e08a3c']], showscale: false, hovertemplate: '%{y}<br>%{x}: 결측치 %{z:.0f}%<extra></extra>' }],
      { margin: { l: 190, r: 10, t: 10, b: 60 }, xaxis: { tickangle: -20 }, yaxis: { autorange: 'reversed' } });

    // 인터랙티브 산점도
    L.opts($('rsX'), KS6, k => k, k => NAME[k]); L.opts($('rsY'), KS6, k => k, k => NAME[k]); $('rsX').value = '탄소'; $('rsY').value = '물';
    const drawSc = () => {
      const a = $('rsX').value, b = $('rsY').value, ja = J(a), jb = J(b); if (a === b) { L.purge('chScatter'), $('chScatter').innerHTML = '<div class="empty">가로축과 세로축에 서로 다른 영향을 골라 주세요.</div>'; $('scRead').innerHTML = ''; return; }
      const p = pair(a, b), pts = p.rows.filter(r => r.v[ja] > 0 && r.v[jb] > 0);
      const up = pts.filter(r => PCT[r.id][b] - PCT[r.id][a] >= 40), dn = pts.filter(r => PCT[r.id][a] - PCT[r.id][b] >= 40), rest = pts.filter(r => !up.includes(r) && !dn.includes(r));
      const tr = (arr, name, color) => ({ type: 'scatter', mode: 'markers', name, x: arr.map(r => r.v[ja]), y: arr.map(r => r.v[jb]), text: arr.map(r => `${r.name} (${r.category})`), marker: { size: 8, color, opacity: .8 }, hovertemplate: `%{text}<br>${NAME[a]} %{x:.3g}<br>${NAME[b]} %{y:.3g}<extra></extra>` });
      plot('chScatter', [tr(rest, '그 외', '#2367d1'), tr(up, `${L.josa(NAME[b], '이', '가')} 유난히 높은 원료`, '#e08a3c'), tr(dn, `${L.josa(NAME[a], '이', '가')} 유난히 높은 원료`, '#8a5fb3')], { xaxis: { type: 'log', title: `${NAME[a]} (${IMP[ja].sym} / kg)` }, yaxis: { type: 'log', title: `${NAME[b]} (${IMP[jb].sym} / kg)` }, legend: { orientation: 'h', y: -0.28 }, margin: { l: 80, b: 100 } });
      const w = p.rho >= .7 ? '순위가 거의 함께 움직입니다' : p.rho >= .4 ? '어느 정도 함께 움직이지만 예외도 많습니다' : '거의 따로 움직입니다';
      $('scRead').innerHTML = `<div class="read"><b>${NAME[a]} × ${NAME[b]}: ρ ${p.rho.toFixed(2)}</b>. ${w}(원료 ${p.n}종 비교). 색이 다른 점은 한쪽 순위가 다른 쪽보다 40%p 이상 높은 원료입니다(주황 ${up.length}종, 보라 ${dn.length}종).</div>`;
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
        const hi = tr[tr.length - 1], lo = tr[0], nm = r => (r.category.startsWith(r.name) ? r.category : `${r.category} ${r.name}`);
        $('trRead').innerHTML = `<div class="read">${L.josa(nm(hi), '의', '의')} ${L.josa(im.name, '이', '가')} 가장 큽니다. 가장 작은 ${L.josa(nm(lo), '과', '와')} 비교하면 <b>${L.times(hi.v[j] / lo.v[j])}</b> 차이입니다.</div>`;
      } else { L.purge('chTrans'), $('chTrans').innerHTML = `<div class="empty">${im.name}의 수송 단계 값이 ${tr.length}개뿐이라(최소 3개 필요) 그래프를 그리지 않았습니다.</div>`; $('trRead').innerHTML = ''; }
      const ws = D.filter(r => r.stage === '폐기물 처리' && r.unit === 'kg' && r.v[j] > 0), cats = [...new Set(ws.map(r => r.category))].filter(c => ws.filter(r => r.category === c).length >= 2);
      if (cats.length >= 2) {
        plot('chWaste', cats.map((c, i) => ({ type: 'box', name: `${c} (${ws.filter(r => r.category === c).length}개)`, y: ws.filter(r => r.category === c).map(r => r.v[j]), boxpoints: 'all', jitter: .4, pointpos: 0, text: ws.filter(r => r.category === c).map(r => r.name), marker: { color: L.COLORS[i], size: 6 }, hovertemplate: '%{text}<br>%{y:.3g}<extra></extra>' })), { yaxis: { type: 'log', title: `${im.sym} / kg` }, showlegend: false, margin: { b: 60 } });
        const med = c => S.median(ws.filter(r => r.category === c).map(r => r.v[j])), rk = cats.map(c => ({ c, m: med(c) })).sort((x, y) => y.m - x.m), top = rk[0], bot = rk[rk.length - 1];
        $('wsRead').innerHTML = `<div class="read">폐기 방식 중 <b>${esc(top.c)}</b>의 ${L.josa(im.name, '이', '가')} 가장 크고(중앙값 ${fmt(top.m)}), <b>${esc(L.josa(bot.c, '이', '가'))}</b> 가장 작습니다. 두 방식은 <b>${L.times(top.m / bot.m)}</b> 차이입니다.${cats.includes('재활용') ? '<br><small class="muted">재활용은 새 자원을 덜 쓰는 효과(회피 부하)가 계수에 반영됐는지 원자료에 나와 있지 않아, 해석에 주의가 필요합니다.</small>' : ''}</div>`;
      } else { L.purge('chWaste'), $('chWaste').innerHTML = `<div class="empty">${im.name}의 폐기 단계 값이 부족해 그래프를 그리지 않았습니다.</div>`; $('wsRead').innerHTML = ''; }
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
