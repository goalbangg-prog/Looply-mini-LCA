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
      <div><label for="exMode">분석 방법</label><select id="exMode"><option value="rank">순위 (상·하위 항목)</option><option value="hist">분포 (log₁₀)</option><option value="box">구분별 분포 (박스플롯)</option><option value="scatter">산점도 (영향범주 간)</option><option value="corr">상관행렬 (Spearman ρ)</option><option value="radar">프로파일 비교 (백분위 레이더)</option></select></div></div>
      <div id="exSecond" style="width:33%;margin-top:14px" class="hidden"><label for="exImpact2">Y축 영향범주</label><select id="exImpact2"></select></div>
      <div id="exCatWrap" style="margin-top:16px"><label>구분 필터 <span class="muted" style="font-weight:500">(체크 해제한 구분은 분석에서 제외)</span></label><div class="chk" id="exCats"></div></div>
      <div id="exRadarWrap" class="hidden" style="margin-top:16px"><label>비교 항목 (최대 4개, 이름을 입력하거나 목록에서 선택)</label><div class="grid g4" id="exRadarIn"></div><datalist id="exNames"></datalist></div>
      <div id="exStatus" class="status"></div></div>
      <div class="panel"><div id="exTitle"></div><div id="exChart" class="chart h460"></div><div id="exRead"></div><div id="exExtra"></div></div>`;
    L.opts($('exScope'), scopes, s => s.key, s => `${s.stage} · ${s.unit} (n=${s.rows.length})${s.note}`);
    $('exRadarIn').innerHTML = [0, 1, 2, 3].map(i => `<input type="text" list="exNames" data-rad="${i}" placeholder="항목 ${i + 1}" aria-label="비교 항목 ${i + 1}">`).join('');
    $('exScope').onchange = () => { fillScope(); draw(); };
    for (const id of ['exImpact', 'exImpact2', 'exMode']) $(id).onchange = draw;
    document.querySelectorAll('[data-rad]').forEach(i => (i.onchange = draw));
    fillScope(); draw();
  }
  function fillScope() {
    const s = scope(), cov = j => Math.round(L.coverage(s.rows, j) * 100), keep = $('exImpact').value;
    for (const id of ['exImpact', 'exImpact2']) L.opts($(id), IMP.map((_, j) => j), j => j, j => `${IMP[j].name} (보유율 ${cov(j)}%)`);
    $('exImpact').value = keep && +keep < IMP.length ? keep : '0'; $('exImpact2').value = '1';
    const cats = [...new Set(s.rows.map(r => r.category))];
    $('exCats').innerHTML = cats.map(c => `<label><input type="checkbox" data-excat value="${esc(c)}" checked>${esc(c)} <span class="muted" style="font-weight:500">${s.rows.filter(r => r.category === c).length}</span></label>`).join('');
    document.querySelectorAll('[data-excat]').forEach(x => (x.onchange = draw));
    $('exNames').innerHTML = s.rows.map(r => `<option value="${esc(lbl(r))}">`).join('');
    document.querySelectorAll('[data-rad]').forEach(i => (i.value = ''));
  }
  const times = L.times;

  function draw() {
    const s = scope(), mode = $('exMode').value, j = +$('exImpact').value, j2 = +$('exImpact2').value, all = filtered(s);
    $('exSecond').classList.toggle('hidden', mode !== 'scatter'); $('exCatWrap').classList.toggle('hidden', mode === 'radar'); $('exRadarWrap').classList.toggle('hidden', mode !== 'radar');
    $('exImpact').disabled = mode === 'corr' || mode === 'radar';
    const rows = L.col(all, j), miss = all.length - rows.length, im = IMP[j];
    $('exStatus').className = 'status' + (miss > all.length * .15 && mode !== 'corr' && mode !== 'radar' ? ' warn' : '');
    $('exStatus').innerHTML = mode === 'corr' ? `분석 대상 ${all.length}건 · 두 영향범주 값이 모두 있는 쌍만 사용(pairwise deletion)` : mode === 'radar' ? `백분위 기준 모집단: ${s.stage} · ${s.unit} ${s.rows.length}건(영향범주별 유효값 기준)` : `분석 대상 ${all.length}건 중 <b>${rows.length}건</b>에서 ${im.name} 값 확보${miss ? ` (결측 ${miss}건은 결측치로 인해 제외)` : ''}`;
    $('exTitle').innerHTML = ''; $('exRead').innerHTML = ''; $('exExtra').innerHTML = ''; $('exChart').innerHTML = ''; try { Plotly.purge($('exChart')); } catch (e) { }
    if (!['corr', 'radar'].includes(mode) && rows.length < 5) { $('exChart').innerHTML = `<div class="empty">${im.name}은(는) 현재 조건에서 유효값이 ${rows.length}건으로 시각화 기준(5건)에 미달합니다. 다른 영향범주·범위·구분을 선택하십시오.</div>`; return; }
    const T = (t, sub) => ($('exTitle').innerHTML = `<h3>${t}</h3>${sub ? `<p class="hint" style="margin:0 0 6px">${sub}</p>` : ''}`);
    const R = h => ($('exRead').innerHTML = `<div class="read">${h}</div>`);
    if (mode === 'rank') {
      const sorted = [...rows].sort((a, b) => b.v[j] - a.v[j]), n = Math.min(12, Math.floor(sorted.length / 2)), sh = [...sorted.slice(0, n), ...sorted.slice(-n)];
      T(`${im.name}: 상위 ${n}개 · 하위 ${n}개`, `${im.sym} / ${s.unit}`);
      plot('exChart', [{ type: 'bar', orientation: 'h', y: sh.map(lbl), x: sh.map(r => r.v[j]), marker: { color: sh.map((_, i) => (i < n ? '#c4504a' : '#2367d1')) }, hovertemplate: '%{y}<br>%{x:.3g}<extra></extra>' }],
        { xaxis: { type: 'log', title: `${im.sym} / ${s.unit} (로그 눈금)` }, yaxis: { automargin: true, autorange: 'reversed' }, margin: { l: 230 } });
      R(`최댓값(${esc(lbl(sorted[0]))})은 최솟값(${esc(lbl(sorted[sorted.length - 1]))})의 <b>${times(sorted[0].v[j] / sorted[sorted.length - 1].v[j])}</b>입니다. 로그 눈금이므로 막대 길이 차이보다 실제 격차가 큽니다.`);
    } else if (mode === 'hist') {
      const vals = rows.map(r => r.v[j]), med = S.median(vals), p10 = S.quantile(vals, .1), p90 = S.quantile(vals, .9);
      T(`${im.name} 계수 분포`, '10배 단위 로그 구간(log₁₀) 히스토그램');
      plot('exChart', [{ type: 'histogram', x: vals.map(Math.log10), nbinsx: 24, marker: { color: '#2367d1' }, hovertemplate: '10^%{x} 부근: %{y}건<extra></extra>' }],
        { xaxis: { title: `log₁₀(${im.sym} / ${s.unit})` }, yaxis: { title: '항목 수' }, bargap: 0.05 });
      R(`중앙값 <b>${fmt(med)}</b> ${im.sym}/${s.unit}, P10 ${fmt(p10)} ~ P90 ${fmt(p90)} (<b>${times(p90 / p10)}</b> 범위)입니다. 분포의 폭이 크므로 평균보다 중앙값·분위수로 요약하는 것이 적절합니다.`);
    } else if (mode === 'box') {
      const cats = [...new Set(rows.map(r => r.category))].filter(c => rows.filter(r => r.category === c).length >= 3);
      if (cats.length < 2) { $('exChart').innerHTML = '<div class="empty">비교 가능한 구분이 2개 미만입니다(구분당 유효값 3건 이상 필요).</div>'; return; }
      T(`${im.name}: 구분별 분포`, `유효값 3건 이상 구분 · ${im.sym} / ${s.unit} · 로그 눈금`);
      plot('exChart', cats.map((c, i) => ({ type: 'box', name: `${c} (${rows.filter(r => r.category === c).length})`, y: rows.filter(r => r.category === c).map(r => r.v[j]), boxpoints: 'all', jitter: .4, pointpos: 0, marker: { color: L.COLORS[i % 6], size: 5 }, text: rows.filter(r => r.category === c).map(lbl), hovertemplate: '%{text}<br>%{y:.3g}<extra></extra>' })),
        { yaxis: { type: 'log', title: `${im.sym} / ${s.unit}` }, showlegend: false, xaxis: { tickangle: -20 }, margin: { b: 100 } });
      const meds = cats.map(c => ({ c, m: S.median(rows.filter(r => r.category === c).map(r => r.v[j])) })).sort((a, b) => b.m - a.m);
      R(`구분별 중앙값 최고: <b>${esc(meds[0].c)}</b>, 최저: <b>${esc(meds[meds.length - 1].c)}</b>. 구분 간 사분위 범위가 크게 겹친다면 구분(대표 소재군)만으로 계수 수준을 추정하기 어렵다는 뜻입니다.`);
    } else if (mode === 'scatter') {
      const im2 = IMP[j2], pr = all.filter(r => r.v[j] > 0 && r.v[j2] > 0);
      if (j === j2) { $('exChart').innerHTML = '<div class="empty">서로 다른 두 영향범주를 선택하십시오.</div>'; return; }
      if (pr.length < 5) { $('exChart').innerHTML = `<div class="empty">두 범주 모두 유효한 항목이 ${pr.length}건으로 기준(5건)에 미달합니다.</div>`; return; }
      const rho = S.spearman(pr.map(r => r.v[j]), pr.map(r => r.v[j2]));
      T(`${im.name} × ${im2.name}`, `유효쌍 n=${pr.length} · 양 축 로그 눈금`);
      plot('exChart', [{ type: 'scatter', mode: 'markers', x: pr.map(r => r.v[j]), y: pr.map(r => r.v[j2]), text: pr.map(lbl), marker: { size: 8, color: '#2367d1', opacity: .75 }, hovertemplate: '%{text}<br>x %{x:.3g}<br>y %{y:.3g}<extra></extra>' }],
        { xaxis: { type: 'log', title: `${im.name} (${im.sym}/${s.unit})` }, yaxis: { type: 'log', title: `${im2.name} (${im2.sym}/${s.unit})` } });
      const w = Math.abs(rho) >= .7 ? '강한' : Math.abs(rho) >= .4 ? '중간 정도의' : '약한';
      R(`Spearman ρ = <b>${rho.toFixed(2)}</b> (n=${pr.length}): ${rho >= 0 ? '' : '음의 '}${w} 단조 관계입니다. 상관은 인과를 의미하지 않으며, 소재군이 혼재되어 있으면 구분별로 나누어 확인해야 합니다.`);
    } else if (mode === 'corr') {
      const ks = IMP.map((_, k) => k).filter(k => L.has(all, k).length >= 10);
      if (ks.length < 2) { $('exChart').innerHTML = '<div class="empty">유효값 10건 이상인 영향범주가 2개 미만이어서 상관행렬을 산출할 수 없습니다(이 범위는 탄소발자국만 제공되는 경우가 많습니다).</div>'; return; }
      const cell = (a, b) => { const p = all.filter(r => r.v[a] != null && r.v[b] != null); return { rho: a === b ? 1 : (p.length >= 8 ? S.spearman(p.map(r => r.v[a]), p.map(r => r.v[b])) : null), n: p.length }; };
      const M = ks.map(a => ks.map(b => cell(a, b)));
      T('영향범주 간 Spearman 순위상관', '값이 모두 있는 쌍만 사용 · 쌍의 수가 8 미만이면 표시하지 않음');
      plot('exChart', [{ type: 'heatmap', x: ks.map(k => IMP[k].name), y: ks.map(k => IMP[k].name), z: M.map(r => r.map(c => c.rho)), text: M.map(r => r.map(c => (c.rho == null ? '' : c.rho.toFixed(2)))), texttemplate: '%{text}', customdata: M.map(r => r.map(c => c.n)), zmin: -1, zmax: 1, colorscale: [[0, '#c4504a'], [.5, '#fff'], [1, '#2367d1']], showscale: false, hovertemplate: '%{y} × %{x}<br>ρ %{z:.2f} · n=%{customdata}<extra></extra>' }],
        { margin: { l: 120, b: 100 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -25 } });
      R('ρ가 1에 가까울수록 두 범주의 항목 순위가 함께 움직이고, 0에 가까우면 독립적입니다. 셀에 마우스를 올리면 비교에 사용된 쌍의 수(n)를 확인할 수 있습니다.');
    } else {
      const ks = IMP.map((_, k) => k).filter(k => L.coverage(s.rows, k) >= .5);
      const names = [...document.querySelectorAll('[data-rad]')].map(i => i.value.trim()).filter(Boolean);
      const picks = names.map(n => s.rows.find(r => lbl(r) === n)).filter(Boolean);
      T('프로파일 비교', `영향범주별 백분위(0~100, 높을수록 ${s.stage} · ${s.unit} 항목 중 계수가 큼) · 결측 범주는 선을 잇지 않음`);
      if (!picks.length) { $('exChart').innerHTML = '<div class="empty">비교할 항목을 1개 이상 입력하십시오. 입력창을 클릭하면 선택 가능한 항목 목록이 표시됩니다.</div>'; return; }
      if (ks.length < 3) { $('exChart').innerHTML = '<div class="empty">보유율 50% 이상인 영향범주가 3개 미만이어서 레이더 차트를 그릴 수 없습니다.</div>'; return; }
      const ref = ks.map(k => L.col(s.rows, k).map(r => r.v[k]));
      const pct = r => ks.map((k, i) => (r.v[k] > 0 ? S.percentile(ref[i], r.v[k]) : null));
      const th = ks.map(k => IMP[k].name);
      plot('exChart', picks.map((r, i) => { const p = pct(r); return { type: 'scatterpolar', mode: 'lines+markers', name: lbl(r), r: [...p, p[0]], theta: [...th, th[0]], connectgaps: false, fill: 'toself', opacity: .55, line: { color: L.COLORS[i % 6] }, hovertemplate: '%{theta}: 백분위 %{r:.0f}<extra>' + lbl(r) + '</extra>' }; }),
        { polar: { radialaxis: { range: [0, 100], tickvals: [0, 25, 50, 75, 100] } }, legend: { orientation: 'h', y: -0.12 }, margin: { l: 60, r: 60, t: 30, b: 60 } });
      $('exExtra').innerHTML = `<table class="tbl" style="margin-top:16px"><thead><tr><th>항목</th>${ks.map(k => `<th class="num">${IMP[k].name}<br><small>${IMP[k].sym}/${s.unit}</small></th>`).join('')}</tr></thead><tbody>${picks.map(r => { const p = pct(r); return `<tr><td>${esc(lbl(r))}</td>${ks.map((k, i) => `<td class="num${r.v[k] == null ? ' muted' : ''}">${r.v[k] == null ? '결측' : `${fmt(r.v[k])}<br><small class="muted">${L.topLabel(p[i])}</small>`}</td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
      R('백분위 프로파일은 항목이 어느 영향범주에서 두드러지는지 한눈에 보여 줍니다. 탄소 백분위만 낮고 다른 범주가 높은 항목은 “탄소 단일 지표로는 포착되지 않는 부담”의 후보입니다. 대체 소재 검토 시 범주 간 상쇄(trade-off) 여부를 확인하는 용도로 활용하십시오.');
    }
  }
  L.tabs.explore = { build, built: false };
})();
