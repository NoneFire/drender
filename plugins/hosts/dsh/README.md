# @nonefire/dsh-drender-plugin

为 DeepSeek Harness 提供 drender 适配器，注册 `drender_validate`、`drender_render` 两个工具，并注册运行时 Skill `drender-report`。

通用 Skill 源文件为 [`../../../.agents/skills/drender-report/SKILL.md`](../../../.agents/skills/drender-report/SKILL.md)。构建时会复制到 `lib/skills/drender-report/SKILL.md`，请只维护共享源文件。

## 环境要求

- Node.js 22.13 或更高版本。
- DSH 已挂载公开的 `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-skill` 服务，并启用了供模型加载 Skill 的消费者。
- 读取 Markdown frontmatter 中声明的 SQLite 与 SQL 文件需要 DSH Session 工作区文件系统服务。
- 侧栏 HTML 预览需要 Session 工作区；Web profile 还需要 DSH 的 `ui-tool`、`ui-slots`、`ui-renderer` 和 `ui-primitives` 模块。附件服务是可选的。

插件仅依赖 DSH 公布的 Cordis、tools、skill、attachment 和客户端 UI API，不导入 DSH 应用源码或私有包。

## 安装

发布后，将插件安装到所选 profile：

```sh
dsh plugin --profile web add @nonefire/dsh-drender-plugin
```

Renderer、CSV/SQLite 数据源和主题代码均已打进这个插件包，不需要单独安装 drender 的其他 npm 包。图表与 Markdown 解析器等第三方运行时由 npm 自动安装；DSH 自身 API 由宿主提供。在源码开发环境中，将 `cordis.patch.yml` 的插件条目加入 profile 配置；稳定 ID 为 `md-report-dsh`，名称必须与包名及 `src/index.ts` 导出一致。

## 工具

- `drender_validate`：校验必需 frontmatter、dashboard/panel 结构、组件配置、数据集引用、安全链接和图片资源。诊断包含行号与报告路径。
- `drender_render`：生成包含主题和所需图表运行时的自包含 HTML，保存 Markdown 源文件；宿主支持时还会生成右侧栏预览和下载附件。若 HTML 存储不可用，工具会返回有长度上限的 Markdown 预览。

数据组件从声明的只读 SQLite 查询或显式传入的快照读取。Frontmatter 可声明一个 SQLite 文件，并通过 SQL sidecar、命名 view 或短内联查询声明数据集和 Excalidraw 场景。数据库与 SQL 路径必须位于 Session 工作区内。查询只允许只读语句，每个数据集最多 5,000 行，SQL 文件最多 100 KB，图片输入总量最多 8 MB，数据快照总量上限为 1 MB。

`drender_render` 会把渲染后的 HTML 与对应快照嵌入导出文件，因此离线可用。内联 `datasets` 或 `assets` 参数不会写回 Markdown，会产生可移植性提示；可重复使用的报告应保留 Markdown、SQLite 文件、SQL sidecar 和图片资源。

## 组件覆盖

支持普通 Markdown、自动目录、提示条、12 列 dashboard 面板、正文分栏和折叠详情；KPI、ECharts、Tabulator 数据表、SQL、Mermaid、AntV Infographic、Excalidraw SVG、AntV T8 和声明式图片资源。图表、数据表和 Excalidraw 数据可通过 frontmatter 声明的 SQLite 数据源提供。

导出 HTML 内嵌样式、必要的开源可视化运行时和所引用资源，使用基于哈希的内容安全策略。导出文件是数据快照；请勿在其中放入秘密或凭据。
