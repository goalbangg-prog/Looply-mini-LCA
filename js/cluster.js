/* 묶어 보기(군집 분석) 탭 */
(function () {
  const { $, esc, fmt, IMP, D, POOL, RES, lbl, plot } = L;
  const SHORTN = IMP.map(i => i.name.replace('(산성비)', ''));
  let scopes = [], timer = null;
  function makeScopes() {
    const m = {};
    for (const r of D) { const k = r.stage + '|' + r.unit; (m[k] = m[k] || []).push(r); }
    scopes = Object.entries(m).filter(([, a]) => a.length >= 30).map(([k, a]) => { const [stage, unit] = k.split('|'), p = stage === '원료 및 에너지 생산' && unit === 'kg'; return { key: k, stage, unit, rows: p ? POOL : a, note: p ? ' · 수돗물·공업용수 제외' : '' }; });
  }
  const scope = () => scopes.find(s => s.key === $('clScope').value);
  const chosen = () => [...document.querySelectorAll('[data-cl]')].filter(x => x.checked).map(x => +x.value);

  function build() {
    makeScopes();
    $('cluster').innerHTML = `<div class="panel"><h3>비슷한 원료끼리 묶어 보기</h3>
      <p class="muted">수치가 비슷한 항목을 정해진 수의 무리로 나눠요(KMeans). 어떤 영향을 쓰느냐에 따라 결과가 달라지니, 직접 바꿔 보며 확인해 보세요.</p>
      <div class="grid g2"><div><label for="clScope">1. 범위</label><select id="clScope"></select></div>
        <div><label for="clK">2. 무리 수</label><select id="clK">${[2, 3, 4, 5, 6].map(k => `<option value="${k}"${k === RES.chosen_k ? ' selected' : ''}>${k}개${k === RES.chosen_k ? ' (리포트 기본값)' : ''}</option>`).join('')}</select></div></div>
      <div style="margin-top:16px"><label>3. 묶을 때 쓸 영향 (값이 비어 있는 항목은 분석에서 빠져요)</label><div class="chk" id="clChecks"></div></div>
      <div class="status" id="clStatus" aria-live="polite"></div></div>
      <div id="clOut"></div>`;
    L.opts($('clScope'), scopes, s => s.key, s => `${s.stage} · ${s.unit} (${s.rows.length}개)${s.note}`);
    $('clScope').value = '원료 및 에너지 생산|kg';
    $('clScope').onchange = () => { fillChecks(); run(); };
    $('clK').onchange = run; fillChecks(); run();
  }
  function fillChecks() {
    const s = scope(), box = $('clChecks') || $('clChecks');
    const cov = IMP.map((_, j) => L.coverage(s.rows, j));
    let on = cov.map(c => c >= .85);
    if (on.filter(Boolean).length < 2) { // 85% 이상 채워진 영향이 2개 미만이면, 채워진 비율이 높은 순서로 2~3개를 켠다 (절반 이상 찬 것만)
      on = cov.map(() => false); cov.map((c, j) => ({ c, j })).filter(x => x.c >= .5).sort((a, b) => b.c - a.c).slice(0, 3).forEach(x => (on[x.j] = true));
    }
    $('clChecks').innerHTML = IMP.map((im, j) => {
      const c = cov[j], usable = c >= .5;
      return `<label class="${usable ? '' : 'off'}" title="${usable ? '' : '값이 절반도 안 채워져 있어 쓸 수 없어요'}"><input type="checkbox" data-cl value="${j}" ${on[j] ? 'checked' : ''} ${usable ? '' : 'disabled'}>${SHORTN[j]} <span class="muted" style="font-weight:500">${Math.round(c * 100)}%</span></label>`;
    }).join('');
    document.querySelectorAll('[data-cl]').forEach(x => x.onchange = () => { clearTimeout(timer); timer = setTimeout(run, 80); });
  }

  const KM = (X, k) => S.kmeans(X, k, 10, 42);
  
  function run() {
    const s = scope(), sel = chosen(), k = +$('clK').value, out = $('clOut');
    if (sel.length < 2) { $('clStatus').className = 'status warn'; $('clStatus').textContent = L.coverageOK(s) < 2 ? '이 범위에서는 값이 절반 이상 채워진 영향이 1가지뿐이라(대부분 탄소발자국만 있어요) 묶어 볼 수 없어요.' : '영향을 2가지 이상 골라 주세요.'; out.innerHTML = ''; return; }
    const rows = s.rows.filter(r => sel.every(j => r.v[j] != null && r.v[j] > 0)), lost = s.rows.length - rows.length;
    // 어느 구분이 많이 빠졌는지
    const cats = {}; s.rows.forEach(r => { (cats[r.category] = cats[r.category] || { all: 0, ok: 0 }).all++; });
    rows.forEach(r => cats[r.category].ok++);
    const worst = Object.entries(cats).filter(([, c]) => c.all >= 4 && (c.all - c.ok) / c.all >= .4).sort((a, b) => (b[1].all - b[1].ok) / b[1].all - (a[1].all - a[1].ok) / a[1].all).slice(0, 3);
    $('clStatus').className = 'status' + (lost / s.rows.length > .15 ? ' warn' : '');
    $('clStatus').innerHTML = `선택한 ${sel.length}가지 영향(${sel.map(j => SHORTN[j]).join('·')})이 모두 있는 항목: <b>${rows.length}개 / ${s.rows.length}개</b> (${lost}개 빠짐).` + (worst.length ? ` 특히 많이 빠진 구분: ${worst.map(([c, v]) => `${esc(c)} ${Math.round((v.all - v.ok) / v.all * 100)}%`).join(', ')} → 이 구분들은 결과에서 대표성이 낮아요.` : '');
    if (rows.length < k * 5) { out.innerHTML = `<div class="panel"><div class="empty">분석할 항목이 ${rows.length}개뿐이라 ${k}개 무리로 나누기엔 적어요. 영향을 줄이거나 무리 수를 줄여 보세요.</div></div>`; return; }
    const X = S.standardizeLog(rows.map(r => sel.map(j => r.v[j])));
    const scores = []; const models = {};
    for (let kk = 2; kk <= 6; kk++) { if (rows.length < kk * 5) continue; const m = KM(X, kk); models[kk] = m; scores.push({ k: kk, sil: S.silhouette(X, m.lab, kk), stab: S.stability(X, kk, m), sizes: [...new Set(m.lab)].map(c => m.lab.filter(l => l === c).length).sort((a, b) => b - a) }); }
    const m = models[k], sc = scores.find(x => x.k === k);
    // 평균 표준화 값이 작은 무리부터 1번
    const order = m.centers.map((c, i) => ({ i, v: S.mean(c) })).sort((a, b) => a.v - b.v).map(o => o.i), num = {}; order.forEach((o, n) => (num[o] = n + 1));
    const overall = sel.map((j, z) => S.median(rows.map(r => r.v[j])));
    const groups = order.map(ci => { const mem = rows.filter((_, i) => m.lab[i] === ci), idx = rows.map((_, i) => i).filter(i => m.lab[i] === ci);
      const ratio = sel.map((j, z) => S.median(mem.map(r => r.v[j])) / overall[z]);
      const ex = idx.map(i => ({ r: rows[i], d: Math.sqrt(X[i].reduce((a, v, h) => a + (v - m.centers[ci][h]) ** 2, 0)) })).sort((a, b) => a.d - b.d).slice(0, 5).map(x => x.r);
      const comp = {}; mem.forEach(r => (comp[r.category] = (comp[r.category] || 0) + 1));
      return { mem, ratio, ex, comp }; });
    const verdict = sc.sil >= .5 ? '경계가 뚜렷한 편이에요.' : sc.sil >= .25 ? '경계가 흐릿한 편이에요. 참고용으로만 보세요.' : '경계가 거의 없어요. 억지로 나눈 결과에 가까워요.';
    // Python(scikit-learn) 결과와 비교: 같은 항목, 같은 영향 5가지, 리포트 기본 무리 수일 때만
    let agree = '';
    const same = s.key === '원료 및 에너지 생산|kg' && k === RES.chosen_k && rows.length === RES.cluster_n && rows.every(r => RES.cluster_members[r.id] != null) && sel.map(j => IMP[j].k).sort().join() === ['탄소', '자원', '산성', '부영', '물'].sort().join();
    if (same) agree = `<div class="read">Python(scikit-learn)으로 묶은 결과와 비교하면 일치도(ARI)가 <b>${S.ari(m.lab, rows.map(r => RES.cluster_members[r.id])).toFixed(2)}</b>예요(1이면 완전히 같음).</div>`;
    out.innerHTML = `<div class="panel"><h3>① 무리 수별 점수</h3>
      <table class="tbl"><thead><tr><th>무리 수</th><th class="num">경계 뚜렷함(실루엣)</th><th class="num">여러 번 돌려도 같은 결과(1이 최대)</th><th>무리 크기</th></tr></thead><tbody>${scores.map(x => `<tr${x.k === k ? ' style="background:#e3f3ee;font-weight:700"' : ''}><td>${x.k}개${x.k === k ? ' ← 지금 선택' : ''}</td><td class="num">${x.sil.toFixed(3)}</td><td class="num">${x.stab.toFixed(2)}</td><td>${x.sizes.join(' / ')}</td></tr>`).join('')}</tbody></table>
      <div class="${sc.sil < .4 ? 'caution' : 'read'}"><b>${k}개 무리: 실루엣 ${sc.sil.toFixed(2)}</b> · ${verdict} 점수가 가장 높은 개수가 곧 정답은 아니에요. 가장 작은 무리가 너무 작지 않은지(${Math.min(...sc.sizes)}개), 여러 번 돌려도 같은 결과인지(${sc.stab.toFixed(2)})도 함께 봐요.${rows.length < 40 ? ` 항목이 ${rows.length}개뿐이라 우연히 이렇게 나뉘었을 수도 있어요.` : ''}</div>${agree}</div>
      <div class="panel"><h3>② 무리별 특징</h3><p class="hint" style="margin:-4px 0 14px">번호는 영향이 작은 쪽부터 붙였어요. 순위나 등급이 아니에요. 배수는 "선택한 항목 전체의 중앙값"과 비교한 값이에요.</p>
        <div class="grid g3" style="grid-template-columns:repeat(${Math.min(k, 3)},1fr)">${groups.map((g, i) => {
          const { title, line } = L.clusterTitle(g.ratio, sel.map(j => SHORTN[j]));
          const lo = sel.map((j, z) => ({ j, v: g.ratio[z] })).filter(t => t.v <= 0.5).sort((a, b) => a.v - b.v).slice(0, 2);
          const txt = line + (lo.length && g.ratio.some(v => v >= 1) ? `<br>작은 영향: ${lo.map(t => `${SHORTN[t.j]} ${L.fx(t.v)}`).join(', ')}` : '');
          const topc = Object.entries(g.comp).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${esc(c)} ${n}`).join(', ');
          return `<div class="clu"><span class="tag">${i + 1}번 무리 · ${g.mem.length}개</span><h4>${title}</h4><p style="margin:6px 0">${txt}</p>${g.mem.length < 5 ? '<p class="caution" style="margin:6px 0;padding:6px 10px">항목이 5개 미만이라 예외적인 항목일 수 있어요.</p>' : ''}<small>대표: ${g.ex.map(r => esc(r.name)).join(', ')}<br>구분: ${topc}</small></div>`;
        }).join('')}</div></div>
      <div class="panel"><div class="grid g2"><div><h3>③ 영향별 배수 지도</h3><div id="clHeat" class="chart h340"></div></div><div><h3>④ 두 영향으로 본 분포</h3><div id="clScatter" class="chart h340"></div></div></div></div>
      <div class="panel"><details style="margin:0"><summary>항목별 무리 번호 전체 보기 (${rows.length}개)</summary><div class="scroll" style="margin-top:10px"><table class="tbl"><thead><tr><th>무리</th><th>항목</th><th>구분</th>${sel.map(j => `<th class="num">${SHORTN[j]}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => ({ r, n: num[m.lab[i]] })).sort((a, b) => a.n - b.n).map(x => `<tr><td><span class="pill">${x.n}</span></td><td>${esc(lbl(x.r))}</td><td>${esc(x.r.category)}</td>${sel.map(j => `<td class="num">${fmt(x.r.v[j])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></div>`;
    const ratios = groups.map(g => g.ratio);
    plot('clHeat', [{ type: 'heatmap', x: sel.map(j => SHORTN[j]), y: groups.map((g, i) => `${i + 1}번 (${g.mem.length}개)`), z: ratios.map(r => r.map(Math.log10)), zmin: -1.5, zmax: 1.5, colorscale: [[0, '#2b6c8f'], [.5, '#fff'], [1, '#c4504a']], showscale: false, text: ratios.map(r => r.map(v => (v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)) + '배')), texttemplate: '%{text}', hovertemplate: '%{y}<br>%{x}: 전체 중앙값의 %{text}<extra></extra>' }],
      { margin: { l: 90, b: 70, t: 10 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -20 } });
    const [u, v] = sel;
    plot('clScatter', groups.map((g, i) => ({ type: 'scatter', mode: 'markers', name: `${i + 1}번 무리`, x: g.mem.map(r => r.v[u]), y: g.mem.map(r => r.v[v]), text: g.mem.map(lbl), marker: { size: 8, color: L.COLORS[i % 6], opacity: .8 }, hovertemplate: '%{text}<br>x %{x:.3g}<br>y %{y:.3g}<extra></extra>' })),
      { xaxis: { type: 'log', title: SHORTN[u] + ' (' + IMP[u].sym + ')' }, yaxis: { type: 'log', title: SHORTN[v] + ' (' + IMP[v].sym + ')' }, legend: { orientation: 'h', y: -0.28 }, margin: { b: 100 } });
    L._lastCluster = { rows, sel, k, labels: m.lab, scores, groups };
  }
  L.tabs.cluster = { build, built: false };
})();
