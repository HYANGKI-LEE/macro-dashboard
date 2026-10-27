"""data/Macro.xlsx 의 Info 시트를 주기별 SQLite DB로 옮긴다. 구조는 FRED DB(scripts/fred/build_fred_db.py)와 같다.

  Info(일)   → data/infomax_daily.db     (주말 제외)
  Info(월)   → data/infomax_monthly.db
  Info(분기) → data/infomax_quarterly.db

  market(date TEXT PRIMARY KEY, <지표명> REAL, ...)   - 칼럼 = Info 시트 2행 지표명 (대시보드가 이 이름으로 찾음)
  series(column_name, sheet, col_idx, block_title, field)
  meta(key, value)

엑셀이 원본이라 매번 통째로 다시 만든다(엑셀에서 지운 열은 DB에서도 사라짐).
Info 시트 구조: 2행 = 지표명(B열 지표명은 A2), 3행 = 필드명, 4행~ = A열 날짜 + 값.

사용: python build_infomax_db.py [--xlsx data/Macro.xlsx]
"""
import argparse
import datetime as dt
import os
import sqlite3

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(ROOT, 'data')
SHEETS = {'Info(일)': 'daily', 'Info(월)': 'monthly', 'Info(분기)': 'quarterly'}


def read_sheet(ws, skip_weekends):
    rows = ws.iter_rows(values_only=True)
    next(rows)
    head = list(next(rows))
    field = list(next(rows))
    names = [head[0] if i == 1 else h for i, h in enumerate(head)]
    cols, used = [], {}
    for i, n in enumerate(names):
        if i > 0 and isinstance(n, str) and n.strip():
            n = n.strip()
            used[n] = used.get(n, 0) + 1
            cols.append((i, n if used[n] == 1 else f'{n}#{used[n]}', field[i] if i < len(field) else None))

    data = []
    for row in rows:
        d = row[0] if row else None
        if not isinstance(d, (dt.datetime, dt.date)):
            continue
        if skip_weekends and d.weekday() >= 5:
            continue
        vals = [row[i] if i < len(row) and isinstance(row[i], (int, float)) else None for i, _, _ in cols]
        if any(v is not None for v in vals):
            data.append((d.strftime('%Y-%m-%d'), *vals))
    return cols, data


def write_db(path, sheet, cols, data):
    tmp = path + '.tmp'
    if os.path.exists(tmp):
        os.remove(tmp)
    con = sqlite3.connect(tmp)
    con.execute('CREATE TABLE market (date TEXT PRIMARY KEY, ' + ', '.join(f'"{n}" REAL' for _, n, _ in cols) + ')')
    # 같은 날짜가 두 번 나오면 뒤의 값을 쓴다
    con.executemany(f"INSERT OR REPLACE INTO market VALUES ({','.join('?' * (len(cols) + 1))})", data)
    con.execute('CREATE TABLE series (column_name TEXT PRIMARY KEY, sheet TEXT, col_idx INTEGER, block_title TEXT, field TEXT)')
    con.executemany('INSERT INTO series VALUES (?,?,?,?,?)', [(n, sheet, i + 1, n.split('#')[0], f) for i, n, f in cols])
    con.execute('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)')
    con.executemany('INSERT INTO meta VALUES (?,?)', [
        ('source', 'Infomax (data/Macro.xlsx)'), ('sheet', sheet),
        ('updated_infomax', dt.datetime.now().isoformat(timespec='seconds'))])
    con.commit()
    con.execute('VACUUM')
    con.close()
    os.replace(tmp, path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--xlsx', default=os.path.join(DATA_DIR, 'Macro.xlsx'))
    a = ap.parse_args()

    wb = openpyxl.load_workbook(a.xlsx, read_only=True, data_only=True)
    try:
        for sheet, name in SHEETS.items():
            cols, data = read_sheet(wb[sheet], skip_weekends=(name == 'daily'))
            path = os.path.join(DATA_DIR, f'infomax_{name}.db')
            write_db(path, sheet, cols, data)
            last = data[-1][0] if data else '-'
            print(f'{os.path.basename(path):<24} {os.path.getsize(path) / 1e6:5.1f} MB  {len(data):>6,}행 x {len(cols):>3}개 지표  ~{last}')
    finally:
        wb.close()  # read_only 워크북은 닫지 않으면 윈도우에서 파일이 잠긴다


if __name__ == '__main__':
    main()
