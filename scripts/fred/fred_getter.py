# HYANGKI-LEE/fred 의 fred_getter.py 를 대시보드용으로 옮긴 것.
# 바뀐 점: API 키는 환경변수(FRED_API_KEY), 재시도 횟수 제한, SSL 검증 사용, 조회 옵션(params) 추가.
import os
import time

import requests

API = 'https://api.stlouisfed.org/fred'
MAX_RETRY = 5


def _get(path, **params):
    key = os.environ.get('FRED_API_KEY')
    if not key:
        raise RuntimeError('FRED_API_KEY 환경변수가 없습니다')
    params.update(api_key=key, file_type='json')
    status = None
    for attempt in range(MAX_RETRY):
        try:
            response = requests.get(f'{API}/{path}', params=params, timeout=30)
            status = response.status_code
            if status == 200:
                return response.json()
            if status != 429 and status < 500:
                break  # 잘못된 요청은 재시도해도 소용없음
        except requests.RequestException as e:
            status = type(e).__name__
        print(f'Retrying {path} {params.get("series_id")} ({attempt + 1}/{MAX_RETRY})...')
        time.sleep(10 * (attempt + 1))
    # 에러 메시지에 URL(=API 키)이 찍히지 않도록 직접 만든다
    raise RuntimeError(f'FRED 요청 실패: {path} {params.get("series_id")} (status {status})')


def getSeriesInfo(series_id):
    return _get('series', series_id=series_id)


def getObservations(series_id, **params):
    """params 예: observation_start='1990-01-01', units='pc1'(전년비 %) / 'chg'(전기 대비 증감)"""
    data = _get('series/observations', series_id=series_id, **params)
    if not data.get('observations'):
        raise RuntimeError(f'FRED 데이터 없음: {series_id}')
    return data
