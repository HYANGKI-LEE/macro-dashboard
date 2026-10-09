// 파일을 바꿀 때마다 올려서 브라우저 캐시 대신 새 파일을 받게 한다 (index.html의 ?v= 와 같이 맞출 것)
const VERSION = '20261009b';

// ===== 시리즈 정의 =====
// 열 찾기: exact(지표명 완전 일치) 또는 prefix(지표명 시작 일치). 지표명은 Info 시트 2행.
// 색: key → css의 --s-<key>(국가 색), color → css 토큰 직접 지정, other → 회색 선(dash로 구분).
// hidden: 기본으로 숨김(범례 클릭으로 표시), step: 계단식 선, since: 이 연도부터만 사용,
// transform: 'diff' → 전월 대비 증감.
const POLICY = [
  { key: 'kr', label: '한국', prefix: '한국:기준금리' },
  { key: 'us', label: '미국(상단)', prefix: '미국:기준금리 상단' },
  { key: 'eu', label: '유로존', prefix: '유로존:ECB정책금리' },
  { key: 'jp', label: '일본', prefix: '일본:기준금리' },
  { key: 'uk', label: '영국', prefix: '영국:기준금리' },
  { key: 'au', label: '호주', prefix: '호주:기준금리' },
  { key: 'ca', label: '캐나다', prefix: '캐나다:기준금리' },
  { other: true, hidden: true, dash: 'dashed', label: '멕시코', prefix: '멕시코:기준금리' },
  { other: true, hidden: true, dash: 'dotted', label: '대만', prefix: '대만:기준금리' },
  { other: true, hidden: true, dash: [8, 3, 2, 3], label: '인도', prefix: '인도:기준금리' },
  { other: true, hidden: true, dash: [2, 6], label: '뉴질랜드', prefix: '뉴질랜드:기준금리' },
];

const TENORS = [2, 5, 10, 20, 30];
const MARKET = (t) => [
  { key: 'kr', label: '한국', exact: `금투협 최종호가 국고채권(${t}년)` },
  { key: 'us', label: '미국', exact: `미국(종합) ${t}년` },
  { key: 'eu', label: '유럽연합', exact: `유럽연합 ${t}년` },
  { key: 'jp', label: '일본', exact: `일본 ${t}년` },
  { key: 'cn', label: '중국', exact: `중국 ${t}년` },
  { key: 'uk', label: '영국', exact: `영국 ${t}년` },
  { key: 'au', label: '호주', exact: `호주 ${t}년` },
  { other: true, hidden: true, dash: 'dashed', label: '프랑스', exact: `프랑스 ${t}년` },
  { other: true, hidden: true, dash: 'dotted', label: '이탈리아', exact: `이탈리아 ${t}년` },
  { other: true, hidden: true, dash: [8, 3, 2, 3], label: '스페인', exact: `스페인 ${t}년` },
  { other: true, hidden: true, dash: [2, 6], label: '대만', exact: `대만 ${t}년` },
];

const BASE = { color: '--base-rate', step: true };

