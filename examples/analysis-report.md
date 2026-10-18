---
format: md-report/1
mode: report
title: 2026 年 10 月经营数据分析报告
eyebrow: 月度经营分析
deck: 营收规模、区域贡献结构，以及本月增长来自哪里。
footer: 正文数字与图表引用同一份指标定义；口径与来源见文末。
toc: auto
sqlite:
  path: examples/data/report-data.sqlite
  datasets:
    summary:
      table: regional_revenue
      queryFile: examples/queries/october-summary.sql
      columns:
        - name: revenue_total
          type: number
          unit: CNY
        - name: orders_total
          type: number
          unit: order
        - name: average_order_value
          type: number
          unit: CNY
      updatedAt: '2026-10-31'
    monthly_total:
      table: monthly_revenue
      queryFile: examples/queries/monthly-total.sql
      columns:
        - name: month
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
    region_month:
      table: monthly_revenue
      queryFile: examples/queries/region-month.sql
      columns:
        - name: region
          type: string
        - name: month
          type: string
        - name: revenue
          type: number
          unit: CNY
      updatedAt: '2026-10-31'
    revenue_bridge:
      table: monthly_revenue
      queryFile: examples/queries/revenue-bridge.sql
      columns:
        - name: item
          type: string
        - name: delta
          type: number
          unit: CNY
      updatedAt: '2026-10-31'
    regional_radar:
      table: regional_revenue
      queryFile: examples/queries/regional-radar.sql
      columns:
        - name: dimension
          type: string
        - name: region
          type: string
        - name: score
          type: number
      updatedAt: '2026-10-31'
    conversion_steps:
      table: conversion_steps
      queryFile: examples/queries/conversion-steps.sql
      columns:
        - name: stage
          type: string
        - name: position
          type: number
        - name: users
          type: number
      updatedAt: '2026-10-31'
    conversion_paid:
      table: conversion_steps
      queryFile: examples/queries/conversion-paid.sql
      columns:
        - name: paid_users
          type: number
          unit: 人
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
  scenes:
    conversion_flow:
      table: report_scenes
      queryFile: examples/queries/conversion-flow-scene.sql
      column: scene_json
metrics:
  oct_revenue:
    label: 10 月营收
    dataRef: summary
    field: revenue_total
    format: currency
    currency: CNY
    compact: true
    goodDirection: up
    comparison:
      kind: mom
      dataRef: summary
      field: revenue_prev
    definition: 当月已支付订单金额合计，含税，按订单支付时间归属月份
    numerator: 各区域已支付订单金额
    denominator: 月度营收合计
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
    owner: 经营分析组
  revenue_mom:
    label: 营收环比
    dataRef: summary
    field: revenue_mom
    format: percent
    goodDirection: up
    definition: 本月营收 / 上月营收 − 1
    numerator: 本月营收
    denominator: 上月营收
    source: 交易库 monthly_revenue
    asOf: '2026-10-31'
  paid_orders:
    label: 支付订单
    dataRef: summary
    field: orders_total
    format: number
    unit: 单
    goodDirection: up
    definition: 当月状态为已支付的订单笔数
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  average_order_value:
    label: 单均金额
    dataRef: summary
    field: average_order_value
    format: currency
    currency: CNY
    decimals: 2
    goodDirection: up
    definition: 当月营收 / 当月支付订单笔数
    numerator: 当月营收
    denominator: 当月支付订单笔数
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
    definition: 华东营收 / 当月营收合计
    numerator: 华东营收
    denominator: 月度营收合计
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  share_south:
    label: 华南占比
    dataRef: summary
    field: share_south
    format: percent
    goodDirection: up
    comparison:
      kind: mom
      pointsDelta: true
      dataRef: summary
      field: share_south_prev
    definition: 华南营收 / 当月营收合计
    numerator: 华南营收
    denominator: 月度营收合计
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
    definition: 华北营收 / 当月营收合计
    numerator: 华北营收
    denominator: 月度营收合计
    source: 交易库 regional_revenue
    asOf: '2026-10-31'
  concentration_gain:
    label: 华东占比提升
    dataRef: summary
    field: share_east_gain
    format: percentage-points
    goodDirection: down
    definition: 10 月华东占比减去 5 月华东占比，正值表示集中度上升
    numerator: 10 月华东占比
    denominator: 5 月华东占比
    source: 交易库 monthly_revenue
    asOf: '2026-10-31'
  conversion_paid:
    label: 完成支付人数
    dataRef: conversion_paid
    field: paid_users
    format: number
    unit: 人
    definition: 当月漏斗中「完成支付」阶段的人数，应与支付订单数互相对应
    source: 行为埋点 conversion_steps
    asOf: '2026-10-31'
