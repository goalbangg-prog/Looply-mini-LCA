/* 공통: 데이터 준비, 표시 도구 */
(function (g) {
  const L = {};
  L.D = window.LCA_DATA; L.RES = window.LCA_RESULTS;
  // v 배열의 순서와 같다
  L.IMP = [
    { k: '탄소', name: '탄소발자국', sym: 'kg CO₂ eq', plain: '온실가스 배출' },
    { k: '자원', name: '자원발자국', sym: 'kg Sb eq', plain: '광물·자원 사용' },
    { k: '산성', name: '산성화(산성비)', sym: 'kg SO₂ eq', plain: '산성비를 만드는 물질' },
    { k: '부영', name: '부영양화', sym: 'kg PO₄³⁻ eq', plain: '물속 영양분 과다(녹조 등)' },
    { k: '물', name: '물소모', sym: 'm³ H₂O eq', plain: '물 사용량' },
    { k: '스모그', name: '광화학스모그', sym: 'kg C₂H₄ eq', plain: '스모그를 만드는 물질' },
    { k: '오존', name: '오존층영향', sym: 'kg CFC-11 eq', plain: '오존층을 얇게 만드는 물질' }
  ];
  L.STAGES = ['원료 및 에너지 생산', '연료원별 사용', '화학반응공정', '폐기물 처리', '수송'];
  L.COLORS = ['#1f6f8b', '#e08a3c', '#4f9a6b', '#8a5fb3', '#c4504a', '#6b7a90'];
  L.$ = id => document.getElementById(id);
  L.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  // 숫자를 읽기 쉽게: 보통 범위는 유효숫자 3자리, 아주 작거나 큰 값은 ×10ⁿ
  L.fmt = v => {
    if (v == null || Number.isNaN(v)) return '자료 없음';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 100 && a < 100000) return Math.round(v).toLocaleString('ko-KR');
    if (a >= 0.01 && a < 100) return String(Number(v.toPrecision(3)));
    const [m, e] = v.toExponential(2).split('e'); return m + '×10' + String(+e).split('').map(c => SUP[c] || c).join('');
  };
  L.pct = v => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + '%';
  L.lbl = r => (r.stage === '원료 및 에너지 생산' ? r.name : r.category + ' · ' + r.name);
  L.POOL = L.D.filter(r => r.stage === '원료 및 에너지 생산' && r.unit === 'kg' && r.category !== '수자원');
  L.col = (rows, j) => rows.filter(r => r.v[j] != null && r.v[j] > 0);
  L.coverage = (rows, j) => rows.length ? rows.filter(r => r.v[j] != null).length / rows.length : 0;
  L.has = (rows, j) => rows.filter(r => r.v[j] != null);

  // 차트: Plotly 가 없으면(CDN 차단 등) 안내 문구를 보여 준다
  L.plot = (id, traces, layout, extra) => {
    const el = L.$(id); if (!el) return;
    if (!window.Plotly) { el.innerHTML = '<p class="muted center pad">차트 라이브러리(Plotly)를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>'; return; }
    const base = {
      font: { family: 'Pretendard, "Noto Sans KR", Inter, sans-serif', size: 13, color: '#243247' },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 70, r: 20, t: 20, b: 60 }, hoverlabel: { font: { size: 13 } }
    };
    const lay = Object.assign({}, base, layout || {});
    lay.margin = Object.assign({}, base.margin, (layout || {}).margin || {});
    Plotly.newPlot(el, traces, lay, Object.assign({ displayModeBar: false, responsive: true }, extra || {}));
  };
  L.resizeAll = root => { if (!window.Plotly) return; (root || document).querySelectorAll('.js-plotly-plot').forEach(el => { try { Plotly.Plots.resize(el); } catch (e) { } }); };
  L.opts = (sel, list, valueFn, textFn, keep) => {
    const prev = keep ? sel.value : null;
    sel.innerHTML = list.map(x => `<option value="${L.esc(valueFn(x))}">${L.esc(textFn(x))}</option>`).join('');
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  };
  // 무리 이름: 숫자(전체 중앙값 대비 배수)에서 바로 만든다. ratios=[영향별 배수], names=[영향 이름]
  L.fx = v => (v >= 10 ? Math.round(v) : v.toFixed(v < 1 ? 2 : 1)) + '배';
  L.clusterTitle = (ratios, names) => {
    const o = ratios.map((v, i) => ({ n: names[i], v })).sort((a, b) => b.v - a.v);
    if (o[0].v < 1) return { title: '전반적으로 작은 무리', line: '모든 영향이 전체 중앙값보다 작은 편이에요.' };
    const big = o.filter(x => x.v >= 5);
    if (big.length) return { title: big.slice(0, 2).map(x => x.n).join('·') + ' 쪽이 유난히 큰 무리', line: '전체 중앙값보다 ' + o.slice(0, 2).map(x => `<b>${x.n} ${L.fx(x.v)}</b>`).join(', ') + ' 커요.' };
    if (o[0].v >= 2) return { title: '일부 영향이 큰 무리', line: '전체 중앙값보다 ' + o.slice(0, 2).map(x => `<b>${x.n} ${L.fx(x.v)}</b>`).join(', ') + ' 커요.' };
    return { title: '중간 무리', line: `전체 중앙값과 비슷한 수준이에요(가장 큰 차이: ${o[0].n} ${L.fx(o[0].v)}).` };
  };
  // 큰 배수를 읽기 쉽게 (예: 244000 -> 약 24만 배)
  L.times = v => (v >= 1e4 ? `약 ${v >= 1e5 ? Math.round(v / 1e4) : (v / 1e4).toFixed(1)}만 배` : v >= 100 ? `약 ${Math.round(v)}배` : `약 ${v >= 10 ? Math.round(v) : v.toFixed(1)}배`);
  L.coverageOK = s => L.IMP.filter((_, j) => L.coverage(s.rows, j) >= .5).length;
  L.tabs = {}; // 탭 이름 -> 처음 열 때 실행할 함수
  g.L = L;
})(window);
