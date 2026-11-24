"""리치먼드 연은 제조업 서베이(FRED에 없음)를 받아 data/fred_monthly.db 에 RICH_* 칼럼으로 병합한다.

- 원자료: 연은 홈페이지의 과거 데이터 엑셀 하나 (주소 고정, 매달 같은 파일이 갱신됨). 1993.11~
- 계절조정(sa_*) 전부와 가격 4개(pct_chg_*, 원계열만 있음)를 넣는다. 끊긴 workwk(2022.5까지)는 제외.
  칼럼명: sa_mfg_composite → RICH_SA_COMPOSITE (끝의 _C = 현재, _E = 6개월 후 전망)
- 매번 전체를 덮어쓴다 (계절조정 수정치 반영).
- 출처 표기 필요: Federal Reserve Bank of Richmond

사용: python scripts/richmond/build_richmond_db.py
"""
import datetime as dt
import io
import os
import sqlite3

import openpyxl
import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = os.path.join(ROOT, 'data', 'fred_monthly.db')
URL = ('https://www.richmondfed.org/-/media/RichmondFedOrg/region_communities/regional_data_analysis/regional_economy/'
       'surveys_of_business_conditions/manufacturing/data/mfg_historicaldata.xlsx')


def read_excel():
    """{칼럼명: (원래 이름, {'YYYY-MM-01': 값})}"""
    r = requests.get(URL, headers={'User-Agent': 'Mozilla/5.0'}, timeout=60)
    r.raise_for_status()
    head, *rows = openpyxl.load_workbook(io.BytesIO(r.content), data_only=True).worksheets[0].values
    out = {}
    for j, h in enumerate(head):
        if not h or 'workwk' in h or not (h.startswith('sa_mfg_') or 'pct_chg' in h):
            continue
        out['RICH_' + h.replace('mfg_', '').upper()] = (h, {
            x[0].strftime('%Y-%m-01'): float(x[j]) for x in rows
            if isinstance(x[0], dt.datetime) and isinstance(x[j], (int, float))})
    if not out.get('RICH_SA_COMPOSITE', (None, {}))[1]:
        raise SystemExit('sa_mfg_composite 칼럼이 없습니다. 엑셀 형식이 바뀌었는지 확인하세요.')
    return out


def main():
    data = read_excel()
    con = sqlite3.connect(DB)
    cols = {r[1] for r in con.execute('PRAGMA table_info(market)')}
    for i, (name, (raw, values)) in enumerate(data.items(), 1):
        if name not in cols:
            con.execute(f'ALTER TABLE market ADD COLUMN "{name}" REAL')
        con.execute(f'UPDATE market SET "{name}"=NULL')
        con.executemany('INSERT OR IGNORE INTO market(date) VALUES (?)', [(d,) for d in values])
        con.executemany(f'UPDATE market SET "{name}"=? WHERE date=?', [(v, d) for d, v in values.items()])
        con.execute('INSERT OR REPLACE INTO series VALUES (?,?,?,?,?,?,?,?,?,?,?)', (
            name, 'richmond', i, 'Richmond Fed Manufacturing Survey', 'Index', f'Richmond Fed Manufacturing: {raw}', 'M',
            'Percent' if 'pct_chg' in raw else 'Index', 'SA' if raw.startswith('sa_') else 'NSA', None, max(values)))
        print(f'{name:<28} {min(values)[:7]} ~ {max(values)[:7]}  {len(values):>4}개  최근 {values[max(values)]}')
    con.execute("INSERT OR REPLACE INTO meta VALUES ('updated_richmond', ?)", (dt.datetime.now().isoformat(timespec='seconds'),))
    con.commit()
    con.execute('VACUUM')
    con.close()


if __name__ == '__main__':
    main()
