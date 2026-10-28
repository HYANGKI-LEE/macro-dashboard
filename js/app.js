// 파일을 바꿀 때마다 올려서 브라우저 캐시 대신 새 파일을 받게 한다 (index.html의 ?v= 와 같이 맞출 것)
const VERSION = '20261028f';

// ===== 데이터(DB) =====
// data/<이름>.db 를 페이지에 필요한 것만 받아 온다. 이름의 '_' 뒤가 주기(daily/weekly/monthly/quarterly).
//   fred_*    : FRED (scripts/fred/build_fred_db.py) — 칼럼 = FRED 티커
//   infomax_* : 인포맥스 (data/Macro.xlsx → scripts/excel/build_infomax_db.py) — 칼럼 = Info 시트 2행 지표명
const FRED_D = 'fred_daily';
const FRED_W = 'fred_weekly';
const FRED_M = 'fred_monthly';
const FRED_Q = 'fred_quarterly';
const INFO_D = 'infomax_daily';
const INFO_M = 'infomax_monthly';
const INFO_Q = 'infomax_quarterly';
//   mfg_*     : FRED 항목별 DB (HYANGKI-LEE/fred 의 build_db.py → output/db/*.db). 복사하지 않고 public 리포에서 바로 읽음
//               세로형(series_id, date, value)이라 LONG_DB 로 주소·테이블을 지정. 칼럼 = FRED 티커
//               raw.githubusercontent.com 은 5분 캐시라 fred 리포에 push 후 몇 분 뒤 반영
const FRED_REPO_DB = 'https://raw.githubusercontent.com/HYANGKI-LEE/fred/main/output/db/';
const MFG_M = 'mfg_monthly';
const LONG_DB = { mfg_monthly: { url: `${FRED_REPO_DB}us_macro_PBA_manufacturing.db`, obs: 'obs_monthly' } };
const freqOf = (table) => table.split('_')[1];

// ===== 시리즈 정의 =====
// 열 찾기: exact(칼럼명 완전 일치) 또는 prefix(칼럼명 시작 일치). splice: 여러 칼럼을 이어 붙임(뒤가 우선).
// table: 이 시리즈만 다른 DB에서 가져올 때 (기본은 차트의 table).
// 색: key → css의 --s-<key>(국가 색), color → css 토큰 직접 지정, other → 회색 선(dash로 구분).
// hidden: 기본으로 숨김(범례 클릭으로 표시), step: 계단식 선, since: 이 연도부터만 사용,
// monthly: 일별 값을 월별(그 달 마지막 값)로 바꿈, transform: 'diff' → 전기 대비 증감, 'yoy' → 전년동기비(%), 'mom' → 전기비(%).
// div: 같은 DB의 다른 칼럼으로 나눔(비율), scale: 값에 곱함(예: 0.001 → 백만 달러를 십억 달러로).
// calc: 여러 칼럼을 분기 단위로 맞춰 계산 { inputs: [Q(칼럼, DB, 'last'|'mean')], fn: (a, b, ...) => 값 },
// shiftYears: 날짜를 N년 뒤로 옮김(선행 지표), right: 오른쪽 축(차트의 unit2),
// indexTo: 'YYYY-MM-DD' 그 날짜 값을 100으로 한 지수.
// 차트 compare: { base: 'YYYY-MM-DD' } → 시리즈(defs)를 항목으로, 기준 분기와 최근 분기 값을 막대로 비교.
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
// 미국 기준금리: 08.12.16 이전은 단일 목표치(DFEDTAR), 이후는 목표 범위 상단(DFEDTARU)
const FED_UPPER = { ...BASE, label: '기준금리(상단)', table: FRED_D, splice: ['DFEDTAR', 'DFEDTARU'] };
// 분기 차트용 기준금리: 실효 연방기금금리 분기 평균 (엑셀 Main(분기)와 같은 BOGZ1FL072052006Q), 오른쪽 축
const FFR_Q = { color: '--base-rate', label: '기준금리(우)', table: FRED_Q, exact: 'BOGZ1FL072052006Q', right: true };
// calc 입력 칼럼 (기본: FRED 분기, 분기 마지막 값)
const Q = (col, table = FRED_Q, agg = 'last') => ({ col, table, agg });

// Census M3 Table 2 (Value of Manufacturers' New Orders for Industry Groups) 행 순서. [티커(SA), 이름, 원문, 들여쓰기]
// 맨 위 근원 자본재 수주는 Table 2에 없는 참고 행 (용도별 분류, 시장이 가장 주목하는 설비투자 선행지표)
const TABLE2 = [
  ['NEWORDER', '근원 자본재 수주 (참고)', 'Nondefense capital goods excluding aircraft (core capital goods) - Table 2 외 참고 행', 0],
  ['AMTMNO', '제조업 전체', 'All manufacturing industries', 0],
  ['AMXTNO', '운송장비 제외', 'Excluding transportation', 1],
  ['AMXDNO', '국방 제외', 'Excluding defense', 1],
  ['AMTUNO', '수주잔고 보유 업종', 'With unfilled orders', 1],
  ['DGORDER', '내구재', 'Durable goods industries', 0],
  ['A31SNO', '1차 금속', 'Primary metals', 1],
  ['A31ANO', '철강', 'Iron and steel mills', 2],
  ['AANMNO', '알루미늄·비철금속', 'Aluminum and nonferrous metals', 2],
  ['A31CNO', '주철 주조', 'Ferrous metal foundries', 2],
  ['A32SNO', '금속가공', 'Fabricated metal products', 1],
  ['A33SNO', '기계', 'Machinery', 1],
  ['A33CNO', '건설기계', 'Construction machinery', 2],
  ['A33DNO', '광업·유전·가스전 기계', 'Mining, oil field, and gas field machinery', 2],
  ['A33ENO', '산업기계', 'Industrial machinery', 2],
  ['A33GNO', '사진장비', 'Photographic equipment', 2],
  ['A33HNO', '공조·냉동장비', 'Ventilation, heating, air-conditioning, and refrigeration equipment', 2],
  ['A33INO', '금속가공기계', 'Metalworking machinery', 2],
  ['ATGPNO', '터빈·발전기·동력전달장비', 'Turbines, generators, and other power transmission equipment', 2],
  ['A33MNO', '운반·하역장비', 'Material handling equipment', 2],
  ['A34SNO', '컴퓨터·전자', 'Computers and electronic products', 1],
  ['A34ANO', '컴퓨터', 'Computers', 2],
  ['A34DNO', '통신장비(비국방)', 'Nondefense communications equipment', 2],
  ['A34ENO', '통신장비(국방)', 'Defense communications equipment', 2],
  ['A34HNO', '전자부품', 'Electronic components', 2],
  ['A34INO', '탐색·항법장비(비국방)', 'Nondefense search and navigation equipment', 2],
  ['A34JNO', '탐색·항법장비(국방)', 'Defense search and navigation equipment', 2],
  ['A34KNO', '전자의료·계측·제어기기', 'Electromedical, measuring, and control instruments', 2],
  ['A35SNO', '전기장비·가전·부품', 'Electrical equipment, appliances, and components', 1],
  ['A35ANO', '조명장비', 'Electric lighting equipment', 2],
  ['A35BNO', '가전', 'Household appliances', 2],
  ['A35CNO', '전기장비', 'Electrical equipment', 2],
  ['A36SNO', '운송장비', 'Transportation equipment', 1],
  ['ABTPNO', '자동차 차체·부품·트레일러', 'Motor vehicle bodies, parts, and trailers', 2],
  ['ANAPNO', '항공기·부품(비국방)', 'Nondefense aircraft and parts', 2],
  ['ADAPNO', '항공기·부품(국방)', 'Defense aircraft and parts', 2],
  ['A36ZNO', '선박', 'Ships and boats', 2],
  ['A37SNO', '가구', 'Furniture and related products', 1],
  ['AMNMNO', '비내구재', 'Nondurable goods industries', 0],
];
const SLOTS = 7; // css --slot-1 ~ --slot-7

