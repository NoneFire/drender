# @nonefire/data-sources

`@nonefire/data-sources` 提供宿主侧 CSV 与只读 SQLite 适配器，把文件或查询结果转换为 `@nonefire/renderer-core` 可消费的数据集快照。

## 安装

```sh
pnpm add @nonefire/data-sources @nonefire/renderer-core
```

```js
import { loadSqliteDataset, readCsvDataset } from '@nonefire/data-sources';
```

SQLite 查询只接受 `SELECT`、`WITH` 或 `VALUES`，使用绑定参数，并限制为单条语句和最多 5,000 行。CSV 和 SQLite 返回相同的数据集结构；浏览器不会直接读取数据库，导出的 HTML 使用物化后的快照。

完整 frontmatter 示例见 [drender 仓库](https://github.com/NoneFire/drender)。

MIT License。
