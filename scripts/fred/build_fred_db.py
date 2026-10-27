"""FRED 시리즈를 받아 주기별 SQLite DB에 저장한다. 각 DB는 TradingCheckboard의 market.db와 같은 구조.

  data/fred_daily.db / fred_weekly.db / fred_monthly.db / fred_quarterly.db  (FRED frequency 기준으로 자동 분류)

  market(date TEXT PRIMARY KEY, <티커> REAL, ...)                     - 와이드 테이블, 칼럼 = FRED series id
  series(column_name, sheet, col_idx, block_title, field, ...)        - 칼럼 메타 (sheet = us_macro.py의 리스트명)
  meta(key, value)                                                    - 빌드 정보

- 주기별로 나누는 이유: 주기가 섞이면 일별 날짜 행마다 월·분기 칼럼이 빈칸으로 붙어 파일이 커지고,
  매일 바뀌는 건 일별 DB뿐이라 git에 다시 올라가는 양도 줄어든다.
- 티커 목록은 mySeriesIds/us_macro.py (HYANGKI-LEE/fred 에서 복사)와 dashboard_extra.py 의 ids_* 리스트 전체. 중복 티커는 한 칼럼.
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

LIST_FILES = [os.path.join(HERE, 'mySeriesIds', f) for f in ('us_macro.py', 'dashboard_extra.py')]
DATA_DIR = os.path.join(ROOT, 'data')
# FRED frequency_short → DB 이름. 목록에 없는 주기(연간 등)는 fred_other.db
FREQ_DB = {'D': 'daily', 'W': 'weekly', 'BW': 'weekly', 'M': 'monthly', 'Q': 'quarterly'}
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
    """티커 목록 파일들을 위에서부터 읽어 [(티커, 리스트명, 섹션 주석)] 반환 (주석 처리된 티커는 제외)."""
    out, seen, group, section = [], {}, None, ''
    lines = [line for f in LIST_FILES for line in open(f, encoding='utf-8')]
    for line in lines:
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


class FreqDB:
    """주기별 DB 하나. 필요할 때 열고 칼럼 목록을 기억한다."""

    def __init__(self, name):
        self.path = os.path.join(DATA_DIR, f'fred_{name}.db')
        self.con = sqlite3.connect(self.path)
        ensure_schema(self.con)
        self.cols = {r[1] for r in self.con.execute('PRAGMA table_info(market)')} - {'date'}
        self.added, self.changed, self.dropped, self.touched = [], 0, [], False

    def drop(self, key):
        self.con.execute(f'ALTER TABLE market DROP COLUMN "{key}"')
        self.con.execute('DELETE FROM series WHERE column_name=?', (key,))
        self.cols.discard(key)
        self.dropped.append(key)
        self.touched = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='쉼표로 구분한 티커만 갱신')
    ap.add_argument('--drop-missing', action='store_true')
    a = ap.parse_args()
    load_env()

    tickers = read_tickers()
    if a.only:
        only = set(a.only.split(','))
        tickers = [t for t in tickers if t[0] in only]
    print(f'티커 {len(tickers)}개')

    # 이미 있는 DB는 모두 열어 둔다 (주기가 바뀐 티커를 옛 DB에서 지우기 위해)
    dbs = {}
    for f in os.listdir(DATA_DIR):
        m = re.match(r'^fred_(\w+)\.db$', f)
        if m:
            dbs[m.group(1)] = FreqDB(m.group(1))
    failed, calls = [], 0

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

        name = FREQ_DB.get(info.get('frequency_short'), 'other')
        db = dbs.get(name) or dbs.setdefault(name, FreqDB(name))
        for other in dbs.values():
            if other is not db and key in other.cols:
                other.drop(key)
        con = db.con
        if key not in db.cols:
            con.execute(f'ALTER TABLE market ADD COLUMN "{key}" REAL')
            db.cols.add(key)
            db.added.append(key)
        old = dict(con.execute(f'SELECT date, "{key}" FROM market WHERE "{key}" IS NOT NULL'))
        db.changed += sum(1 for d, v in data.items() if d in old and abs(old[d] - v) > 1e-9)
        con.executemany('INSERT OR IGNORE INTO market(date) VALUES (?)', [(d,) for d in data])
        con.executemany(f'UPDATE market SET "{key}"=? WHERE date=?', [(v, d) for d, v in data.items()])
        con.execute(f"INSERT OR REPLACE INTO series VALUES ({','.join('?' * len(SERIES_COLS))})", (
            key, group, n, section, info.get('units_short', ''),
            info.get('title'), info.get('frequency_short'), info.get('units'),
            info.get('seasonal_adjustment_short'), info.get('last_updated'), info.get('observation_end')))
        con.commit()
        db.touched = True
        print(f'[{n}/{len(tickers)}] {key:<20} {name:<9} {len(data):>6} obs  ~{info.get("observation_end")}  {info.get("title", "")[:50]}')

    if a.drop_missing and not a.only:
        keep = {t[0] for t in tickers}
        for db in dbs.values():
            for c in sorted(db.cols - keep):
                db.drop(c)

    print()
    now = dt.datetime.now().isoformat(timespec='seconds')
    for name, db in sorted(dbs.items()):
        con = db.con
        if db.touched:
            con.execute("DELETE FROM market WHERE " + (' AND '.join(f'"{c}" IS NULL' for c in db.cols) or '1'))  # 빈 행 정리
            con.execute("INSERT OR REPLACE INTO meta VALUES ('source', 'FRED, Federal Reserve Bank of St. Louis')")
            con.execute("INSERT OR REPLACE INTO meta VALUES ('frequency', ?)", (name,))
            con.execute("INSERT OR REPLACE INTO meta VALUES ('updated_fred', ?)", (now,))
            con.commit()
            con.execute('VACUUM')
        rows = con.execute('SELECT COUNT(*) FROM market').fetchone()[0]
        con.close()
        print(f'{os.path.basename(db.path):<20} {os.path.getsize(db.path) / 1e6:5.1f} MB  {rows:>6,}행 x {len(db.cols):>3}개 티커  '
              f'(새 칼럼 {len(db.added)}, 값 수정 {db.changed}칸, 삭제 {len(db.dropped)})')
    if failed:
        print(f'실패 {len(failed)}개:')
        for key, err in failed:
            print(f'  {key}: {err}')


if __name__ == '__main__':
    main()
