# @nonefire/dsh-drender-plugin

**让 DSH Agent 把数据和分析要求转成可校验、可复核、可离线分享的标准化报告。**

本插件将 [drender](https://github.com/NoneFire/drender) 接入 DeepSeek Harness（DSH），实现 `md-report/1` 报告格式。Agent 使用 Markdown 声明指标、数据和组件，插件负责校验文档、读取允许的数据源，并生成交互式 HTML 报告或仪表盘。

它主要解决三件事：同一指标在卡片、图表和正文中保持同一口径；在渲染前发现格式和引用错误；把分析结果交付为不依赖 CDN 或数据库连接的 HTML 文件。

## 效果预览

组件图鉴展示报告组件、指标 token、分栏布局和并排图表的实际渲染效果。可直接查看图鉴 HTML、Markdown 源文件和经营仪表盘示例：

- [组件图鉴 HTML](https://github.com/NoneFire/drender/blob/main/examples/template-gallery.html) · [图鉴 Markdown 源文件](https://github.com/NoneFire/drender/blob/main/examples/template-gallery.md)
- [经营仪表盘 HTML](https://github.com/NoneFire/drender/blob/main/examples/dashboard.html)

![drender 组件图鉴预览，展示报告布局、指标 token 和多种图表组件](https://raw.githubusercontent.com/NoneFire/drender/main/examples/assets/template-gallery-preview.png)

GitHub 会显示 HTML 文件源码；下载后用浏览器打开即可查看交互效果。完整组件说明和更多示例见 [仓库 README](https://github.com/NoneFire/drender#实际效果)。

## 插件提供什么

安装后，DSH Agent 可使用两个工具和一个 Skill：

- **`drender_validate`**：校验 `md-report/1` frontmatter、组件字段、指标和数据集引用、布局结构、安全链接及图片资源。错误诊断包含代码、行号和字段路径，便于 Agent 修复后再渲染。
- **`drender_render`**：校验并渲染报告，返回 HTML 预览路径、源 Markdown 路径、数据集和组件摘要；宿主支持时还提供侧栏预览和下载附件。
- **`drender-report` Skill**：引导 Agent 先明确报告问题，再选择指标、查询、图表和版式，并遵守 `md-report/1` 语法。

## 工作流程

1. Agent 根据用户的问题和数据源编写 `md-report/1` Markdown。
2. Agent 调用 `drender_validate` 检查文档结构和引用，并根据诊断修正错误。
3. Agent 调用 `drender_render`。宿主只读加载 frontmatter 中声明的 SQLite 数据，将查询结果物化后传给 renderer。
4. DSH 展示或提供下载自包含 HTML；Markdown 源文件和其声明的数据库、SQL sidecar、图片可保留用于复现。

```text
问题 + 工作区数据
       ↓
Agent 编写 md-report/1 Markdown
       ↓
drender_validate → drender_render
       ↓
可复核的源文件 + 交互式离线 HTML
```

## 安装

将插件安装到 DSH Web profile：

```sh
dsh plugin --profile web add @nonefire/dsh-drender-plugin
```

插件包内已包含 renderer、数据源和主题模块。用户只需安装这个 DSH 插件包；ECharts、Mermaid、AntV Infographic、AntV T8、Tabulator 等第三方运行时依赖由 npm 自动安装。

## 输入与数据来源

两个工具都接受以下一种报告来源：

- `markdown`：完整的 Markdown 文本，必须包含 `md-report/1` YAML frontmatter。
- `path`：Session 工作区内的 `.md` 或 `.markdown` 文件路径。

两者只能提供其一。`drender_render` 还接受可选 `fontSize`，范围为 12–20 CSS 像素，默认值为 14。

可复现报告应在 frontmatter 声明工作区相对路径的 SQLite 数据库、查询文件、图片和场景。插件只读执行声明的 SQLite 查询；查询可以来自 SQL sidecar、SQLite view 或短内联语句。一次性调用也可通过 `datasets` 和 `assets` 参数直接传入数据快照或图片；这些参数不会写回 Markdown，重复使用时应改为声明工作区文件。

插件包也导出 `readCsvDataset`、`parseCsvDataset` 和 `loadSqliteDataset` 等数据源函数，供宿主集成或应用代码使用。

## 报告与组件

支持 report 和 dashboard 两种模式，包括：

- **数据组件：** 指标 token、KPI、ECharts 图表、排行榜、透视表、Tabulator 数据表、发现摘要、指标口径和数据质量说明。
- **说明组件：** SQL 代码块、Mermaid 流程图、AntV Infographic、AntV T8 叙述、Excalidraw 场景和声明式图片。
- **版式组件：** 自动目录、提示条、折叠详情、2–6 列正文分栏和 12 列 dashboard 面板栅格；图表可放在分栏内并排显示。

通过 `metrics` 声明业务指标，再从 KPI、图表或正文引用，可共享格式和口径。渲染器只把报告实际使用的组件运行时、主题、数据快照和声明资源放入 HTML，文件可离线打开。

## 运行要求

- Node.js 22.13 或更高版本。
- DSH profile 提供公开的 `tools` 与 `skills` 服务，并启用 Skill 加载。
- 读取 frontmatter 声明的 SQLite、SQL 和图片文件需要 Session 工作区 filesystem 服务。
- Web profile 的侧栏 UI 需要 DSH `ui-tool`、`ui-slots`、`ui-renderer` 和 `ui-primitives` 模块。
- 附件服务是可选的；没有附件服务时，若 Session 工作区可写，HTML 仍可通过预览路径访问。

插件依赖 DSH 公布的 Cordis、tools、skill、attachment 和客户端 UI API，不导入 DSH 应用源码或私有包。

## 数据限制与安全

- SQLite 查询使用只读连接，只允许只读语句；数据库和 SQL 文件路径必须位于当前 Session 工作区。
- 每个数据集最多 5,000 行，SQL 文件最多 100 KB，报告数据快照总量最多 1 MB。
- 图片输入总量最多 8 MB，且必须通过 frontmatter 声明工作区相对路径与媒体类型。
- 渲染器拒绝原始 HTML 和不安全链接，不运行用户 JavaScript，也不在浏览器里执行 SQL。
- 导出的 HTML 内含数据快照，收到文件的人可以检查这些数据；不要把秘密或凭据放入报告。

## 开发

通用 Skill 源文件位于 [`.agents/skills/drender-report/SKILL.md`](../../../.agents/skills/drender-report/SKILL.md)。构建会把它复制到 `lib/skills/drender-report/SKILL.md`；请只维护共享源文件。

DSH 插件条目见 [`cordis.patch.yml`](cordis.patch.yml)，稳定 ID 为 `md-report-dsh`，名称与包名及 `src/index.ts` 导出保持一致。

完整组件图鉴、格式说明和示例见 [drender 仓库](https://github.com/NoneFire/drender)。
