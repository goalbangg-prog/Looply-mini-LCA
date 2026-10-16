/* 탭 전환: 처음 열 때 한 번만 화면을 만든다 (숨겨진 탭에서 차트를 그리면 크기가 0이 되기 때문) */
(function () {
  const names = ['report', 'calc', 'explore', 'cluster'];
  function show(name) {
    if (!names.includes(name)) name = 'report';
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    names.forEach(n => L.$(n).classList.toggle('hidden', n !== name));
    const t = L.tabs[name];
    try { if (!t.built) { t.build(); t.built = true; } else L.resizeAll(L.$(name)); }
    catch (e) { L.$(name).innerHTML = '<div class="panel"><div class="empty">화면을 만드는 중 오류가 발생했습니다: ' + L.esc(e.message) + '</div></div>'; console.error(e); }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); show(b.dataset.tab); }));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  L.$('badge').textContent = `환경성적표지 평가계수(2021) · ${L.D.length}개 항목`;
  show(location.hash.slice(1));
})();