// ===== 페이지 · 차트 정의 =====
// table: daily = Info(일), monthly = Info(월), quarterly = Info(분기)
// sub: 하위 탭이 있는 페이지에서 차트가 속한 탭. bar: 막대 차트. unit: 축/툴팁 단위.
const PAGES = {
  rates: {
    title: '금리',
    desc: 'Info(일) 시트 기준. 범례를 클릭하면 선을 켜고 끌 수 있어요.',
    subtabs: [['main', 'Main'], ['global', '글로벌']],
    charts: [
      { sub: 'main', id: 'chart-kr', title: '한국 기준금리 · 국고채 3년 · 10년', table: 'daily', unit: '%', defs: [
        { ...BASE, label: '기준금리', prefix: '한국:기준금리' },
        { color: '--slot-2', label: '국고채 3년', exact: '금투협 최종호가 국고채권(3년)' },
        { color: '--slot-3', label: '국고채 10년', exact: '금투협 최종호가 국고채권(10년)' },
      ] },
      { sub: 'main', id: 'chart-us', title: '미국 기준금리 · 국채 2년 · 10년', table: 'daily', unit: '%', defs: [
        { ...BASE, label: '기준금리(상단)', prefix: '미국:기준금리 상단' },
        { color: '--slot-2', label: '국채 2년', exact: '미국(종합) 2년' },
        { color: '--slot-3', label: '국채 10년', exact: '미국(종합) 10년' },
      ] },
      { sub: 'global', id: 'chart-policy', title: '주요국 기준금리 추이', table: 'daily', unit: '%', step: true, defs: POLICY,
        note: '회색 점선 국가는 기본 숨김. 범례를 클릭하면 보여요.' },
      { sub: 'global', id: 'chart-market', title: '주요국 시장금리 추이', table: 'daily', unit: '%', defs: () => MARKET(state.tenor), tenors: true },
    ],
  },
  inflation: {
    title: '물가',
    desc: 'Info(월) 시트 기준. 미국 물가지표는 전년동월비(%).',
    charts: [
      { id: 'chart-price', title: '미국 기준금리 · CPI · PCE · Core PCE', table: 'monthly', unit: '%', defs: [
        { ...BASE, label: '기준금리(상단)', prefix: '미국:기준금리 상단' },
        { color: '--slot-1', label: 'CPI', prefix: '미국:CPI(YOY)' },
        { color: '--slot-2', label: 'PCE', prefix: '미국:PCEPI' },
        { color: '--slot-3', label: 'Core PCE', prefix: '미국:근원PCEPI' },
      ] },
    ],
  },
  labor: {
    title: '고용',
    desc: 'Info(월) 시트 기준. 미국 고용지표.',
    charts: [
      { id: 'chart-nfp', title: '미국 비농업 취업자수 증감 (전월대비)', table: 'monthly', unit: '천 명', digits: 0, bar: true, defs: [
        { color: '--slot-1', label: '취업자 증감', prefix: '미국:비농업 취업자수', transform: 'diff' },
      ] },
      { id: 'chart-unemp', title: '미국 실업률 · JOLTS 구인비율', table: 'monthly', unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '실업률', prefix: '미국:실업률' },
        { color: '--slot-2', label: '구인비율', prefix: '미국:JOLTS:구인비율' },
      ] },
    ],
  },
  housing: {
    title: '주택시장',
    desc: 'Info(월) 시트 기준. 미국 주택지표(계절조정 연율, SAAR).',
    charts: [
      { id: 'chart-starts', title: '미국 주택착공 · 허가건수', table: 'monthly', unit: '천 호', digits: 0, defs: [
        { color: '--slot-1', label: '착공', prefix: '미국:민간 주택착공' },
        { color: '--slot-2', label: '허가', prefix: '미국:민간 주택허가' },
      ] },
      { id: 'chart-newhome', title: '미국 신규주택판매', table: 'monthly', unit: '천 호', digits: 0, defs: [
        { color: '--slot-1', label: '신규주택판매', prefix: '미국:신규주택판매' },
      ] },
      { id: 'chart-existing', title: '미국 기존주택판매', table: 'monthly', unit: '백만 호', digits: 2, defs: [
        { color: '--slot-1', label: '기존주택판매', prefix: '미국:기존주택판매', since: 1999 },
      ], note: '1998년 이전 값은 단위가 달라 제외했어요.' },
    ],
  },
  growth: {
    title: '성장',
    desc: 'Info(분기) 시트 기준. 실질 GDP 성장률(전년동기비, %).',
    charts: [
      // Main(분기) 'GDP 성장률' 차트와 같은 국가 구성
      { id: 'chart-gdp', title: '주요국 GDP 성장률 추이', table: 'quarterly', unit: '%', defs: [
        { key: 'kr', label: '한국', prefix: '한국:' },
        { key: 'us', label: '미국', prefix: '미국:' },
        { key: 'eu', label: 'EU', prefix: 'EU:' },
        { key: 'jp', label: '일본', prefix: '일본:' },
        { key: 'cn', label: '중국', prefix: '중국:' },
        { key: 'uk', label: '영국', prefix: '영국:' },
        { key: 'au', label: '호주', prefix: '호주:' },
        { other: true, dash: 'solid', label: '독일', prefix: '독일:' },
        { other: true, dash: 'dashed', label: '프랑스', prefix: '프랑스:' },
      ] },
    ],
  },
  oil: {
    title: '유가',
    desc: 'Info(일) 시트 기준.',
    charts: [
      { id: 'chart-wti', title: 'WTI 현물 가격', table: 'daily', unit: '달러/배럴', digits: 2, defs: [
        { color: '--slot-1', label: 'WTI', prefix: '미국:WTI' },
      ] },
    ],
  },
};

// ===== 상태 =====
const state = { data: null, page: 'rates', sub: { rates: 'main' }, period: {}, tenor: 10, legend: {} };
const charts = {};

