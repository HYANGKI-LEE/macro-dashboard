// SQLite DB(data/*.db)를 받아 표({ dates, cols })로 바꾼다. 무거운 작업이라 화면이 멈추지 않도록 워커에서 처리한다.
// DB 구조 두 가지
//   와이드: market(date TEXT 'YYYY-MM-DD', <칼럼> REAL, ...) — scripts/fred/build_fred_db.py, scripts/excel/build_infomax_db.py
//   세로형: <obs>(series_id, date, value) — HYANGKI-LEE/fred 의 build_db.py (항목별 DB, raw.githubusercontent.com 에서 직접 받음)
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
importScripts(`${SQLJS}sql-wasm.js`);
const ready = initSqlJs({ locateFile: (f) => SQLJS + f });

function wide(db) {
  const [result] = db.exec('SELECT * FROM market ORDER BY date');
  const dates = [];
  const cols = {};
  if (result) {
    const names = result.columns.slice(1);
    names.forEach((n) => { cols[n] = []; });
    for (const row of result.values) {
      dates.push(Date.parse(`${row[0]}T00:00:00Z`));
      names.forEach((n, i) => { cols[n].push(row[i + 1]); });
    }
  }
  return { dates, cols };
}

// 세로형 → 와이드: 날짜 합집합을 행으로, series_id 를 칼럼으로. series 가 있으면 그 티커만 꺼냄
function long(db, obs, series) {
  const where = series ? `WHERE series_id IN (${series.map(() => '?').join(',')})` : '';
  const [result] = db.exec(`SELECT series_id, date, value FROM ${obs} ${where} ORDER BY date`, series || []);
  const rows = result ? result.values : [];
  const days = [...new Set(rows.map((r) => r[1]))];
  const at = new Map(days.map((d, i) => [d, i]));
  const cols = {};
  for (const [id, day, value] of rows) {
    if (!cols[id]) cols[id] = new Array(days.length).fill(null);
    cols[id][at.get(day)] = value;
  }
  return { dates: days.map((d) => Date.parse(`${d}T00:00:00Z`)), cols };
}

// .gz 로 끝나는 주소는 받으면서 바로 푼다 (fred 리포 build_db.py 가 만든 압축본)
async function bytesOf(res, url) {
  const body = url.split('?')[0].endsWith('.gz') ? res.body.pipeThrough(new DecompressionStream('gzip')) : res.body;
  return new Uint8Array(await new Response(body).arrayBuffer());
}

// 요청: { name, url, obs?, series? } → 응답: { ok, name, table: { dates: [epoch ms], cols: { 칼럼: [값|null] } } }
onmessage = async (e) => {
  const { name, url, obs, series } = e.data;
  try {
    const [SQL, res] = await Promise.all([ready, fetch(url, { cache: 'no-cache' })]);
    if (!res.ok) throw new Error(`${name}.db 를 받지 못했어요 (HTTP ${res.status})`);
    const db = new SQL.Database(await bytesOf(res, url));
    const table = obs ? long(db, obs, series) : wide(db);
    db.close();
    postMessage({ ok: true, name, table });
  } catch (err) {
    postMessage({ ok: false, name, error: String(err.message || err) });
  }
};