// ===== 사이드바 묶음 · 페이지 · 차트 정의 =====
// group: 사이드바 묶음. sub: 하위 탭이 있는 페이지에서 차트가 속한 탭. bar: 막대 차트. unit: 축/툴팁 단위.
// wide: 그리드 한 줄 전체 폭으로 그림 (추이가 촘촘한 막대 차트 등).
const GROUPS = [['oil', '유가'], ['us', '미국'], ['kr', '한국']];

const PAGES = {
  oil: {
    group: 'oil',
    title: '유가',
    desc: '인포맥스 일별 데이터 기준.',
    charts: [
      { id: 'chart-wti', title: 'WTI 현물 가격', table: INFO_D, unit: '달러/배럴', digits: 2, defs: [
        { color: '--slot-1', label: 'WTI', prefix: '미국:WTI' },
      ] },
    ],
  },
  rates: {
    group: 'us',
    title: '금리',
    desc: '미국 기준금리는 FRED, 나머지는 인포맥스 일별 데이터 기준. 범례를 클릭하면 선을 켜고 끌 수 있어요.',
    subtabs: [['main', 'Main'], ['global', '글로벌']],
    charts: [
      { sub: 'main', id: 'chart-kr', title: '한국 기준금리 · 국고채 3년 · 10년', table: INFO_D, unit: '%', defs: [
        { ...BASE, label: '기준금리', prefix: '한국:기준금리' },
        { color: '--slot-2', label: '국고채 3년', exact: '금투협 최종호가 국고채권(3년)' },
        { color: '--slot-3', label: '국고채 10년', exact: '금투협 최종호가 국고채권(10년)' },
      ] },
      { sub: 'main', id: 'chart-us', title: '미국 기준금리 · 국채 2년 · 10년', table: INFO_D, unit: '%', defs: [
        FED_UPPER,
        { color: '--slot-2', label: '국채 2년', exact: '미국(종합) 2년' },
        { color: '--slot-3', label: '국채 10년', exact: '미국(종합) 10년' },
      ] },
      { sub: 'global', id: 'chart-policy', title: '주요국 기준금리 추이', table: INFO_D, unit: '%', step: true, defs: POLICY,
        note: '회색 점선 국가는 기본 숨김. 범례를 클릭하면 보여요.' },
      { sub: 'global', id: 'chart-market', title: '주요국 시장금리 추이', table: INFO_D, unit: '%', defs: () => MARKET(state.tenor), tenors: true },
    ],
  },
  inflation: {
    group: 'us',
    title: '물가',
    desc: 'FRED 기준. 물가지표는 지수의 전년동월비(%)로 계산.',
    charts: [
      { id: 'chart-price', title: '미국 기준금리 · CPI · PCE · Core PCE', table: FRED_M, unit: '%', defs: [
        { ...FED_UPPER, monthly: true },
        { color: '--slot-1', label: 'CPI', exact: 'CPIAUCSL', transform: 'yoy' },
        { color: '--slot-2', label: 'PCE', exact: 'PCEPI', transform: 'yoy' },
        { color: '--slot-3', label: 'Core PCE', exact: 'PCEPILFE', transform: 'yoy' },
      ] },
    ],
  },
  labor: {
    group: 'us',
    title: '고용',
    desc: 'FRED 기준. 미국 고용지표.',
    charts: [
      { id: 'chart-nfp', title: '미국 비농업 취업자수 증감 (전월대비)', table: FRED_M, unit: '천 명', digits: 0, bar: true, defs: [
        { color: '--slot-1', label: '취업자 증감', exact: 'PAYEMS', transform: 'diff' },
      ] },
      { id: 'chart-unemp', title: '미국 실업률 · JOLTS 구인비율', table: FRED_M, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '실업률', exact: 'UNRATE' },
        { color: '--slot-2', label: '구인비율', exact: 'JTSJOR' },
      ] },
    ],
  },
  housing: {
    group: 'us',
    title: '주택시장',
    desc: 'FRED 기준(기존주택판매는 인포맥스). 계절조정 연율(SAAR).',
    charts: [
      { id: 'chart-starts', title: '미국 주택착공 · 허가건수', table: FRED_M, unit: '천 호', digits: 0, defs: [
        { color: '--slot-1', label: '착공', exact: 'HOUST' },
        { color: '--slot-2', label: '허가', exact: 'PERMIT' },
      ] },
      { id: 'chart-newhome', title: '미국 신규주택판매', table: FRED_M, unit: '천 호', digits: 0, defs: [
        { color: '--slot-1', label: '신규주택판매', exact: 'HSN1F' },
      ] },
      // FRED 기존주택판매(EXHOSLUSM495S)는 NAR 라이선스로 최근 13개월만 제공돼 인포맥스 값을 쓴다
      { id: 'chart-existing', title: '미국 기존주택판매', table: INFO_M, unit: '백만 호', digits: 2, defs: [
        { color: '--slot-1', label: '기존주택판매', prefix: '미국:기존주택판매', since: 1999 },
      ], note: '1998년 이전 값은 단위가 달라 제외했어요.' },
    ],
  },
  growth: {
    group: 'us',
    title: '성장',
    desc: '인포맥스 분기 데이터 기준. 실질 GDP 성장률(전년동기비, %).',
    charts: [
      // Main(분기) 'GDP 성장률' 차트와 같은 국가 구성
      { id: 'chart-gdp', title: '주요국 GDP 성장률 추이', table: INFO_Q, unit: '%', defs: [
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
  // 01. US 매크로 엑셀 Main(분기)의 신용 관련 차트. 모두 FRED 분기 데이터, 기준금리는 오른쪽 축.
  credit: {
    group: 'us',
    title: '신용',
    desc: 'FRED 분기 데이터 기준 (엑셀 Main(분기) 신용 차트). 기준금리는 실효 연방기금금리 분기 평균(오른쪽 축). '
      + 'HY 스프레드·수익률과 주요 상업은행(Citi·JPM 등) 카드 데이터는 아직 DB에 없어 뺐어요. GDP·투자 차트는 제외.',
    cols: 3,
    defaultPeriod: 's2000',
    charts: [
      // --- 대출태도 (SLOOS) ---
      { id: 'cr-sloos-ci', title: 'SLOOS 대출기준 강화: C&I', table: FRED_Q, unit: '%p', unit2: '%', digits: 1, defs: [
        { color: '--slot-1', label: '대·중견기업', exact: 'DRTSCILM' },
        { color: '--slot-2', label: '소기업', exact: 'DRTSCIS' },
        FFR_Q,
      ] },
      { id: 'cr-sloos-ci2', title: 'SLOOS 대출기준 강화: C&I (금리 제외)', table: FRED_Q, unit: '%p', digits: 1, defs: [
        { color: '--slot-1', label: '대·중견기업', exact: 'DRTSCILM' },
        { color: '--slot-2', label: '소기업', exact: 'DRTSCIS' },
      ] },
      { id: 'cr-sloos-mix', title: 'SLOOS 대출기준 강화: 기업·소비자', table: FRED_Q, unit: '%p', digits: 1, defs: [
        { color: '--slot-1', label: 'C&I 대·중견', exact: 'DRTSCILM' },
        { color: '--slot-2', label: 'C&I 소기업', exact: 'DRTSCIS' },
        { color: '--slot-3', label: '신용카드', exact: 'DRTSCLCC' },
        { color: '--slot-4', label: '오토론', exact: 'STDSAUTO' },
      ] },
      { id: 'cr-sloos-all', title: 'SLOOS 대출기준 강화: 전체', table: FRED_Q, unit: '%p', digits: 1, defs: [
        { color: '--slot-1', label: 'C&I 대·중견', exact: 'DRTSCILM' },
        { color: '--slot-2', label: 'C&I 소기업', exact: 'DRTSCIS' },
        { color: '--slot-3', label: '신용카드', exact: 'DRTSCLCC' },
        { color: '--slot-4', label: '오토론', exact: 'STDSAUTO' },
        { color: '--slot-5', label: '기타 소비자', exact: 'STDSOTHCONS' },
        { color: '--slot-6', label: 'CRE 건설·개발', exact: 'SUBLPDRCSC' },
        { color: '--slot-7', label: 'CRE 다가구', exact: 'SUBLPDRCSM' },
      ] },
      { id: 'cr-sloos-cre', title: 'SLOOS 대출기준 강화: CRE', table: FRED_Q, unit: '%p', digits: 1, defs: [
        { color: '--slot-1', label: '건설·개발', exact: 'SUBLPDRCSC' },
        { color: '--slot-2', label: '다가구', exact: 'SUBLPDRCSM' },
        { color: '--slot-3', label: '비농업 비주거', exact: 'SUBLPDRCSN' },
      ] },
      // --- 연체율 ---
      { id: 'cr-dq-mix', title: '연체율: 가계·기업·카드', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '가계대출', exact: 'DRCLACBS' },
        { color: '--slot-2', label: '기업대출', exact: 'DRBLACBS' },
        { color: '--slot-3', label: '신용카드', exact: 'DRCCLACBS' },
        FFR_Q,
      ] },
      { id: 'cr-dq-bizcard', title: '연체율: 기업·카드 · 기준금리', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '기업대출', exact: 'DRBLACBS' },
        { color: '--slot-3', label: '신용카드', exact: 'DRCCLACBS' },
        FFR_Q,
      ], note: '엑셀의 HY 스프레드 선은 DB에 없어 뺐어요.' },
      { id: 'cr-dq-mortgage', title: '연체율: 주택담보대출', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '모기지', exact: 'DRSFRMACBS' },
        FFR_Q,
      ] },
      { id: 'cr-dq-business', title: '연체율: 기업대출', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '기업대출', exact: 'DRBLACBS' },
        FFR_Q,
      ] },
      { id: 'cr-dq-card', title: '연체율: 신용카드', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '신용카드', exact: 'DRCCLACBS' },
        FFR_Q,
      ] },
      { id: 'cr-dq-cre', title: 'CRE 연체율: 대형 vs 소형 은행', table: FRED_Q, unit: '%', defs: [
        { color: '--slot-1', label: '대형(상위 100)', exact: 'DRCRELEXFT100S' },
        { color: '--slot-2', label: '소형', exact: 'DRCRELEXFOBS' },
      ] },
      { id: 'cr-dq-curve', title: '기업대출 연체율 vs 10Y-2Y(2년 선행)', table: FRED_Q, unit: '%', unit2: '%p', defs: [
        { color: '--slot-1', label: '기업대출 연체율', exact: 'DRBLACBS' },
        { color: '--slot-2', label: '10Y-2Y (2년 선행)', right: true, shiftYears: 2, calc: { inputs: [Q('T10Y2Y', FRED_D, 'mean')], fn: (x) => x } },
      ], note: '10Y-2Y는 분기 평균을 2년 뒤로 옮겨 그렸어요.' },
      { id: 'cr-dq-burden', title: '카드 연체율 · 모기지 부담', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '신용카드 연체율', exact: 'DRCCLACBS' },
        { color: '--slot-2', label: '모기지 상환/가처분소득', exact: 'MDSP' },
        FFR_Q,
      ] },
      // --- 상각률 ---
      { id: 'cr-co-cre', title: '상각률: CRE · 부동산', table: FRED_Q, unit: '%', defs: [
        { color: '--slot-1', label: 'CRE', exact: 'CORCREXFACBS' },
        { color: '--slot-2', label: '부동산 담보', exact: 'CORSREACBS' },
      ] },
      { id: 'cr-co-all', title: '상각률: 대출 종류별', table: FRED_Q, unit: '%', unit2: '%', defs: [
        { color: '--slot-1', label: '기업대출', exact: 'CORBLACBS' },
        { color: '--slot-2', label: 'CRE', exact: 'CORCREXFACBS' },
        { color: '--slot-3', label: '리스', exact: 'CORLFRACBS' },
        { color: '--slot-4', label: '신용카드(우)', exact: 'CORCCACBS', right: true },
        FFR_Q,
      ] },
      // --- 부채 ---
      { id: 'cr-debt-gdp', title: '기업·가계 부채 / GDP', table: FRED_Q, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '비금융기업', calc: { inputs: [Q('BCNSDODNS'), Q('GDP')], fn: (d, g) => d / (g * 1000) * 100 } },
        { color: '--slot-2', label: '가계', calc: { inputs: [Q('CMDEBT'), Q('GDP')], fn: (d, g) => d / (g * 1000) * 100 } },
      ] },
      { id: 'cr-debt-corp', title: '기업 부채/GDP · 부채/자기자본', table: FRED_Q, unit: '%', unit2: '%', digits: 1, defs: [
        { color: '--slot-1', label: '부채/GDP', calc: { inputs: [Q('BCNSDODNS'), Q('GDP')], fn: (d, g) => d / (g * 1000) * 100 } },
        { color: '--slot-2', label: '부채/자기자본(우)', exact: 'NCBCMDPMVCE', right: true },
      ] },
      { id: 'cr-capex-ci', title: 'CapEx · C&I 대출 / GDP', table: FRED_Q, unit: '%', unit2: '%', digits: 1, defs: [
        { color: '--slot-1', label: '비금융기업 CapEx', calc: { inputs: [Q('BOGZ1FA105050005Q'), Q('GDP')], fn: (c, g) => c / (g * 1000) * 100 } },
        { color: '--slot-2', label: 'C&I 대출(우)', right: true, calc: { inputs: [Q('TOTCI', FRED_W, 'mean'), Q('GDP')], fn: (c, g) => c / g * 100 } },
      ] },
      { id: 'cr-debt-hh', title: '가계 부채: GDP · 소득 대비', table: FRED_Q, unit: '%', unit2: '%', digits: 1, defs: [
        { color: '--slot-1', label: '부채/GDP', calc: { inputs: [Q('CMDEBT'), Q('GDP')], fn: (d, g) => d / (g * 1000) * 100 } },
        { color: '--slot-2', label: '부채/개인소득', calc: { inputs: [Q('CMDEBT'), Q('PINCOME')], fn: (d, i) => d / (i * 1000) * 100 } },
        { color: '--slot-3', label: '부채상환/가처분소득(우)', exact: 'TDSP', right: true },
      ] },
      { id: 'cr-dsr', title: '가계 부채상환 부담 / 가처분소득', table: FRED_Q, unit: '%', defs: [
        { color: '--slot-1', label: '모기지', exact: 'MDSP' },
        { color: '--slot-2', label: '소비자 부채', exact: 'CDSP' },
      ] },
      { id: 'cr-debt-equity', title: '비금융기업 부채/자기자본', table: FRED_Q, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '부채/자기자본(시가)', exact: 'NCBCMDPMVCE' },
      ], note: '엑셀의 US HY 수익률·WAM 선은 DB에 없어 뺐어요.' },
      // --- 가계 재무 ---
      { id: 'hh-assets', title: '가계 자산 구성 (총자산 대비)', table: FRED_Q, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '부동산', calc: { inputs: [Q('HOOREVLMHMV'), Q('BOGZ1FL192000005Q')], fn: (a, t) => a / t * 100 } },
        { color: '--slot-2', label: '예금', calc: { inputs: [Q('BOGZ1FL193020005Q'), Q('BOGZ1FL193030205Q'), Q('BOGZ1FL193034005Q'), Q('BOGZ1FL192000005Q')], fn: (a, b, c, t) => (a + b + c) / t * 100 } },
        { color: '--slot-3', label: '채권', calc: { inputs: [Q('BOGZ1LM194022005Q'), Q('BOGZ1FL192000005Q')], fn: (a, t) => a / t * 100 } },
        { color: '--slot-4', label: '주식', calc: { inputs: [Q('BOGZ1LM193064005Q'), Q('BOGZ1FL192000005Q')], fn: (a, t) => a / t * 100 } },
      ], note: '예금 = 요구불·현금 + 저축성 예금 + MMF' },
      { id: 'hh-cash-wage', title: '가계 현금성 자산 · 임금 상승률', table: FRED_Q, unit: '십억 달러', unit2: '%', digits: 0, defs: [
        { color: '--slot-1', label: '요구불예금·현금', calc: { inputs: [Q('BOGZ1FL193020005Q')], fn: (a) => a / 1000 } },
        { color: '--slot-2', label: 'Wage Tracker(우)', right: true, calc: { inputs: [Q('FRBATLWGT3MMAUMHWGO', FRED_M)], fn: (a) => a } },
      ] },
      { id: 'hh-networth', title: '가계 순자산 / 가처분소득', table: FRED_Q, unit: '배', digits: 2, defs: [
        { color: '--slot-1', label: '순자산/가처분소득', calc: { inputs: [Q('BOGZ1FL192090005Q'), Q('DPI')], fn: (n, d) => n / (d * 1000) } },
      ] },
      { id: 'hh-networth-saving', title: '가계 순자산/소득 · 저축률', table: FRED_Q, unit: '배', unit2: '%', digits: 2, defs: [
        { color: '--slot-1', label: '순자산/가처분소득', calc: { inputs: [Q('BOGZ1FL192090005Q'), Q('DPI')], fn: (n, d) => n / (d * 1000) } },
        { color: '--slot-2', label: '저축률(우)', exact: 'A072RC1Q156SBEA', right: true },
      ] },
      // --- 자산 분포 ---
      { id: 'dist-share', title: '자산 그룹별 총자산 비중', table: FRED_Q, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '상위 1%', exact: 'WFRBST01108' },
        { color: '--slot-2', label: '상위 1~10%', exact: 'WFRBSN09135' },
        { color: '--slot-3', label: '상위 10~50%', exact: 'WFRBSN40162' },
        { color: '--slot-4', label: '하위 50%', exact: 'WFRBSB50189' },
      ] },
      { id: 'dist-share-change', title: '총자산 비중 변동: 2010.2Q vs 최근', table: FRED_Q, unit: '%', digits: 1, compare: { base: '2010-04-01' }, defs: [
        { label: '상위 1%', exact: 'WFRBST01108' },
        { label: '상위 1~10%', exact: 'WFRBSN09135' },
        { label: '상위 10~50%', exact: 'WFRBSN40162' },
        { label: '하위 50%', exact: 'WFRBSB50189' },
      ], note: '엑셀은 2025.2Q 고정, 여기선 최근 분기와 비교해요.' },
      { id: 'dist-fin-assets', title: '그룹별 금융자산 추이 (2020.1Q=100)', table: FRED_Q, unit: '', digits: 1, defs: [
        { color: '--slot-1', label: '상위 1%', exact: 'WFRBLT01004', indexTo: '2020-01-01' },
        { color: '--slot-2', label: '상위 1~10%', exact: 'WFRBLN09031', indexTo: '2020-01-01' },
        { color: '--slot-3', label: '상위 10~50%', exact: 'WFRBLN40058', indexTo: '2020-01-01' },
        { color: '--slot-4', label: '하위 50%', exact: 'WFRBLB50085', indexTo: '2020-01-01' },
      ] },
      // --- 기타 ---
      { id: 'etc-wage-q', title: '분위별 주간 임금 상승률 (YoY)', table: FRED_Q, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '1분위', exact: 'LEU0252916100Q', transform: 'yoy' },
        { color: '--slot-2', label: '2분위(중위)', exact: 'LEU0252887700Q', transform: 'yoy' },
        { color: '--slot-3', label: '3분위', exact: 'LEU0252916200Q', transform: 'yoy' },
        { color: '--slot-4', label: '상위 10%', exact: 'LEU0252916300Q', transform: 'yoy' },
      ] },
      { id: 'etc-capex-index', title: 'CapEx · 소매판매 · 고용 (2021.1Q=100)', table: FRED_Q, unit: '', digits: 1, defs: [
        { color: '--slot-1', label: '비금융기업 CapEx', calc: { inputs: [Q('BOGZ1FA105050005Q')], fn: (a) => a }, indexTo: '2021-01-01' },
        { color: '--slot-2', label: '소매판매', calc: { inputs: [Q('RSAFS', FRED_M)], fn: (a) => a }, indexTo: '2021-01-01' },
        { color: '--slot-3', label: '비농업 고용', calc: { inputs: [Q('PAYEMS', FRED_M)], fn: (a) => a }, indexTo: '2021-01-01' },
      ], note: '소매판매·고용은 분기 마지막 달 값' },
      { id: 'etc-m2-spx', title: 'M2 · S&P500', table: FRED_Q, unit: '십억 달러', unit2: 'pt', digits: 0, defs: [
        { color: '--slot-1', label: 'M2', calc: { inputs: [Q('M2SL', FRED_M)], fn: (a) => a } },
        { color: '--slot-2', label: 'S&P500(우)', right: true, calc: { inputs: [Q('SP500', FRED_D)], fn: (a) => a } },
      ], note: 'FRED S&P500은 최근 10년치만 제공돼요. 분기 마지막 값' },
      { id: 'etc-pce', title: '명목 PCE 증가율 (YoY)', table: FRED_Q, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: 'PCE', exact: 'PCEC', transform: 'yoy' },
      ] },
    ],
  },
  // 기업/생산: 제조업 = Census M3 내구재 주문 (FRED 월별, 계절조정)
  // panels: 차트 그리드 아래 전체 폭 블록 (MoM/YoY 버튼 + 선택 업종 추이 차트 + 변동률 표)
  business: {
    group: 'us',
    title: '기업/생산',
    desc: 'FRED 월별 데이터 기준. 제조업: Census M3(제조업 출하·재고·수주) — fred 리포(HYANGKI-LEE/fred)의 Manufacturing 항목 DB를 바로 읽고, 수주·출하·재고 모두 계절조정 금액(백만 달러)에서 계산.',
    subtabs: [['manufacturing', '제조업']],
    cols: 3,
    defaultPeriod: 's2020',
    charts: [
      { sub: 'manufacturing', id: 'dg-mom', title: '내구재 수주 전월비', table: MFG_M, unit: '%', digits: 1, bar: true, wide: true, defs: [
        { color: '--slot-1', label: '내구재', exact: 'DGORDER', transform: 'mom' },
        { color: '--slot-2', label: '운송 제외', exact: 'ADXTNO', transform: 'mom' },
        { color: '--slot-3', label: '근원 자본재', exact: 'NEWORDER', transform: 'mom' },
      ], note: '근원 자본재 = 비국방 자본재(항공기 제외)' },
      { sub: 'manufacturing', id: 'dg-yoy', title: '내구재 수주 전년비', table: MFG_M, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '내구재', exact: 'DGORDER', transform: 'yoy' },
        { color: '--slot-2', label: '운송 제외', exact: 'ADXTNO', transform: 'yoy' },
        { color: '--slot-3', label: '국방 제외', exact: 'ADXDNO', transform: 'yoy' },
      ] },
      { sub: 'manufacturing', id: 'dg-core', title: '근원 자본재 수주 · 출하 (YoY)', table: MFG_M, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '수주', exact: 'NEWORDER', transform: 'yoy' },
        { color: '--slot-2', label: '출하', exact: 'ANXAVS', transform: 'yoy' },
      ], note: '수주는 설비투자 선행, 출하는 GDP 장비투자 추정에 쓰임' },
      { sub: 'manufacturing', id: 'dg-industry', title: '업종별 수주 전년비', table: MFG_M, unit: '%', digits: 1, defs: [
        { color: '--slot-1', label: '컴퓨터·전자', exact: 'A34SNO', transform: 'yoy' },
        { color: '--slot-2', label: '기계', exact: 'A33SNO', transform: 'yoy' },
        { color: '--slot-3', label: '전기장비', exact: 'A35SNO', transform: 'yoy' },
        { color: '--slot-4', label: '1차 금속', exact: 'A31SNO', transform: 'yoy' },
        { color: '--slot-5', label: '금속가공', exact: 'A32SNO', transform: 'yoy' },
      ] },
    ],
    panels: [
      { sub: 'manufacturing', id: 'm3-table2', title: '업종별 신규 수주 변동률 (Census M3 Table 2, 계절조정)', table: MFG_M,
        rows: TABLE2, selected: ['AMTMNO', 'DGORDER', 'AMNMNO'],
        note: '표의 업종 행을 누르면 차트에 추가·제거돼요 (최대 7개). 업종명에 마우스를 올리면 Census 원문 이름이 보여요.' },
    ],
  },
};

