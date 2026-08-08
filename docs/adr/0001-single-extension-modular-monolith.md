# ADR 0001：单扩展模块化单体

- 状态：已接受
- 日期：2026-08-03

## 背景

项目只面向 VS Code，但会持续增加多个开发者工具域。独立 Web、Server、Electron 和 Monorepo 会增加没有实际收益的运行环境与发布复杂度。

## 决定

使用单仓库、单 `package.json` 和单 VSIX。代码隔离 Core、Extension Host、React Webview，并在 Core 内按领域组织。

开发和打包使用 Node.js 22 LTS；扩展 Bundle 仍以 Node 20 语法为目标。当前 VSCE 工具链要求 Node 22，因此开发环境下限高于扩展生成代码目标。

## 后果

领域可以独立增长，只有一个发布单元和入口。若未来确实出现独立发布需求，再以新的 ADR 评估拆包，而不是提前建设 Monorepo。
