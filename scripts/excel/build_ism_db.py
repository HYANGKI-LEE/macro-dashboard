"""인포맥스 엑셀(data/Infomax_data.xlsx, ISM 시트)에서 ISM 지수를 읽어 data/ism.db 를 만들고 data/fred_monthly.db 에 병합한다.

  data/ism.db          : ISM만 담은 DB (fred_*.db 와 같은 구조: market / series / meta)
  data/fred_monthly.db : 대시보드 월별 DB. ISM_* 칼럼을 추가·덮어씀 (build_fred_db.py 는 ISM_* 칼럼을 지우지 않음)

- 엑셀은 git에 올리지 않고 로컬에만 둔다. 엑셀을 새로 받은 뒤 이 스크립트를 돌리고 두 DB를 커밋하면 된다.
- 인포맥스는 시리즈가 시작하기 전 기간을 다른 칼럼 값으로 채워 보낸다(예: 서비스업 세부지수 1997.6 이전 = 제조업 가격지수).
  그래서 START 이전 값은 버린다.
- 서비스업 PMI 헤드라인은 엑셀에 없어(비제조업 PMI 칼럼은 2009.3에서 끊김) ISM 방식대로 계산한다:
  기업활동·신규주문·고용·공급업체 납품 4개 지수의 단순평균. ISM이 이 합성지수를 내기 시작한 2008.1부터.

사용: python scripts/excel/build_ism_db.py
"""
import datetime as dt
import os
import sqlite3

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(ROOT, 'data')
XLSX = os.path.join(DATA_DIR, 'Infomax_data.xlsx')
SERIES_COLS = ['column_name', 'sheet', 'col_idx', 'block_title', 'field',
               'title', 'frequency', 'units', 'seasonal_adjustment', 'last_updated', 'observation_end']

# 엑셀 열 번호(0 = 날짜) → (칼럼명, 영문 이름, 처음 값이 맞는 달)
COLS = {
    2: ('ISM_MFG_PMI', 'ISM Manufacturing PMI', None),
    3: ('ISM_MFG_NEWORD', 'ISM Manufacturing: New Orders', None),
    4: ('ISM_MFG_PROD', 'ISM Manufacturing: Production', None),
    5: ('ISM_MFG_EMP', 'ISM Manufacturing: Employment', None),
    6: ('ISM_MFG_DELIV', 'ISM Manufacturing: Supplier Deliveries', None),
    7: ('ISM_MFG_INV', 'ISM Manufacturing: Inventories', None),
    8: ('ISM_MFG_CUSTINV', "ISM Manufacturing: Customers' Inventories", '1997-01'),
    9: ('ISM_MFG_PRICES', 'ISM Manufacturing: Prices', None),
    10: ('ISM_MFG_BACKLOG', 'ISM Manufacturing: Backlog of Orders', '1993-01'),
    11: ('ISM_MFG_IMPORTS', 'ISM Manufacturing: Imports', '1989-10'),
    12: ('ISM_MFG_EXPORTS', 'ISM Manufacturing: New Export Orders', '1988-01'),
    14: ('ISM_SVC_NEWORD', 'ISM Services: New Orders', '1997-07'),
    15: ('ISM_SVC_BUSACT', 'ISM Services: Business Activity', '1997-07'),
    16: ('ISM_SVC_EMP', 'ISM Services: Employment', '1997-07'),
    17: ('ISM_SVC_DELIV', 'ISM Services: Supplier Deliveries', '1997-07'),
    18: ('ISM_SVC_INV', 'ISM Services: Inventories', '1997-07'),
    19: ('ISM_SVC_INVSENT', 'ISM Services: Inventory Sentiment', '1997-08'),
    20: ('ISM_SVC_PRICES', 'ISM Services: Prices', '1997-07'),
    21: ('ISM_SVC_BACKLOG', 'ISM Services: Backlog of Orders', '1997-07'),
    22: ('ISM_SVC_IMPORTS', 'ISM Services: Imports', '1997-07'),
    23: ('ISM_SVC_EXPORTS', 'ISM Services: New Export Orders', '1997-07'),
}
SVC_PMI = ('ISM_SVC_PMI', 'ISM Services PMI', '2008-01')
SVC_PARTS = ['ISM_SVC_BUSACT', 'ISM_SVC_NEWORD', 'ISM_SVC_EMP', 'ISM_SVC_DELIV']


def read_excel():
    """{칼럼명: {'YYYY-MM-01': 값}}"""
    ws = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)['ISM']
    data = {name: {} for name, _, _ in COLS.values()}
    for r in ws.iter_rows(min_row=4, values_only=True):
        if not isinstance(r[0], dt.datetime):
            continue
        ym = r[0].strftime('%Y-%m')
        for j, (name, _, start) in COLS.items():
            if isinstance(r[j], (int, float)) and (start is None or ym >= start):
                data[name][f'{ym}-01'] = float(r[j])
    parts = [data[p] for p in SVC_PARTS]
    data[SVC_PMI[0]] = {d: round(sum(p[d] for p in parts) / 4, 2) for d in parts[0]
                        if d >= f'{SVC_PMI[2]}-01' and all(d in p for p in parts)}
    return data


def write(path, data, meta_rows):
    con = sqlite3.connect(path)
    con.execute('CREATE TABLE IF NOT EXISTS market (date TEXT PRIMARY KEY)')
    con.execute(f"CREATE TABLE IF NOT EXISTS series ({', '.join(SERIES_COLS)}, PRIMARY KEY(column_name))")
    con.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)')
    cols = {r[1] for r in con.execute('PRAGMA table_info(market)')}
    for name, values in data.items():
        if name not in cols:
            con.execute(f'ALTER TABLE market ADD COLUMN "{name}" REAL')
        con.execute(f'UPDATE market SET "{name}"=NULL')  # 엑셀이 원본이라 통째로 덮어씀 (수정치 반영)
        con.executemany('INSERT OR IGNORE INTO market(date) VALUES (?)', [(d,) for d in values])
        con.executemany(f'UPDATE market SET "{name}"=? WHERE date=?', [(v, d) for d, v in values.items()])
    con.executemany(f"INSERT OR REPLACE INTO series VALUES ({','.join('?' * len(SERIES_COLS))})", meta_rows)
    con.execute("INSERT OR REPLACE INTO meta VALUES ('updated_ism', ?)", (dt.datetime.now().isoformat(timespec='seconds'),))
    con.commit()
    con.execute('VACUUM')
    con.close()


def main():
    data = read_excel()
    names = {name: (title, start) for name, title, start in [*COLS.values(), SVC_PMI]}
    meta_rows = []
    for i, name in enumerate(data, 1):
        title, _ = names[name]
        block = 'ISM Manufacturing' if name.startswith('ISM_MFG') else 'ISM Services'
        meta_rows.append((name, 'ism', i, block, 'Index', title, 'M', 'Index', 'SA', None, max(data[name])))
    ism = os.path.join(DATA_DIR, 'ism.db')
    if os.path.exists(ism):
        os.remove(ism)
    write(ism, data, meta_rows)
    write(os.path.join(DATA_DIR, 'fred_monthly.db'), data, meta_rows)
    for name in data:
        d = data[name]
        print(f'{name:<16} {min(d)[:7]} ~ {max(d)[:7]}  {len(d):>4}개  최근 {d[max(d)]}')


if __name__ == '__main__':
    main()
