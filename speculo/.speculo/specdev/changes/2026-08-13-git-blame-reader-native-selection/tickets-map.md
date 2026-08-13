---
schema_version: 3
artifact: tickets-map
change: 2026-08-13-git-blame-reader-native-selection
status: in_progress
---

# Tickets Map: Git Blame Reader 原生选择

- **Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/{change}/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/{change}/evidence/</Path>`
- **可选 Goal Plan：** 不需要；单 Ticket 顺序执行。

## 1. 目标与拆分策略

`US-001..US-004` 与 `AC-001..AC-010` 共同描述一个不可拆分的用户行为：双列 DOM、颜色、选择、显式动作和大文件性能必须一起成立。采用单个 Standard 垂直 Ticket，避免按 React/CSS/测试形成人工水平依赖。

## 2. 执行清单

| ID   | Ticket                                                                                             | 可观察产出          | Blocked By | Depth    | Risk | Ready | Owner      | Contract IDs   | Wave/Gate | Status |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------- | ---------- | -------- | ---- | ----- | ---------- | -------------- | --------- | ------ |
| T-01 | `<Path>{roots.state}/specdev/changes/{change}/ticket/01-deliver-native-selection-reader.md</Path>` | 双列原生选择 Reader | —          | standard | high | yes   | unassigned | AC-001..AC-010 | W1/G1     | review |

## 3. 依赖 DAG

```text
T-01 [REVIEW / implementation + integration; real Reader UI E2E not-run]
```

## 4. 合同覆盖矩阵

| Contract ID    | 覆盖 Ticket | 验证接缝           | 状态    | 说明                     |
| -------------- | ----------- | ------------------ | ------- | ------------------------ |
| AC-001..AC-007 | T-01        | React/CSS/Chromium | covered | 颜色、双列、动作与分隔线 |
| AC-008         | T-01        | 20,000 行真实 UI   | covered | 全 DOM 原生选择与性能    |
| AC-009         | T-01        | 9 组合 UI 矩阵     | covered | 主题、缩放与可访问性     |
| AC-010         | T-01        | React state/E2E    | covered | Refresh 保留列宽         |

## 5. 并行与路径所有权

单 Ticket 顺序执行，不并行、不创建额外 worktree，无 writable 交集或 shared owner 问题。

## 6. Gate、Wave 与集成点

G1：回归测试先红；G2：双列 DOM/颜色/交互定向测试通过；G3：真实 VS Code 主题、选择、分隔线和 20,000 行通过；G4：完整门禁与 Evidence 完成。

## 7. 横切契约与风险

- 公共 model、Gateway 和 Host action contract 只读兼容。
- 原生选择合同高于旧窗口虚拟化约束；以当前 change ADR-002 为权威。
- 用户界面必须由真实 VS Code Chromium 和系统剪贴板验证，jsdom 不替代布局与 Range Evidence。

## 8. 同步规则

- Ticket frontmatter 是状态权威，Map 同步投影。
- 状态或合同变化后运行 SpecDev validator。
- 不自动 commit、push、release 或归档。
