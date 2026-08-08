# 项目范围与固定技术栈

## 项目范围

本仓库是单一 VS Code 扩展发布单元，用于承载不断增长的开发者工具集合。当前只提供架构验证用的 System Info 领域，不实现正式业务工具。

## 固定技术栈

- 必须使用 Node.js 22 LTS 进行开发、构建和打包；扩展 Bundle 目标保持 Node 20 兼容语法。
- 必须使用 pnpm，并通过 `packageManager` 固定版本。
- 必须使用 TypeScript 严格模式。
- Extension Host 使用 VS Code Node Extension Host。
- 复杂 UI 使用 React + TypeScript Webview；简单工具优先命令和原生 VS Code UI。
- 构建使用 esbuild，测试使用 Vitest 与 VS Code Test CLI。
- 格式、Lint、类型、测试、依赖边界、未使用代码、构建和 VSIX 必须形成门禁。

## 非目标

禁止在基座中创建独立 Web 应用、HTTP 服务、WebSocket 服务、Electron 应用、VS Code Web Extension 入口、遥测或 Marketplace 自动发布。

## 变更技术栈

重大替换必须先添加 ADR，说明动机、备选方案、迁移成本、运行环境、安全、体积和回滚方式。不得因个人偏好临时引入第二套构建或状态系统。
