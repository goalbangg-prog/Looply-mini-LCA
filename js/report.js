/* 분석 리포트 탭: 숫자는 전부 데이터에서 바로 계산하거나 analysis_results.json(Python 결과)에서 가져온다 */
(function () {
  const { $, esc, fmt, IMP, POOL, D, RES, lbl, plot } = L;
  const J = k => IMP.findIndex(i => i.k === k);
  const pair = (a, b) => { const rows = POOL.filter(r => r.v[J(a)] != null && r.v[J(b)] != null); return { rho: S.spearman(rows.map(r => r.v[J(a)]), rows.map(r => r.v[J(b)])), n: rows.length }; };
  const topLabel = p => (p >= 50 ? `상위 ${Math.max(1, Math.round(100 - p))}%` : `하위 ${Math.max(1, Math.round(p))}%`);

  // 탄소 순위보다 다른 영향 순위가 40점 이상 높은 원료 (Python 분석과 같은 방식)
  function hidden() {
    const names = ['자원', '산성', '부영', '스모그', '물'], pct = {};
    for (const k of ['탄소', ...names]) {
      const j = J(k), rows = POOL.filter(r => r.v[j] != null), rk = S.rank(rows.map(r => r.v[j]));
      rows.forEach((r, i) => { (pct[r.id] = pct[r.id] || {})[k] = rk[i] / rows.length * 100; });
    }
    const out = [];
    for (const r of POOL) {
      const p = pct[r.id]; let best = null;
      for (const k of names) if (p[k] != null && (!best || p[k] - p['탄소'] > best.diff)) best = { k, diff: p[k] - p['탄소'] };
      if (best && best.diff >= 40) out.push({ r, k: best.k, c: p['탄소'], o: p[best.k], diff: best.diff });
    }
    return out.sort((a, b) => b.diff - a.diff);
  }

  function build() {
    const cw = pair('탄소', '물'), ca = pair('탄소', '자원'), cs = pair('탄소', '산성');
    const hid = hidden();
    const ozoneAll = D.filter(r => r.v[6] != null).length, onlyCarbon = D.filter(r => r.v.filter(v => v != null).length === 1).length;
    const ozPool = Math.round(L.coverage(POOL, 6) * 100);
    const kScores = RES.k_scores, K = RES.chosen_k, sens = RES.sensitivity;
    const mem = RES.cluster_members, ov = RES.cluster_overall_median;
    const nameOf = { 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성화', 부영: '부영양화', 스모그: '광화학스모그', 물: '물소모' };
    const rows6 = ['탄소', '자원', '산성', '부영', '물', '스모그'];

    $('report').innerHTML = `
    <section class="hero">
      <span class="eyebrow" style="color:#7fe3c4">LOOPLY · LCA 데이터 분석 리포트</span>
      <h1>환경영향계수 ${D.length}개를 처음부터 다시 들여다봤어요</h1>
      <p class="lead">한국환경산업기술원 환경성적표지 평가계수(2021)를 정리하고, 7가지 환경영향 중 값이 비어 있는 곳까지 숫자로 확인한 뒤 분석했어요. 아래 세 가지가 가장 먼저 말하고 싶은 내용이에요.</p>
      <div class="finds">
        <div class="find"><b>${cw.rho.toFixed(1)}</b><h3>탄소가 낮아도 물소모는 따로예요</h3><p>탄소와 자원·산성화는 함께 오르내리는 편(${ca.rho.toFixed(1)}~${cs.rho.toFixed(1)})이지만, 물소모와의 관계는 약해요. 1에 가까울수록 같이 움직이는 정도예요.</p></div>
        <div class="find"><b>${hid.length}개</b><h3>탄소만 보면 놓치는 원료가 있어요</h3><p>원료 ${POOL.length}개 중 ${hid.length}개는 탄소 순위보다 다른 영향 순위가 훨씬 높아요. 예: ${hid.slice(0, 3).map(h => esc(h.r.name)).join(', ')}.</p></div>
        <div class="find"><b>${onlyCarbon}개</b><h3>탄소발자국만 있는 항목이 많아요</h3><p>연료 사용·화학반응 단계 등 ${onlyCarbon}개는 탄소 외에는 값이 없어요. 오존층영향은 전체 ${D.length}개 중 ${ozoneAll}개만 값이 있어요.</p></div>
      </div>
    </section>

    <section class="sec"><span class="eyebrow">01 · 자료 범위</span><h2>어디에 값이 있고, 어디가 비어 있을까요?</h2>
      <p class="lead">분석에 들어가기 전에 먼저 확인했어요. 칸의 숫자는 그 단계의 항목 중 값이 들어 있는 비율(%)이에요. 값이 없는 것(자료 없음)은 0이 아니라 "모른다"로 다뤘어요.</p>
      <div class="card"><div id="chCover" class="chart h340"></div></div>
      <div class="grid g3" style="margin-top:18px">
        <div class="card"><h3>탄소만 있는 단계</h3><p class="muted" style="margin:0">연료원별 사용(${RES.coverage_by_stage['연료원별 사용']['항목수']}개)과 화학반응공정(${RES.coverage_by_stage['화학반응공정']['항목수']}개)은 탄소발자국 말고는 값이 없어요. 이 단계는 탄소만 계산할 수 있고 다른 영향과의 비교는 못 해요.</p></div>
        <div class="card"><h3>오존층영향은 분석에서 뺐어요</h3><p class="muted" style="margin:0">원료 항목에서 ${ozPool}%만 값이 있어요(전체 ${D.length}개 중 ${ozoneAll}개). 이렇게 비면 숫자를 비교해도 믿을 수 없어서, 계산기에서는 값이 있는 항목만 보여 주고, 분석에는 쓰지 않았어요.</p></div>
        <div class="card"><h3>분석에 쓴 범위</h3><p class="muted" style="margin:0">'원료 및 에너지 생산' 단계의 kg 단위 ${RES.base_n}개 중 수돗물·공업용수 2개(재료가 아니라 물 자체라 값이 1000배 이상 작아요)를 뺀 ${POOL.length}개예요. 단위가 다르면 한 줄로 비교할 수 없어서 나눴어요.</p></div>
      </div>
    </section>

    <section class="sec"><span class="eyebrow">02 · 영향끼리의 관계</span><h2>탄소만 보면 놓치는 것</h2>
      <p class="lead">온실가스(탄소)는 가장 많이 알려진 지표지만, 원료가 환경에 주는 부담의 전부는 아니에요. 원료 ${POOL.length}개로 영향끼리 얼마나 같이 움직이는지 확인했어요.</p>
      <div class="grid g-wide">
        <div class="card"><h3>탄소발자국 × 물소모 (1kg당, 로그 눈금)</h3><div id="chScatter" class="chart h400"></div><div class="read">주황색은 <b>탄소 순위보다 다른 영향 순위가 40점 이상 높은</b> 원료예요(${hid.length}개). 점 위에 마우스를 올리면 이름이 나와요.</div></div>
        <div class="card"><h3>영향끼리 같이 움직이는 정도</h3><div id="chCorr" class="chart h400"></div><div class="read">숫자가 1에 가까우면 한쪽이 클 때 다른 쪽도 큰 편이에요. <b>물소모</b>는 다른 영향과 약하게만 이어져 있어요.</div></div>
      </div>
      <div class="card" style="margin-top:22px"><h3>탄소 순위와 다른 영향 순위가 크게 다른 원료 (위 10개)</h3>
        <table class="tbl"><thead><tr><th>원료</th><th>구분</th><th>탄소 순위</th><th>더 높은 영향</th><th>그 영향 순위</th></tr></thead><tbody>${hid.slice(0, 10).map(h => `<tr><td>${esc(h.r.name)}</td><td>${esc(h.r.category)}</td><td>${topLabel(h.c)}</td><td>${nameOf[h.k]}</td><td><b>${topLabel(h.o)}</b></td></tr>`).join('')}</tbody></table>
        <div class="caution">순위는 같은 단위(1kg)당 계수를 ${POOL.length}개 원료끼리 비교한 값이에요. 용도가 다른 원료의 우열을 가리는 점수가 아니에요(예: 골판지 1kg과 시멘트 1kg은 쓰임새가 달라요).</div></div>
    </section>

    <section class="sec"><span class="eyebrow">03 · 비슷한 것끼리 묶기</span><h2>영향이 비슷한 원료를 ${K}무리로 나눠 봤어요</h2>
      <p class="lead">${RES.features.map(f => f.replace('산성비', '산성화')).join('·')} ${RES.features.length}가지 영향을 함께 보고, 수치가 비슷한 원료끼리 묶었어요(군집 분석, KMeans). 값이 5가지 모두 있는 ${RES.cluster_n}개가 대상이에요.</p>
      <div class="grid g3" id="cluCards"></div>
      <div class="grid g2" style="margin-top:22px">
        <div class="card"><h3>무리마다 얼마나 다른가 (전체 중앙값의 몇 배?)</h3><div id="chClu" class="chart h340"></div></div>
        <div class="card"><h3>재료 구분(건축자재·금속 등)과 무리는 같지 않아요</h3><div id="chComp" class="chart h340"></div></div>
      </div>
      <div class="card" style="margin-top:22px"><h3>이 묶음, 얼마나 믿을 수 있을까요?</h3>
        <table class="tbl"><thead><tr><th>묶는 수</th><th class="num">경계 뚜렷함(실루엣)</th><th class="num">여러 번 돌려도 같은 결과(1이 최대)</th><th>무리 크기</th></tr></thead><tbody>${kScores.map(s => `<tr${s.k === K ? ' style="background:#e3f3ee;font-weight:700"' : ''}><td>${s.k}개${s.k === K ? ' ← 선택' : ''}</td><td class="num">${s.실루엣.toFixed(3)}</td><td class="num">${s.안정성.toFixed(2)}</td><td>${s.크기.join(' / ')}</td></tr>`).join('')}</tbody></table>
        <div class="read"><b>고르는 기준을 미리 정했어요.</b> ① 여러 번 돌려도 거의 같은 결과(0.95 이상) ② 가장 작은 무리가 전체의 10% 이상 ③ 둘을 통과한 것 중 무리끼리 가장 잘 구분되는 개수(Davies-Bouldin 점수가 낮을수록 잘 구분돼요). 통과한 것은 ${RES.k_candidates.join('개, ')}개이고, 그중 ${K}개를 골랐어요. 2개와 3개의 점수 차이(${kScores[0].실루엣.toFixed(3)} vs ${kScores[1].실루엣.toFixed(3)})는 사실상 같아서, ${K}단계가 읽기 더 쉬운 점도 반영했어요.</div>
        <div class="caution"><b>경계가 뚜렷하지는 않아요.</b> 실루엣 점수가 0.33 정도라 "무리 사이 경계가 흐릿한 편"이에요(0.5를 넘어야 뚜렷하다고 봐요). 게다가 묶는 영향을 바꾸면 결과가 달라져요. 핵심 3가지(탄소·자원·산성)만 쓰면 같은 항목끼리 같은 무리가 되는 정도가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}, 스모그를 더하면 ${sens['6개(+스모그)'].ARI.toFixed(2)}로 낮아져요(1이면 완전히 같음). 그래서 이 결과는 <b>"어떤 원료끼리 비슷해 보이는지 살펴보는 참고용"</b>이에요.</div>
      </div>
    </section>

    <section class="sec"><span class="eyebrow">04 · 해석의 경계</span><h2>이 데이터로 말할 수 있는 것, 없는 것</h2>
      <div class="yesno" style="margin-top:14px">
        <div class="card yes"><h3>말할 수 있어요</h3><ul>
          <li>같은 단위(1kg)당 원료끼리 영향의 <b>크기 순서</b>를 대략 비교할 수 있어요.</li>
          <li>탄소와 다른 영향이 <b>같이 움직이는 정도</b>를 볼 수 있어요.</li>
          <li>어떤 영향은 <b>자료가 없어서</b> 비교가 어렵다는 점을 알 수 있어요.</li>
          <li>선택한 원료와 사용량으로 <b>일부 영향의 합계</b>를 대략 계산할 수 있어요.</li></ul></div>
        <div class="card no"><h3>말할 수 없어요</h3><ul>
          <li>제품이나 서비스 <b>전체</b>의 환경영향(전과정평가). 이 값은 원료 한 단계의 계수일 뿐이에요.</li>
          <li>용도가 다른 원료 중 <b>무엇이 더 친환경인지</b>(시멘트 1kg과 구리 1kg은 쓰임새가 달라요).</li>
          <li>계수가 만들어진 <b>이유</b>(왜 높은지는 이 표만으로는 알 수 없어요).</li>
          <li>최신 값. 이 자료는 <b>2021년 기준</b>이라 지금과 다를 수 있어요.</li></ul></div>
      </div>
    </section>

    <section class="sec"><span class="eyebrow">05 · 방법과 출처</span><h2>어떻게 분석했는지 숨기지 않을게요</h2>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h3>자료와 정리 과정</h3><ol style="margin:0;padding-left:20px">
          <li>출처: 한국환경산업기술원 환경성적표지 평가계수(2021-08-02) ${D.length}개 항목. 원자료 이용 조건은 따로 확인이 필요해요.</li>
          <li>"해당없음"은 0이 아니라 <b>빈 값</b>으로 두었어요.</li>
          <li>이름이 겹치지 않는지, 같은 항목이 두 번 들어가지 않았는지 확인했어요(중복 0).</li>
          <li>단위가 다른 항목은 섞지 않고 나눠서 봤어요.</li>
          <li>값 차이가 수만 배라서 <b>로그</b>를 씌운 뒤 크기를 맞춰(표준화) 묶었어요.</li></ol></div>
        <div class="card"><h3>용어 풀이</h3><dl class="gloss" style="margin:0">
          <dt>순위 상관(스피어만)</dt><dd>두 값의 순위가 함께 오르내리는 정도. -1~1, 1에 가까울수록 같이 움직여요.</dd>
          <dt>군집 분석(KMeans)</dt><dd>수치가 비슷한 것끼리 정해진 수의 무리로 나누는 방법이에요.</dd>
          <dt>실루엣 점수</dt><dd>각 항목이 자기 무리에 얼마나 잘 맞는지. 0.5 이상이면 경계가 뚜렷한 편이에요.</dd>
          <dt>로그 눈금</dt><dd>10배 커질 때마다 같은 간격으로 보여 줘서 아주 작은 값과 큰 값을 한 그림에 담아요.</dd></dl></div>
      </div>
      <details><summary>코드와 검증 자료 보기</summary><div class="body">
        <p>분석은 Python(pandas, NumPy, scikit-learn, SciPy)으로 처음부터 다시 했고, 이 웹페이지의 계산과 비교했어요.</p>
        <ul><li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/analysis/reanalysis.py">analysis/reanalysis.py</a> · 재분석 전체 코드</li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/notebooks/kmeans_silhouette_sklearn.ipynb">notebooks/kmeans_silhouette_sklearn.ipynb</a> · 군집·실루엣 노트북</li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/docs/TEST_REPORT.md">docs/TEST_REPORT.md</a> · 확인한 것과 확인하지 못한 것</li></ul></div></details>
    </section>`;

    // ---------- 차트 ----------
    // 1) 자료 범위
    const stages = L.STAGES.filter(s => RES.coverage_by_stage[s]);
    plot('chCover', [{
      type: 'heatmap', x: IMP.map(i => i.name), y: stages.map(s => `${s} (${RES.coverage_by_stage[s]['항목수']}개)`),
      z: stages.map(s => IMP.map(i => RES.coverage_by_stage[s][({ 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성비', 부영: '부영양화', 물: '물소모', 스모그: '광화학스모그', 오존: '오존층영향' })[i.k]])),
      text: stages.map(s => IMP.map(i => Math.round(RES.coverage_by_stage[s][({ 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성비', 부영: '부영양화', 물: '물소모', 스모그: '광화학스모그', 오존: '오존층영향' })[i.k]]) + '%')),
      texttemplate: '%{text}', zmin: 0, zmax: 100, colorscale: [[0, '#fbe3d6'], [0.5, '#e4f1ec'], [1, '#2a8f78']], showscale: false,
      hovertemplate: '%{y}<br>%{x}: 값이 있는 비율 %{z:.0f}%<extra></extra>'
    }], { margin: { l: 190, r: 10, t: 10, b: 50 }, xaxis: { side: 'bottom' }, yaxis: { autorange: 'reversed' } });

    // 2) 산점도
    const jc = J('탄소'), jw = J('물'), hidIds = new Set(hid.map(h => h.r.id));
    const pts = POOL.filter(r => r.v[jc] > 0 && r.v[jw] > 0), hl = pts.filter(r => hidIds.has(r.id)), nl = pts.filter(r => !hidIds.has(r.id));
    const tr = (arr, name, color) => ({ type: 'scatter', mode: 'markers', name, x: arr.map(r => r.v[jc]), y: arr.map(r => r.v[jw]), text: arr.map(r => `${r.name} (${r.category})`), marker: { size: 8, color, opacity: .8 }, hovertemplate: '%{text}<br>탄소 %{x:.3g} kg CO₂ eq<br>물소모 %{y:.3g} m³<extra></extra>' });
    plot('chScatter', [tr(nl, '그 밖의 원료', '#1f6f8b'), tr(hl, '탄소 순위보다 다른 영향이 훨씬 높음', '#e08a3c')],
      { xaxis: { type: 'log', title: '탄소발자국 (kg CO₂ eq / kg)' }, yaxis: { type: 'log', title: '물소모 (m³ / kg)' }, legend: { orientation: 'h', y: -0.25 }, margin: { l: 80, b: 90 } });

    // 3) 상관 히트맵
    const mat = rows6.map(a => rows6.map(b => (a === b ? 1 : pair(a, b).rho)));
    const nn = rows6.map(a => rows6.map(b => (a === b ? POOL.filter(r => r.v[J(a)] != null).length : pair(a, b).n)));
    plot('chCorr', [{
      type: 'heatmap', x: rows6.map(k => nameOf[k]), y: rows6.map(k => nameOf[k]), z: mat, zmin: -1, zmax: 1, colorscale: [[0, '#c4504a'], [0.5, '#ffffff'], [1, '#1f6f8b']], showscale: false,
      text: mat.map(r => r.map(v => v.toFixed(2))), texttemplate: '%{text}', customdata: nn, hovertemplate: '%{y} × %{x}<br>상관 %{z:.2f} (비교한 원료 %{customdata}개)<extra></extra>'
    }], { margin: { l: 95, b: 90, t: 10 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -30 } });

    // 4) 군집 카드/차트 (Python 결과 사용)
    const prof = RES.cluster_profile, order = ['작은 무리', '중간 무리', '큰 무리'];
    const featKeys = rows6.filter(k => k !== '스모그' || true);
    const nameKey = { 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성비', 부영: '부영양화', 스모그: '광화학스모그', 물: '물소모' };
    const ratios = prof.map(p => rows6.map(k => (p[nameKey[k]].중앙값 / ov[nameKey[k]])));
    $('cluCards').innerHTML = prof.map((p, i) => {
      const r = ratios[i];
      const members = Object.entries(mem).filter(([, c]) => c === p.군집).map(([id]) => D[+id]);
      const med = S.median(members.map(m => m.v[0]));
      const ex = members.sort((a, b) => Math.abs(a.v[0] - med) - Math.abs(b.v[0] - med)).slice(0, 5).map(m => esc(m.name));
      const { title, line } = L.clusterTitle(r, rows6.map(k => nameOf[k]));
      return `<div class="clu"><span class="tag">${p.군집}번 · ${p.항목수}개</span><h4>${title}</h4><p style="margin:6px 0">${line}</p><small>대표 원료: ${ex.join(', ')}</small></div>`;
    }).join('');
    plot('chClu', [{
      type: 'heatmap', x: rows6.map(k => nameOf[k]), y: prof.map(p => `${p.군집}번 무리 (${p.항목수}개)`), z: ratios.map(r => r.map(Math.log10)), zmin: -1.5, zmax: 1.5,
      colorscale: [[0, '#2b6c8f'], [0.5, '#ffffff'], [1, '#c4504a']], showscale: false, text: ratios.map(r => r.map(v => (v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)) + '배')), texttemplate: '%{text}',
      hovertemplate: '%{y}<br>%{x}: 전체 중앙값의 %{text}<extra></extra>'
    }], { margin: { l: 130, b: 60, t: 10 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -20 } });
    const cats = [...new Set(Object.values(RES.category_by_cluster).flatMap(o => Object.keys(o)))];
    plot('chComp', Object.keys(RES.category_by_cluster).sort().map((c, i) => ({
      type: 'bar', name: `${c}번 무리`, x: cats, y: cats.map(k => RES.category_by_cluster[c][k] || 0), marker: { color: L.COLORS[i] }, hovertemplate: '%{x}: %{y}개<extra>' + c + '번 무리</extra>'
    })), { barmode: 'stack', yaxis: { title: '원료 수' }, xaxis: { tickangle: -25 }, legend: { orientation: 'h', y: -0.35 }, margin: { b: 110 } });
  }
  L.tabs.report = { build, built: false };
})();
