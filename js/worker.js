// 엑셀 파싱은 무거워서 화면이 멈추지 않도록 워커에서 처리한다.
// Info 시트만 읽고, Main 시트(차트·작업용)는 건드리지 않는다.
importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');

const SHEETS = { daily: 'Info(일)', quarterly: 'Info(분기)' };

// Info 시트 구조: 2행 = 지표명, 3행 = 필드명, 4행~ = A열 날짜(엑셀 serial) + 값.
// B열 지표명은 A2에 들어 있다(B2는 단위 표기).
function readSheet(ws, { skipWeekends }) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const head = rows[1] || [];
  const names = head.map((h, i) => (i === 1 ? head[0] : h));
  const dates = [];
  const cols = {};
  const keep = [];
  names.forEach((n, i) => {
    if (i > 0 && typeof n === 'string' && n.trim()) { cols[n.trim()] = []; keep.push([i, n.trim()]); }
  });
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    const serial = row[0];
    if (typeof serial !== 'number') continue;
    const t = Math.round((serial - 25569) * 864e5);
    if (skipWeekends) { const d = new Date(t).getUTCDay(); if (d === 0 || d === 6) continue; }
    dates.push(t);
    for (const [i, n] of keep) { const v = row[i]; cols[n].push(typeof v === 'number' ? v : null); }
  }
  return { dates, cols };
}

onmessage = async (e) => {
  try {
    const res = await fetch(e.data.url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`엑셀 파일을 받지 못했어요 (HTTP ${res.status})`);
    const wb = XLSX.read(await res.arrayBuffer(), { type: 'array', sheets: Object.values(SHEETS), dense: true });
    for (const name of Object.values(SHEETS)) {
      if (!wb.Sheets[name]) throw new Error(`'${name}' 시트를 찾지 못했어요`);
    }
    postMessage({
      ok: true,
      daily: readSheet(wb.Sheets[SHEETS.daily], { skipWeekends: true }),
      quarterly: readSheet(wb.Sheets[SHEETS.quarterly], { skipWeekends: false }),
    });
  } catch (err) {
    postMessage({ ok: false, error: String(err.message || err) });
  }
};
