"""FRED 시리즈를 받아 data/macro.db(SQLite)에 저장한다. TradingCheckboard의 market.db와 같은 구조.

  market(date TEXT PRIMARY KEY, <티커> REAL, ...)                     - 와이드 테이블, 칼럼 = FRED series id
  series(column_name, sheet, col_idx, block_title, field, ...)        - 칼럼 메타 (sheet = us_macro.py의 리스트명)
  meta(key, value)                                                    - 빌드 정보

- 티커 목록은 mySeriesIds/us_macro.py (HYANGKI-LEE/fred 에서 복사)의 ids_* 리스트 전체. 중복 티커는 한 칼럼.
- 증분 업데이트: FRED 값이 있는 칸만 덮어쓴다(수정치 반영). 없는 날짜는 행을 추가한다.
- us_macro.py에서 빠진 티커는 --drop-missing 을 줄 때만 DB에서 삭제한다.
- 실패한 티커는 건너뛰고 마지막에 목록을 출력한다(기존 DB 값은 유지).

사용: python build_fred_db.py [--only GDP,UNRATE] [--drop-missing]
"""
import argparse
import datetime as dt
import os
import re
import sqlite3
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from fred_getter import getObservations, getSeriesInfo  # noqa: E402

LIST_FILE = os.path.join(HERE, 'mySeriesIds', 'us_macro.py')
DB = os.path.join(ROOT, 'data', 'macro.db')
SERIES_COLS = ['column_name', 'sheet', 'col_idx', 'block_title', 'field',
               'title', 'frequency', 'units', 'seasonal_adjustment', 'last_updated', 'observation_end']


def load_env():
    path = os.path.join(ROOT, '.env')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            k, _, v = line.strip().partition('=')
            if k and v and k not in os.environ:
                os.environ[k] = v


def read_tickers():
    """us_macro.py 를 위에서부터 읽어 [(티커, 리스트명, 섹션 주석)] 반환 (주석 처리된 티커는 제외)."""
    out, seen, group, section = [], {}, None, ''
    for line in open(LIST_FILE, encoding='utf-8'):
        s = line.strip()
        m = re.match(r'^(ids_\w+)\s*=\s*\[', s)
        if m:
            group, section = m.group(1), ''
            continue
        if group is None:
            continue
        if s.startswith(']'):
            group = None
        elif s.startswith('#') and not re.match(r"^#+\s*'", s):
            title = s.lstrip('#-').strip()
            if title:
                section = title
        else:
            m = re.match(r"^'([^']+)'", s)
            if m:
                key = m.group(1)
                if key in seen:
                    if group not in out[seen[key]][1]:
                        out[seen[key]][1].append(group)
                else:
                    seen[key] = len(out)
                    out.append((key, [group], section))
    return [(k, ','.join(g), sec) for k, g, sec in out]


def ensure_schema(con):
    con.execute('CREATE TABLE IF NOT EXISTS market (date TEXT PRIMARY KEY)')
    con.execute(f"CREATE TABLE IF NOT EXISTS series ({', '.join(SERIES_COLS)}, PRIMARY KEY(column_name))")
    con.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)')


def fetch(series_id):
    obs = getObservations(series_id)['observations']
    return {o['date']: float(o['value']) for o in obs if o['value'] not in ('.', '')}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', default=DB)
    ap.add_argument('--only', help='쉼표로 구분한 티커만 갱신')
    ap.add_argument('--drop-missing', action='store_true')
    a = ap.parse_args()
    load_env()

    tickers = read_tickers()
    if a.only:
        only = set(a.only.split(','))
        tickers = [t for t in tickers if t[0] in only]
    print(f'티커 {len(tickers)}개')

    con = sqlite3.connect(a.db)
    ensure_schema(con)
    cols = {r[1] for r in con.execute('PRAGMA table_info(market)')}
    failed, added, changed, calls = [], [], 0, 0

    for n, (key, group, section) in enumerate(tickers, 1):
        try:
            info = getSeriesInfo(key)['seriess'][0]
            data = fetch(key)
            calls += 2
        except Exception as e:  # noqa: BLE001 - 한 티커 실패로 전체를 멈추지 않는다
            failed.append((key, str(e)))
            print(f'[{n}/{len(tickers)}] {key:<20} 실패: {e}')
            continue
        if calls % 40 == 0:
            time.sleep(5)  # FRED 호출 제한(분당 120회) 여유

        if key not in cols:
            con.execute(f'ALTER TABLE market ADD COLUMN "{key}" REAL')
            cols.add(key)
            added.append(key)
        old = dict(con.execute(f'SELECT date, "{key}" FROM market WHERE "{key}" IS NOT NULL'))
        changed += sum(1 for d, v in data.items() if d in old and abs(old[d] - v) > 1e-9)
        con.executemany('INSERT OR IGNORE INTO market(date) VALUES (?)', [(d,) for d in data])
        con.executemany(f'UPDATE market SET "{key}"=? WHERE date=?', [(v, d) for d, v in data.items()])
        con.execute(f"INSERT OR REPLACE INTO series VALUES ({','.join('?' * len(SERIES_COLS))})", (
            key, group, n, section, info.get('units_short', ''),
            info.get('title'), info.get('frequency_short'), info.get('units'),
            info.get('seasonal_adjustment_short'), info.get('last_updated'), info.get('observation_end')))
        con.commit()
        print(f'[{n}/{len(tickers)}] {key:<20} {len(data):>6} obs  ~{info.get("observation_end")}  {info.get("title", "")[:60]}')

    dropped = []
    if a.drop_missing and not a.only:
        keep = {t[0] for t in tickers}
        for c in sorted(cols - keep - {'date'}):
            con.execute(f'ALTER TABLE market DROP COLUMN "{c}"')
            con.execute('DELETE FROM series WHERE column_name=?', (c,))
            dropped.append(c)

    con.execute("INSERT OR REPLACE INTO meta VALUES ('source', 'FRED, Federal Reserve Bank of St. Louis')")
    con.execute("INSERT OR REPLACE INTO meta VALUES ('updated_fred', ?)", (dt.datetime.now().isoformat(timespec='seconds'),))
    con.commit()
    rows, ncol = con.execute('SELECT COUNT(*) FROM market').fetchone()[0], len(cols) - 1
    con.close()

    print(f'\n저장: {os.path.normpath(a.db)} ({os.path.getsize(a.db) / 1e6:.1f} MB) - {rows:,}행 x {ncol}개 티커')
    print(f'새 칼럼 {len(added)}개, 기존 값 수정 {changed}칸, 삭제 {len(dropped)}개')
    if failed:
        print(f'실패 {len(failed)}개:')
        for key, err in failed:
            print(f'  {key}: {err}')


if __name__ == '__main__':
    main()
