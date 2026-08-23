---
schema_version: 3
artifact: tickets-map
change: 2026-08-23-native-git-revision-comparison
status: completed
---

# Tickets Map: 原生 Git 双节点比较

- **Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/{change}/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/{change}/evidence/</Path>`
- **可选 Goal Plan：** 不需要；单 Ticket 顺序执行。

## 1. 目标与拆分策略

`US-001..US-004` 与 `AC-001..AC-007` 共同组成一条从 SCM 入口到原生多文件比较的垂直行为。采用单个 Standard Ticket，使 typed 解析、选择状态、资源映射和 UI 收缩在同一兼容窗口内落地，避免水平拆分产生临时失效状态。

## 2. 执行清单

| ID   | Ticket                                                                                                    | 可观察产出                   | Blocked By | Depth    | Risk   | Ready | Owner      | Contract IDs   | Wave/Gate | Status |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------- | -------- | ------ | ----- | ---------- | -------------- | --------- | ------ |
| T-01 | `<Path>{roots.state}/specdev/changes/{change}/ticket/01-deliver-native-git-revision-comparison.md</Path>` | SCM 双端选择与原生多文件比较 | —          | standard | medium | yes   | unassigned | AC-001..AC-007 | W1/G1     | done   |

## 3. 依赖 DAG

```text
T-01 [DONE]
```

## 4. 合同覆盖矩阵

| Contract ID    | 覆盖 Ticket | 验证接缝                          | 状态    | 说明                           |
| -------------- | ----------- | --------------------------------- | ------- | ------------------------------ |
| AC-001..AC-003 | T-01        | Manifest、QuickPick、Core/Adapter | covered | 入口、端点选择和 revision 解析 |
| AC-004..AC-006 | T-01        | Presentation 与 Controller        | covered | 多文件资源、特殊状态和空比较   |
| AC-007         | T-01        | Manifest 与扩展集成               | covered | 兼容入口和旧视图收缩           |

## 5. 并行与路径所有权

单 Ticket 顺序执行，不并行、不创建额外 worktree；本 change 不写入另一个活跃 change 的目录。

## 6. Gate、Wave 与集成点

G1：revision 红绿已完成；G2：QuickPick 红绿已完成；G3：native changes 红绿已完成；G4：manifest/文档收缩与聚焦回归已完成；G5：完整门禁、双轴审查和 Evidence 已完成。

## 7. 横切契约与风险

- 手输 revision 在边界严格限制为十六进制前缀，解析后固定完整 OID。
- 只使用 Git 参数数组和公开 VS Code API/命令。
- `base -> target` 是所有标题、数据与测试共享的方向合同。

## 8. 同步规则

- Ticket frontmatter 是状态权威，Map 同步投影。
- 状态或合同变化后运行 SpecDev validator。
- 不自动 commit、push、release、归档或修改其他活跃 change。
