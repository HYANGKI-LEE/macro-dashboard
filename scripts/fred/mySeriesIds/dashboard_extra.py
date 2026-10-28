# 대시보드에 필요한데 us_macro.py 에 없는 티커 (01. US 매크로 엑셀 Main(분기) 차트에서 쓰는 것)

ids_extra = [
    # Charge-off Rate - All banks
    'CORSREACBS', # Charge-Off Rate on Loans Secured by Real Estate, All Commercial Banks
    'CORCREXFACBS', # Charge-Off Rate on Commercial Real Estate Loans (Excluding Farmland), Booked in Domestic Offices, All Commercial Banks
    'CORCCACBS', # Charge-Off Rate on Credit Card Loans, All Commercial Banks
    'CORLFRACBS', # Charge-Off Rate on Lease Financing Receivables, All Commercial Banks
    'CORBLACBS', # Charge-Off Rate on Business Loans, All Commercial Banks

    # Debt
    'CDSP', # Consumer Debt Service Payments as a Percent of Disposable Personal Income
    'BCNSDODNS', # Nonfinancial Corporate Business; Debt Securities and Loans; Liability, Level
    'CMDEBT', # Households and Nonprofit Organizations; Debt Securities and Loans; Liability, Level
    'PINCOME', # Personal Income

    # Yield curve
    'T10Y2Y', # 10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity

    # Wage - Usual weekly earnings by quartile (Main(분기) L~O)
    'LEU0252916100Q', # Employed full time: Median usual weekly nominal earnings: 1st quartile
    'LEU0252887700Q', # Employed full time: Median usual weekly nominal earnings
    'LEU0252916200Q', # Employed full time: Median usual weekly nominal earnings: 3rd quartile
    'LEU0252916300Q', # Employed full time: Median usual weekly nominal earnings: 9th decile

    # Household balance sheet
    'HOOREVLMHMV', # Households; Owner-Occupied Real Estate including Vacant Land and Mobile Homes at Market Value
    'BOGZ1FL193030205Q', # Households; Time and Savings Deposits; Asset, Level
    'BOGZ1FL192090005Q', # Households; Net Worth, Level
    'DPI', # Disposable Personal Income
    'A072RC1Q156SBEA', # Personal Saving Rate

    # Distributional Financial Accounts - share of total assets / level of financial assets
    'WFRBST01108', # Share of Total Assets Held by the Top 1%
    'WFRBSN09135', # Share of Total Assets Held by the 90th to 99th Wealth Percentiles
    'WFRBSN40162', # Share of Total Assets Held by the 50th to 90th Wealth Percentiles
    'WFRBSB50189', # Share of Total Assets Held by the Bottom 50%
    'WFRBLT01004', # Financial Assets Held by the Top 1%
    'WFRBLN09031', # Financial Assets Held by the 90th to 99th Wealth Percentiles
    'WFRBLN40058', # Financial Assets Held by the 50th to 90th Wealth Percentiles
    'WFRBLB50085', # Financial Assets Held by the Bottom 50%

    # Money & equity (엑셀은 블룸버그 M2 Index, SPX)
    'M2SL', # M2
    'SP500', # S&P 500 (FRED는 최근 10년만 제공)
]

# 내구재 주문 - Census M3 (기업/생산 > 제조업). DGORDER, NEWORDER 는 us_macro.py 에 있음
ids_durable = [
    'ADXTNO', # Manufacturers' New Orders: Durable Goods Excluding Transportation
    'ADXDNO', # Manufacturers' New Orders: Durable Goods Excluding Defense
    'ANDENO', # Manufacturers' New Orders: Nondefense Capital Goods
    'ANXAVS', # Manufacturers' Value of Shipments: Nondefense Capital Goods Excluding Aircraft
    'AMDMUO', # Manufacturers' Unfilled Orders: Durable Goods
    'AMDMVS', # Manufacturers' Value of Shipments: Durable Goods
    'AMDMTI', # Manufacturers' Total Inventories: Durable Goods
    'A34SNO', # Manufacturers' New Orders: Computers and Electronic Products
    'A33SNO', # Manufacturers' New Orders: Machinery
    'A35SNO', # Manufacturers' New Orders: Electrical Equipment, Appliances and Components
    'A31SNO', # Manufacturers' New Orders: Primary Metals
    'A32SNO', # Manufacturers' New Orders: Fabricated Metal Products
    'A36SNO', # Manufacturers' New Orders: Transportation Equipment
    'ANAPNO', # Manufacturers' New Orders: Nondefense Aircraft and Parts
    'ADAPNO', # Manufacturers' New Orders: Defense Aircraft and Parts
]