---

::: note
本报告回答三个问题：10 月营收增长了多少、增长来自哪个区域、区域结构正在如何变化。正文数字与图表都引用 frontmatter 中同一份指标定义，因此不存在同一指标出现两个数值的可能。口径与来源见文末「口径与来源」。
:::

## 摘要

10 月营收 **{{oct_revenue}}**，环比 **{{revenue_mom}}**。区域结构为：华东 **{{share_east}}**、华南 **{{share_south}}**、华北 **{{share_north}}**，三者合计构成本月全部营收。

当月支付订单 **{{paid_orders}}**，单均金额 **{{average_order_value}}**。增长主要由华东贡献：华东占比环比提升 **{{share_east}}**，而华北占比下降 **{{share_north}}**。

> 分析范围：2026-10-01 至 2026-10-31；环比基期为 2026-09；数据截至 2026-10-31。

::: success
**结论：** 本月增长质量集中在华东，营收与订单同步提升。需要关注的是增长来源单一化——华东占比已从 5 月的水平连续上升，华北本月几乎持平，区域结构的不均衡在扩大。
:::

## 关键发现

```findings
{"title":"关键发现","kicker":"发现","items":[{"severity":"opportunity","title":"10 月营收创近 6 个月新高","detail":"营收环比增速高于此前 5 个月的水平。","metricRef":"oct_revenue","evidence":["revenue-trend"],"action":"维持华东与内容渠道投入","owner":"经营分析组"},{"severity":"risk","title":"增长高度依赖华东","detail":"华东占比环比提升，同时华南与华北占比下降，区域集中度连续上升。","metricRef":"concentration_gain","evidence":["region-share","region-concentration"],"action":"按区域复核投放与库存配置","owner":"区域运营组"},{"severity":"risk","title":"华北本月几乎持平","detail":"华北营收占比环比下降，是三个区域中唯一明显走弱的。","metricRef":"share_north","evidence":["region-share"],"action":"下钻华北城市与品类，确认是否口径或供给问题","owner":"区域运营组"}]}
```

## 核心指标

```kpi
{"items":[{"metricRef":"oct_revenue","sparkline":{"dataRef":"monthly_total","x":"month","y":"revenue","title":"月度营收趋势"}},{"metricRef":"revenue_mom"},{"metricRef":"paid_orders"},{"metricRef":"average_order_value"},{"metricRef":"share_north"},{"metricRef":"conversion_paid"}]}
```

## 营收走势

```chart
{"kind":"bar","title":"月度营收合计","dataRef":"monthly_total","x":"month","y":"revenue","unit":"元","anchor":"revenue-trend"}
```

```chart
{"kind":"combo","title":"营收规模与华东集中度","dataRef":"monthly_share","x":"month","unit":"元","kicker":"统计图","axisFormat":{"format":"currency","compact":true},"series":[{"field":"revenue","type":"bar","axis":0,"name":"月度营收","format":"currency","compact":true},{"field":"share_east","type":"line","axis":1,"name":"华东占比","format":"percent"}]}
```

营收规模与区域集中度同图对照：柱为当月营收合计，线为华东营收占全公司营收的比例（右轴）。两条线同时上行，说明增量与集中度同向变化。

```chart
{"kind":"area","title":"各区域营收趋势","dataRef":"monthly_revenue","x":"month","y":"revenue","series":"region","unit":"元"}
```

```chart
{"kind":"line","title":"华东占比趋势","dataRef":"monthly_share","x":"month","y":"share_east","unit":"比例","axisFormat":{"format":"percent"},"anchor":"region-concentration","targets":[{"value":0.5,"label":"50% 参考线"}]}
```

## 区域结构

```chart
{"kind":"bar","title":"10 月区域营收","dataRef":"regional_revenue","x":"region","y":"revenue","unit":"元","anchor":"region-share"}
```

```ranking
{"dataRef":"regional_revenue","x":"region","y":"revenue","title":"区域营收排行","kicker":"排行","format":"currency","currency":"CNY","compact":true,"limit":5}
```

区域营收占比在 10 月的绝对水平与变动方向：

```pivot
{"dataRef":"region_month","rows":"region","columns":"month","value":"revenue","agg":"sum","title":"区域 × 月份营收","kicker":"交叉表","rowsLabel":"地区","columnsLabel":"月份","format":"currency","currency":"CNY","compact":true,"columnTotal":true}
```

## 增长归因

```chart
{"kind":"waterfall","title":"9 月到 10 月营收桥","dataRef":"revenue_bridge","x":"item","y":"delta","totalField":"is_total","unit":"元"}
```

