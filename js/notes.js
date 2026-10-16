/* 방법·출처 탭: 분석 방법 설명, 환산 기준 출처, 기술 스택, 한계를 한곳에 모은다 */
(function () {
  const { $, esc, D, POOL, RES } = L;
  const METHODS = [
    ['결측치 처리', '값이 비어 있는 데이터를 어떻게 다루는지에 관한 규칙', '“해당없음”은 0이 아니라 결측으로 두었고, 합계에서는 값이 있는 항목만 더한 뒤 ‘5건 중 4건 반영’처럼 표시했습니다.'],
    ['로그 변환(log₁₀)', '값을 10배씩 커지는 눈금으로 바꾸는 변환', '계수가 수십만 배까지 차이 나서, 그대로 두면 큰 값 몇 개가 그래프와 군집 분석을 지배합니다. 그래프의 “로그 눈금”도 같은 뜻입니다.'],
    ['표준화(z-score)', '평균을 0, 흩어진 정도(표준편차)를 1로 맞추는 변환', '단위가 다른 영향범주를 같은 기준에서 비교하려고 군집 분석 직전에 적용했습니다.'],
    ['중앙값과 분위수(P10·P90)', '순서대로 세웠을 때 한가운데 값, 그리고 하위 10%·상위 10% 경계 값', '분포가 한쪽으로 크게 치우쳐 있어 평균 대신 사용했습니다.'],
    ['백분위', '전체 항목 중 내 순위가 어느 정도 위치인지를 0~100으로 나타낸 값', '“상위 10%” 같은 표시에 사용했습니다. 계수의 절대 크기가 아니라 순위 정보입니다.'],
    ['히스토그램', '값을 구간으로 나누고 구간마다 항목이 몇 개인지 막대로 보여 주는 분포도', '계수 분포가 어느 구간에 몰려 있는지 확인할 때 사용했습니다.'],
    ['박스플롯', '상자 모양으로 값의 퍼진 정도를 보여 주는 그래프(상자는 가운데 50% 범위, 상자 속 선은 중앙값, 점은 개별 항목)', '구분별·처리방식별 계수 차이를 비교할 때 사용했습니다.'],
    ['산점도', '두 값을 가로·세로 축에 놓고 항목마다 점 하나로 찍은 그래프', '두 영향범주가 함께 움직이는지 확인했습니다.'],
    ['히트맵', '숫자의 크기를 색의 진하기로 나타낸 표', '값이 있는 비율, 순위상관, 군집별 중앙값 배수를 표현했습니다.'],
    ['레이더 차트', '여러 지표를 거미줄 모양으로 한 번에 보여 주는 그래프', '한 항목이 어떤 영향범주에서 두드러지는지 백분위로 비교했습니다.'],
    ['Spearman 순위상관(ρ)', '두 지표에서 항목들의 순위가 얼마나 비슷한지를 −1~1로 나타낸 값. 1이면 순위가 완전히 같고 0이면 거의 무관', '값의 크기가 아니라 순위만 쓰기 때문에 극단값에 덜 흔들립니다. 상관이 곧 인과는 아닙니다.'],
    ['KMeans 군집 분석', '비슷한 값을 가진 항목끼리 k개의 무리(군집)로 자동 분류하는 방법', '시작점은 k-means++(서로 멀리 떨어진 점에서 시작해 결과를 안정시키는 방식)로 정하고, 10번 돌려 가장 좋은 결과를 택했습니다.'],
    ['실루엣 계수', '군집 안은 촘촘하고 군집끼리는 멀수록 커지는 지표(−1~1, 0.5 이상이면 뚜렷한 편)', '이번 결과는 약 0.33이라 경계가 흐린 편입니다.'],
    ['Davies–Bouldin 지수', '군집끼리 겹치는 정도를 나타내는 지표(작을수록 잘 분리됨)', 'k를 고르는 사전 기준의 마지막 단계에서 사용했습니다.'],
    ['ARI(조정 랜드 지수)', '두 군집 결과가 얼마나 같은지를 나타내는 지표(1이면 동일)', '시작점을 바꿔 다시 돌렸을 때의 안정성, 범주 구성을 바꿨을 때의 민감도, Python과 웹 구현의 일치 확인에 사용했습니다.'],
    ['부분합계', '값이 비어 있는 항목이 빠진 채 계산된 합계', '실제보다 작게 계산됐을 수 있어 계산기에서 별도로 표시했습니다.'],
    ['기여도 분석(hotspot)', '전체 결과에서 어떤 항목이 몇 %를 차지하는지 보는 분석', '계산 목록에서 결과를 좌우하는 항목을 찾는 용도입니다.'],
    ['Trade-off(상쇄 관계)', '한쪽 지표가 좋아지면 다른 쪽이 나빠지는 관계', '탄소는 낮지만 다른 영향범주가 높은 원료를 찾는 데 활용했습니다.']
  ];
  const STACK = [
    ['화면', 'HTML · CSS · JavaScript(빌드 과정 없음), Plotly.js 2.35.2(차트)'],
    ['통계 계산(브라우저)', '직접 구현한 stats.js: 순위상관, KMeans(k-means++), 실루엣, ARI. Python 결과와 대조 검증'],
    ['데이터 분석(Python)', 'pandas, NumPy, SciPy, scikit-learn, matplotlib, Jupyter Notebook'],
    ['배포', 'GitHub Pages(정적 호스팅, 서버 없음)'],
    ['검증', 'Playwright(헤드리스 브라우저)와 Node.js 단위 테스트(tests/stats.test.js)']
  ];
  function build() {
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length;
    $('notes').innerHTML = `
    <section class="sec" style="margin-top:0"><span class="eyebrow">Methods & Sources</span><h2>분석 방법과 <span class="hl">출처</span></h2>
      <p class="lead">이 페이지에는 사용한 데이터, 분석 방법(전문 용어와 쉬운 풀이), 생활 환산 기준의 출처, 기술 스택, 한계를 모아 두었습니다.</p>
      <nav class="toc" aria-label="이 페이지의 목차" style="margin-left:0"><a href="#n1" data-n="n1">데이터</a><a href="#n2" data-n="n2">분석 방법</a><a href="#n3" data-n="n3">환산 기준</a><a href="#n4" data-n="n4">기술 스택</a><a href="#n5" data-n="n5">한계</a><a href="#n6" data-n="n6">코드</a></nav>
      <div class="card" id="n1"><h3>1. 데이터와 정제</h3><ul>
        <li><b>출처:</b> 한국환경산업기술원 환경성적표지 평가계수(2021-08-02 기준), 총 ${D.length}건, 영향범주 7종.</li>
        <li><b>정제:</b> “해당없음”을 0이 아닌 결측으로 처리, 대분류·구분·항목·단위를 묶은 키의 중복 0건 확인, 0 이하의 값 0건 확인.</li>
        <li><b>분석 범위:</b> 서로 단위가 다른 항목은 섞지 않고, ‘원료 및 에너지 생산’ 단계 중 단위가 kg인 항목에서 수자원(상수·공업용수)을 제외한 ${POOL.length}건을 주 대상으로 삼았습니다(원료 단계 ${nStage}건 중).</li>
        <li><b>이용 조건:</b> 원자료의 재이용·재배포 조건은 별도로 확인해야 합니다.</li></ul></div>
      <div class="card" id="n2" style="margin-top:22px"><h3>2. 분석 방법 (전문 용어와 쉬운 풀이)</h3>
        <table class="mdl"><tbody>${METHODS.map(([t, d, u]) => `<tr><td><b>${esc(t)}</b>(${esc(d)})<br><span class="muted">▸ 이 프로젝트에서는 ${esc(u)}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="card" id="n3" style="margin-top:22px"><h3>3. 생활 환산 기준과 출처</h3>
        <p class="muted">계산기의 ‘일상 속 규모로 환산하면’에 쓰인 기준입니다. 가능한 한 최신 공개값을 사용했습니다.</p>
        <table class="mdl"><tbody>${L.EQ_SRC.map(e => `<tr><th>${esc(e.name)}</th><td><b>${esc(e.value)}</b> <span class="muted">· ${esc(e.year)}</span><br>출처: ${esc(e.who)}<br><span class="muted">${esc(e.note)}</span></td></tr>`).join('')}</tbody></table>
        <div class="caution"><b>확인 필요:</b> 위 수치는 기관 원문이 아니라 보도 등을 통해 확인한 값이 포함되어 있습니다. 제출·공개 전에 기관 원문과 대조하시길 권합니다. 특히 승용차 배출계수는 확인 가능한 가장 최근 공식 실적(2020년 판매분)이어서 현재 신차 평균과 다를 수 있습니다.</div></div>
      <div class="card" id="n4" style="margin-top:22px"><h3>4. 사용한 기술 스택</h3><table class="mdl"><tbody>${STACK.map(([a, b]) => `<tr><th>${a}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card" id="n5" style="margin-top:22px"><h3>5. 한계</h3><ul>
        <li>평가계수는 2021년 기준 평균값이며 인증 값이 아닙니다. 불확도(오차 범위) 정보가 원자료에 없습니다.</li>
        <li>환경영향 계산은 고른 항목의 계수에 수량을 곱해 더한 <b>부분 산정</b>입니다. 시스템 경계, 기능단위, 배분(할당)은 반영하지 않았으며 ISO 14040/14044에 따른 전과정평가가 아닙니다.</li>
        <li>군집 분석은 탐색용입니다. 실루엣 계수가 낮고 묶는 범주에 따라 결과가 달라집니다.</li>
        <li>차트의 최종 모양은 실제 브라우저에서 확인이 필요합니다.</li></ul></div>
      <div class="card" id="n6" style="margin-top:22px"><h3>6. 코드와 재현</h3><ul>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA" target="_blank" rel="noopener">GitHub 저장소</a></li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/analysis/reanalysis.py" target="_blank" rel="noopener">analysis/reanalysis.py</a> · 원자료부터의 재분석 코드</li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/notebooks/reanalysis_sklearn.ipynb" target="_blank" rel="noopener">notebooks/reanalysis_sklearn.ipynb</a> · 결측 구조·군집·민감도 분석 노트북</li>
        <li><a href="https://github.com/goalbangg-prog/Looply-mini-LCA/blob/main/docs/TEST_REPORT.md" target="_blank" rel="noopener">docs/TEST_REPORT.md</a> · 수행·미수행 검증 기록</li></ul></div>
    </section>`;
    $('notes').querySelectorAll('[data-n]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = $(a.dataset.n); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  }
  L.tabs.notes = { build, built: false };
})();
