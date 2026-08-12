---
schema_version: 1
artifact: triage
change: 2026-08-10-fix-toolbox-command-context-and-blame-layout
mode: intake
source: <Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/source.md</Path>
classification: mixed
risk: medium
route: specdev/implement
ready_for_implementation: true
external_action: not-applicable
updated_at: 2026-08-10T08:50:28+08:00
---

# Triage: 修复命令上下文与 Blame 布局

## 当前判定

- **影响：** 两个用户菜单入口不可用，Blame 固定宽度显著压缩代码区域，命令来源不易识别。
- **紧急度：** immediate
- **当前证据：** 用户提供 0.1.1 运行日志与截图；代码检查确认两个命令守卫不接受 VS Code 实际菜单上下文，Renderer 固定使用 `22em`。
- **相关代码/工件：** `<Path>src/extension/commands/git-review-session-command.ts</Path>`、`<Path>src/extension/commands/view-line-history-command.ts</Path>`、`<Path>src/extension/presentation/git-blame-decoration-renderer.ts</Path>`、`<Path>package.json</Path>`。

## 未知项

- **可发现事实：** 已通过 VS Code 官方源码与本地实现确认，无。
- **需要用户决定：** 已确认前缀、颜色范围和 0.1.2 本地交付，无。
- **低影响实现细节：** 装饰资源内部组织沿用现有逐文档生命周期。

## 路由

- **下一 Work：** `<Path>{roots.workflows}/specdev/I-implement/I-implement.md</Path>`
- **理由：** 根因、外部行为、兼容要求和验证接缝均已锁定，单个 Standard Ticket 可完成。

## 外部动作

- **远程目标：** 无
- **关闭能力：** not-applicable
- **当前状态：** not-applicable
- **授权记录：** 无
- **尝试与结果：** 无
