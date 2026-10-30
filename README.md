# Macro Dashboard

`data/*.db`(SQLite)를 읽어 GitHub Pages에 표시하는 매크로 지표 대시보드.

## 데이터(DB)
| 파일 | 출처 | 만드는 스크립트 |
|---|---|---|
| `data/fred_daily.db` · `fred_weekly.db` · `fred_monthly.db` · `fred_quarterly.db` | FRED (`scripts/fred/mySeriesIds/us_macro.py` 티커 전체) | `python scripts/fred/build_fred_db.py` |
| `data/infomax_daily.db` · `infomax_monthly.db` · `infomax_quarterly.db` | 인포맥스 (`data/Macro.xlsx` 의 Info 시트) | `python scripts/excel/build_infomax_db.py` |

DB 구조는 모두 같다: `market`(date + 지표별 칼럼), `series`(칼럼 정보), `meta`(업데이트 시각).
FRED 스크립트는 로컬 `.env` 의 `FRED_API_KEY` 를 쓴다(git 제외).

## 데이터 업데이트
1. FRED: `build_fred_db.py` 실행 → 바뀐 `fred_*.db` commit·push
2. 인포맥스: `data/Macro.xlsx` 수정·저장 → `build_infomax_db.py` 실행 → xlsx와 `infomax_*.db` commit·push
   (`scripts/autopush.ps1` 이 이 과정을 자동으로 함)

## 화면 구성
`js/app.js` 의 `GROUPS`(사이드바 묶음: 미국)와 `PAGES`(페이지·차트) 설정으로 만든다.
