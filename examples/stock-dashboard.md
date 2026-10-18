---
format: md-report/1
mode: dashboard
title: AAPL.US 股价大屏
sqlite:
  path: examples/data/stock-dashboard.sqlite
  datasets:
    stock_daily:
      table: stock_bars
      queryFile: examples/queries/stock-daily.sql
      parameters: ["eodhd", "AAPL.US", "1d"]
      columns:
        - name: trade_date
          type: date
        - name: open
          type: number
          unit: USD
        - name: high
          type: number
          unit: USD
        - name: low
          type: number
          unit: USD
        - name: close
          type: number
          unit: USD
        - name: adjusted_close
          type: number
          unit: USD
        - name: volume
          type: number
          unit: shares
      source: "EOD Historical Data · 日线 EOD API"
      fetchedAt: '2026-10-16T22:57:07.471Z'
      updatedAt: '2026-10-16'
    stock_summary:
      table: stock_bars
      queryFile: examples/queries/stock-summary.sql
      parameters: ["eodhd", "AAPL.US", "1d"]
      maxRows: 1
      columns:
        - name: latest_adjusted_close
          type: number
          unit: USD
        - name: daily_return
          type: number
        - name: twenty_session_return_pct
          type: number
          unit: '%'
        - name: latest_volume
          type: number
          unit: shares
        - name: sample_days
          type: number
        - name: sample_start_date
          type: date
        - name: sample_end_date
          type: date
        - name: sample_period
          type: string
      source: "EOD Historical Data · 日线 EOD API"
      fetchedAt: '2026-10-16T22:57:07.471Z'
      updatedAt: '2026-10-16'
    stock_recent:
      table: stock_bars
      queryFile: examples/queries/stock-recent.sql
      parameters: ["eodhd", "AAPL.US", "1d"]
      columns:
        - name: trade_date
          type: date
        - name: open
          type: number
          unit: USD
        - name: high
          type: number
          unit: USD
        - name: low
          type: number
          unit: USD
        - name: close
          type: number
          unit: USD
        - name: adjusted_close
          type: number
          unit: USD
        - name: volume
          type: number
          unit: shares
      source: "EOD Historical Data · 日线 EOD API"
      fetchedAt: '2026-10-16T22:57:07.471Z'
      updatedAt: '2026-10-16'
---

:::: dashboard columns=12
::: panel span=12
```kpi
{"title":"AAPL.US 核心行情","items":[{"label":"最新调整收盘价","dataRef":"stock_summary","field":"latest_adjusted_close","unit":"USD","changeField":"daily_return","period":"较前一交易日"},{"label":"近 20 个交易日收益","dataRef":"stock_summary","field":"twenty_session_return_pct","unit":"%","period":"近 20 个交易日"},{"label":"最新成交量","dataRef":"stock_summary","field":"latest_volume","unit":"股","period":"最新交易日"},{"label":"样本交易日","dataRef":"stock_summary","field":"sample_days","unit":"日","periodField":"sample_period"}]}
```
:::

::: panel span=8
```chart
{"kind":"line","title":"AAPL.US 调整收盘价趋势","dataRef":"stock_daily","x":"trade_date","y":"adjusted_close","unit":"USD"}
```
:::

::: panel span=4
```chart
{"kind":"bar","title":"日成交量","dataRef":"stock_daily","x":"trade_date","y":"volume","unit":"股"}
```
:::

::: panel span=12
```data-table
{"dataRef":"stock_recent","title":"最近 20 个交易日","columns":[{"field":"trade_date","label":"交易日"},{"field":"open","label":"开盘价","format":"currency:USD"},{"field":"high","label":"最高价","format":"currency:USD"},{"field":"low","label":"最低价","format":"currency:USD"},{"field":"close","label":"收盘价","format":"currency:USD"},{"field":"adjusted_close","label":"调整收盘价","format":"currency:USD"},{"field":"volume","label":"成交量"}],"defaultSort":{"field":"trade_date","direction":"desc"},"viewportHeight":320}
```
:::
::::
