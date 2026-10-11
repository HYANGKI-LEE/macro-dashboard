"""FRED에서 미국 지표를 받아 data/fred.json 으로 저장한다. GitHub Actions에서 매일 실행.

출력 형식은 엑셀 파서(js/worker.js)와 같다: {daily|monthly: {dates: [epoch ms], cols: {key: [값|null]}}}
"""
import json
import os
import time
from datetime import datetime, timezone

from fred_getter import getObservations, getSeriesInfo
from series import DAILY, MONTHLY, START

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'fred.json')
calls = 0


def fetch(series_id, units='lin'):
    """{'YYYY-MM-DD': 값} 형태로 반환. FRED 결측치('.')는 None."""
    global calls
    calls += 1
    if calls % 20 == 0:
        time.sleep(5)  # FRED 호출 제한(분당 120회) 여유
    obs = getObservations(series_id, observation_start=START, units=units)['observations']
    return {o['date']: (None if o['value'] == '.' else round(float(o['value']), 4)) for o in obs}


def to_ms(day):
    return int(datetime.strptime(day, '%Y-%m-%d').replace(tzinfo=timezone.utc).timestamp() * 1000)


def to_table(series_by_key, weekdays_only=False):
    days = sorted({d for s in series_by_key.values() for d in s})
    if weekdays_only:
        days = [d for d in days if datetime.strptime(d, '%Y-%m-%d').weekday() < 5]
    return {
        'dates': [to_ms(d) for d in days],
        'cols': {key: [s.get(d) for d in days] for key, s in series_by_key.items()},
    }


def month_end_values(daily):
    """일별 시리즈 → 월별(해당 월 마지막 값, 날짜는 FRED 월별처럼 1일)"""
    out = {}
    for day in sorted(daily):
        if daily[day] is not None:
            out[day[:8] + '01'] = daily[day]
    return out


def main():
    meta = {}

    daily = {}
    for spec in DAILY:
        ids = spec.get('splice') or [spec['id']]
        merged = {}
        for series_id in ids:
            merged.update({d: v for d, v in fetch(series_id).items() if v is not None})
        daily[spec['key']] = merged
        meta[spec['key']] = {'ids': ids, 'title': getSeriesInfo(ids[-1])['seriess'][0]['title']}
        print(f'daily   {spec["key"]:<18} {len(merged)} obs')

    monthly = {}
    for spec in MONTHLY:
        if 'from_daily' in spec:
            monthly[spec['key']] = month_end_values(daily[spec['from_daily']])
            meta[spec['key']] = {'from_daily': spec['from_daily']}
        else:
            monthly[spec['key']] = fetch(spec['id'], spec.get('units', 'lin'))
            meta[spec['key']] = {'ids': [spec['id']], 'units': spec.get('units', 'lin'),
                                 'title': getSeriesInfo(spec['id'])['seriess'][0]['title']}
        print(f'monthly {spec["key"]:<18} {len(monthly[spec["key"]])} obs')

    data = {
        'source': 'FRED, Federal Reserve Bank of St. Louis',
        'start': START,
        'meta': meta,
        'daily': to_table(daily, weekdays_only=True),
        'monthly': to_table(monthly),
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'saved {os.path.normpath(OUT)} ({os.path.getsize(OUT):,} bytes)')


if __name__ == '__main__':
    main()
