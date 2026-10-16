/* 환경영향 계산 탭 */
(function () {
  const { $, esc, fmt, IMP, D, lbl } = L;
  const UNIT_OPTS = { kg: { g: .001, kg: 1, ton: 1000 }, L: { mL: .001, L: 1, m3: 1000 }, m3: { L: .001, m3: 1, mL: 1e-6 }, MJ: { MJ: 1, kWh: 3.6 }, kWh: { kWh: 1, MJ: 1 / 3.6 }, 'ton.km': { 'ton.km': 1, 'kg.km': .001 } };
  const unitsOf = row => Object.keys(UNIT_OPTS[row.unit] || { [row.unit]: 1 });
  const toBase = (row, u, amt) => amt * ((UNIT_OPTS[row.unit] || { [row.unit]: 1 })[u] ?? 1);
  let basket = [], uid = 1, cur = null;

  const topLabel = p => (p >= 50 ? `상위 ${Math.max(1, Math.round(100 - p))}%` : `하위 ${Math.max(1, Math.round(p))}%`);

  function build() {
    $('calc').innerHTML = `
    <div class="panel"><span class="eyebrow">STEP 1</span><h3>무엇을 계산할까요?</h3>
      <p class="hint" style="margin:-4px 0 14px">이름을 검색하거나, 대분류 → 구분 → 항목 순서로 고르세요.</p>
      <label for="search">이름으로 찾기</label>
      <input id="search" type="search" placeholder="예: 시멘트, 알루미늄, 경유, 매립" autocomplete="off">
      <p class="hint" id="searchInfo" aria-live="polite"></p>
      <div class="steps" style="margin-top:14px">
        <div><label for="stage">① 대분류</label><select id="stage"></select></div>
        <div><label for="category">② 구분</label><select id="category"></select></div>
        <div><label for="material">③ 항목</label><select id="material"></select></div>
      </div>
      <div class="preview" id="preview"></div>
      <div class="row" style="margin-top:18px"><div style="width:180px"><label for="amount">사용량</label><input id="amount" type="number" min="0" step="any" value="1"></div>
        <div style="width:150px"><label for="unit">단위</label><select id="unit"></select></div>
        <button class="btn" id="add">+ 계산 목록에 담기</button><button class="btn sub" id="example">예시 담아 보기</button></div>
    </div>
    <div class="panel"><span class="eyebrow">STEP 2</span><h3>계산 목록</h3><div id="basket"></div></div>
    <div class="panel"><span class="eyebrow">STEP 3</span><h3>환경영향 결과</h3><div id="results"></div></div>`;
    $('stage').onchange = () => { refreshCategories(); };
    $('search').oninput = () => { refreshCategories(); };
    $('category').onchange = refreshMaterials; $('material').onchange = refreshPreview;
    $('add').onclick = add; $('example').onclick = example;
    L.opts($('stage'), L.STAGES, x => x, x => `${x} (${D.filter(r => r.stage === x).length}개)`);
    refreshCategories(); renderBasket();
  }

  const pool = () => {
    const st = $('stage').value, q = $('search').value.trim().toLowerCase();
    return D.filter(r => r.stage === st && (!q || (r.name + ' ' + r.category).toLowerCase().includes(q)));
  };
  function refreshCategories() {
    const rows = pool(), q = $('search').value.trim();
    const cats = [...new Set(rows.map(r => r.category))];
    L.opts($('category'), cats, x => x, x => `${x} (${rows.filter(r => r.category === x).length}개)`, true);
    if (q) {
      const other = D.filter(r => r.stage !== $('stage').value && (r.name + ' ' + r.category).toLowerCase().includes(q.toLowerCase())).length;
      $('searchInfo').innerHTML = rows.length ? `이 대분류에서 <b>${rows.length}개</b>를 찾았어요.${other ? ` 다른 대분류에도 ${other}개 있어요.` : ''}` : `이 대분류에는 없어요.${other ? ` 다른 대분류에 ${other}개 있으니 ① 대분류를 바꿔 보세요.` : ' 다른 이름으로 검색해 보세요.'}`;
    } else $('searchInfo').textContent = '';
    refreshMaterials();
  }
  function refreshMaterials() {
    const rows = pool().filter(r => r.category === $('category').value);
    L.opts($('material'), rows, r => r.id, r => `${r.name} (${r.unit} 기준)`);
    refreshPreview();
  }

  // 선택한 항목의 계수와, 비슷한 항목들 사이에서의 위치
  function refreshPreview() {
    cur = $('material').value === '' ? null : (D[+$('material').value] || null); const box = $('preview');
    $('add').disabled = !cur;
    if (!cur) { box.innerHTML = '<span class="muted">조건에 맞는 항목이 없어요. 검색어를 바꾸거나 지워 보세요.</span>'; L.opts($('unit'), [], x => x, x => x); return; }
    L.opts($('unit'), unitsOf(cur), x => x, x => x); $('unit').value = cur.unit;
    const same = D.filter(r => r.stage === cur.stage && r.unit === cur.unit && (r.stage !== '원료 및 에너지 생산' || r.category !== '수자원'));
    box.innerHTML = `<b>${esc(lbl(cur))}</b> <span class="muted">· 1 ${esc(cur.unit)}를 쓸 때의 계수</span>` + IMP.map((im, j) => {
      const v = cur.v[j], refv = same.filter(r => r.v[j] != null).map(r => r.v[j]);
      if (v == null) return `<div class="prev-row"><span>${im.name}</span><span class="muted">자료 없음</span><span class="muted">이 항목은 ${im.name} 값이 비어 있어요</span><span></span></div>`;
      if (refv.length < 10) return `<div class="prev-row"><span>${im.name}</span><span><b>${fmt(v)}</b></span><span class="muted">${im.sym} / ${esc(cur.unit)} · 비교할 항목이 ${refv.length}개뿐이라 위치는 생략했어요</span><span></span></div>`;
      const p = S.percentile(refv, v);
      return `<div class="prev-row"><span>${im.name}</span><span><b>${fmt(v)}</b></span><span><div class="bar" aria-hidden="true"><i style="width:${p.toFixed(0)}%"></i></div></span><span><b>${topLabel(p)}</b> <small class="muted">/${refv.length}개</small></span></div>`;
    }).join('') + `<p class="hint">막대가 길수록 같은 단계·같은 단위(${esc(cur.unit)}) 항목 중 값이 큰 편이에요. 용도가 다른 항목끼리의 우열은 아니에요.</p>`;
  }

  function add() {
    if (!cur) return; const amt = parseFloat($('amount').value);
    if (!(amt > 0)) { $('amount').focus(); $('amount').setCustomValidity('0보다 큰 숫자를 넣어 주세요'); $('amount').reportValidity(); $('amount').setCustomValidity(''); return; }
    basket.push({ uid: uid++, id: cur.id, amount: amt, unit: $('unit').value });
    renderBasket();
  }
  function example() {
    const find = n => D.find(r => r.name === n);
    const ex = [['1종 포틀랜드 시멘트', 1000, 'kg'], ['알루미늄 판', 200, 'kg'], ['고밀도 폴리에틸렌', 50, 'kg'], ['생활폐기물 위생매립', 100, 'kg']];
    const bct = D.find(r => r.stage === '수송' && r.category === '육상수송'); if (bct) ex.push([bct.name, 5, 'ton.km']);
    basket = []; for (const [n, a, u] of ex) { const r = n === (bct && bct.name) ? bct : find(n); if (r) basket.push({ uid: uid++, id: r.id, amount: a, unit: u }); }
    renderBasket();
  }

  function calc() {
    return basket.map(b => { const row = D[b.id], qty = toBase(row, b.unit, b.amount); return { b, row, qty, v: row.v.map(x => (x == null ? null : x * qty)) }; });
  }
  function renderBasket() {
    const res = calc();
    $('basket').innerHTML = res.length ? res.map(({ b, row }, i) => `<div class="item"><div><b>${i + 1}. ${esc(lbl(row))}</b><small>${esc(row.stage)} › ${esc(row.category)} · 계수 기준 ${esc(row.unit)}</small></div>
      <input type="number" min="0" step="any" value="${b.amount}" data-amt="${b.uid}" aria-label="사용량"><select data-unit="${b.uid}" aria-label="단위">${unitsOf(row).map(u => `<option${u === b.unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select><button class="btn sub" data-del="${b.uid}">삭제</button></div>`).join('')
      + `<div class="row" style="margin-top:14px"><button class="btn sub" id="clear">모두 비우기</button></div>`
      : '<div class="empty">아직 담은 항목이 없어요. 위에서 항목을 고르고 "계산 목록에 담기"를 눌러 보세요.</div>';
    $('basket').querySelectorAll('[data-amt]').forEach(el => el.onchange = () => { const b = basket.find(x => x.uid === +el.dataset.amt); const v = parseFloat(el.value); if (b && v > 0) { b.amount = v; renderResults(); } else el.value = b.amount; });
    $('basket').querySelectorAll('[data-unit]').forEach(el => el.onchange = () => { const b = basket.find(x => x.uid === +el.dataset.unit); if (b) { b.unit = el.value; renderResults(); } });
    $('basket').querySelectorAll('[data-del]').forEach(el => el.onclick = () => { basket = basket.filter(x => x.uid !== +el.dataset.del); renderBasket(); });
    if ($('clear')) $('clear').onclick = () => { basket = []; renderBasket(); };
    renderResults();
  }

  let impactSel = 0;
  function renderResults() {
    const res = calc(), box = $('results');
    if (!res.length) { box.innerHTML = '<div class="empty">계산 목록이 비어 있어요.</div>'; return; }
    const tot = IMP.map((_, j) => { const have = res.filter(x => x.v[j] != null); return { sum: have.reduce((s, x) => s + x.v[j], 0), n: have.length, all: res.length }; });
    box.innerHTML = `<div class="metrics">${IMP.map((im, j) => {
      const t = tot[j];
      if (!t.n) return `<div class="metric na"><span>${im.name}</span><strong>자료 없음</strong><small>선택한 항목 모두 값이 비어 있어요</small></div>`;
      return `<div class="metric"><span>${im.name}${t.n < t.all ? '<em class="part">일부만</em>' : ''}</span><strong>${fmt(t.sum)}</strong><small>${im.sym}${t.n < t.all ? ` · ${t.all}건 중 ${t.n}건만 반영` : ''}</small></div>`;
    }).join('')}</div>
    ${tot.some(t => t.n && t.n < t.all) ? '<div class="caution">"일부만"이 붙은 영향은 값이 비어 있는 항목을 합계에서 뺀 숫자예요. 실제보다 작을 수 있어요.</div>' : ''}
    <div class="row" style="margin-top:22px;align-items:center"><h3 style="margin:0">어떤 항목의 비중이 클까요?</h3><div style="width:220px"><select id="impSel" aria-label="영향 선택">${IMP.map((im, j) => `<option value="${j}"${j === impactSel ? ' selected' : ''}>${im.name}</option>`).join('')}</select></div></div>
    <div id="bars" style="margin-top:12px"></div>
    <div class="row" style="margin:22px 0 8px;justify-content:space-between;align-items:center"><h3 style="margin:0">계산 상세</h3><button class="btn" id="export">결과를 CSV로 저장</button></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>항목</th><th class="num">환산량</th>${IMP.map(im => `<th class="num">${im.name}<br><small>${im.sym}</small></th>`).join('')}</tr></thead><tbody>${res.map(x => `<tr><td>${esc(lbl(x.row))}</td><td class="num">${fmt(x.qty)} ${esc(x.row.unit)}</td>${x.v.map(v => `<td class="num${v == null ? ' muted' : ''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('impSel').onchange = () => { impactSel = +$('impSel').value; drawBars(res); };
    $('export').onclick = () => exportCsv(res, tot);
    drawBars(res);
  }
  function drawBars(res) {
    const j = impactSel, have = res.filter(x => x.v[j] != null && x.v[j] > 0), sum = have.reduce((s, x) => s + x.v[j], 0);
    $('bars').innerHTML = have.length ? have.sort((a, b) => b.v[j] - a.v[j]).map(x => { const p = x.v[j] / sum * 100; return `<div class="hbar"><span>${esc(lbl(x.row))}</span><div class="bar"><i style="width:${p.toFixed(1)}%"></i></div><span class="num"><b>${p < 0.05 ? '0.1% 미만' : p.toFixed(p < 10 ? 1 : 0) + '%'}</b></span></div>`; }).join('') + `<p class="hint">값이 있는 ${have.length}건 기준 비중이에요${have.length < res.length ? ` (${res.length - have.length}건은 자료 없음).` : '.'}</p>` : '<p class="muted">이 영향은 선택한 항목에 값이 없어요.</p>';
  }
  function exportCsv(res, tot) {
    const cell = v => { let s = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const num = v => (v == null ? null : Number(v.toPrecision(8)));
    const lines = [['대분류', '구분', '항목', '입력량', '입력단위', '환산량', '계수기준단위', ...IMP.map(i => `${i.name} (${i.sym})`)]];
    for (const x of res) lines.push([x.row.stage, x.row.category, x.row.name, x.b.amount, x.b.unit, num(x.qty), x.row.unit, ...x.v.map(num)]);
    lines.push(['합계(값이 있는 항목만)', '', '', '', '', '', '', ...tot.map(t => (t.n ? num(t.sum) : '자료 없음'))]);
    lines.push(['반영된 항목 수', '', '', '', '', '', '', ...tot.map(t => `${t.n}/${t.all}`)]);
    const csv = '﻿' + lines.map(r => r.map(cell).join(',')).join('\r\n'), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'looply_result.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  L.tabs.calc = { build, built: false };
  L._calc = { toBase, unitsOf, get basket() { return basket; }, set basket(v) { basket = v; } };
})();
