# @nonefire/renderer-core

`@nonefire/renderer-core` 用于校验 `md-report/1` 文档，并将其渲染为自包含的交互式 HTML 报告或仪表盘。

## 能力

支持 Markdown、自动目录、布局容器、指标 token、KPI、ECharts、Tabulator、Mermaid、AntV Infographic、AntV T8、Excalidraw SVG、安全资源处理和可读诊断。HTML 仅嵌入文档实际使用的运行时，适合离线查看。

## 安装

```sh
pnpm add @nonefire/renderer-core
```

核心 API：

```js
import { renderReport, validateReport } from '@nonefire/renderer-core';
```

将 Markdown 和可选的数据集快照传给 `validateReport` 或 `renderReport`。若 Markdown frontmatter 声明 SQLite 文件，可先用 `@nonefire/data-sources` 在宿主侧只读加载数据，再把结果交给 renderer。

完整格式说明与可运行示例见 [drender 仓库](https://github.com/NoneFire/drender) 和 [`drender-report` Skill](https://github.com/NoneFire/drender/tree/main/.agents/skills/drender-report)。

MIT License。
