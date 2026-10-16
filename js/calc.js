/* 환경영향 계산 탭: 좌측 항목 선택 / 우측 계산 목록·결과 */
(function () {
  const { $, esc, fmt, IMP, D, POOL, lbl } = L;
  const UNIT_OPTS = { kg: { g: .001, kg: 1, ton: 1000 }, L: { mL: .001, L: 1, m3: 1000 }, m3: { L: .001, m3: 1, mL: 1e-6 }, MJ: { MJ: 1, kWh: 3.6 }, kWh: { kWh: 1, MJ: 1 / 3.6 }, 'ton.km': { 'ton.km': 1, 'kg.km': .001 } };
  const unitsOf = row => Object.keys(UNIT_OPTS[row.unit] || { [row.unit]: 1 });
  const toBase = (row, u, amt) => amt * ((UNIT_OPTS[row.unit] || { [row.unit]: 1 })[u] ?? 1);
  const KEY = 'looply.basket.v2';
  let basket = [], uid = 1, cur = null, baseline = null, impactSel = 0; const altSel = {}, altOpen = new Set();

  const load = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return a.filter(x => D[x.id] && x.amount > 0).map(x => ({ uid: uid++, id: x.id, amount: x.amount, unit: x.unit })); } catch (e) { return []; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(basket.map(b => ({ id: b.id, amount: b.amount, unit: b.unit })))); } catch (e) { } };
  const badge = () => { const b = document.querySelector('[data-tab="calc"]'); if (b) b.innerHTML = '환경영향 계산' + (basket.length ? `<span class="cnt">${basket.length}</span>` : ''); };
  basket = load(); badge();

  function build() {
    $('calc').innerHTML = `<div class="calc-grid">
    <aside class="panel sticky"><span class="eyebrow">01 / Selection</span><h3>평가계수 선택</h3>
      <label for="search">이름 검색</label>
      <input id="search" type="search" placeholder="예: 시멘트, 알루미늄, 경유, 매립" autocomplete="off">
      <p class="hint" id="searchInfo" aria-live="polite"></p>
      <div style="display:grid;gap:12px;margin-top:12px">
        <div><label for="stage">① 대분류</label><select id="stage"></select></div>
        <div><label for="category">② 구분</label><select id="category"></select></div>
        <div><label for="material">③ 항목</label><select id="material"></select></div>
      </div>
      <div class="preview" id="preview"></div>
      <div class="row" style="margin-top:16px"><div style="width:150px"><label for="amount">사용량</label><input id="amount" type="number" min="0" step="any" value="1"></div>
        <div style="width:100px"><label for="unit">단위</label><select id="unit"></select></div>
        <button class="btn" id="add" style="flex:1">계산 목록에 추가</button></div>
      <div id="toast" aria-live="polite"></div>
    </aside>
    <div>
      <section class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:6px"><div><span class="eyebrow">02 / Inventory</span><h3 style="margin:0">계산 목록</h3></div>
        <div class="row"><button class="btn sub sm" id="example">예시 구성 불러오기</button><button class="btn sub sm" id="clear">전체 삭제</button></div></div><div id="basket"></div></section>
      <section class="panel"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px"><div><span class="eyebrow">03 / Results</span><h3 style="margin:0">환경영향 산정 결과</h3></div><div class="row" id="baseBtns"></div></div><div id="results"></div></section>
    </div></div>`;
    $('stage').onchange = refreshCategories; $('search').oninput = refreshCategories;
    $('category').onchange = refreshMaterials; $('material').onchange = refreshPreview;
    $('add').onclick = add; $('example').onclick = example; $('clear').onclick = () => { basket = []; save(); renderBasket(); };
    $('amount').onkeydown = e => { if (e.key === 'Enter') add(); };
    L.opts($('stage'), L.STAGES, x => x, x => `${x} (${D.filter(r => r.stage === x).length})`);
    refreshCategories(); renderBasket();
  }

  const pool = () => { const st = $('stage').value, q = $('search').value.trim().toLowerCase(); return D.filter(r => r.stage === st && (!q || (r.name + ' ' + r.category).toLowerCase().includes(q))); };
  function refreshCategories() {
    const rows = pool(), q = $('search').value.trim(), cats = [...new Set(rows.map(r => r.category))];
    L.opts($('category'), cats, x => x, x => `${x} (${rows.filter(r => r.category === x).length})`, true);
    if (q) {
      const other = D.filter(r => r.stage !== $('stage').value && (r.name + ' ' + r.category).toLowerCase().includes(q.toLowerCase())).length;
      $('searchInfo').innerHTML = rows.length ? `현재 대분류에서 <b>${rows.length}건</b> 검색${other ? ` · 다른 대분류 ${other}건` : ''}` : `현재 대분류에는 해당 항목이 없습니다.${other ? ` 다른 대분류에 ${other}건이 있으니 ① 대분류를 바꿔 보세요.` : ''}`;
    } else $('searchInfo').textContent = '';
    refreshMaterials();
  }
  function refreshMaterials() {
    const rows = pool().filter(r => r.category === $('category').value);
    L.opts($('material'), rows, r => r.id, r => `${r.name} [${r.unit}]`, true);
    refreshPreview();
  }
  function refreshPreview() {
    cur = $('material').value === '' ? null : (D[+$('material').value] || null); const box = $('preview'); $('add').disabled = !cur;
    if (!cur) { box.innerHTML = '<span class="muted">조건에 맞는 항목이 없습니다. 검색어를 고치거나 지워 보세요.</span>'; L.opts($('unit'), [], x => x, x => x); return; }
    const keepUnit = $('unit').value; L.opts($('unit'), unitsOf(cur), x => x, x => x); $('unit').value = unitsOf(cur).includes(keepUnit) ? keepUnit : cur.unit;
    const same = D.filter(r => r.stage === cur.stage && r.unit === cur.unit && r.category !== '수자원');
    box.innerHTML = `<b>${esc(lbl(cur))}</b><div class="hint" style="margin:2px 0 8px">계수는 1 ${esc(cur.unit)}당 값이며, 오른쪽은 같은 대분류·같은 단위 항목 중 위치(백분위)입니다</div>` + IMP.map((im, j) => {
      const v = cur.v[j], refv = same.filter(r => r.v[j] != null).map(r => r.v[j]);
      const head = `<span>${im.name}<small class="muted" style="display:block;font-size:11px">${im.sym}</small></span>`;
      if (v == null) return `<div class="prev-row">${head}<span class="muted">결측</span><span></span><span></span></div>`;
      if (refv.length < 10) return `<div class="prev-row">${head}<b>${fmt(v)}</b><span class="muted" style="grid-column:3/5;font-size:12px">비교 대상 ${refv.length}건뿐이라 위치 생략</span></div>`;
      const p = S.percentile(refv, v);
      return `<div class="prev-row">${head}<b>${fmt(v)}</b><div class="bar" aria-hidden="true"><i style="width:${p.toFixed(0)}%"></i></div><span><b>${L.topLabel(p)}</b><small class="muted"> n=${refv.length}</small></span></div>`;
    }).join('');
  }

  function toast(msg) { const t = $('toast'); t.innerHTML = `<div class="toast">${msg}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => (t.innerHTML = ''), 3500); }
  function add() {
    if (!cur) return; const amt = parseFloat($('amount').value), unit = $('unit').value;
    if (!(amt > 0)) { $('amount').setCustomValidity('0보다 큰 값을 입력해 주세요'); $('amount').reportValidity(); $('amount').setCustomValidity(''); return; }
    const ex = basket.find(b => b.id === cur.id && b.unit === unit);
    if (ex) ex.amount += amt; else basket.push({ uid: uid++, id: cur.id, amount: amt, unit });
    save(); renderBasket();
    toast(`${ex ? '수량 합산' : '추가'}: <b>${esc(lbl(cur))}</b> ${ex ? ex.amount : amt} ${esc(unit)} · 계산 목록 ${basket.length}건`);
  }
  function example() {
    const find = (st, cat, n) => D.find(r => r.stage === st && r.category === cat && r.name === n);
    const ex = [[find('원료 및 에너지 생산', '건축자재', '1종 포틀랜드 시멘트'), 1000, 'kg'], [find('원료 및 에너지 생산', '금속', '알루미늄 판'), 200, 'kg'], [find('원료 및 에너지 생산', '플라스틱', '고밀도 폴리에틸렌'), 50, 'kg'], [find('폐기물 처리', '매립', '생활폐기물 위생매립'), 100, 'kg'], [D.find(r => r.stage === '수송' && r.category === '육상수송' && r.name === 'BCT'), 5, 'ton.km']];
    basket = []; for (const [r, a, u] of ex) if (r) basket.push({ uid: uid++, id: r.id, amount: a, unit: u });
    save(); renderBasket();
  }

  const calc = () => basket.map(b => { const row = D[b.id], qty = toBase(row, b.unit, b.amount); return { b, row, qty, v: row.v.map(x => (x == null ? null : x * qty)) }; });
  const totals = res => IMP.map((_, j) => { const have = res.filter(x => x.v[j] != null); return { sum: have.reduce((s, x) => s + x.v[j], 0), n: have.length, all: res.length }; });

  function renderBasket() {
    badge(); const res = calc();
    $('basket').innerHTML = res.length ? res.map(({ b, row }) => `<div class="item" data-u="${b.uid}"><div class="item-top"><div><b>${esc(lbl(row))}</b><small>${esc(row.stage)} › ${esc(row.category)} · 계수 기준 ${esc(row.unit)}</small></div>
      <input type="number" min="0" step="any" value="${b.amount}" data-amt="${b.uid}" aria-label="사용량"><select data-unit="${b.uid}" aria-label="단위">${unitsOf(row).map(u => `<option${u === b.unit ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>
      <div class="row" style="gap:6px"><button class="btn sub sm" data-alt="${b.uid}">${altOpen.has(b.uid) ? '대체 검토 닫기' : '대체 검토'}</button><button class="btn sub sm" data-del="${b.uid}">삭제</button></div></div>${altOpen.has(b.uid) ? `<div class="alt" id="alt${b.uid}"></div>` : ''}</div>`).join('')
      : '<div class="empty">계산 목록이 비어 있습니다. 왼쪽에서 항목을 골라 추가해 보세요.</div>';
    $('basket').querySelectorAll('[data-amt]').forEach(el => el.onchange = () => { const b = basket.find(x => x.uid === +el.dataset.amt), v = parseFloat(el.value); if (b && v > 0) { b.amount = v; save(); renderResults(); renderAlts(); } else if (b) el.value = b.amount; });
    $('basket').querySelectorAll('[data-unit]').forEach(el => el.onchange = () => { const b = basket.find(x => x.uid === +el.dataset.unit); if (b) { b.unit = el.value; save(); renderResults(); renderAlts(); } });
    $('basket').querySelectorAll('[data-del]').forEach(el => el.onclick = () => { basket = basket.filter(x => x.uid !== +el.dataset.del); altOpen.delete(+el.dataset.del); save(); renderBasket(); });
    $('basket').querySelectorAll('[data-alt]').forEach(el => el.onclick = () => { const u = +el.dataset.alt; altOpen.has(u) ? altOpen.delete(u) : altOpen.add(u); renderBasket(); });
    renderAlts(); renderResults();
  }

  // 대체 후보 검토: 같은 단계·같은 기준 단위의 다른 항목으로 바꿨을 때(동일 수량) 영향범주별 변화율
  function renderAlts() {
    for (const u of altOpen) {
      const box = $('alt' + u), b = basket.find(x => x.uid === u); if (!box || !b) continue;
      const row = D[b.id], cands = D.filter(r => r.id !== row.id && r.stage === row.stage && r.unit === row.unit && r.v[0] != null && r.category !== '수자원');
      const groups = [...new Set(cands.map(r => r.category))].sort((a, c) => (a === row.category ? -1 : c === row.category ? 1 : a.localeCompare(c)));
      const sel = altSel[u], alt = sel != null ? D[sel] : null;
      let tbl = '';
      if (alt) {
        const qty = toBase(row, b.unit, b.amount);
        tbl = `<table class="tbl" style="margin-top:10px"><thead><tr><th>영향범주</th><th class="num">현재</th><th class="num">대체</th><th class="num">변화율</th></tr></thead><tbody>${IMP.map((im, j) => {
          const a = row.v[j], c = alt.v[j]; if (a == null || c == null) return `<tr><td>${im.name}</td><td class="num muted">${a == null ? '결측' : fmt(a * qty)}</td><td class="num muted">${c == null ? '결측' : fmt(c * qty)}</td><td class="num muted">비교 불가</td></tr>`;
          const d = (c - a) / a * 100;
          return `<tr><td>${im.name} <small class="muted">${im.sym}</small></td><td class="num">${fmt(a * qty)}</td><td class="num">${fmt(c * qty)}</td><td class="num"><span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d) >= 1000 ? Math.round(Math.abs(d)).toLocaleString('ko-KR') : Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}%</span></td></tr>`;
        }).join('')}</tbody></table><div class="row" style="margin-top:10px"><button class="btn sm" data-apply="${u}">대체 후보로 교체</button></div><p class="hint">같은 수량·같은 단위로 바꿨을 때의 단순 비교입니다. 성능·수명 같은 기능 차이는 반영하지 않습니다.</p>`;
      }
      box.innerHTML = `<label for="altsel${u}">대체 후보 (${esc(row.stage)} · ${esc(row.unit)} 기준, 같은 구분이 먼저 나옵니다)</label><select id="altsel${u}"><option value="">선택하세요</option>${groups.map(g => `<optgroup label="${esc(g)}">${cands.filter(r => r.category === g).sort((a, c) => a.v[0] - c.v[0]).map(r => `<option value="${r.id}"${sel === r.id ? ' selected' : ''}>${esc(r.stage === '원료 및 에너지 생산' ? r.name : r.category + ' · ' + r.name)} (탄소 ${fmt(r.v[0])})</option>`).join('')}</optgroup>`).join('')}</select>${tbl}`;
      $('altsel' + u).onchange = e => { altSel[u] = e.target.value === '' ? null : +e.target.value; renderAlts(); };
      const ap = box.querySelector('[data-apply]'); if (ap) ap.onclick = () => { b.id = alt.id; b.unit = alt.unit === row.unit ? b.unit : alt.unit; altSel[u] = null; save(); renderBasket(); };
    }
  }

  function renderResults() {
    const res = calc(), box = $('results');
    $('baseBtns').innerHTML = res.length ? (baseline ? '<button class="btn sub sm" id="baseClear">기준안 해제</button>' : '<button class="btn sub sm" id="baseSet">현재 구성을 기준안으로 저장</button>') : '';
    if ($('baseSet')) $('baseSet').onclick = () => { baseline = { tot: totals(calc()).map(t => (t.n ? t.sum : null)), n: basket.length }; renderResults(); };
    if ($('baseClear')) $('baseClear').onclick = () => { baseline = null; renderResults(); };
    if (!res.length) { box.innerHTML = '<div class="empty">계산 목록이 비어 있습니다.</div>'; return; }
    const tot = totals(res);
    const dlt = j => { if (!baseline || baseline.tot[j] == null || !tot[j].n) return ''; const d = (tot[j].sum - baseline.tot[j]) / baseline.tot[j] * 100; if (Math.abs(d) < 0.05) return '<span class="delta muted">기준안 대비 변화 없음</span>'; return `<span class="delta ${d > 0 ? 'up' : 'down'}">기준안 대비 ${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}%</span>`; };
    const partial = tot.some(t => t.n && t.n < t.all);
    // 규모 환산
    const eqCard = (list, total, part) => list.map(e => `<div class="eqc"><span>${e.label}</span><b>${fmt(total / e.per)}<small style="display:inline;font-size:14px;color:var(--muted);margin-left:4px">${e.unit}</small></b><small>${esc(e.basis)}</small></div>`).join('');
    const eq = (tot[0].n ? `<h4 style="margin:0 0 8px">탄소발자국 ${fmt(tot[0].sum)} kg CO₂ eq는 이런 규모입니다${tot[0].n < tot[0].all ? ' (결측 제외 부분합계 기준)' : ''}</h4><div class="eq">${eqCard(L.EQ.carbon, tot[0].sum)}</div>` : '')
      + (tot[4].n ? `<h4 style="margin:18px 0 8px">물소모 ${fmt(tot[4].sum)} m³ H₂O eq는 이런 규모입니다${tot[4].n < tot[4].all ? ' (결측 제외 부분합계 기준)' : ''}</h4><div class="eq">${eqCard(L.EQ.water, tot[4].sum)}</div>` : '');
    // 원료 분포 내 위치 (모든 항목이 원료 단계 kg 기준일 때)
    let lvl = '';
    if (res.every(x => x.row.stage === '원료 및 에너지 생산' && x.row.unit === 'kg')) {
      const mass = res.reduce((s, x) => s + x.qty, 0);
      const rows = [0, 1, 2, 3, 4, 5].map(j => { if (tot[j].n < tot[j].all) return null; const v = tot[j].sum / mass, ref = L.col(POOL, j).map(r => r.v[j]); if (!(v > 0) || ref.length < 10) return null; return { j, v, p: S.percentile(ref, v), mid: S.median(ref) }; }).filter(Boolean);
      if (rows.length) lvl = `<h4 style="margin:18px 0 6px">원료 ${POOL.length}종과 비교한 위치(백분위) <small class="muted">· 혼합물 ${fmt(mass)} kg의 kg당 환산값 기준</small></h4><table class="tbl"><thead><tr><th>영향범주</th><th class="num">kg당 값</th><th class="num">원료 중앙값 대비</th><th>전체 중 위치</th></tr></thead><tbody>${rows.map(r => `<tr><td>${IMP[r.j].name}</td><td class="num">${fmt(r.v)}</td><td class="num">${L.fx(r.v / r.mid)}</td><td style="width:36%"><div class="bar"><i style="width:${r.p.toFixed(0)}%"></i></div></td><td>${L.topLabel(r.p)}</td></tr>`).join('')}</tbody></table><p class="hint">백분위는 ‘전체 원료 중 어디쯤인가’를 뜻합니다(예: 상위 10% = 계수가 큰 쪽 10% 안). 질량으로 가중평균한 kg당 값을 사용했고, 모든 항목의 값이 있는 범주만 표시합니다.</p>`;
    }
    box.innerHTML = `<div class="metrics">${IMP.map((im, j) => {
      const t = tot[j];
      if (!t.n) return `<div class="metric na"><span>${im.name}</span><strong>결측</strong><small>선택한 항목 모두 값이 비어 있음</small></div>`;
      return `<div class="metric"><span>${im.name}${t.n < t.all ? '<em class="part" title="결측 항목이 합계에서 제외됨">부분합계</em>' : ''}</span><strong>${fmt(t.sum)}<em class="u">${im.sym}</em></strong><small>${t.n < t.all ? `${t.all}건 중 ${t.n}건 반영` : `${t.all}건 모두 반영`}</small>${dlt(j)}</div>`;
    }).join('')}</div>
    ${partial ? '<div class="caution">‘부분합계’ 범주는 값이 비어 있는(결측) 항목이 합계에서 빠져 있어 실제보다 작게 계산될 수 있습니다. 결측을 0으로 바꾸어 넣지는 않았습니다.</div>' : ''}
    ${baseline ? `<p class="hint">기준안은 저장한 시점의 ${baseline.n}건 구성입니다. 수량이나 항목을 바꾸면 기준안 대비 변화율이 바로 갱신됩니다.</p>` : ''}
    <h4 style="margin:24px 0 8px">일상 속 규모로 환산하면</h4>${eq}<p class="hint">${esc(L.EQ_NOTE)} <a href="#notes" data-go="notes">방법·출처 보기</a></p>${lvl}
    <div class="row" style="margin:24px 0 8px;align-items:center"><h4 style="margin:0">기여도 분석 <small class="muted" style="font-weight:500">(어느 항목이 결과를 좌우하는가, hotspot)</small></h4><div style="width:200px"><select id="impSel" aria-label="영향범주 선택">${IMP.map((im, j) => `<option value="${j}"${j === impactSel ? ' selected' : ''}>${im.name}</option>`).join('')}</select></div></div>
    <div id="bars"></div>
    <div class="row" style="margin:24px 0 8px;justify-content:space-between;align-items:center"><h4 style="margin:0">항목별 산정 상세</h4><button class="btn sm" id="export">CSV 저장</button></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>항목</th><th class="num">환산량</th>${IMP.map(im => `<th class="num">${im.name}<br><small>${im.sym}</small></th>`).join('')}</tr></thead><tbody>${res.map(x => `<tr><td>${esc(lbl(x.row))}</td><td class="num">${fmt(x.qty)} ${esc(x.row.unit)}</td>${x.v.map(v => `<td class="num${v == null ? ' muted' : ''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('impSel').onchange = () => { impactSel = +$('impSel').value; drawBars(res); };
    $('export').onclick = () => exportCsv(res, tot); drawBars(res);
  }
  function drawBars(res) {
    const j = impactSel, have = res.filter(x => x.v[j] != null && x.v[j] > 0), sum = have.reduce((s, x) => s + x.v[j], 0);
    if (!have.length) { $('bars').innerHTML = '<p class="muted">선택한 영향범주는 계산 목록 전체가 결측이라 기여도를 계산할 수 없습니다.</p>'; return; }
    const sorted = [...have].sort((a, b) => b.v[j] - a.v[j]), top = sorted[0], tp = top.v[j] / sum * 100;
    $('bars').innerHTML = (have.length > 1 ? `<p style="margin:0 0 8px"><b>${IMP[j].name}</b>의 <b>${tp.toFixed(0)}%</b>가 <b>${esc(lbl(top.row))}</b>에서 발생합니다(기여도 1위).</p>` : '') + sorted.map(x => { const p = x.v[j] / sum * 100; return `<div class="hbar"><span>${esc(lbl(x.row))}</span><div class="bar"><i style="width:${p.toFixed(1)}%"></i></div><span class="num"><b>${p < 0.05 ? '0.1% 미만' : p.toFixed(p < 10 ? 1 : 0) + '%'}</b></span></div>`; }).join('') + `<p class="hint">값이 있는 ${have.length}건 기준${have.length < res.length ? ` · ${res.length - have.length}건은 결측이라 제외` : ''}</p>`;
  }
  function exportCsv(res, tot) {
    const cell = v => { let s = v == null ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const num = v => (v == null ? null : Number(v.toPrecision(8)));
    const lines = [['대분류', '구분', '항목', '입력량', '입력단위', '환산량', '계수기준단위', ...IMP.map(i => `${i.name} (${i.sym})`)]];
    for (const x of res) lines.push([x.row.stage, x.row.category, x.row.name, x.b.amount, x.b.unit, num(x.qty), x.row.unit, ...x.v.map(num)]);
    lines.push(['합계(값이 있는 항목만)', '', '', '', '', '', '', ...tot.map(t => (t.n ? num(t.sum) : '결측'))]);
    lines.push(['반영 항목 수', '', '', '', '', '', '', ...tot.map(t => `${t.n}/${t.all}`)]);
    const csv = '﻿' + lines.map(r => r.map(cell).join(',')).join('\r\n'), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'looply_result.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  L.tabs.calc = { build, built: false };
  L._calc = { toBase, unitsOf, get basket() { return basket; } };
})();
