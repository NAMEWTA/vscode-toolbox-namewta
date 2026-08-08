# 新增业务域

以下流程用于后续 Copy Reference、Git Blame、JSON、UUID 等工具。

## 1. 定义领域语言

选择具体 kebab-case 领域名，并列出输入、输出、失败、平台能力和信任要求。不要先创建 `utils.ts` 或通用 Service。

## 2. 建立 Core 领域

在 `src/core/domains/<domain>/` 创建具体文件。模型和 Handler 不导入 VS Code、Node、React 或 DOM。所有 I/O 通过最小 Port 表达。

## 3. 扩展命令契约

在 `ToolCommandMap` 增加 `<domain>.<action>`。输入输出必须可 JSON 序列化，并补充运行时类型守卫。

## 4. 实现平台 Adapter

在 `src/extension/adapters/` 实现领域 Port。路径、URI、编辑器选择、剪贴板、Git 和配置都在这一层转换。

## 5. 注册

在 `register-domain-modules.ts` 装配 Handler。禁止 Service Locator、模块级单例和隐式注册副作用。

## 6. 提供交互入口

简单能力使用 VS Code Command、QuickPick、Hover 或 Decoration；只有复杂交互才使用 React Webview。两者必须调用同一 Gateway 命令。

## 7. 验证

添加共置单元测试、必要的集成测试、文档、国际化和配置。运行 `pnpm check:ci` 并检查 VSIX 内容。
