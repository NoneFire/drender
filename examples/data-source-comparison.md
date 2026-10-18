---
format: md-report/1
mode: dashboard
title: CSV 与 SQLite 数据源对照
---

:::: dashboard columns=12
::: panel span=12
```kpi
{"title":"同一份数据快照","items":[{"label":"记录数","value":1000,"unit":"行"},{"label":"数据字段","value":4,"unit":"列"},{"label":"来源适配器","value":2,"unit":"种"},{"label":"快照一致","value":"是","period":"CSV 与 SQLite 的行列值一致"}]}
```
:::

::: panel span=8
```chart
{"kind":"line","title":"收盘价趋势（两种来源同一结果）","dataRef":"daily_bars","x":"trade_date","y":"close","unit":"USD"}
```
:::

::: panel span=4
```chart
{"kind":"bar","title":"行业样本构成","dataRef":"sector_totals","x":"sector","y":"rows","unit":"行"}
```
:::

::: panel span=12
```data-table
{"dataRef":"daily_bars","title":"1000 行交互式明细（Tabulator）","columns":[{"field":"trade_date","label":"日期","width":130},{"field":"close","label":"收盘价","format":"currency:USD","width":140},{"field":"volume","label":"成交量","width":150},{"field":"sector","label":"行业","width":180}],"defaultSort":{"field":"trade_date","direction":"desc"},"viewportHeight":420}
```
:::
::::
