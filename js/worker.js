// SQLite DB(data/*.db)를 받아 market 테이블을 표로 바꾼다. 무거운 작업이라 화면이 멈추지 않도록 워커에서 처리한다.
// DB 구조: market(date TEXT 'YYYY-MM-DD', <칼럼> REAL, ...) — scripts/fred/build_fred_db.py, scripts/excel/build_infomax_db.py 참고
const SQLJS = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
importScripts(`${SQLJS}sql-wasm.js`);
const ready = initSqlJs({ locateFile: (f) => SQLJS + f });

// 요청: { name, url } → 응답: { ok, name, table: { dates: [epoch ms], cols: { 칼럼: [값|null] } } }
onmessage = async (e) => {
  const { name, url } = e.data;
  try {
    const [SQL, res] = await Promise.all([ready, fetch(url, { cache: 'no-cache' })]);
    if (!res.ok) throw new Error(`${name}.db 를 받지 못했어요 (HTTP ${res.status})`);
    const db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
    const [result] = db.exec('SELECT * FROM market ORDER BY date');
    db.close();
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
    postMessage({ ok: true, name, table: { dates, cols } });
  } catch (err) {
    postMessage({ ok: false, name, error: String(err.message || err) });
  }
};
