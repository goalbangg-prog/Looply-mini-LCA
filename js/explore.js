/* 데이터 탐색 탭 */
(function () {
  const { $, esc, fmt, IMP, D, POOL, lbl, plot } = L;
  let scopes = [];
  function makeScopes() {
    const m = {};
    for (const r of D) { const k = r.stage + '|' + r.unit; (m[k] = m[k] || []).push(r); }
    scopes = Object.entries(m).filter(([, a]) => a.length >= 10).map(([k, a]) => {
      const [stage, unit] = k.split('|'), poolScope = stage === '원료 및 에너지 생산' && unit === 'kg';
      return { key: k, stage, unit, rows: poolScope ? POOL : a, note: poolScope ? ' · 수돗물·공업용수 제외' : '' };
    }).sort((a, b) => L.STAGES.indexOf(a.stage) - L.STAGES.indexOf(b.stage) || b.rows.length - a.rows.length);
  }
  const scope = () => scopes.find(s => s.key === $('exScope').value);

  function build() {
    makeScopes();
    $('explore').innerHTML = `<div class="panel"><h3>어떤 모습으로 볼까요?</h3>
      <div class="grid g3"><div><label for="exScope">범위 (대분류 · 기준 단위)</label><select id="exScope"></select></div>
      <div><label for="exImpact">영향 항목</label><select id="exImpact"></select></div>
      <div><label for="exMode">보는 방법</label><select id="exMode"><option value="rank">순위: 큰 것·작은 것</option><option value="hist">분포: 값이 어디에 몰려 있나</option><option value="box">구분별 비교</option><option value="scatter">두 영향 비교</option><option value="corr">영향끼리 관계표</option></select></div></div>
      <div id="exSecond" style="width:33%;margin-top:14px" class="hidden"><label for="exImpact2">비교할 두 번째 영향</label><select id="exImpact2"></select></div>
      <div id="exStatus" class="status"></div></div>
      <div class="panel"><div id="exTitle"></div><div id="exChart" class="chart h460"></div><div id="exRead"></div></div>`;
    L.opts($('exScope'), scopes, s => s.key, s => `${s.stage} · ${s.unit} (${s.rows.length}개)${s.note}`);
    $('exScope').onchange = () => { fillImpacts(); draw(); };
    for (const id of ['exImpact', 'exImpact2', 'exMode']) $(id).onchange = draw;
    fillImpacts(); draw();
  }
  function fillImpacts() {
    const s = scope(), cov = j => Math.round(L.coverage(s.rows, j) * 100);
    const keep = $('exImpact').value;
    for (const id of ['exImpact', 'exImpact2']) { L.opts($(id), IMP.map((_, j) => j), j => j, j => `${IMP[j].name} (값 있음 ${cov(j)}%)`); }
    $('exImpact').value = keep && +keep < IMP.length ? keep : '0'; $('exImpact2').value = '1';
  }

  function draw() {
    const s = scope(), mode = $('exMode').value, j = +$('exImpact').value, j2 = +$('exImpact2').value;
    $('exSecond').classList.toggle('hidden', mode !== 'scatter');
    const rows = L.col(s.rows, j), miss = s.rows.length - rows.length, im = IMP[j];
    $('exStatus').className = 'status' + (miss > s.rows.length * .15 ? ' warn' : '');
    $('exStatus').innerHTML = mode === 'corr' ? `${s.rows.length}개 항목 중 두 영향 모두 값이 있는 쌍만 비교해요.` : `${s.rows.length}개 항목 중 <b>${rows.length}개</b>에 ${im.name} 값이 있어요${miss ? ` (${miss}개는 자료 없음이라 뺐어요)` : ''}.`;
    $('exTitle').innerHTML = ''; $('exRead').innerHTML = ''; $('exChart').innerHTML = ''; try { Plotly.purge($('exChart')); } catch (e) { }
    if (mode !== 'corr' && rows.length < 5) { $('exChart').innerHTML = `<div class="empty">${im.name}은(는) 이 범위에서 값이 ${rows.length}개뿐이라 그림을 그리지 않았어요. 다른 영향이나 다른 범위를 골라 보세요.</div>`; return; }
    const T = (t, sub) => ($('exTitle').innerHTML = `<h3>${t}</h3>${sub ? `<p class="hint" style="margin:0 0 6px">${sub}</p>` : ''}`);
    const R = h => ($('exRead').innerHTML = `<div class="read">${h}</div>`);
    if (mode === 'rank') {
      const sorted = [...rows].sort((a, b) => b.v[j] - a.v[j]), nTop = Math.min(12, Math.floor(sorted.length / 2)), sh = [...sorted.slice(0, nTop), ...sorted.slice(-nTop)];
      T(`${im.name}: 큰 ${nTop}개와 작은 ${nTop}개`, `${im.sym} / ${s.unit}`);
      plot('exChart', [{ type: 'bar', orientation: 'h', y: sh.map(lbl), x: sh.map(r => r.v[j]), marker: { color: sh.map((_, i) => (i < nTop ? '#c4504a' : '#1f6f8b')) }, hovertemplate: '%{y}<br>%{x:.3g}<extra></extra>' }],
        { xaxis: { type: 'log', title: `${im.sym} / ${s.unit} (로그 눈금)` }, yaxis: { automargin: true, autorange: 'reversed' }, margin: { l: 230 } });
      const hi = sorted[0].v[j], lo = sorted[sorted.length - 1].v[j];
      R(`가장 큰 값(${esc(lbl(sorted[0]))})은 가장 작은 값(${esc(lbl(sorted[sorted.length - 1]))})의 <b>${L.times(hi / lo)}</b>예요. 위쪽 붉은 막대가 큰 쪽, 아래쪽 파란 막대가 작은 쪽이에요. 가로 눈금이 로그라서 막대 길이 차이보다 실제 차이는 훨씬 커요.`);
    } else if (mode === 'hist') {
      T(`${im.name} 계수의 분포`, '값이 10배 커질 때마다 같은 간격으로 나눈 구간(로그)');
      const lv = rows.map(r => Math.log10(r.v[j])), med = S.median(rows.map(r => r.v[j])), p10 = S.quantile(rows.map(r => r.v[j]), .1), p90 = S.quantile(rows.map(r => r.v[j]), .9);
      plot('exChart', [{ type: 'histogram', x: lv, nbinsx: 24, marker: { color: '#1f6f8b' }, hovertemplate: '10^%{x} 근처: %{y}개<extra></extra>' }],
        { xaxis: { title: `log₁₀(${im.sym} / ${s.unit})  (예: -2 = 0.01, 0 = 1, 1 = 10)` }, yaxis: { title: '항목 수' }, bargap: 0.05 });
      R(`중앙값은 <b>${fmt(med)}</b> ${im.sym}/${s.unit}이에요. 아래 10%는 ${fmt(p10)} 이하, 위 10%는 ${fmt(p90)} 이상으로, 양끝 사이가 <b>${L.times(p90 / p10)}</b> 벌어져 있어요. 막대가 높은 곳에 원료가 많이 몰려 있어요.`);
    } else if (mode === 'box') {
      const cats = [...new Set(rows.map(r => r.category))].filter(c => rows.filter(r => r.category === c).length >= 3);
      if (cats.length < 2) { $('exChart').innerHTML = '<div class="empty">비교할 구분이 2개 미만이에요(구분마다 항목이 3개 이상 필요해요).</div>'; return; }
      T(`${im.name}: 구분별 비교`, `항목이 3개 이상인 구분만 보여요 · ${im.sym} / ${s.unit}`);
      plot('exChart', cats.map((c, i) => ({ type: 'box', name: `${c} (${rows.filter(r => r.category === c).length})`, y: rows.filter(r => r.category === c).map(r => r.v[j]), boxpoints: 'all', jitter: .4, pointpos: 0, marker: { color: L.COLORS[i % 6], size: 5 }, text: rows.filter(r => r.category === c).map(lbl), hovertemplate: '%{text}<br>%{y:.3g}<extra></extra>' })),
        { yaxis: { type: 'log', title: `${im.sym} / ${s.unit} (로그 눈금)` }, showlegend: false, xaxis: { tickangle: -20 }, margin: { b: 100 } });
      const meds = cats.map(c => ({ c, m: S.median(rows.filter(r => r.category === c).map(r => r.v[j])) })).sort((a, b) => b.m - a.m);
      R(`중앙값이 가장 큰 구분은 <b>${esc(meds[0].c)}</b>, 가장 작은 구분은 <b>${esc(meds[meds.length - 1].c)}</b>예요. 그런데 상자(가운데 50%)가 서로 많이 겹치고 점이 넓게 퍼져 있다면, <b>구분 이름만으로는 값을 짐작하기 어렵다</b>는 뜻이에요.`);
    } else if (mode === 'scatter') {
      const im2 = IMP[j2], pr = s.rows.filter(r => r.v[j] > 0 && r.v[j2] > 0);
      if (j === j2) { $('exChart').innerHTML = '<div class="empty">서로 다른 두 영향을 골라 주세요.</div>'; return; }
      if (pr.length < 5) { $('exChart').innerHTML = `<div class="empty">두 영향 모두 값이 있는 항목이 ${pr.length}개뿐이라 그리지 않았어요.</div>`; return; }
      const rho = S.spearman(pr.map(r => r.v[j]), pr.map(r => r.v[j2]));
      T(`${im.name} × ${im2.name}`, `두 값이 모두 있는 ${pr.length}개 · 둘 다 로그 눈금`);
      plot('exChart', [{ type: 'scatter', mode: 'markers', x: pr.map(r => r.v[j]), y: pr.map(r => r.v[j2]), text: pr.map(lbl), marker: { size: 8, color: '#1f6f8b', opacity: .75 }, hovertemplate: '%{text}<br>x %{x:.3g}<br>y %{y:.3g}<extra></extra>' }],
        { xaxis: { type: 'log', title: `${im.name} (${im.sym}/${s.unit})` }, yaxis: { type: 'log', title: `${im2.name} (${im2.sym}/${s.unit})` } });
      const w = Math.abs(rho) >= .7 ? '꽤 같이 움직이는 편' : Math.abs(rho) >= .4 ? '어느 정도 같이 움직이는 편' : '거의 따로 움직이는 편';
      R(`순위 상관은 <b>${rho.toFixed(2)}</b>로, 두 영향이 ${w}이에요(1에 가까울수록 같이 움직여요). 점이 오른쪽 위로 모여 있으면 한쪽이 클 때 다른 쪽도 큰 편이에요. 같이 움직여도 <b>한쪽이 다른 쪽의 원인은 아니에요.</b>`);
    } else {
      const ks = IMP.map((_, k) => k).filter(k => L.has(s.rows, k).length >= 10);
      if (ks.length < 2) { $('exChart').innerHTML = '<div class="empty">값이 10개 이상 있는 영향이 2개 미만이라 관계표를 만들 수 없어요. (이 범위는 탄소발자국만 있는 경우가 많아요.)</div>'; return; }
      const cell = (a, b) => { const p = s.rows.filter(r => r.v[a] != null && r.v[b] != null); return { rho: a === b ? 1 : (p.length >= 8 ? S.spearman(p.map(r => r.v[a]), p.map(r => r.v[b])) : null), n: p.length }; };
      const M = ks.map(a => ks.map(b => cell(a, b)));
      T('영향끼리 같이 움직이는 정도 (순위 상관)', '각 칸에서 두 값이 모두 있는 항목만 비교 · 비교한 개수가 8개 미만이면 비워 둠');
      plot('exChart', [{ type: 'heatmap', x: ks.map(k => IMP[k].name), y: ks.map(k => IMP[k].name), z: M.map(r => r.map(c => c.rho)), text: M.map(r => r.map(c => (c.rho == null ? '' : c.rho.toFixed(2)))), texttemplate: '%{text}', customdata: M.map(r => r.map(c => c.n)), zmin: -1, zmax: 1, colorscale: [[0, '#c4504a'], [.5, '#fff'], [1, '#1f6f8b']], showscale: false, hovertemplate: '%{y} × %{x}<br>상관 %{z:.2f} · 비교한 항목 %{customdata}개<extra></extra>' }],
        { margin: { l: 120, b: 100 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -25 } });
      R('1에 가까운 칸은 두 영향이 같이 움직이고, 0에 가까운 칸은 서로 거의 관계가 없어요. 마우스를 올리면 몇 개를 비교한 값인지 볼 수 있어요.');
    }
  }
  L.tabs.explore = { build, built: false };
})();
