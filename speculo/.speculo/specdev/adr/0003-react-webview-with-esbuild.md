# ADR 0003：React Webview 与 esbuild

- 状态：已接受
- 日期：2026-08-03

## 背景

部分未来工具需要复杂 UI，但项目不需要独立 Web 产品。为单个基座同时维护 Vite/Webpack 与扩展构建会增加工具链成本。

## 决定

React 只用于 VS Code Webview。Extension 与 Webview 均由 esbuild 构建。基座不引入路由、全局状态、组件库或 CSS 框架。

## 后果

构建简单、快速、产物明确。Webview 必须遵守 CSP、消息验证、主题变量和资源生命周期。未来引入 UI 库需单独评估。
