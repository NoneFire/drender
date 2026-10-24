# @nonefire/viewer-theme

`@nonefire/viewer-theme` 提供 drender 报告和全屏深色仪表盘使用的 CSS。样式包含主题变量、响应式布局、打印规则以及图表、数据表和 Markdown 内容的基础排版。

## 使用

```sh
pnpm add @nonefire/viewer-theme
```

```js
import { viewerThemeCss } from '@nonefire/viewer-theme';
```

CSS 字符串由 `@nonefire/renderer-core` 自动注入生成的 HTML。若宿主自己组装页面，也可以将 `viewerThemeCss` 写入 `<style>`。

完整示例见 [drender 仓库](https://github.com/NoneFire/drender)。

MIT License。
