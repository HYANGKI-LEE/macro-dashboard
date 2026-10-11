# 대시보드에 쓰는 FRED 시리즈 (HYANGKI-LEE/fred 의 mySeriesIds/us_macro.py 에서 골라 옴)
# key   : 대시보드(js/app.js)에서 부르는 이름
# id    : FRED series id
# units : FRED 변환 옵션. lin(원값, 기본) / pc1(전년동기비 %) / chg(전기 대비 증감)
# splice: 여러 시리즈를 이어 붙임(뒤의 시리즈가 우선)

START = '1990-01-01'

DAILY = [
    # 기준금리: 08.12.16 이전은 단일 목표치(DFEDTAR), 이후는 목표 범위 상단(DFEDTARU)
    {'key': 'FED_UPPER', 'splice': ['DFEDTAR', 'DFEDTARU']},
    {'key': 'UST2Y', 'id': 'DGS2'},
    {'key': 'UST10Y', 'id': 'DGS10'},
    {'key': 'WTI', 'id': 'DCOILWTICO'},
]

MONTHLY = [
    {'key': 'FED_UPPER_M', 'from_daily': 'FED_UPPER'},  # 일별 기준금리의 월말 값
    {'key': 'CPI_YOY', 'id': 'CPIAUCSL', 'units': 'pc1'},
    {'key': 'PCE_YOY', 'id': 'PCEPI', 'units': 'pc1'},
    {'key': 'CORE_PCE_YOY', 'id': 'PCEPILFE', 'units': 'pc1'},
    {'key': 'UNRATE', 'id': 'UNRATE'},
    {'key': 'JOB_OPENINGS_RATE', 'id': 'JTSJOR'},
    {'key': 'NFP_CHG', 'id': 'PAYEMS', 'units': 'chg'},
    {'key': 'HOUSING_STARTS', 'id': 'HOUST'},
    {'key': 'BUILDING_PERMITS', 'id': 'PERMIT'},
    {'key': 'NEW_HOME_SALES', 'id': 'HSN1F'},
    # 기존주택판매(EXHOSLUSM495S)는 NAR 라이선스로 최근 13개월만 제공돼 엑셀(Info(월))을 계속 사용
]
