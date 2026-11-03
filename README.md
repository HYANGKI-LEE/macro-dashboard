# Macro Dashboard

`data/*.db`(SQLite)를 읽어 GitHub Pages에 표시하는 매크로 지표 대시보드.

## 데이터(DB)
| 파일 | 출처 | 만드는 스크립트 |
|---|---|---|
| `data/fred_daily.db` · `fred_weekly.db` · `fred_monthly.db` · `fred_quarterly.db` | FRED (`scripts/fred/mySeriesIds/us_macro.py` 티커 전체) | `python scripts/fred/build_fred_db.py` |
| `data/ism.db` (+ `fred_monthly.db`의 `ISM_*` 칼럼) | ISM 제조업·서비스업 PMI (인포맥스 엑셀 `data/Infomax_data.xlsx` ISM 시트, 로컬 전용) | `python scripts/excel/build_ism_db.py` |

DB 구조는 모두 같다: `market`(date + 지표별 칼럼), `series`(칼럼 정보), `meta`(업데이트 시각).
FRED 스크립트는 로컬 `.env` 의 `FRED_API_KEY` 를 쓴다(git 제외).

## 데이터 업데이트
1. FRED: `build_fred_db.py` 실행 → 바뀐 `fred_*.db` commit·push
2. 항목별 FRED DB(NIPA·Z.1·H.8 등): HYANGKI-LEE/fred 리포 GitHub Actions가 평일마다 갱신, 대시보드가 바로 읽음

인포맥스(`Macro.xlsx`)는 더 이상 쓰지 않는다 (2026-11 제거). ISM만 `Infomax_data.xlsx`에서 DB로 만들어 커밋한다(엑셀은 git에 안 올림).

## 화면 구성
`js/app.js` 의 `GROUPS`(사이드바 묶음: 미국)와 `PAGES`(페이지·차트) 설정으로 만든다.
