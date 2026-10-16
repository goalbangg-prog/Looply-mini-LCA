/* 군집 분석 탭 */
(function () {
  const { $, esc, fmt, IMP, D, POOL, RES, lbl, plot } = L;
  const SHORTN = IMP.map(i => i.name);
  let scopes = [], timer = null, ctx = null;
  function makeScopes() {
    const m = {};
    for (const r of D) { const k = r.stage + '|' + r.unit; (m[k] = m[k] || []).push(r); }
    scopes = Object.entries(m).filter(([, a]) => a.length >= 30).map(([k, a]) => { const [stage, unit] = k.split('|'), p = stage === '원료 및 에너지 생산' && unit === 'kg'; return { key: k, stage, unit, rows: p ? POOL : a, note: p ? ' · 수자원 제외' : '' }; });
  }
  const scope = () => scopes.find(s => s.key === $('clScope').value);
  const chosen = () => [...document.querySelectorAll('[data-cl]')].filter(x => x.checked).map(x => +x.value);

  function build() {
    makeScopes();
    $('cluster').innerHTML = `<div class="panel"><span class="eyebrow">Cluster Analysis</span><h3>군집 분석 설정 (KMeans)</h3>
      <p class="muted">영향범주 계수를 로그 변환·표준화(z-score)한 뒤 KMeans(k-means++ 초기화, 10회 시행 중 관성 최소)로 군집화합니다. 사용하는 영향범주에 따라 결과가 달라지므로 조건을 바꿔 가며 민감도를 확인할 수 있습니다.</p>
      <div class="grid g2"><div><label for="clScope">1. 분석 범위</label><select id="clScope"></select></div>
        <div><label for="clK">2. 군집 수(k)</label><select id="clK">${[2, 3, 4, 5, 6].map(k => `<option value="${k}"${k === RES.chosen_k ? ' selected' : ''}>k = ${k}${k === RES.chosen_k ? ' (리포트 기준)' : ''}</option>`).join('')}</select></div></div>
      <div style="margin-top:16px"><label>3. 군집화에 사용할 영향범주 <span class="muted" style="font-weight:500">(값은 범주별 보유율, 결측 항목은 분석에서 제외)</span></label><div class="chk" id="clChecks"></div></div>
      <div class="status" id="clStatus" aria-live="polite"></div></div>
      <div id="clOut"></div>`;
    L.opts($('clScope'), scopes, s => s.key, s => `${s.stage} · ${s.unit} (n=${s.rows.length})${s.note}`);
    $('clScope').value = '원료 및 에너지 생산|kg';
    $('clScope').onchange = () => { fillChecks(); run(); };
    $('clK').onchange = run; fillChecks(); run();
  }
  function fillChecks() {
    const s = scope(), cov = IMP.map((_, j) => L.coverage(s.rows, j));
    let on = cov.map(c => c >= .85);
    if (on.filter(Boolean).length < 2) { on = cov.map(() => false); cov.map((c, j) => ({ c, j })).filter(x => x.c >= .5).sort((a, b) => b.c - a.c).slice(0, 3).forEach(x => (on[x.j] = true)); }
    $('clChecks').innerHTML = IMP.map((im, j) => { const usable = cov[j] >= .5; return `<label class="${usable ? '' : 'off'}" title="${usable ? '' : '보유율 50% 미만으로 사용 불가'}"><input type="checkbox" data-cl value="${j}" ${on[j] ? 'checked' : ''} ${usable ? '' : 'disabled'}>${SHORTN[j]} <span class="muted" style="font-weight:500">${Math.round(cov[j] * 100)}%</span></label>`; }).join('');
    document.querySelectorAll('[data-cl]').forEach(x => (x.onchange = () => { clearTimeout(timer); timer = setTimeout(run, 80); }));
  }

  function run() {
    const s = scope(), sel = chosen(), k = +$('clK').value, out = $('clOut');
    if (sel.length < 2) { $('clStatus').className = 'status warn'; $('clStatus').textContent = L.coverageOK(s) < 2 ? '보유율 50% 이상인 영향범주가 1개뿐이어서(대부분 탄소발자국만 제공) 군집 분석을 수행할 수 없습니다.' : '영향범주를 2개 이상 선택하십시오.'; out.innerHTML = ''; ctx = null; return; }
    const rows = s.rows.filter(r => sel.every(j => r.v[j] != null && r.v[j] > 0)), lost = s.rows.length - rows.length;
    const cats = {}; s.rows.forEach(r => { (cats[r.category] = cats[r.category] || { all: 0, ok: 0 }).all++; }); rows.forEach(r => cats[r.category].ok++);
    const worst = Object.entries(cats).filter(([, c]) => c.all >= 4 && (c.all - c.ok) / c.all >= .4).sort((a, b) => (b[1].all - b[1].ok) / b[1].all - (a[1].all - a[1].ok) / a[1].all).slice(0, 3);
    $('clStatus').className = 'status' + (lost / s.rows.length > .15 ? ' warn' : '');
    $('clStatus').innerHTML = `선택 범주(${sel.map(j => SHORTN[j]).join('·')}) 전부 유효한 항목: <b>${rows.length} / ${s.rows.length}건</b> (결측으로 ${lost}건 제외).` + (worst.length ? ` 제외 비율이 높은 구분: ${worst.map(([c, v]) => `${esc(c)} ${Math.round((v.all - v.ok) / v.all * 100)}%`).join(', ')} → 해당 구분은 결과의 대표성이 낮습니다.` : '');
    if (rows.length < k * 5) { out.innerHTML = `<div class="panel"><div class="empty">유효 항목 ${rows.length}건으로는 k=${k} 군집화가 부적절합니다(군집당 5건 이상 필요). 범주 수 또는 k를 줄이십시오.</div></div>`; ctx = null; return; }
    const X = S.standardizeLog(rows.map(r => sel.map(j => r.v[j]))), scores = [], models = {};
    for (let kk = 2; kk <= 6; kk++) { if (rows.length < kk * 5) continue; const m = S.kmeans(X, kk, 10, 42); models[kk] = m; scores.push({ k: kk, sil: S.silhouette(X, m.lab, kk), stab: S.stability(X, kk, m), sizes: [...new Set(m.lab)].map(c => m.lab.filter(l => l === c).length).sort((a, b) => b - a) }); }
    const m = models[k], sc = scores.find(x => x.k === k);
    const order = m.centers.map((c, i) => ({ i, v: S.mean(c) })).sort((a, b) => a.v - b.v).map(o => o.i), num = {}; order.forEach((o, n) => (num[o] = n + 1));
    const overall = sel.map(j => S.median(rows.map(r => r.v[j])));
    const groups = order.map(ci => { const idx = rows.map((_, i) => i).filter(i => m.lab[i] === ci), mem = idx.map(i => rows[i]);
      const ratio = sel.map((j, z) => S.median(mem.map(r => r.v[j])) / overall[z]);
      const ex = idx.map(i => ({ r: rows[i], d: Math.sqrt(X[i].reduce((a, v, h) => a + (v - m.centers[ci][h]) ** 2, 0)) })).sort((a, b) => a.d - b.d).slice(0, 5).map(x => x.r);
      const comp = {}; mem.forEach(r => (comp[r.category] = (comp[r.category] || 0) + 1)); return { mem, ratio, ex, comp }; });
    const verdict = sc.sil >= .5 ? '군집 구조가 비교적 뚜렷합니다.' : sc.sil >= .25 ? '군집 간 경계가 모호하여 탐색 목적으로만 해석해야 합니다.' : '군집 구조가 거의 확인되지 않습니다.';
    let agree = '';
    const same = s.key === '원료 및 에너지 생산|kg' && k === RES.chosen_k && rows.length === RES.cluster_n && rows.every(r => RES.cluster_members[r.id] != null) && sel.map(j => IMP[j].k).sort().join() === ['탄소', '자원', '산성', '부영', '물'].sort().join();
    if (same) agree = `<div class="read">scikit-learn(Python) 결과와의 일치도: ARI <b>${S.ari(m.lab, rows.map(r => RES.cluster_members[r.id])).toFixed(2)}</b> (1.00 = 완전 일치).</div>`;
    out.innerHTML = `<div class="panel"><h3>① 군집 수별 타당성 지표</h3>
      <table class="tbl"><thead><tr><th>군집 수</th><th class="num">실루엣 계수</th><th class="num">안정성 (재시행 ARI 평균)</th><th>군집 크기</th></tr></thead><tbody>${scores.map(x => `<tr${x.k === k ? ' style="background:#e8f0fc;font-weight:700"' : ''}><td>k = ${x.k}${x.k === k ? ' ◀ 선택' : ''}</td><td class="num">${x.sil.toFixed(3)}</td><td class="num">${x.stab.toFixed(2)}</td><td>${x.sizes.join(' / ')}</td></tr>`).join('')}</tbody></table>
      <div class="${sc.sil < .4 ? 'caution' : 'read'}"><b>k = ${k}: 실루엣 ${sc.sil.toFixed(2)}</b> — ${verdict} 실루엣 최대값만으로 k를 결정하지 않고, 최소 군집 크기(${Math.min(...sc.sizes)}건)와 안정성(${sc.stab.toFixed(2)})을 함께 검토합니다.${rows.length < 40 ? ` 표본이 ${rows.length}건으로 작아 우연에 의한 분할일 가능성이 있습니다.` : ''}</div>${agree}</div>
      <div class="panel"><h3>② 군집 프로파일</h3><p class="hint" style="margin:-4px 0 14px">군집 번호는 표준화 중심값 평균이 낮은 순서의 식별자이며 순위·등급이 아닙니다. 배수는 선택 항목 전체 중앙값 대비 군집 중앙값의 비율입니다.</p>
        <div class="grid" style="grid-template-columns:repeat(${Math.min(k, 3)},1fr)">${groups.map((g, i) => {
          const { title, line } = L.clusterTitle(g.ratio, sel.map(j => SHORTN[j]));
          const lo = sel.map((j, z) => ({ j, v: g.ratio[z] })).filter(t => t.v <= 0.5).sort((a, b) => a.v - b.v).slice(0, 2);
          const topc = Object.entries(g.comp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${esc(c)} ${n}`).join(', ');
          return `<div class="clu"><span class="tag">군집 ${i + 1} · n=${g.mem.length}</span><h4>${title}</h4><p style="margin:6px 0">${line}${lo.length && g.ratio.some(v => v >= 1) ? `<br>저위 범주: ${lo.map(t => `${SHORTN[t.j]} ${L.fx(t.v)}`).join(', ')}` : ''}</p>${g.mem.length < 5 ? '<p class="caution" style="margin:6px 0;padding:6px 10px">군집 크기가 5건 미만으로 이상치 성격일 수 있습니다.</p>' : ''}<small>대표 항목: ${g.ex.map(r => esc(r.name)).join(', ')}<br>구분 구성: ${topc}</small></div>`;
        }).join('')}</div></div>
      <div class="panel"><div class="grid g2"><div><h3>③ 중앙값 배수 히트맵</h3><div id="clHeat" class="chart h340"></div></div><div><h3>④ 산점도 (로그)</h3><div id="clScatter" class="chart h340"></div></div></div></div>
      <div class="panel"><h3>⑤ 항목 조회</h3><p class="hint" style="margin:-4px 0 10px">항목을 입력하면 소속 군집과 프로파일을 확인하고 산점도에 표시합니다. 분석에서 제외된 항목은 제외 사유(결측 범주)를 안내합니다.</p>
        <div style="max-width:420px"><input id="clFind" type="text" list="clNames" placeholder="항목명 입력 (예: 유리면)" aria-label="항목 조회"><datalist id="clNames">${s.rows.map(r => `<option value="${esc(lbl(r))}">`).join('')}</datalist></div><div id="clFound" style="margin-top:14px"></div></div>
      <div class="panel"><details style="margin:0"><summary>항목별 군집 배정 전체 (${rows.length}건)</summary><div class="scroll" style="margin-top:10px"><table class="tbl"><thead><tr><th>군집</th><th>항목</th><th>구분</th>${sel.map(j => `<th class="num">${SHORTN[j]}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => ({ r, n: num[m.lab[i]] })).sort((a, b) => a.n - b.n).map(x => `<tr><td><span class="pill">${x.n}</span></td><td>${esc(lbl(x.r))}</td><td>${esc(x.r.category)}</td>${sel.map(j => `<td class="num">${fmt(x.r.v[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></div>`;
    const ratios = groups.map(g => g.ratio);
    plot('clHeat', [{ type: 'heatmap', x: sel.map(j => SHORTN[j]), y: groups.map((g, i) => `군집 ${i + 1} (n=${g.mem.length})`), z: ratios.map(r => r.map(Math.log10)), zmin: -1.5, zmax: 1.5, colorscale: [[0, '#2b6c8f'], [.5, '#fff'], [1, '#c4504a']], showscale: false, text: ratios.map(r => r.map(L.fx)), texttemplate: '%{text}', hovertemplate: '%{y}<br>%{x}: 전체 중앙값의 %{text}<extra></extra>' }],
      { margin: { l: 110, b: 70, t: 10 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -20 } });
    ctx = { rows, sel, k, labels: m.lab, num, groups, overall, X, centers: m.centers, scores, s };
    L._lastCluster = { rows, sel, k, labels: m.lab, scores, groups };
    drawScatter(null); $('clFind').onchange = find;
  }
  function drawScatter(hi) {
    const { sel, groups } = ctx, [u, v] = sel;
    const tr = groups.map((g, i) => ({ type: 'scatter', mode: 'markers', name: `군집 ${i + 1}`, x: g.mem.map(r => r.v[u]), y: g.mem.map(r => r.v[v]), text: g.mem.map(lbl), marker: { size: 8, color: L.COLORS[i % 6], opacity: .8 }, hovertemplate: '%{text}<br>x %{x:.3g}<br>y %{y:.3g}<extra></extra>' }));
    if (hi && hi.v[u] > 0 && hi.v[v] > 0) tr.push({ type: 'scatter', mode: 'markers+text', name: '조회 항목', x: [hi.v[u]], y: [hi.v[v]], text: [hi.name], textposition: 'top center', marker: { size: 16, symbol: 'star', color: '#101d32', line: { width: 1, color: '#fff' } }, hoverinfo: 'text' });
    plot('clScatter', tr, { xaxis: { type: 'log', title: SHORTN[u] + ' (' + IMP[u].sym + ')' }, yaxis: { type: 'log', title: SHORTN[v] + ' (' + IMP[v].sym + ')' }, legend: { orientation: 'h', y: -0.28 }, margin: { b: 100 } });
  }
  function find() {
    if (!ctx) return; const q = $('clFind').value.trim(), box = $('clFound'); if (!q) { box.innerHTML = ''; drawScatter(null); return; }
    const r = ctx.s.rows.find(x => lbl(x) === q) || ctx.s.rows.find(x => lbl(x).includes(q));
    if (!r) { box.innerHTML = '<div class="empty">일치하는 항목이 없습니다.</div>'; drawScatter(null); return; }
    const i = ctx.rows.indexOf(r);
    if (i < 0) { const miss = ctx.sel.filter(j => !(r.v[j] > 0)).map(j => SHORTN[j]); box.innerHTML = `<div class="caution"><b>${esc(lbl(r))}</b>은(는) 선택한 범주 중 ${miss.join('·')}이(가) 결측이므로 이번 군집 분석에서 제외되었습니다.</div>`; drawScatter(null); return; }
    const g = ctx.num[ctx.labels[i]], grp = ctx.groups[g - 1];
    box.innerHTML = `<div class="read" style="margin-top:0"><b>${esc(lbl(r))}</b> → <b>군집 ${g}</b> (n=${grp.mem.length})</div><table class="tbl" style="margin-top:10px"><thead><tr><th>영향범주</th><th class="num">계수</th><th class="num">전체 중앙값 대비</th><th class="num">소속 군집 중앙값 대비</th></tr></thead><tbody>${ctx.sel.map((j, z) => `<tr><td>${SHORTN[j]}</td><td class="num">${fmt(r.v[j])}</td><td class="num">${L.fx(r.v[j] / ctx.overall[z])}</td><td class="num">${L.fx(r.v[j] / S.median(grp.mem.map(x => x.v[j])))}</td></tr>`).join('')}</tbody></table>`;
    drawScatter(r);
  }
  L.tabs.cluster = { build, built: false };
})();