// ===== 상태 =====
// panel: 패널 id → { mode: 'mom'|'yoy', slots: Map(티커 → 색 번호) }
const state = { data: {}, page: 'rates', sub: { rates: 'main', business: 'manufacturing' }, period: {}, tenor: 10, legend: {}, ready: {}, panel: {} };
const charts = {};

// ===== 유틸 =====
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ymd = (t) => new Date(t).toISOString().slice(0, 10);
const ym = (t) => new Date(t).toISOString().slice(0, 7);
const quarterLabel = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}.${Math.floor(d.getUTCMonth() / 3) + 1}Q`; };
const defsOf = (spec) => (typeof spec.defs === 'function' ? spec.defs() : spec.defs);
const tableOf = (spec, def) => def.table || spec.table;
// 툴팁에 붙일 FRED 티커 (FRED 데이터일 때만. 인포맥스는 빈 문자열)
const isFred = (table) => table.startsWith('fred_') || !!LONG_DB[table];
function fredTicker(spec, def) {
  if (def.calc) return def.calc.inputs.filter((i) => isFred(i.table)).map((i) => i.col).join(', ');
  if (!isFred(tableOf(spec, def))) return '';
  if (def.splice) return def.splice.join('→');
  return def.div ? `${def.exact}/${def.div}` : def.exact || '';
}

function findCol(cols, def) {
  if (def.splice) {
    const parts = def.splice.map((n) => cols[n]).filter(Boolean);
    if (!parts.length) return null;
    return parts[0].map((_, i) => parts.reduce((v, p) => (p[i] !== null ? p[i] : v), null));
  }
  const names = Object.keys(cols);
  const name = def.exact ? names.find((n) => n === def.exact) : names.find((n) => n.startsWith(def.prefix));
  return name ? cols[name] : null;
}

// 정의에 따라 가공한 { dates, vals } (monthly, since, transform 적용). 열이 없으면 null.
const quarterKey = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1); };

// 칼럼 하나를 분기별 Map(분기 첫날 → 값)으로. agg: 'last'(분기 마지막 값) | 'mean'(분기 평균)
function quarterMap({ col, table, agg }) {
  const t = state.data[table];
  const vals = t && t.cols[col];
  if (!vals) return null;
  const groups = new Map();
  t.dates.forEach((d, i) => {
    if (vals[i] === null) return;
    const k = quarterKey(d);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(vals[i]);
  });
  return new Map([...groups].map(([k, xs]) => [k, agg === 'mean' ? xs.reduce((a, b) => a + b, 0) / xs.length : xs[xs.length - 1]]));
}

function calcValues(def) {
  const maps = def.calc.inputs.map(quarterMap);
  if (maps.some((m) => !m)) return null;
  const dates = [...maps[0].keys()].sort((a, b) => a - b);
  const vals = dates.map((k) => {
    const xs = maps.map((m) => m.get(k));
    return xs.some((x) => x === undefined) ? null : def.calc.fn(...xs);
  });
  return { dates, vals };
}

function shiftYears({ dates, vals }, n) {
  return { dates: dates.map((t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate()); }), vals };
}

function indexTo({ dates, vals }, day) {
  const i = dates.indexOf(Date.parse(`${day}T00:00:00Z`));
  const base = i >= 0 ? vals[i] : null;
  return { dates, vals: vals.map((v) => (v !== null && base ? (v / base) * 100 : null)) };
}

function valuesOf(table, def) {
  if (def.calc) {
    let v = calcValues(def);
    if (v && def.shiftYears) v = shiftYears(v, def.shiftYears);
    if (v && def.indexTo) v = indexTo(v, def.indexTo);
    return v;
  }
  if (!table) return null;
  let vals = findCol(table.cols, def);
  if (!vals) return null;
  let { dates } = table;
  if (def.monthly) {
    // 일별 → 월별: 그 달 마지막 값, 날짜는 FRED 월별처럼 1일
    const byMonth = new Map();
    dates.forEach((t, i) => {
      if (vals[i] === null) return;
      const d = new Date(t);
      byMonth.set(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), vals[i]);
    });
    dates = [...byMonth.keys()];
    vals = [...byMonth.values()];
  }
  if (def.div) {
    const den = table.cols[def.div];
    if (!den) return null;
    vals = vals.map((v, i) => (v !== null && den[i] ? v / den[i] : null));
  }
  if (def.scale) vals = vals.map((v) => (v === null ? null : v * def.scale));
  if (def.since) {
    const from = Date.UTC(def.since, 0, 1);
    vals = vals.map((v, i) => (dates[i] < from ? null : v));
  }
  if (def.transform === 'diff') {
    vals = vals.map((v, i) => (i > 0 && v !== null && vals[i - 1] !== null ? v - vals[i - 1] : null));
  }
  if (def.transform === 'mom') {
    vals = vals.map((v, i) => (i > 0 && v !== null && vals[i - 1] ? (v / vals[i - 1] - 1) * 100 : null));
  }
  if (def.transform === 'yoy') {
    const at = new Map(dates.map((t, i) => [t, vals[i]]));
    vals = vals.map((v, i) => {
      const d = new Date(dates[i]);
      const prev = at.get(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()));
      return v !== null && prev ? (v / prev - 1) * 100 : null;
    });
  }
  return def.indexTo ? indexTo({ dates, vals }, def.indexTo) : { dates, vals };
}

// 기간: 연도 하나(1.1~12.31), 'N년 이후', MAX(전체)
const RANGE_STARTS = [1990, 2000, 2010, 2020];
const MAX_PERIOD = { key: 'max', label: 'MAX', from: -Infinity, to: Infinity };
const sincePeriod = (y) => ({ key: `s${y}`, label: `${y}~`, from: Date.UTC(y, 0, 1), to: Infinity });
const yearPeriod = (y) => ({ key: `y${y}`, label: `${y}`, from: Date.UTC(y, 0, 1), to: Date.UTC(y + 1, 0, 1), year: y });
const periodName = (p) => (p.year ? `${p.year}년` : p.label);

function pointsInPeriod({ dates, vals }, { from, to }) {
  const out = [];
  for (let i = 0; i < dates.length; i++) {
    const t = dates[i];
    if (t < from) continue;
    if (t >= to) break;
    if (vals[i] !== null) out.push([t, vals[i]]);
  }
  return out;
}

function buildSeries(spec, period) {
  const missing = [];
  const series = defsOf(spec).map((def) => {
    const v = valuesOf(state.data[tableOf(spec, def)], def);
    if (!v) { missing.push(def.label); return null; }
    return { def, data: pointsInPeriod(v, period) };
  }).filter(Boolean);
  return { series, missing };
}

// ===== 차트 옵션 =====
function chartOption(spec, built, period) {
  const single = !!period.year;
  const freq = freqOf(spec.table);
  const quarterly = freq === 'quarterly';
  // 분기 데이터를 한 해만 볼 때는 1Q~4Q 카테고리 축, 그 외에는 시간 축
  const byQuarter = quarterly && single;
  const digits = spec.digits ?? 2;
  const fmt = (v) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const unitOf = (def) => (def.right ? spec.unit2 : spec.unit);
  const suffix = (unit) => (unit === '%' ? '%' : ` ${unit}`);
  const hasRight = built.series.some((s) => s.def.right);

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
      yAxisIndex: def.right ? 1 : 0,
      emphasis: { focus: 'series' },
    };
    if (spec.bar) return { ...base, type: 'bar', barMaxWidth: 12 };
    return {
      ...base,
      type: 'line',
      step: spec.step || def.step ? 'end' : false,
      showSymbol: freq !== 'daily' && data.length <= 40,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { borderColor: surface, borderWidth: 2 },
      lineStyle: { width: 2, type: def.dash || 'solid' },
    };
  });

  const head = (v) => (byQuarter ? `${period.year}.${v}` : quarterly ? quarterLabel(v) : freq === 'monthly' ? ym(v) : ymd(v));

  return {
    animation: false,
    textStyle: { fontFamily: 'Pretendard, "Malgun Gothic", sans-serif', color: text },
    grid: { left: 56, right: hasRight ? 56 : 16, top: showLegend ? 56 : 32, bottom: 32 },
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
          .map((p) => {
            const { def } = built.series[p.seriesIndex];
            const ticker = fredTicker(spec, def);
            const tag = ticker ? ` <span style="color:${muted};font-size:11px">${ticker}</span>` : '';
            return `<div style="display:flex;gap:12px;justify-content:space-between"><span>${p.marker}${p.seriesName}${tag}</span><b>${fmt(p.value[1])}${suffix(unitOf(def))}</b></div>`;
          });
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
    yAxis: [
      {
        type: 'value',
        scale: !spec.bar,
        name: spec.unit,
        nameTextStyle: { color: muted, align: 'left' },
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: grid } },
      },
      // 오른쪽 축 (right: true 시리즈가 있을 때만)
      {
        type: 'value',
        show: hasRight,
        scale: true,
        name: hasRight ? spec.unit2 : '',
        nameTextStyle: { color: muted, align: 'right' },
        axisLabel: { color: muted },
        splitLine: { show: false },
      },
    ],
    series,
  };
}

// compare 차트: 항목(defs)별로 기준 분기와 최근 분기(모든 항목에 값이 있는 마지막 분기) 값을 막대로 비교. 기간 버튼과 무관.
function compareOption(spec) {
  const vs = defsOf(spec).map((def) => valuesOf(state.data[tableOf(spec, def)], def));
  if (vs.some((v) => !v)) return null;
  const at = vs.map((v) => new Map(v.dates.map((t, i) => [t, v.vals[i]])));
  const common = vs[0].dates.filter((t) => at.every((m) => m.get(t) !== null && m.get(t) !== undefined));
  const base = Date.parse(`${spec.compare.base}T00:00:00Z`);
  const last = common[common.length - 1];
  const muted = css('--text-muted');
  const grid = css('--grid');
  const digits = spec.digits ?? 1;
  const bar = (t, color) => ({
    name: quarterLabel(t), type: 'bar', color, barMaxWidth: 28,
    data: at.map((m) => m.get(t) ?? null),
    label: { show: true, position: 'top', color: muted, fontSize: 11, formatter: (p) => p.value?.toFixed(digits) },
  });
  return {
    animation: false,
    textStyle: { fontFamily: 'Pretendard, "Malgun Gothic", sans-serif', color: css('--text-primary') },
    grid: { left: 56, right: 16, top: 56, bottom: 32 },
    legend: { top: 0, left: 0, textStyle: { color: css('--text-primary') }, icon: 'roundRect', itemWidth: 14, itemHeight: 4 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: css('--surface-1'), borderColor: grid, valueFormatter: (v) => `${v?.toFixed(digits)}${spec.unit === '%' ? '%' : ` ${spec.unit}`}` },
    xAxis: { type: 'category', data: defsOf(spec).map((d) => d.label), axisLine: { lineStyle: { color: grid } }, axisLabel: { color: muted } },
    yAxis: { type: 'value', name: spec.unit, nameTextStyle: { color: muted, align: 'left' }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: grid } } },
    series: [bar(base, css('--other-series')), bar(last, css('--slot-1'))],
  };
}

function drawChart(spec) {
  const page = Object.keys(PAGES).find((p) => PAGES[p].charts.includes(spec));
  const period = state.period[page];

  if (!charts[spec.id]) {
    charts[spec.id] = echarts.init(document.getElementById(spec.id));
    charts[spec.id].on('legendselectchanged', (e) => { state.legend[spec.id] = e.selected; });
  }
  if (spec.compare) {
    const option = compareOption(spec);
    if (option) charts[spec.id].setOption(option, { notMerge: true });
    document.getElementById(`note-${spec.id}`).textContent = option ? (spec.note || '') : '데이터 없음';
    return;
  }
  const built = buildSeries(spec, period);
  charts[spec.id].setOption(chartOption(spec, built, period), { notMerge: true });

  const empty = built.series.filter((s) => !s.data.length).map((s) => s.def.label);
  const notes = [];
  if (spec.note) notes.push(spec.note);
  if (built.missing.length) notes.push(`${spec.tenors ? `${state.tenor}년물 ` : ''}데이터 없음: ${built.missing.join(', ')}`);
  if (empty.length) notes.push(`${periodName(period)} 값 없음: ${empty.join(', ')}`);
  document.getElementById(`note-${spec.id}`).textContent = notes.join(' · ');
}

// ===== 패널: 업종별 변동률 표 + 선택 업종 추이 차트 =====
function panelState(panel) {
  if (!state.panel[panel.id]) state.panel[panel.id] = { mode: 'mom', slots: new Map(panel.selected.map((t, i) => [t, i + 1])) };
  return state.panel[panel.id];
}

function toggleRow(panel, page, ticker) {
  const { slots } = panelState(panel);
  if (slots.has(ticker)) {
    slots.delete(ticker);
  } else {
    const used = new Set(slots.values());
    const free = Array.from({ length: SLOTS }, (_, i) => i + 1).find((n) => !used.has(n));
    if (!free) return; // 최대 SLOTS개
    slots.set(ticker, free);
  }
  drawPanel(panel, page);
}

function drawPanel(panel, page) {
  const period = state.period[page];
  const { mode, slots } = panelState(panel);
  const table = state.data[panel.table];
  const label = mode === 'yoy' ? '전년비' : '전월비';

  // 차트: 선택한 업종 (표 순서대로)
  const spec = {
    id: `chart-${panel.id}`, table: panel.table, unit: '%', digits: 1,
    defs: panel.rows.filter(([t]) => slots.has(t)).map(([t, name]) => ({ label: name, exact: t, transform: mode, color: `--slot-${slots.get(t)}` })),
  };
  if (!charts[spec.id]) {
    charts[spec.id] = echarts.init(document.getElementById(spec.id));
    charts[spec.id].on('legendselectchanged', (e) => { state.legend[spec.id] = e.selected; });
  }
  charts[spec.id].setOption(chartOption(spec, buildSeries(spec, period), period), { notMerge: true });

  // 표: 행 = 업종, 열 = 기간 안의 월 (옛날 → 최신)
  const rows = panel.rows.map((row) => {
    const v = valuesOf(table, { exact: row[0], transform: mode });
    return { row, at: new Map(v ? pointsInPeriod(v, period) : []) };
  });
  const months = [...new Set(rows.flatMap((r) => [...r.at.keys()]))].sort((a, b) => a - b);
  const cell = (v) => (v === undefined ? '<td></td>' : `<td class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v.toFixed(1)}</td>`);
  const html = `
    <thead><tr><th class="name">업종 (${label}, %)</th>${months.map((t) => `<th>${ym(t).replace('-', '.')}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(({ row: [t, name, en, level], at }) => {
      const slot = slots.get(t);
      const chip = slot ? `<i class="chip" style="background:var(--slot-${slot})"></i>` : '<i class="chip"></i>';
      return `<tr data-ticker="${t}" class="lv${level}${slot ? ' on' : ''}"><th class="name" title="${en} (${t})">${chip}${name}</th>${months.map((m) => cell(at.get(m))).join('')}</tr>`;
    }).join('')}</tbody>`;
  const el = document.getElementById(`table-${panel.id}`);
  el.innerHTML = html;
  el.querySelectorAll('tbody tr').forEach((tr) => { tr.onclick = () => toggleRow(panel, page, tr.dataset.ticker); });
  const wrap = el.parentElement;
  if (wrap.dataset.view !== `${period.key}/${mode}`) { // 기간·기준이 바뀌었을 때만 최신 월(오른쪽 끝)로 스크롤
    wrap.scrollLeft = wrap.scrollWidth;
    wrap.dataset.view = `${period.key}/${mode}`;
  }
  const notes = [panel.note];
  if (slots.size >= SLOTS) notes.push(`차트에는 최대 ${SLOTS}개까지 넣을 수 있어요`);
  document.getElementById(`note-${panel.id}`).textContent = notes.join(' · ');
}

function renderPage(page) {
  const cfg = PAGES[page];
  const onSub = (c) => !cfg.subtabs || c.sub === state.sub[page];
  cfg.charts.filter(onSub).forEach(drawChart);
  (cfg.panels || []).filter(onSub).forEach((p) => drawPanel(p, page));
}

// ===== 화면 만들기 =====
function buildPages() {
  const nav = document.getElementById('nav');
  const main = document.querySelector('main');
  for (const [group, label] of GROUPS) {
    const pages = Object.entries(PAGES).filter(([, cfg]) => cfg.group === group);
    nav.insertAdjacentHTML('beforeend', `
      <div class="nav-group">
        <div class="nav-group-title"><span class="code">${group.toUpperCase()}</span>${label}</div>
        ${pages.length ? pages.map(([id, cfg]) => `<a href="#${id}" data-page="${id}">${cfg.title}</a>`).join('') : '<p class="nav-empty">준비 중</p>'}
      </div>`);
  }

  for (const [id, cfg] of Object.entries(PAGES)) {
    // 만기 버튼이 있는 차트 옆 칸에는 같은 높이의 빈 줄을 넣어 차트 위치를 맞춘다.
    const cell = (c, list) => `
      <div${c.wide ? ' class="wide"' : ''}>
        <h2>${c.title}</h2>
        ${c.tenors ? '<div class="filters"><span class="label">만기</span><div class="seg" id="tenors"></div></div>'
          : list.some((x) => x.tenors) ? '<div class="filters filters-spacer"></div>' : ''}
        <p class="note" id="note-${c.id}"></p>
        <div class="chart" id="${c.id}"></div>
      </div>`;
    const grid = (list) => `<div class="chart-grid${cfg.cols === 3 ? ' cols-3' : ''}">${list.map((c) => cell(c, list)).join('')}</div>`;
    const panel = (p) => `
      <div class="panel">
        <h2>${p.title}</h2>
        <div class="filters"><span class="label">기준</span><div class="seg" data-mode="${p.id}"></div></div>
        <p class="note" id="note-${p.id}"></p>
        <div class="chart" id="chart-${p.id}"></div>
        <div class="table-wrap"><table class="ind-table" id="table-${p.id}"></table></div>
      </div>`;
    const panels = (s) => (cfg.panels || []).filter((p) => !s || p.sub === s).map(panel).join('');
    const body = cfg.subtabs
      ? cfg.subtabs.map(([s]) => `<div class="subpage" data-subpage="${id}/${s}">${grid(cfg.charts.filter((c) => c.sub === s))}${panels(s)}</div>`).join('')
      : grid(cfg.charts) + panels();
    const groupLabel = GROUPS.find(([g]) => g === cfg.group)[1];

    main.insertAdjacentHTML('beforeend', `
      <section class="page" id="page-${id}">
        <p class="updated" id="updated-${id}"></p>
        <h1><span class="crumb">${groupLabel}</span>${cfg.title}</h1>
        ${cfg.subtabs ? `<nav class="subtabs" data-subtabs="${id}">${cfg.subtabs.map(([s, label]) => `<a href="#${id}/${s}" data-sub="${s}">${label}</a>`).join('')}</nav>` : ''}
        <p class="desc">${cfg.desc}</p>
        ${cfg.charts.length ? `<div class="filters"><span class="label">기간</span><div class="years" data-years="${id}"></div></div>` : ''}
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
  loadPage(page);
}

// ===== DB 불러오기 =====
const worker = new Worker(`js/worker.js?v=${VERSION}`);
const pending = {};
worker.onmessage = (e) => {
  const { name } = e.data;
  const p = pending[name];
  delete pending[name];
  if (e.data.ok) { state.data[name] = e.data.table; p.resolve(); } else p.reject(new Error(e.data.error));
};

function loadTable(name) {
  if (state.data[name]) return Promise.resolve();
  if (!pending[name]) {
    let resolve; let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pending[name] = { promise, resolve, reject };
    const src = LONG_DB[name];
    worker.postMessage({ name, obs: src?.obs, url: src ? src.url : new URL(`data/${name}.db?v=${Date.now()}`, location.href).href });
  }
  return pending[name].promise;
}

// 페이지에 필요한 DB 이름 (시장금리는 모든 만기)
function tablesOf(page) {
  const fromCharts = PAGES[page].charts.flatMap((spec) => allDefs(spec).flatMap((def) => (def.calc ? def.calc.inputs.map((i) => i.table) : [tableOf(spec, def)])));
  return [...new Set([...fromCharts, ...(PAGES[page].panels || []).map((p) => p.table)])];
}

async function loadPage(page) {
  const loading = document.getElementById('loading');
  const need = tablesOf(page).filter((t) => !state.data[t]);
  if (need.length) {
    loading.textContent = '데이터를 불러오는 중이에요…';
    loading.classList.remove('hidden', 'error');
    try {
      await Promise.all(need.map(loadTable));
    } catch (err) {
      loading.textContent = `데이터를 불러오지 못했어요: ${err.message}`;
      loading.classList.add('error');
      return;
    }
    if (state.page !== page) return; // 기다리는 동안 다른 페이지로 옮겼으면 그 페이지가 그린다
  }
  loading.classList.add('hidden');
  if (!state.ready[page]) { setupFilters(page); state.ready[page] = true; }
  renderPage(page);
  Object.values(charts).forEach((c) => c.resize());
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

// 페이지 차트의 시리즈마다 콜백 (가공된 값 기준)
function eachSeries(page, fn) {
  PAGES[page].charts.forEach((spec) => {
    allDefs(spec).forEach((def) => {
      const v = valuesOf(state.data[tableOf(spec, def)], def);
      if (v) fn(v, def.calc ? 'quarterly' : def.monthly ? 'monthly' : freqOf(tableOf(spec, def)), def);
    });
  });
}

// 페이지 차트 중 하나라도 값이 있는 연도만 버튼으로 만든다.
function yearsWithData(page) {
  const years = new Set();
  eachSeries(page, ({ dates, vals }) => {
    vals.forEach((v, i) => { if (v !== null) years.add(new Date(dates[i]).getUTCFullYear()); });
  });
  return [...years].sort((a, b) => a - b);
}

// 주기별 마지막 데이터 날짜 → '데이터 기준' 문구
function updatedText(page) {
  const last = {};
  eachSeries(page, ({ dates, vals }, freq, def) => {
    if (def.shiftYears) return; // 앞으로 옮긴 선행 지표는 기준일에서 뺀다
    // 일별 값을 월·분기로 묶으면 아직 끝나지 않은 달·분기가 들어올 수 있어 기준일에서 뺀다
    const months = { monthly: 1, quarterly: 3 }[freq];
    const done = (t) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1) <= Date.now(); };
    for (let i = vals.length - 1; i >= 0; i--) {
      if (vals[i] !== null && (!months || done(dates[i]))) { last[freq] = Math.max(last[freq] ?? -Infinity, dates[i]); break; }
    }
  });
  const parts = [['daily', '일별', ymd], ['weekly', '주별', ymd], ['monthly', '월별', ym], ['quarterly', '분기', quarterLabel]]
    .filter(([f]) => last[f] !== undefined)
    .map(([f, label, fmt]) => `${label} ${fmt(last[f])}`);
  return parts.length ? `데이터 기준: ${parts.join(' · ')}` : '';
}

function setupFilters(page) {
  document.getElementById(`updated-${page}`).textContent = updatedText(page);
  if (!PAGES[page].charts.length) return;
  const singles = yearsWithData(page).map(yearPeriod);
  const ranges = [MAX_PERIOD, ...RANGE_STARTS.map(sincePeriod)];
  // 기본 기간: defaultPeriod(예: 's2000') 가 있으면 그것, 없으면 가장 최근 연도
  state.period[page] = ranges.find((r) => r.key === PAGES[page].defaultPeriod) || singles[singles.length - 1] || MAX_PERIOD;
  buttons(document.querySelector(`[data-years="${page}"]`), [ranges, singles], state.period[page].key, (p) => { state.period[page] = p; renderPage(page); });
  (PAGES[page].panels || []).forEach((p) => {
    const modes = [{ key: 'mom', label: 'MoM (전월비)' }, { key: 'yoy', label: 'YoY (전년비)' }];
    buttons(document.querySelector(`[data-mode="${p.id}"]`), [modes], panelState(p).mode, (m) => { panelState(p).mode = m.key; drawPanel(p, page); });
  });
  if (PAGES[page].charts.some((c) => c.tenors)) {
    const tenors = TENORS.map((t) => ({ key: t, label: `${t}Y` }));
    buttons(document.getElementById('tenors'), [tenors], state.tenor, (t) => { state.tenor = t.key; renderPage(page); });
  }
}

// ===== 시작 =====
buildPages();
window.addEventListener('hashchange', () => showPage(location.hash.slice(1)));
window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()));
showPage(location.hash.slice(1));
