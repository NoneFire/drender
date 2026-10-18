---
format: md-report/1
mode: dashboard
title: 2026 年 10 月经营总览
eyebrow: 经营总览
status: 数据截至 2026-10-31 · 图表与数据表可交互
sqlite:
  path: examples/data/report-data.sqlite
  datasets:
    summary:
      table: regional_revenue
      queryFile: examples/queries/october-summary.sql
      updatedAt: '2026-10-31'
    monthly_revenue:
      table: monthly_revenue
      queryFile: examples/queries/monthly-revenue.sql
      columns:
        - name: month
          type: string
        - name: region
          type: string
        - name: revenue
          type: number
          unit: CNY
      updatedAt: '2026-10-31'
    monthly_share:
      table: monthly_revenue
      queryFile: examples/queries/monthly-share.sql
      columns:
        - name: month
          type: string
        - name: revenue
          type: number
          unit: CNY
        - name: share_east
          type: number
      updatedAt: '2026-10-31'
    channel_mix:
      view: report_channel_mix
      columns:
        - name: channel
          type: string
        - name: orders
          type: number
          unit: order
      updatedAt: '2026-10-31'
    regional_revenue:
      table: regional_revenue
      queryFile: examples/queries/regional-revenue.sql
      columns:
        - name: region
          type: string
        - name: orders
          type: number
          unit: order
        - name: revenue
          type: number
          unit: CNY
      updatedAt: '2026-10-31'
    order_details:
      table: order_details
      queryFile: examples/queries/paid-orders.sql
      columns:
        - name: order_id
          type: string
        - name: region
          type: string
        - name: channel
          type: string
        - name: amount
          type: number
          unit: CNY
        - name: paid_at
          type: string
      updatedAt: '2026-10-31'
metrics:
  oct_revenue:
    label: 10 月营收
    dataRef: summary
    field: revenue_total
    format: currency
    currency: CNY
    compact: true
    comparison:
      kind: mom
      dataRef: summary
      field: revenue_prev
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
    owner: 经营分析组
    definition: 当月已支付订单金额合计
  paid_orders:
    label: 支付订单
    dataRef: summary
    field: orders_total
    format: number
    unit: 单
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  average_order_value:
    label: 单均金额
    dataRef: summary
    field: average_order_value
    format: currency
    currency: CNY
    decimals: 2
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  share_east:
    label: 华东占比
    dataRef: summary
    field: share_east
    format: percent
    goodDirection: up
    comparison:
      kind: mom
      pointsDelta: true
      dataRef: summary
      field: share_east_prev
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  share_north:
    label: 华北占比
    dataRef: summary
    field: share_north
    format: percent
    goodDirection: up
    comparison:
      kind: mom
      pointsDelta: true
      dataRef: summary
      field: share_north_prev
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  concentration_gain:
    label: 华东占比提升
    dataRef: summary
    field: share_east_gain
    format: percentage-points
    goodDirection: down
    definition: 10 月华东占比减去 5 月华东占比
    source: 交易库 monthly_revenue
    asOf: '2026-10-31'
---

:::: dashboard columns=12
::: panel span=12
```kpi
{"title":"核心经营指标","items":[{"metricRef":"oct_revenue","sparkline":{"dataRef":"monthly_revenue","x":"month","y":"revenue","title":"月度营收"}},{"metricRef":"paid_orders"},{"metricRef":"average_order_value"},{"metricRef":"share_east"}]}
```
:::

::: panel span=8
```chart
{"kind":"combo","title":"营收与华东集中度","dataRef":"monthly_share","x":"month","unit":"元","axisFormat":{"format":"currency","compact":true},"series":[{"field":"revenue","type":"bar","axis":0,"name":"月度营收"},{"field":"share_east","type":"line","axis":1,"name":"华东占比","format":"percent"}],"targets":[{"value":500000,"label":"50 万"}]}
```
:::

::: panel span=4
```chart
{"kind":"pie","title":"支付渠道占比","dataRef":"channel_mix","x":"channel","y":"orders","unit":"单"}
```
:::

::: panel span=5
```ranking
{"dataRef":"regional_revenue","x":"region","y":"revenue","title":"区域营收排行","format":"currency","currency":"CNY","compact":true,"limit":5}
```
:::

::: panel span=7
```data-table
{"dataRef":"order_details","title":"近期支付订单","columns":[{"field":"order_id","label":"订单号"},{"field":"region","label":"地区"},{"field":"channel","label":"渠道"},{"field":"amount","label":"金额","format":"currency:CNY"}],"defaultSort":{"field":"amount","direction":"desc"},"viewportHeight":420}
```
:::
::::
