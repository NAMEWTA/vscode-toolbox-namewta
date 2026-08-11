---
schema_version: 3
artifact: tickets-map
change: 2026-08-10-fix-toolbox-command-context-and-blame-layout
status: blocked
---

# Tickets Map: Toolbox 菜单上下文与 Blame 布局修复

- **Map：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/tickets-map.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/spec.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/</Path>`
- **可选 Goal Plan：** 不适用：单 Ticket 串行执行。

## 1. 目标与拆分策略

单个垂直 Ticket 同时恢复入口、视觉和可发现性，并由同一 owner 处理共享 Manifest 与 0.1.2 打包，避免人为拆分后产生不可安装的中间状态。

## 2. 执行清单

| ID   | Ticket                                                                                                                                                 | 可观察产出                                     | Blocked By | Depth    | Risk   | Ready | Owner       | Contract IDs     | Wave/Gate | Status  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------- | -------- | ------ | ----- | ----------- | ---------------- | --------- | ------- |
| T-01 | `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/ticket/01-deliver-toolbox-menu-and-blame-fixes.md</Path>` | 菜单可用、Blame 紧凑、命名前缀统一、0.1.2 VSIX | —          | standard | medium | no    | codex-local | AC-001 至 AC-007 | G-01      | blocked |

Ticket frontmatter 是状态、依赖、深度和路径访问契约的权威；本表是同步投影。

## 3. 依赖 DAG

```text
T-01 [BLOCKED: B-T01-001]
```

## 4. 合同覆盖矩阵

| Contract ID      | 覆盖 Ticket | 验证接缝                       | 状态    | 说明                      |
| ---------------- | ----------- | ------------------------------ | ------- | ------------------------- |
| AC-001 至 AC-003 | T-01        | Command/Adapter/Extension Host | covered | 真实菜单上下文与失败边界  |
| AC-004、AC-005   | T-01        | Formatter/Renderer/截图        | partial | 自动化通过，真实截图待补  |
| AC-006           | T-01        | Manifest/i18n                  | covered | 全部可见命令前缀且 ID兼容 |
| AC-007           | T-01        | `pnpm check:ci` 与 VSIX        | covered | 本地 0.1.2 交付           |

## 5. 并行与路径所有权

单 Ticket 串行执行，不创建 worktree；`package.json` 与本地化资源由 T-01 唯一拥有。

## 6. Gate、Wave 与集成点

G-01 仅在定向红绿证据、完整门禁、真实菜单手动验收和 VSIX 路径全部记录后关闭。

## 7. 横切契约与风险

命令 ID、Extension API v1、Workspace Trust 和资源生命周期保持兼容；颜色不作为唯一信息，不执行远程发布。

## 8. 同步规则

Ticket 状态变化后同步本 Map；实现、Evidence 与 Speculo 校验全部通过后由当前 Implement owner 完成 change。
