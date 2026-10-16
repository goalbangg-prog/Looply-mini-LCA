/* 데이터 분석 탭 */
(function () {
  const { $, esc, fmt, IMP, D, POOL, lbl, plot } = L;
  let scopes = [];
  function makeScopes() {
    const m = {};
    for (const r of D) { const k = r.stage + '|' + r.unit; (m[k] = m[k] || []).push(r); }
    scopes = Object.entries(m).filter(([, a]) => a.length >= 10).map(([k, a]) => {
      const [stage, unit] = k.split('|'), p = stage === '원료 및 에너지 생산' && unit === 'kg';
      return { key: k, stage, unit, rows: p ? POOL : a, note: p ? ' · 수자원 제외' : '' };
    }).sort((a, b) => L.STAGES.indexOf(a.stage) - L.STAGES.indexOf(b.stage) || b.rows.length - a.rows.length);
  }
  const scope = () => scopes.find(s => s.key === $('exScope').value);
  const catOn = () => new Set([...document.querySelectorAll('[data-excat]')].filter(x => x.checked).map(x => x.value));
  const filtered = s => { const on = catOn(); return on.size ? s.rows.filter(r => on.has(r.category)) : s.rows; };

  function build() {
    makeScopes();
    $('explore').innerHTML = `<div class="panel"><span class="eyebrow">Data Analysis</span><h3>분석 조건</h3>
      <div class="grid g3"><div><label for="exScope">분석 범위 (대분류 · 기준 단위)</label><select id="exScope"></select></div>
      <div><label for="exImpact">영향범주</label><select id="exImpact"></select></div>
      <div><label for="exMode">분석 방법</label><select id="exMode"><option value="rank">순위 (상·하위 항목 비교)</option><option value="hist">분포 (히스토그램: 값이 몰린 구간)</option><option value="box">구분별 분포 (박스플롯: 상자그림)</option><option value="scatter">산점도 (두 영향범주의 관계)</option><option value="corr">상관행렬 (Spearman 순위상관)</option><option value="radar">프로파일 비교 (레이더 차트)</option></select></div></div>
      <div id="exSecond" style="width:33%;margin-top:14px" class="hidden"><label for="exImpact2">Y축 영향범주</label><select id="exImpact2"></select></div>
      <div id="exCatWrap" style="margin-top:16px"><label>구분 필터 <span class="muted" style="font-weight:500">(체크 해제한 구분은 분석에서 제외)</span></label><div class="chk" id="exCats"></div></div>
      <div id="exRadarWrap" class="hidden" style="margin-top:16px"><label>비교할 항목 (최대 4개 · 목록에서 고르면 바로 바뀝니다)</label><div class="grid g4" id="exRadarIn"></div></div>
      <div id="exStatus" class="status"></div></div>
      <div class="panel"><div id="exTitle"></div><div id="exChart" class="chart h460"></div><div id="exRead"></div><div id="exExtra"></div></div>`;
    L.opts($('exScope'), scopes, s => s.key, s => `${s.stage} · ${s.unit} (n=${s.rows.length})${s.note}`);
    $('exRadarIn').innerHTML = [0, 1, 2, 3].map(i => `<select data-rad="${i}" aria-label="비교 항목 ${i + 1}"></select>`).join('');
    $('exScope').onchange = () => { fillScope(); draw(); };
    for (const id of ['exImpact', 'exImpact2', 'exMode']) $(id).onchange = draw;
    document.querySelectorAll('[data-rad]').forEach(i => i.addEventListener('change', draw));
    fillScope(); draw();
  }
  function fillScope() {
    const s = scope(), cov = j => Math.round(L.coverage(s.rows, j) * 100), keep = $('exImpact').value;
    for (const id of ['exImpact', 'exImpact2']) L.opts($(id), IMP.map((_, j) => j), j => j, j => `${IMP[j].name} (값 있는 비율 ${cov(j)}%)`);
    $('exImpact').value = keep && +keep < IMP.length ? keep : '0'; $('exImpact2').value = '1';
    const cats = [...new Set(s.rows.map(r => r.category))];
    $('exCats').innerHTML = cats.map(c => `<label><input type="checkbox" data-excat value="${esc(c)}" checked>${esc(c)} <span class="muted" style="font-weight:500">${s.rows.filter(r => r.category === c).length}</span></label>`).join('');
    document.querySelectorAll('[data-excat]').forEach(x => (x.onchange = draw));
    // 비교 항목 선택: 구분별로 묶은 드롭다운(한 번 고른 뒤에도 전체 목록에서 다시 고를 수 있음)
    const groups = cats.map(c => `<optgroup label="${esc(c)}">${s.rows.filter(r => r.category === c).map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</optgroup>`).join('');
    document.querySelectorAll('[data-rad]').forEach((el, i) => { el.innerHTML = `<option value="">${i === 0 ? '항목 선택' : '항목 ' + (i + 1) + ' (선택)'}</option>` + groups; el.value = ''; });
  }
  const times = L.times;

  function draw() {
    const s = scope(), mode = $('exMode').value, j = +$('exImpact').value, j2 = +$('exImpact2').value, all = filtered(s);
    $('exSecond').classList.toggle('hidden', mode !== 'scatter'); $('exCatWrap').classList.toggle('hidden', mode === 'radar'); $('exRadarWrap').classList.toggle('hidden', mode !== 'radar');
    $('exImpact').disabled = mode === 'corr' || mode === 'radar';
    const rows = L.col(all, j), miss = all.length - rows.length, im = IMP[j];
    $('exStatus').className = 'status' + (miss > all.length * .15 && mode !== 'corr' && mode !== 'radar' ? ' warn' : '');
    $('exStatus').innerHTML = mode === 'corr' ? `분석 대상 ${all.length}건 · 두 영향범주 값이 모두 있는 항목 쌍만 사용합니다(pairwise deletion)` : mode === 'radar' ? `백분위 기준: ${s.stage} · ${s.unit} 항목 ${s.rows.length}건 (영향범주별로 값이 있는 항목끼리 비교)` : `분석 대상 ${all.length}건 중 <b>${rows.length}건</b>에 ${im.name} 값이 있습니다${miss ? ` (나머지 ${miss}건은 결측치로 인해 제외)` : ''}`;
    $('exTitle').innerHTML = ''; $('exRead').innerHTML = ''; $('exExtra').innerHTML = ''; L.purge('exChart'), $('exChart').innerHTML = ''; try { Plotly.purge($('exChart')); } catch (e) { }
    if (!['corr', 'radar'].includes(mode) && rows.length < 5) { L.purge('exChart'), $('exChart').innerHTML = `<div class="empty">${im.name}은(는) 현재 조건에서는 값이 있는 항목이 ${rows.length}건뿐이라(최소 5건 필요) 그래프를 그리지 않습니다. 다른 영향범주나 범위, 구분을 선택해 보세요.</div>`; return; }
    const T = (t, sub) => ($('exTitle').innerHTML = `<h3>${t}</h3>${sub ? `<p class="hint" style="margin:0 0 6px">${sub}</p>` : ''}`);
    const R = h => ($('exRead').innerHTML = `<div class="read">${h}</div>`);
    if (mode === 'rank') {
      const sorted = [...rows].sort((a, b) => b.v[j] - a.v[j]), n = Math.min(12, Math.floor(sorted.length / 2)), sh = [...sorted.slice(0, n), ...sorted.slice(-n)];
      T(`${im.name}: 상위 ${n}개 · 하위 ${n}개`, `${im.sym} / ${s.unit}`);
      plot('exChart', [{ type: 'bar', orientation: 'h', y: sh.map(lbl), x: sh.map(r => r.v[j]), marker: { color: sh.map((_, i) => (i < n ? '#c4504a' : '#2367d1')) }, hovertemplate: '%{y}<br>%{x:.3g}<extra></extra>' }],
        { xaxis: { type: 'log', title: `${im.sym} / ${s.unit} (로그 눈금)` }, yaxis: { automargin: true, autorange: 'reversed' }, margin: { l: 230 } });
      R(`최댓값(${esc(lbl(sorted[0]))})은 최솟값(${esc(lbl(sorted[sorted.length - 1]))})의 <b>${times(sorted[0].v[j] / sorted[sorted.length - 1].v[j])}</b>입니다. 가로축이 로그 눈금(10배씩 커지는 눈금)이라 막대 길이 차이보다 실제 격차가 훨씬 큽니다.`);
    } else if (mode === 'hist') {
      const vals = rows.map(r => r.v[j]), med = S.median(vals), p10 = S.quantile(vals, .1), p90 = S.quantile(vals, .9);
      T(`${im.name} 계수 분포`, '히스토그램: 계수를 10배 단위(log₁₀)로 나눈 구간에 항목이 몇 개씩 있는지 보여 줍니다');
      plot('exChart', [{ type: 'histogram', x: vals.map(Math.log10), nbinsx: 24, marker: { color: '#2367d1' }, hovertemplate: '10^%{x} 부근: %{y}건<extra></extra>' }],
        { xaxis: { title: `log₁₀(${im.sym} / ${s.unit})` }, yaxis: { title: '항목 수' }, bargap: 0.05 });
      R(`중앙값 <b>${fmt(med)}</b> ${im.sym}/${s.unit}, P10 ${fmt(p10)} ~ P90 ${fmt(p90)} (<b>${times(p90 / p10)}</b> 범위)입니다. 중앙값은 순서상 한가운데 값, P10·P90은 하위·상위 10% 경계입니다. 값의 폭이 매우 넓어 평균보다 중앙값과 분위수로 요약하는 편이 정확합니다.`);
    } else if (mode === 'box') {
      const cats = [...new Set(rows.map(r => r.category))].filter(c => rows.filter(r => r.category === c).length >= 3);
      if (cats.length < 2) { L.purge('exChart'), $('exChart').innerHTML = '<div class="empty">비교할 수 있는 구분이 2개 미만입니다(구분마다 값이 3건 이상 필요).</div>'; return; }
      T(`${im.name}: 구분별 분포`, `박스플롯(상자그림): 상자는 가운데 50% 범위, 상자 속 선은 중앙값 · 값이 3건 이상인 구분만 표시 · ${im.sym} / ${s.unit} · 로그 눈금`);
      plot('exChart', cats.map((c, i) => ({ type: 'box', name: `${c} (${rows.filter(r => r.category === c).length})`, y: rows.filter(r => r.category === c).map(r => r.v[j]), boxpoints: 'all', jitter: .4, pointpos: 0, marker: { color: L.COLORS[i % 6], size: 5 }, text: rows.filter(r => r.category === c).map(lbl), hovertemplate: '%{text}<br>%{y:.3g}<extra></extra>' })),
        { yaxis: { type: 'log', title: `${im.sym} / ${s.unit}` }, showlegend: false, xaxis: { tickangle: -20 }, margin: { b: 100 } });
      const meds = cats.map(c => ({ c, m: S.median(rows.filter(r => r.category === c).map(r => r.v[j])) })).sort((a, b) => b.m - a.m);
      R(`구분별 중앙값 최고: <b>${esc(meds[0].c)}</b>, 최저: <b>${esc(meds[meds.length - 1].c)}</b>. 상자(가운데 50% 범위)가 서로 크게 겹치면 구분만으로는 계수 수준을 짐작하기 어렵다는 뜻입니다.`);
    } else if (mode === 'scatter') {
      const im2 = IMP[j2], pr = all.filter(r => r.v[j] > 0 && r.v[j2] > 0);
      if (j === j2) { L.purge('exChart'), $('exChart').innerHTML = '<div class="empty">서로 다른 두 영향범주를 골라 주세요.</div>'; return; }
      if (pr.length < 5) { L.purge('exChart'), $('exChart').innerHTML = `<div class="empty">두 범주 모두 값이 있는 항목이 ${pr.length}건뿐이라(최소 5건 필요) 그리지 않습니다.</div>`; return; }
      const rho = S.spearman(pr.map(r => r.v[j]), pr.map(r => r.v[j2]));
      T(`${im.name} × ${im2.name}`, `비교 가능한 항목 ${pr.length}건 · 두 축 모두 로그 눈금`);
      plot('exChart', [{ type: 'scatter', mode: 'markers', x: pr.map(r => r.v[j]), y: pr.map(r => r.v[j2]), text: pr.map(lbl), marker: { size: 8, color: '#2367d1', opacity: .75 }, hovertemplate: '%{text}<br>x %{x:.3g}<br>y %{y:.3g}<extra></extra>' }],
        { xaxis: { type: 'log', title: `${im.name} (${im.sym}/${s.unit})` }, yaxis: { type: 'log', title: `${im2.name} (${im2.sym}/${s.unit})` } });
      const w = Math.abs(rho) >= .7 ? '강한' : Math.abs(rho) >= .4 ? '중간 정도의' : '약한';
      R(`Spearman ρ = <b>${rho.toFixed(2)}</b> (n=${pr.length}): ${rho >= 0 ? '' : '음의 '}${w} 순위 상관입니다(한쪽이 클수록 다른 쪽도 큰 경향이면 +, 반대면 −). 상관이 곧 인과는 아니므로, 소재군이 섞여 있다면 구분별로 나누어 확인하세요.`);
    } else if (mode === 'corr') {
      const ks = IMP.map((_, k) => k).filter(k => L.has(all, k).length >= 10);
      if (ks.length < 2) { L.purge('exChart'), $('exChart').innerHTML = '<div class="empty">값이 10건 이상인 영향범주가 2개 미만이라 상관행렬을 만들 수 없습니다. 이 범위는 탄소발자국만 제공되는 경우가 많습니다.</div>'; return; }
      const cell = (a, b) => { const p = all.filter(r => r.v[a] != null && r.v[b] != null); return { rho: a === b ? 1 : (p.length >= 8 ? S.spearman(p.map(r => r.v[a]), p.map(r => r.v[b])) : null), n: p.length }; };
      const M = ks.map(a => ks.map(b => cell(a, b)));
      T('영향범주 간 Spearman 순위상관(ρ)', 'ρ는 두 지표의 항목 순위가 얼마나 비슷한지를 −1~1로 나타냅니다 · 비교 쌍이 8개 미만이면 표시하지 않음');
      plot('exChart', [{ type: 'heatmap', x: ks.map(k => IMP[k].name), y: ks.map(k => IMP[k].name), z: M.map(r => r.map(c => c.rho)), text: M.map(r => r.map(c => (c.rho == null ? '' : c.rho.toFixed(2)))), texttemplate: '%{text}', customdata: M.map(r => r.map(c => c.n)), zmin: -1, zmax: 1, colorscale: [[0, '#c4504a'], [.5, '#fff'], [1, '#2367d1']], showscale: false, hovertemplate: '%{y} × %{x}<br>ρ %{z:.2f} · n=%{customdata}<extra></extra>' }],
        { margin: { l: 120, b: 100 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -25 } });
      R('ρ가 1에 가까울수록 두 범주의 항목 순위가 함께 움직이고, 0에 가까우면 거의 무관합니다. 칸에 마우스를 올리면 비교에 쓰인 항목 수(n)가 나옵니다.');
    } else {
      const ks = IMP.map((_, k) => k).filter(k => L.coverage(s.rows, k) >= .5);
      const picks = [...document.querySelectorAll('[data-rad]')].map(i => i.value).filter(v => v !== '').map(v => s.rows.find(r => r.id === +v)).filter(Boolean);
      T('프로파일 비교', `각 영향범주에서의 백분위(0~100)입니다. 100에 가까울수록 같은 대분류·단위 항목 중 계수가 큰 편이며, 값이 비어 있는 범주는 선을 잇지 않았습니다.`);
      if (!picks.length) { L.purge('exChart'), $('exChart').innerHTML = '<div class="empty">위 드롭다운에서 비교할 항목을 1개 이상 골라 주세요. 예: 유리면, 골판지.</div>'; return; }
      if (ks.length < 3) { L.purge('exChart'), $('exChart').innerHTML = '<div class="empty">값이 있는 비율이 50% 이상인 영향범주가 3개 미만이라 레이더 차트를 그릴 수 없습니다.</div>'; return; }
      const ref = ks.map(k => L.col(s.rows, k).map(r => r.v[k]));
      const pct = r => ks.map((k, i) => (r.v[k] > 0 ? S.percentile(ref[i], r.v[k]) : null));
      const th = ks.map(k => IMP[k].name);
      plot('exChart', picks.map((r, i) => { const p = pct(r); return { type: 'scatterpolar', mode: 'lines+markers', name: lbl(r), r: [...p, p[0]], theta: [...th, th[0]], connectgaps: false, fill: 'toself', opacity: .55, line: { color: L.COLORS[i % 6] }, hovertemplate: '%{theta}: 백분위 %{r:.0f}<extra>' + lbl(r) + '</extra>' }; }),
        { polar: { radialaxis: { range: [0, 100], tickvals: [0, 25, 50, 75, 100] } }, legend: { orientation: 'h', y: -0.12 }, margin: { l: 60, r: 60, t: 30, b: 60 } });
      $('exExtra').innerHTML = `<table class="tbl" style="margin-top:16px"><thead><tr><th>항목</th>${ks.map(k => `<th class="num">${IMP[k].name}<br><small>${IMP[k].sym}/${s.unit}</small></th>`).join('')}</tr></thead><tbody>${picks.map(r => { const p = pct(r); return `<tr><td>${esc(lbl(r))}</td>${ks.map((k, i) => `<td class="num${r.v[k] == null ? ' muted' : ''}">${r.v[k] == null ? '결측' : `${fmt(r.v[k])}<br><small class="muted">${L.topLabel(p[i])}</small>`}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
      R('레이더 차트는 항목이 어느 영향범주에서 두드러지는지 한눈에 보여 줍니다. 탄소는 낮은데 다른 범주가 높게 튀어나온 항목은, 탄소만 볼 때 놓치는 환경 부담이 있다는 신호입니다. 대체 소재를 검토할 때 한쪽이 좋아지면 다른 쪽이 나빠지는 관계(trade-off)가 없는지 확인하는 용도로 쓰세요.');
    }
  }
  L.tabs.explore = { build, built: false };
})();
