// ===== 차트 설정 =====
// 국가 색은 어느 차트에서든 같은 국가 = 같은 색. key는 css의 --s-<key> 토큰.
// other: true 인 국가는 회색 선(점선 패턴으로 구분), hidden: true 면 기본으로 숨김.
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

// 금리 > Main: 국가별 기준금리와 대표 만기 금리. color는 css 토큰, step은 계단식 선.
const KR_MAIN = [
  { color: '--base-rate', step: true, label: '기준금리', prefix: '한국:기준금리' },
  { color: '--slot-2', label: '국고채 3년', exact: '금투협 최종호가 국고채권(3년)' },
  { color: '--slot-3', label: '국고채 10년', exact: '금투협 최종호가 국고채권(10년)' },
];
const US_MAIN = [
  { color: '--base-rate', step: true, label: '기준금리(상단)', prefix: '미국:기준금리 상단' },
  { color: '--slot-2', label: '국채 2년', exact: '미국(종합) 2년' },
  { color: '--slot-3', label: '국채 10년', exact: '미국(종합) 10년' },
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

// Main(분기) 'GDP 성장률' 차트와 같은 국가 구성
const GDP = [
  { key: 'kr', label: '한국', prefix: '한국:' },
  { key: 'us', label: '미국', prefix: '미국:' },
  { key: 'eu', label: 'EU', prefix: 'EU:' },
  { key: 'jp', label: '일본', prefix: '일본:' },
  { key: 'cn', label: '중국', prefix: '중국:' },
  { key: 'uk', label: '영국', prefix: '영국:' },
  { key: 'au', label: '호주', prefix: '호주:' },
  { other: true, dash: 'solid', label: '독일', prefix: '독일:' },
  { other: true, dash: 'dashed', label: '프랑스', prefix: '프랑스:' },
];

// ===== 상태 =====
const state = { data: null, page: 'rates', sub: { rates: 'main' }, period: {}, tenor: 10, legend: {} };
const charts = {};

// ===== 유틸 =====
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const quarterLabel = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}.${Math.floor(d.getUTCMonth() / 3) + 1}Q`; };

function findCol(cols, def) {
  const names = Object.keys(cols);
  const name = def.exact ? names.find((n) => n === def.exact) : names.find((n) => n.startsWith(def.prefix));
  return name ? cols[name] : null;
}

// 기간: 연도 하나(1.1~12.31), 'N년 이후', MAX(전체)
const RANGE_STARTS = [1990, 2000, 2010, 2020];
const MAX_PERIOD = { key: 'max', label: 'MAX', from: -Infinity, to: Infinity };
const sincePeriod = (y) => ({ key: `s${y}`, label: `${y}~`, from: Date.UTC(y, 0, 1), to: Infinity });
const yearPeriod = (y) => ({ key: `y${y}`, label: `${y}`, from: Date.UTC(y, 0, 1), to: Date.UTC(y + 1, 0, 1), year: y });
const periodName = (p) => (p.year ? `${p.year}년` : p.label);

// 기간 안의 [날짜, 값] 쌍만 뽑는다.
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
    const col = findCol(table.cols, def);
    if (!col) { missing.push(def.label); return null; }
    return { def, data: pointsInPeriod(table.dates, col, period) };
  }).filter(Boolean);
  return { series, missing };
}

// ===== 차트 옵션 =====
// step: 기준금리처럼 계단식으로 바뀌는 지표
function lineOption(chartId, built, { period, quarterly, step }) {
  const single = !!period.year;
  // 분기 데이터를 한 해만 볼 때는 1Q~4Q 카테고리 축, 그 외에는 시간 축
  const byQuarter = quarterly && single;
  const text = css('--text-primary');
  const muted = css('--text-muted');
  const grid = css('--grid');
  const surface = css('--surface-1');
  const other = css('--other-series');

  const selected = { ...Object.fromEntries(built.series.map((s) => [s.def.label, !s.def.hidden])), ...state.legend[chartId] };

  const series = built.series.map(({ def, data }) => {
    const color = def.other ? other : css(def.color || `--s-${def.key}`);
    return {
      name: def.label,
      type: 'line',
      data: byQuarter ? data.map(([t, v]) => [quarterLabel(t).slice(5), v]) : data,
      color,
      step: step || def.step ? 'end' : false,
      showSymbol: quarterly && data.length <= 40,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { borderColor: surface, borderWidth: 2 },
      lineStyle: { width: 2, type: def.dash || 'solid' },
      emphasis: { focus: 'series' },
    };
  });

  return {
    animation: false,
    textStyle: { fontFamily: 'Pretendard, "Malgun Gothic", sans-serif', color: text },
    grid: { left: 48, right: 24, top: 56, bottom: 32 },
    legend: { type: 'scroll', top: 0, left: 0, selected, textStyle: { color: text }, icon: 'roundRect', itemWidth: 14, itemHeight: 4 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: muted } },
      backgroundColor: surface,
      borderColor: grid,
      textStyle: { color: text },
      formatter: (ps) => {
        if (!ps.length) return '';
        const head = byQuarter ? `${period.year}.${ps[0].axisValue}` : quarterly ? quarterLabel(ps[0].axisValue) : ymd(ps[0].axisValue);
        const rows = ps
          .filter((p) => p.value && p.value[1] !== null)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((p) => `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.marker}${p.seriesName}</span><b>${p.value[1].toFixed(2)}%</b></div>`);
        return `<div style="margin-bottom:4px;color:${muted}">${head}</div>${rows.join('')}`;
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
      scale: true,
      name: '%',
      nameTextStyle: { color: muted },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: grid } },
    },
    series,
  };
}

function render(chartId, option) {
  const el = document.getElementById(chartId);
  if (!charts[chartId]) {
    charts[chartId] = echarts.init(el);
    charts[chartId].on('legendselectchanged', (e) => { state.legend[chartId] = e.selected; });
  }
  charts[chartId].setOption(option, { notMerge: true });
}

// ===== 페이지 =====
function renderRates() {
  if (state.sub.rates === 'main') renderRatesMain();
  else renderRatesGlobal();
}

function renderRatesMain() {
  const { daily } = state.data;
  const period = state.period.rates;
  for (const [id, defs] of [['kr', KR_MAIN], ['us', US_MAIN]]) {
    const built = buildSeries(defs, daily, period);
    render(`chart-${id}`, lineOption(`chart-${id}`, built, { period }));
    const empty = built.series.filter((s) => !s.data.length).map((s) => s.def.label);
    const notes = [];
    if (built.missing.length) notes.push(`Info(일)에 열이 없어 표시 안 됨: ${built.missing.join(', ')}`);
    if (empty.length) notes.push(`${periodName(period)} 값 없음: ${empty.join(', ')}`);
    document.getElementById(`note-${id}`).textContent = notes.join(' · ');
  }
}

function renderRatesGlobal() {
  const { daily } = state.data;
  const period = state.period.rates;

  render('chart-policy', lineOption('chart-policy', buildSeries(POLICY, daily, period), { period, step: true }));

  const market = buildSeries(MARKET(state.tenor), daily, period);
  render('chart-market', lineOption('chart-market', market, { period }));
  const empty = market.series.filter((s) => !s.data.length).map((s) => s.def.label);
  const notes = [];
  if (market.missing.length) notes.push(`${state.tenor}년물 데이터 없음: ${market.missing.join(', ')}`);
  if (empty.length) notes.push(`${periodName(period)} 값 없음: ${empty.join(', ')}`);
  document.getElementById('tenor-note').textContent = notes.join(' · ');
}

function renderGrowth() {
  const period = state.period.growth;
  render('chart-gdp', lineOption('chart-gdp', buildSeries(GDP, state.data.quarterly, period), { period, quarterly: true }));
}

const PAGES = { rates: renderRates, growth: renderGrowth };

// 주소 형식: #페이지 또는 #페이지/하위탭 (예: #rates/global)
function showPage(hash) {
  let [page, sub] = hash.split('/');
  if (!PAGES[page]) page = 'rates';
  state.page = page;
  if (state.sub[page]) {
    const subs = [...document.querySelectorAll(`[data-subtabs="${page}"] a`)].map((a) => a.dataset.sub);
    if (subs.includes(sub)) state.sub[page] = sub;
    document.querySelectorAll(`[data-subtabs="${page}"] a`).forEach((a) => a.classList.toggle('active', a.dataset.sub === state.sub[page]));
    document.querySelectorAll(`[data-subpage^="${page}/"]`).forEach((s) => s.classList.toggle('active', s.dataset.subpage === `${page}/${state.sub[page]}`));
  }
  document.querySelectorAll('.page').forEach((s) => s.classList.toggle('active', s.id === `page-${page}`));
  document.querySelectorAll('.sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  if (state.data) {
    PAGES[page]();
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

// 정의된 시리즈 중 하나라도 값이 있는 연도만 버튼으로 만든다.
function yearsWithData(table, defs) {
  const years = new Set();
  defs.forEach((def) => {
    const col = findCol(table.cols, def);
    if (!col) return;
    col.forEach((v, i) => { if (v !== null) years.add(new Date(table.dates[i]).getUTCFullYear()); });
  });
  return [...years].sort((a, b) => a - b);
}

function lastDateWithData(table, defs) {
  let last = null;
  defs.forEach((def) => {
    const col = findCol(table.cols, def);
    if (!col) return;
    for (let i = col.length - 1; i >= 0; i--) {
      if (col[i] !== null) { if (last === null || table.dates[i] > last) last = table.dates[i]; break; }
    }
  });
  return last;
}

function setupFilters() {
  const { daily, quarterly } = state.data;
  const rateDefs = [...POLICY, ...TENORS.flatMap(MARKET)];
  const sets = { rates: [yearsWithData(daily, rateDefs), renderRates], growth: [yearsWithData(quarterly, GDP), renderGrowth] };

  for (const [page, [years, draw]] of Object.entries(sets)) {
    const ranges = [MAX_PERIOD, ...RANGE_STARTS.map(sincePeriod)];
    const singles = years.map(yearPeriod);
    state.period[page] = singles[singles.length - 1];
    buttons(document.querySelector(`[data-years="${page}"]`), [ranges, singles], state.period[page].key, (p) => { state.period[page] = p; draw(); });
  }
  const tenors = TENORS.map((t) => ({ key: t, label: `${t}Y` }));
  buttons(document.getElementById('tenors'), [tenors], state.tenor, (t) => { state.tenor = t.key; renderRates(); });

  const d = lastDateWithData(daily, rateDefs);
  const q = lastDateWithData(quarterly, GDP);
  document.getElementById('updated').textContent = `데이터 기준: 일별 ${d ? ymd(d) : '-'} · 분기 ${q ? quarterLabel(q) : '-'}`;
}

// ===== 시작 =====
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));
window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => state.data && PAGES[state.page]());

showPage(location.hash.slice(1));

const loading = document.getElementById('loading');
const worker = new Worker('js/worker.js');
worker.onmessage = (e) => {
  if (!e.data.ok) {
    loading.textContent = `데이터를 불러오지 못했어요: ${e.data.error}`;
    loading.classList.add('error');
    return;
  }
  state.data = e.data;
  setupFilters();
  loading.classList.add('hidden');
  showPage(state.page);
};
worker.postMessage({ url: new URL('data/Macro.xlsx', location.href).href });
