# 架构总览

vscode-toolbox-namewta 是单一 VS Code 扩展中的模块化单体。它通过物理目录和自动依赖规则隔离三个运行边界。

```text
VS Code 命令 / Webview
          │
          ▼
扩展宿主适配器
          │
          ▼
ToolboxGateway → ToolRegistry → 领域处理器 → Ports
          ▲
          │ 类型化 JSON 消息
          │
React Webview 界面
```

## 核心层（Core）

`src/core/` 与 VS Code、Node、React 和 DOM 无关，包含：

- `contracts/`：稳定、可序列化的命令、结果、错误、消息与 Extension API。
- `orchestration/`：Gateway、Registry、Handler 和执行上下文。
- `domains/`：按业务域组织的模型、Port、Handler 和公共入口。
- `kernel/`：无业务含义的最小错误、Result 和生命周期能力。

## 扩展宿主（Extension Host）

`src/extension/` 是 Node 运行环境，负责 VS Code API、命令注册、日志、配置、Webview 生命周期以及未来文件系统与 Git 子进程适配。`create-extension-runtime.ts` 是唯一 Composition Root。

## Webview 界面层

`src/webview/` 是浏览器环境。React 组件只通过 `WebviewMessageClient` 调用 Gateway，不导入 VS Code 或 Node API。Webview 没有独立产品入口。

## 统一出口

所有业务能力通过：

```ts
toolboxGateway.execute(command, input);
```

对外 Extension API 只暴露版本、execute 和 capabilities。内部 Registry、Panel 和 Adapter 不暴露。

## 依赖方向

```text
extension → core ← webview
```

领域之间不直接依赖。跨域场景由 orchestration 中的具体 Workflow 组合领域公共 API。
