# data-sources（内部模块）

此目录提供宿主侧 CSV 与只读 SQLite 适配器，把文件或查询结果转换为 renderer 可消费的数据集快照。构建时会打进 DSH 插件包，不是独立安装入口。

SQLite 查询只接受 `SELECT`、`WITH` 或 `VALUES`，使用绑定参数，并限制为单条语句和最多 5,000 行。CSV 和 SQLite 返回相同的数据集结构；浏览器不会直接读取数据库，导出的 HTML 使用物化后的快照。

完整 frontmatter 示例见 [drender 仓库](https://github.com/NoneFire/drender)。

MIT License。
