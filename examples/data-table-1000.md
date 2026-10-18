---
format: md-report/1
mode: report
title: 1000 行交互式订单明细
sqlite:
  path: examples/data/report-data.sqlite
  datasets:
    large_orders:
      table: large_orders
      queryFile: examples/queries/large-orders.sql
      columns:
        - name: order_id
          type: string
        - name: ordered_at
          type: string
        - name: customer_id
          type: string
        - name: region
          type: string
        - name: city
          type: string
        - name: channel
          type: string
        - name: product
          type: string
        - name: category
          type: string
        - name: quantity
          type: number
        - name: unit_price
          type: number
          unit: CNY
        - name: discount
          type: number
        - name: amount
          type: number
          unit: CNY
        - name: payment_method
          type: string
        - name: status
          type: string
        - name: sales_rep
          type: string
      maxRows: 1000
      source: 本地合成样例数据
      updatedAt: '2026-10-17'
---

::: note
这是用于验证大数据表滚动的合成样例。点击列标题可排序；横向和纵向滚动条分别浏览 15 列与 1000 行。
:::

```data-table
{"dataRef":"large_orders","title":"订单明细（1000 行）","columns":[{"field":"order_id","label":"订单编号","width":142,"frozen":true},{"field":"ordered_at","label":"下单时间","width":156},{"field":"customer_id","label":"客户编号","width":122},{"field":"region","label":"区域","width":92},{"field":"city","label":"城市","width":96},{"field":"channel","label":"渠道","width":126},{"field":"product","label":"商品","width":190},{"field":"category","label":"品类","width":118},{"field":"quantity","label":"数量","width":80},{"field":"unit_price","label":"单价","format":"currency:CNY","width":112},{"field":"discount","label":"折扣","format":"percent","width":88},{"field":"amount","label":"实付金额","format":"currency:CNY","width":128},{"field":"payment_method","label":"支付方式","width":112},{"field":"status","label":"订单状态","width":104},{"field":"sales_rep","label":"销售","width":92}],"defaultSort":{"field":"ordered_at","direction":"desc"},"viewportHeight":560}
```
