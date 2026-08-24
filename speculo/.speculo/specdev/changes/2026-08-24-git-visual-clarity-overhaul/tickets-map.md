---
schema_version: 3
artifact: tickets-map
change: 2026-08-24-git-visual-clarity-overhaul
status: completed
---

# Tickets Map: Git 可视化清晰度彻底重构

## 1. 拆分策略

五项问题共享 Git identity、颜色、Host action 与发布验证，采用一个 Deep 纵向 Ticket 顺序交付，避免多个 owner 同时修改 composition root、国际化和配置共享路径。

## 2. 执行清单

| ID   | Ticket                                                                                                 | 可观察产出                          | Blocked By | Depth | Risk | Ready | Owner | Contract IDs   | Status |
| ---- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ---------- | ----- | ---- | ----- | ----- | -------------- | ------ |
| T-01 | `<Path>{roots.state}/specdev/changes/{change}/ticket/01-deliver-git-visual-clarity-overhaul.md</Path>` | 清晰的 Compare、Reader 与编辑器注解 | —          | deep  | high | yes   | Codex | AC-001..AC-008 | done   |

## 3. 依赖 DAG

```text
T-01 [DONE]: URI red/green -> Reader red/green -> editor annotation red/green -> docs/integration -> UI matrix -> full gates
```

Ticket frontmatter 是状态权威；本 change 不并行、不创建额外 worktree、不自动 commit、push 或 release。

## 4. 合同覆盖矩阵

| Contract ID    | 覆盖 Ticket | 验证接缝                                 | 状态    |
| -------------- | ----------- | ---------------------------------------- | ------- |
| AC-001         | T-01        | URI/Presentation/Extension Host          | covered |
| AC-002..AC-004 | T-01        | React/CSS/Host contract/真实 UI          | covered |
| AC-005..AC-007 | T-01        | Core formatter/Decoration/Extension Host | covered |
| AC-008         | T-01        | 完整门禁、UI matrix、VSIX                | covered |

## 5. 并行与路径所有权

单 Ticket 顺序执行，不并行、不创建额外 worktree。根配置、国际化和文档由当前唯一 owner 修改，因此不存在 shared owner 竞争。

## 6. Gate、Wave 与集成点

G1 URI 红绿、G2 Reader 红绿、G3 编辑器注解红绿、G4 Extension Host 与 UI 矩阵、G5 完整门禁与 Evidence 均已完成。

## 7. 横切契约与风险

typed Gateway、参数数组 Git runner、输入验证、资源释放和不使用 VS Code 私有命令是所有 Gate 的共同合同。

## 8. 同步规则

Ticket frontmatter 是状态权威；每次状态改变同步 Map、Evidence 与 change status，并运行 SpecDev validator。
