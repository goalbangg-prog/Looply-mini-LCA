/* 탭 전환: 처음 열 때 한 번만 화면을 만든다 (숨겨진 탭에서 차트를 그리면 크기가 0이 되기 때문) */
(function () {
  const names = ['report', 'calc', 'explore', 'cluster', 'notes'];
  // 스크롤 등장 효과: 보이는 영역에 들어올 때 한 번만 부드럽게 나타난다
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.01, rootMargin: '0px 0px -8px 0px' }) : null;
  L.reveal = root => {
    if (!io) return;
    root.querySelectorAll('.sec, .find, .sec .card, .sec .clu').forEach((el, i) => { if (el.classList.contains('rv')) return; el.style.setProperty('--d', (i % 3) * 0.07 + 's'); el.classList.add('rv'); io.observe(el); });
  };
  function show(name) {
    if (!names.includes(name)) name = 'report';
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    names.forEach(n => L.$(n).classList.toggle('hidden', n !== name));
    const t = L.tabs[name];
    try { if (!t.built) { t.build(); t.built = true; } else L.resizeAll(L.$(name)); }
    catch (e) { L.$(name).innerHTML = '<div class="panel"><div class="empty">화면을 만드는 중 오류가 발생했습니다: ' + L.esc(e.message) + '</div></div>'; console.error(e); }
    L.reveal(L.$(name)); window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); show(b.dataset.tab); }));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  L.$('badge').textContent = `환경성적표지 평가계수(2021) · ${L.D.length}개 항목`;
  show(location.hash.slice(1));
})();
