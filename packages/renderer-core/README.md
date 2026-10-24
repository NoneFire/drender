# renderer-core（内部模块）

此目录提供 drender 内部的 `md-report/1` 校验与 HTML 渲染实现，由 DSH 插件在构建时打包。它不是独立安装入口。

## 能力

支持 Markdown、自动目录、布局容器、指标 token、KPI、ECharts、Tabulator、Mermaid、AntV Infographic、AntV T8、Excalidraw SVG、安全资源处理和可读诊断。HTML 仅嵌入文档实际使用的运行时，适合离线查看。

核心 API 为 `renderReport` 和 `validateReport`。构建后的模块由 DSH 插件内部调用。

完整格式说明与可运行示例见 [drender 仓库](https://github.com/NoneFire/drender) 和 [`drender-report` Skill](https://github.com/NoneFire/drender/tree/main/.agents/skills/drender-report)。

MIT License。