桥图把营收变化拆成各区域增量：期初与期末为绝对值，中间为增量。读者可以直接看出增量来自哪些区域。

```chart
{"kind":"radar","title":"区域能力对比（最佳区域 = 100）","dataRef":"regional_radar","x":"dimension","y":"score","series":"region"}
```

```chart
{"kind":"scatter","title":"区域订单量与营收","dataRef":"regional_revenue","x":"orders","y":"revenue","unit":"元"}
```

## 转化链路

```mermaid title="从触达到复购的转化链路"
flowchart LR
  Reach[内容触达] --> Visit[商品访问]
  Visit --> Cart[加入购物车]
  Cart --> Paid[完成支付]
  Paid --> Repeat[会员复购]
```

```chart
{"kind":"funnel","title":"10 月转化漏斗","dataRef":"conversion_steps","x":"stage","y":"users","unit":"人"}
```

漏斗最后一步之前的「完成支付」人数为 **{{conversion_paid}}**，与区域营收表中的订单合计一致，因此漏斗与营收口径互相印证。

```infographic title="本月行动建议"
infographic list-row-simple-horizontal-arrow
data
  lists
    - label: 维持华东投入
      desc: 华东是本月增量的主要来源，优先保证其供给与投放
    - label: 复核华北停滞
      desc: 华北占比环比下降，需确认是需求、供给还是口径问题
    - label: 监控集中度
      desc: 华东占比持续上升，单一区域依赖需要设置观察阈值
```

## 叙述式分析

```antv-t8 title="一段话结论"
10 月营收为[{{oct_revenue}}](metric_value)，环比[{{revenue_mom}}](ratio_value, assessment="positive")。
华东[贡献占比为 {{share_east}}](contribute_ratio, assessment="positive")，华北占比为 [{{share_north}}](ratio_value, assessment="negative")。
两个区域的占比变动方向相反，说明本月增量并非全区域同步。
```

## 订单明细

```data-table
{"dataRef":"order_details","title":"已支付订单抽样","kicker":"数据表","columns":[{"field":"order_id","label":"订单号","frozen":true},{"field":"region","label":"地区"},{"field":"channel","label":"渠道"},{"field":"amount","label":"金额","format":"currency:CNY"},{"field":"paid_at","label":"支付时间","minWidth":160}],"defaultSort":{"field":"amount","direction":"desc"},"viewportHeight":420}
```

::: warning
上表是支付明细的抽样（少量订单，用于说明字段结构），不是区域营收合计的来源。区域营收请使用文末的复核 SQL，两者数值口径不同，不要相互印证。
:::

## 业务关系示意图

```excalidraw
{"sceneRef":"conversion_flow","title":"内容到支付的主链路","kicker":"业务关系图"}
```

## 口径复核 SQL

以下两段 SQL 可用同一份 SQLite 文件直接执行，输出应与正文一致。

```sql dialect=sqlite title="区域营收与占比"
SELECT region,
       revenue,
       orders,
       ROUND(100.0 * revenue / (SELECT SUM(revenue) FROM regional_revenue), 2) AS share_pct
FROM regional_revenue
ORDER BY revenue DESC
```

```sql dialect=sqlite title="月度营收与环比"
SELECT month,
       SUM(revenue) AS revenue,
       ROUND(100.0 * (SUM(revenue) - LAG(SUM(revenue)) OVER (ORDER BY month))
             / LAG(SUM(revenue)) OVER (ORDER BY month), 2) AS mom_pct
FROM monthly_revenue
GROUP BY month
ORDER BY month
```

## 口径与来源

```provenance
{"title":"指标口径与来源","kicker":"口径"}
```

## 数据质量

```quality
{"title":"数据质量与覆盖","kicker":"质量","dataRefs":["summary","regional_revenue","region_month","order_details"],"notes":["区域营收为聚合表，与支付明细抽样不是同一数据源，不可互相推算。","环比基期固定为 2026-09，未做季节调整。"]}
```

## 分栏与折叠详情

[column
### 增长驱动
华东贡献了本月绝大部分增量，内容渠道与会员复购是主要承接渠道。
]

[column
### 关注风险
区域集中度上升会放大单一区域波动对整体的影响，需要设置观察阈值。
]

[details 计算口径 open
营收按已支付订单金额合计，含税，按订单支付时间归属月份；区域占比为区域营收除以当月营收合计；占比变动以百分点（pp）表示，不是相对变化率。
]

[details 未纳入范围
退款、毛利、成本与库存数据不在本报告的数据源中，因此本报告不对增长质量与盈利能力下结论。
]
