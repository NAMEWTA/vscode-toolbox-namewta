---
schema_version: 3
artifact: context
change: 2026-08-24-git-navigation-and-native-review
status: ready
---

# Context: Git 节点搜索与原生 Review

## 用户问题

1. 从 Git Graph 的仓库上下文启动比较时，搜索不到画面中存在的节点。
2. Git Review 使用独立 React Webview，与 Git Compare 的原生 Changes 交互不一致。
3. Relative / Absolute Reference 缺少可重复使用的键盘入口。

## 已确认根因

- Compare 命令注册丢弃 SCM 传入参数，仓库解析器回退到活动编辑器或工作区第一个仓库。
- QuickPick 只过滤已经载入的 `HEAD` 分页；输入变化没有触发 Git 搜索。
- Review 的主呈现由专用 Webview 持有，未复用 Compare 已验证的 `vscode.changes` 资源模型。
- 两个复制命令已有无参数活动编辑器路由，但清单没有键位绑定。

## 约束

- Core、Extension 与 Webview 依赖边界保持不变。
- Git 进程继续使用参数数组、取消、超时与输出上限。
- 不使用 VS Code 私有命令；原生多文件 Changes 只调用公开 `vscode.changes`。
- 本变更不授权 commit、push 或 release。