// ===== 유틸 =====
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const ym = (t) => new Date(t).toISOString().slice(0, 7);
const quarterLabel = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}.${Math.floor(d.getUTCMonth() / 3) + 1}Q`; };
const defsOf = (spec) => (typeof spec.defs === 'function' ? spec.defs() : spec.defs);

function findCol(cols, def) {
  const names = Object.keys(cols);
  const name = def.exact ? names.find((n) => n === def.exact) : names.find((n) => n.startsWith(def.prefix));
  return name ? cols[name] : null;
}

// 정의에 따라 가공한 값 배열 (since, transform 적용). 열이 없으면 null.
function valuesOf(table, def) {
  let vals = findCol(table.cols, def);
  if (!vals) return null;
  if (def.since) {
    const from = Date.UTC(def.since, 0, 1);
    vals = vals.map((v, i) => (table.dates[i] < from ? null : v));
  }
  if (def.transform === 'diff') {
    vals = vals.map((v, i) => (i > 0 && v !== null && vals[i - 1] !== null ? v - vals[i - 1] : null));
  }
  return vals;
}

// 기간: 연도 하나(1.1~12.31), 'N년 이후', MAX(전체)
const RANGE_STARTS = [1990, 2000, 2010, 2020];
const MAX_PERIOD = { key: 'max', label: 'MAX', from: -Infinity, to: Infinity };
const sincePeriod = (y) => ({ key: `s${y}`, label: `${y}~`, from: Date.UTC(y, 0, 1), to: Infinity });
const yearPeriod = (y) => ({ key: `y${y}`, label: `${y}`, from: Date.UTC(y, 0, 1), to: Date.UTC(y + 1, 0, 1), year: y });
const periodName = (p) => (p.year ? `${p.year}년` : p.label);

function pointsInPeriod(dates, vals, { from, to }) {
  const out = [];
  for (let i = 0; i < dates.length; i++) {
    const t = dates[i];
    if (t < from) continue;
    if (t >= to) break;
    if (vals[i] !== null) out.push([t, vals[i]]);
  }
  return out;
}

function buildSeries(defs, table, period) {
  const missing = [];
  const series = defs.map((def) => {
    const vals = valuesOf(table, def);
    if (!vals) { missing.push(def.label); return null; }
    return { def, data: pointsInPeriod(table.dates, vals, period) };
  }).filter(Boolean);
  return { series, missing };
}

// ===== 차트 옵션 =====
function chartOption(spec, built, period) {
  const single = !!period.year;
  const quarterly = spec.table === 'quarterly';
  // 분기 데이터를 한 해만 볼 때는 1Q~4Q 카테고리 축, 그 외에는 시간 축
  const byQuarter = quarterly && single;
  const digits = spec.digits ?? 2;
  const fmt = (v) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const suffix = spec.unit === '%' ? '%' : ` ${spec.unit}`;

  const text = css('--text-primary');
  const muted = css('--text-muted');
  const grid = css('--grid');
  const surface = css('--surface-1');
  const other = css('--other-series');

  const selected = { ...Object.fromEntries(built.series.map((s) => [s.def.label, !s.def.hidden])), ...state.legend[spec.id] };
  const showLegend = built.series.length > 1;

  const series = built.series.map(({ def, data }) => {
    const color = def.other ? other : css(def.color || `--s-${def.key}`);
    const base = {
      name: def.label,
      data: byQuarter ? data.map(([t, v]) => [quarterLabel(t).slice(5), v]) : data,
      color,
      emphasis: { focus: 'series' },
    };
    if (spec.bar) return { ...base, type: 'bar', barMaxWidth: 12 };
    return {
      ...base,
      type: 'line',
      step: spec.step || def.step ? 'end' : false,
      showSymbol: spec.table !== 'daily' && data.length <= 40,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { borderColor: surface, borderWidth: 2 },
      lineStyle: { width: 2, type: def.dash || 'solid' },
    };
  });

  const head = (v) => (byQuarter ? `${period.year}.${v}` : quarterly ? quarterLabel(v) : spec.table === 'monthly' ? ym(v) : ymd(v));

  return {
    animation: false,
    textStyle: { fontFamily: 'Pretendard, "Malgun Gothic", sans-serif', color: text },
    grid: { left: 56, right: 16, top: showLegend ? 56 : 32, bottom: 32 },
    legend: { show: showLegend, type: 'scroll', top: 0, left: 0, selected, textStyle: { color: text }, icon: 'roundRect', itemWidth: 14, itemHeight: 4 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: spec.bar ? 'shadow' : 'line', lineStyle: { color: muted } },
      backgroundColor: surface,
      borderColor: grid,
      textStyle: { color: text },
      formatter: (ps) => {
        if (!ps.length) return '';
        const rows = ps
          .filter((p) => p.value && p.value[1] !== null)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((p) => `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.marker}${p.seriesName}</span><b>${fmt(p.value[1])}${suffix}</b></div>`);
        return `<div style="margin-bottom:4px;color:${muted}">${head(ps[0].axisValue)}</div>${rows.join('')}`;
      },
    },
    xAxis: byQuarter
      ? { type: 'category', data: ['1Q', '2Q', '3Q', '4Q'], boundaryGap: false, axisLine: { lineStyle: { color: grid } }, axisLabel: { color: muted } }
      : {
          type: 'time',
          min: single ? period.from : Number.isFinite(period.from) ? period.from : 'dataMin',
          max: single ? Date.UTC(period.year, 11, 31) : 'dataMax',
          axisLine: { lineStyle: { color: grid } },
          axisLabel: { color: muted, formatter: single ? '{M}월' : '{yyyy}' },
          splitLine: { show: false },
        },
    yAxis: {
      type: 'value',
      scale: !spec.bar,
      name: spec.unit,
      nameTextStyle: { color: muted, align: 'left' },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: grid } },
    },
    series,
  };
}

function drawChart(spec) {
  const page = Object.keys(PAGES).find((p) => PAGES[p].charts.includes(spec));
  const period = state.period[page];
  const built = buildSeries(defsOf(spec), state.data[spec.table], period);

  if (!charts[spec.id]) {
    charts[spec.id] = echarts.init(document.getElementById(spec.id));
    charts[spec.id].on('legendselectchanged', (e) => { state.legend[spec.id] = e.selected; });
  }
  charts[spec.id].setOption(chartOption(spec, built, period), { notMerge: true });

  const empty = built.series.filter((s) => !s.data.length).map((s) => s.def.label);
  const notes = [];
  if (spec.note) notes.push(spec.note);
  if (built.missing.length) notes.push(`${spec.tenors ? `${state.tenor}년물 ` : ''}데이터 없음: ${built.missing.join(', ')}`);
  if (empty.length) notes.push(`${periodName(period)} 값 없음: ${empty.join(', ')}`);
  document.getElementById(`note-${spec.id}`).textContent = notes.join(' · ');
}

function renderPage(page) {
  const cfg = PAGES[page];
  cfg.charts.filter((c) => !cfg.subtabs || c.sub === state.sub[page]).forEach(drawChart);
}

// ===== 화면 만들기 =====
function buildPages() {
  const nav = document.getElementById('nav');
  const main = document.querySelector('main');
  const loading = document.getElementById('loading');
  for (const [id, cfg] of Object.entries(PAGES)) {
    nav.insertAdjacentHTML('beforeend', `<a href="#${id}" data-page="${id}">${cfg.title}</a>`);

    // 만기 버튼이 있는 차트 옆 칸에는 같은 높이의 빈 줄을 넣어 차트 위치를 맞춘다.
    const cell = (c, list) => `
      <div>
        <h2>${c.title}</h2>
        ${c.tenors ? '<div class="filters"><span class="label">만기</span><div class="seg" id="tenors"></div></div>'
          : list.some((x) => x.tenors) ? '<div class="filters filters-spacer"></div>' : ''}
        <p class="note" id="note-${c.id}"></p>
        <div class="chart" id="${c.id}"></div>
      </div>`;
    const grid = (list) => `<div class="chart-grid">${list.map((c) => cell(c, list)).join('')}</div>`;
    const body = cfg.subtabs
      ? cfg.subtabs.map(([s]) => `<div class="subpage" data-subpage="${id}/${s}">${grid(cfg.charts.filter((c) => c.sub === s))}</div>`).join('')
      : grid(cfg.charts);

    loading.insertAdjacentHTML('beforebegin', `
      <section class="page" id="page-${id}">
        <h1>${cfg.title}</h1>
        ${cfg.subtabs ? `<nav class="subtabs" data-subtabs="${id}">${cfg.subtabs.map(([s, label]) => `<a href="#${id}/${s}" data-sub="${s}">${label}</a>`).join('')}</nav>` : ''}
        <p class="desc">${cfg.desc}</p>
        <div class="filters">
          <span class="label">기간</span>
          <div class="years" data-years="${id}"></div>
        </div>
        ${body}
      </section>`);
  }
}

// 주소 형식: #페이지 또는 #페이지/하위탭 (예: #rates/global)
function showPage(hash) {
  let [page, sub] = hash.split('/');
  if (!PAGES[page]) page = 'rates';
  state.page = page;
  if (PAGES[page].subtabs) {
    if (PAGES[page].subtabs.some(([s]) => s === sub)) state.sub[page] = sub;
    document.querySelectorAll(`[data-subtabs="${page}"] a`).forEach((a) => a.classList.toggle('active', a.dataset.sub === state.sub[page]));
    document.querySelectorAll(`[data-subpage^="${page}/"]`).forEach((s) => s.classList.toggle('active', s.dataset.subpage === `${page}/${state.sub[page]}`));
  }
  document.querySelectorAll('.page').forEach((s) => s.classList.toggle('active', s.id === `page-${page}`));
  document.querySelectorAll('.sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  if (state.data) {
    renderPage(page);
    Object.values(charts).forEach((c) => c.resize());
  }
}

// ===== 필터 버튼 =====
// groups: 버튼 묶음 배열. 각 항목은 { key, label }. 묶음끼리는 줄을 나눠 표시하고, 선택은 전체에서 하나.
function buttons(container, groups, currentKey, onPick) {
  container.innerHTML = '';
  groups.forEach((items) => {
    const group = document.createElement('div');
    group.className = 'btn-group';
    items.forEach((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.label;
      b.classList.toggle('active', item.key === currentKey);
      b.onclick = () => {
        container.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        onPick(item);
      };
      group.appendChild(b);
    });
    container.appendChild(group);
  });
}

// 페이지의 모든 차트 정의 (시장금리는 모든 만기)
function allDefs(spec) { return spec.tenors ? TENORS.flatMap(MARKET) : defsOf(spec); }

// 페이지 차트 중 하나라도 값이 있는 연도만 버튼으로 만든다.
function yearsWithData(page) {
  const years = new Set();
  PAGES[page].charts.forEach((spec) => {
    const table = state.data[spec.table];
    allDefs(spec).forEach((def) => {
      const vals = valuesOf(table, def);
      if (vals) vals.forEach((v, i) => { if (v !== null) years.add(new Date(table.dates[i]).getUTCFullYear()); });
    });
  });
  return [...years].sort((a, b) => a - b);
}

function lastDate(tableName) {
  const table = state.data[tableName];
  let last = null;
  Object.values(PAGES).flatMap((p) => p.charts).filter((s) => s.table === tableName).forEach((spec) => {
    allDefs(spec).forEach((def) => {
      const vals = valuesOf(table, def);
      if (!vals) return;
      for (let i = vals.length - 1; i >= 0; i--) {
        if (vals[i] !== null) { if (last === null || table.dates[i] > last) last = table.dates[i]; break; }
      }
    });
  });
  return last;
}

function setupFilters() {
  for (const page of Object.keys(PAGES)) {
    const singles = yearsWithData(page).map(yearPeriod);
    const ranges = [MAX_PERIOD, ...RANGE_STARTS.map(sincePeriod)];
    state.period[page] = singles[singles.length - 1];
    buttons(document.querySelector(`[data-years="${page}"]`), [ranges, singles], state.period[page].key, (p) => { state.period[page] = p; renderPage(page); });
  }
  const tenors = TENORS.map((t) => ({ key: t, label: `${t}Y` }));
  buttons(document.getElementById('tenors'), [tenors], state.tenor, (t) => { state.tenor = t.key; renderPage('rates'); });

  const d = lastDate('daily');
  const m = lastDate('monthly');
  const q = lastDate('quarterly');
  document.getElementById('updated').textContent =
    `데이터 기준: 일별 ${d ? ymd(d) : '-'} · 월별 ${m ? ym(m) : '-'} · 분기 ${q ? quarterLabel(q) : '-'}`;
}

// ===== 시작 =====
buildPages();
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));
window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
showPage(location.hash.slice(1));

const loading = document.getElementById('loading');
const worker = new Worker(`js/worker.js?v=${VERSION}`);
worker.onmessage = (e) => {
  if (!e.data.ok) {
    loading.textContent = `데이터를 불러오지 못했어요: ${e.data.error}`;
    loading.classList.add('error');
    return;
  }
  state.data = e.data;
  setupFilters();
  loading.classList.add('hidden');
  showPage(location.hash.slice(1));
};
worker.postMessage({ url: new URL(`data/Macro.xlsx?v=${Date.now()}`, location.href).href });
