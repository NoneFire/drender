# drender

**drender** 将 Markdown、声明式数据源和图表组件渲染成一份可离线查看的交互式 HTML 报告或仪表盘。文档格式为 `md-report/1`，数据在渲染前由宿主读取并固化到 HTML 中。

## 工作区包

| npm 包 | 用途 |
| --- | --- |
| `@nonefire/renderer-core` | Markdown 校验与渲染、自包含 HTML、ECharts、Mermaid、AntV Infographic、T8、Excalidraw 和 Tabulator。 |
| `@nonefire/viewer-theme` | 报告主题、全屏深色仪表盘主题和打印样式。 |
| `@nonefire/data-sources` | CSV 与只读 SQLite 数据源适配器。 |
| `@nonefire/dsh-drender-plugin` | DSH 的 `drender_validate`、`drender_render` 工具及 `drender-report` Skill。 |

本仓库是 pnpm workspace；根目录包仅用于开发和构建，不单独发布。所有工作区包的版本与 GitHub Release 对齐。

## 功能

- 报告自动生成可点击目录；仪表盘支持 12 列面板布局。
- 声明式 KPI、指标 token、图表、排行榜、透视表、数据表、发现摘要、指标口径和数据质量说明。
- 支持折线、柱形、面积、散点、饼图、漏斗、组合、瀑布、K 线、箱线、热力、桑基、树图、雷达、仪表和地图图表。
- 支持 Mermaid、AntV 信息图模板、AntV T8 叙述和 Excalidraw 场景。
- 支持提示条、折叠详情，以及 2–6 列正文分栏；图表也可以放在分栏里并排显示。
- HTML 内嵌所需样式、运行时、数据快照和声明的图片；打开报告无需连接 CDN 或数据库。

## 构建与示例

需要 Node.js 22.13+ 和 pnpm 11+。

```sh
pnpm install
pnpm build
node examples/render-examples.mjs
```

`render-examples.mjs` 会重建确定性的 SQLite 示例数据，并渲染仪表盘、分析报告、大型数据表和组件图鉴。SQLite 示例中的查询围栏会以只读方式执行，查询失败或无结果时脚本会报错。

其他示例：

```sh
node examples/compare-csv-sqlite-sources.mjs
node examples/sync-stock-example.mjs --offline
```

股票示例默认使用本地 SQLite 缓存；联网更新需要 EODHD API token。演示行情不是实时数据或投资建议。

## DSH 插件

插件注册两个工具：

- `drender_validate`：检查 frontmatter、组件字段、数据集引用、布局结构和安全链接等。
- `drender_render`：生成自包含 HTML，保存 Markdown 源文件，并在宿主支持时提供侧栏预览和可下载附件。

安装到 DSH Web profile：

```sh
dsh plugin --profile web add @nonefire/dsh-drender-plugin
```

需要 Node.js 22.13+，以及 DSH 的公开 tools、skill、filesystem 和客户端 UI 服务。工具与 Skill 使用公开扩展 API；Markdown 声明的数据库和 SQL 文件从当前 Session 工作区读取。

通用 Skill 源文件位于 [`.agents/skills/drender-report/SKILL.md`](.agents/skills/drender-report/SKILL.md)。

## 数据源

可在 Markdown frontmatter 中声明一个工作区相对路径的 SQLite 文件，再为数据集指定查询文件、SQLite view 或简短内联查询：

```yaml
sqlite:
  path: data/monthly-review.sqlite
  datasets:
    monthly_revenue:
      table: monthly_revenue
      queryFile: queries/monthly-revenue.sql
```

也可以通过 `@nonefire/data-sources` 从 CSV 或 SQLite 加载数据，然后把生成的快照交给 renderer。查询在宿主侧以只读方式执行；浏览器只使用已物化的快照，不会访问数据库。

每份报告的数据快照总量上限为 1 MB，每个数据集最多 5,000 行，SQL 文件最多 100 KB。图片必须在 frontmatter 中声明，且路径必须位于当前工作区。

## 安全与离线使用

渲染器拒绝原始 HTML 和不安全链接，不执行 Markdown 正文中的 SQL，也不运行用户提供的 JavaScript。导出的 HTML 会包含数据快照；接收者可以检查其中的数据，请勿放入秘密或凭据。

## 许可证

MIT，见 [LICENSE](LICENSE)。
