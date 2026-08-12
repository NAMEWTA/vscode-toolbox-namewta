---
schema_version: 3
artifact: tickets-map
change: 2026-08-12-git-blame-v2-reader
status: completed
---

# Tickets Map: Git Blame V2 Full-file Reader

- **Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/{change}/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/{change}/evidence/</Path>`
- **可选 Goal Plan：** `<Path>{roots.state}/specdev/changes/{change}/goal-plan.md</Path>`

## 1. 目标与拆分策略

本 Map 将 `US-001` 至 `US-007` 和 `AC-001` 至 `AC-020` 拆成从合同、止血、模型、Reader、复制、导航、性能到集成发布的垂直切片。T-01 是共享合同 owner；T-02 先恢复原生编辑器；T-03 独立构建纯模型；T-04 建立可见 Reader；T-05/T-06 补齐复制与导航；T-07 收口性能/a11y；T-08 作为唯一组合根和发布集成 owner。

不采用与目标无关的 prefactor。迁移按 expand → migrate → observe → contract：先增加 Reader contract/model/Panel，再迁移 Normal Mode 和 Reader consumers，最后扫描并删除 fake gutter。

## 2. 执行清单

| ID   | Ticket                                                                                                | 可观察产出                               | Blocked By          | Depth    | Risk     | Ready | Owner              | Contract IDs                        | Wave/Gate | Status |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------- | -------- | -------- | ----- | ------------------ | ----------------------------------- | --------- | ------ |
| T-01 | `<Path>{roots.state}/specdev/changes/{change}/ticket/01-freeze-reader-contract.md</Path>`             | Reader model/message/copy 合同稳定       | —                   | deep     | high     | yes   | specdev-integrator | AC-004..AC-016,AC-019               | W0/G0     | done   |
| T-02 | `<Path>{roots.state}/specdev/changes/{change}/ticket/02-normal-editor-stop-gutter.md</Path>`          | 原生编辑器无 fake gutter，当前行信息可用 | T-01                | standard | high     | yes   | unassigned         | AC-001..AC-003                      | W1/G1     | done   |
| T-03 | `<Path>{roots.state}/specdev/changes/{change}/ticket/03-build-reader-model.md</Path>`                 | logical line/block/source fidelity model | T-01                | deep     | high     | yes   | unassigned         | AC-004..AC-006,AC-010,AC-015,AC-016 | W1/G1     | done   |
| T-04 | `<Path>{roots.state}/specdev/changes/{change}/ticket/04-reader-mvp.md</Path>`                         | Full-file Reader MVP 可打开并正确换行    | T-01,T-03           | deep     | high     | yes   | unassigned         | AC-004,AC-005,AC-007,AC-015         | W2/G2     | done   |
| T-05 | `<Path>{roots.state}/specdev/changes/{change}/ticket/05-structured-copy-system.md</Path>`             | 8 类结构化复制                           | T-01,T-03,T-04      | standard | high     | yes   | unassigned         | AC-007..AC-010,AC-014               | W3/G3     | done   |
| T-06 | `<Path>{roots.state}/specdev/changes/{change}/ticket/06-reader-source-navigation-lifecycle.md</Path>` | 双向导航、stale/refresh、dispose         | T-01,T-03,T-04,T-05 | deep     | high     | yes   | unassigned         | AC-011..AC-013,AC-019,AC-020        | W4/G4     | done   |
| T-07 | `<Path>{roots.state}/specdev/changes/{change}/ticket/07-reader-performance-accessibility.md</Path>`   | 搜索、虚拟化、键盘和 a11y                | T-04,T-05,T-06      | standard | high     | yes   | unassigned         | AC-005,AC-007,AC-016..AC-019        | W5/G5     | done   |
| T-08 | `<Path>{roots.state}/specdev/changes/{change}/ticket/08-integrate-release-gates.md</Path>`            | 组合根注册、旧实现收缩、全量门禁         | T-02,T-05,T-06,T-07 | deep     | critical | yes   | specdev-integrator | AC-001..AC-004,AC-008..AC-020       | W6/G6-G7  | done   |

## 3. 依赖 DAG

```text
T-01 [READY / shared contract owner]
  ├─→ T-02 [Normal Editing stop-gutter]
  └─→ T-03 [Reader model]
        └─→ T-04 [Reader MVP]
              └─→ T-05 [Structured Copy]
                    └─→ T-06 [Navigation/Lifecycle]
                          └─→ T-07 [Performance/A11y/Search]
T-02 ───────────────────────────────────────────────┐
T-05 ────────────────────────────────────────────────┤
T-06 ────────────────────────────────────────────────┤→ T-08 [Integration / Contract / Release Gate]
T-07 ────────────────────────────────────────────────┘
```

真实阻塞边：T-01 必须先稳定共享 contract；T-03 必须先稳定 model；T-04 必须同时消费 contract/model；T-05/T-06 必须先有可见 Reader；T-07 需要复制和导航行为稳定才能验证；T-08 必须等所有用户路径完成后才可收缩旧实现。

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket              | 验证接缝                   | 状态    | 说明                     |
| ----------- | ------------------------ | -------------------------- | ------- | ------------------------ |
| AC-001      | T-02,T-08                | renderer/E2E/static scan   | covered | 原生布局和集成注册       |
| AC-002      | T-02,T-08                | Status Bar/Hover tests     | covered | 当前行轻量信息           |
| AC-003      | T-02,T-08                | decoration tests/E2E       | covered | whole-line highlight     |
| AC-004      | T-03,T-04,T-08           | model/Panel/integration    | covered | Reader 完整文件          |
| AC-005      | T-03,T-04,T-07           | builder/Webview/manual     | covered | logical line soft wrap   |
| AC-006      | T-01,T-03                | contract/builder           | covered | 连续 block grouping      |
| AC-007      | T-01,T-04,T-05,T-07      | DOM/E2E/manual             | covered | 文本选择                 |
| AC-008      | T-01,T-03,T-05,T-08      | formatter/clipboard        | covered | 单行复制                 |
| AC-009      | T-01,T-05,T-08           | formatter/E2E              | covered | block/commit 复制        |
| AC-010      | T-03,T-05,T-08           | model/export/large fixture | covered | 整文件复制               |
| AC-011      | T-04,T-06,T-08           | Panel/controller/E2E       | covered | Source→Reader            |
| AC-012      | T-06,T-08                | navigation/E2E             | covered | Reader→Source            |
| AC-013      | T-06,T-08                | lifecycle/E2E              | covered | stale/refresh discipline |
| AC-014      | T-01,T-05,T-06,T-08      | contract/message tests     | covered | invalid/expired messages |
| AC-015      | T-03,T-04,T-08           | Handler/Panel/E2E          | covered | unavailable/trust        |
| AC-016      | T-03,T-07,T-08           | large fixture/performance  | covered | virtualization           |
| AC-017      | T-07,T-08                | Webview search/E2E         | covered | source search            |
| AC-018      | T-07,T-08                | manual UI matrix           | covered | theme/zoom/a11y          |
| AC-019      | T-01,T-04,T-06,T-07,T-08 | dispose/resource tests     | covered | lifecycle cleanup        |
| AC-020      | T-01,T-06,T-08           | detail/action integration  | covered | commit detail            |

## 5. 并行与路径所有权

- 最大并发来自 `<Path>{roots.state}/specdev/config.json</Path>`，当前配置为 3；并行是可选资源策略，不代表必须启用多个 Agent。
- W1 中 T-02 与 T-03 可并行：T-02 写 Extension Presentation，T-03 写 Core model/adapter，无项目 writable 交集；T-01 的 contract checkpoint 已关闭。
- T-04 只在 T-03 Evidence 可用后开始。
- T-05 与 T-06 可在 T-04 Evidence 后并行，但 T-06 与 T-05 不共享 writable path；T-07 作为汇合后的后续 Ticket。
- T-08 是唯一 shared owner，独占组合根、package manifest、nls、最终 contracts 合并和 `src/**` 集成冲突处理。

| Ticket A | Ticket B | Writable 交集                | 真实依赖          | 处理                    |
| -------- | -------- | ---------------------------- | ----------------- | ----------------------- |
| T-02     | T-03     | 无                           | T-01              | W1 并行                 |
| T-05     | T-06     | Reader presentation 可能重叠 | T-04              | 顺序或按文件 owner 隔离 |
| T-06     | T-07     | Webview Reader 目录可能重叠  | T-06 产物决定交互 | T-07 等 T-06            |
| T-02     | T-08     | 组合根/package/nls           | T-02 行为完成     | T-08 独占 shared path   |

## 6. Gate、Wave 与集成点

详细 Gate/Wave 由 `<Path>{roots.state}/specdev/changes/{change}/goal-plan.md</Path>` 作为编排权威；本 Map 只保留投影：G0 合同稳定、G1 Normal/Model 首条垂直路径、G2 Reader MVP、G3 Copy/Navigation、G4 Performance/A11y、G5 集成候选、G6 旧实现收缩和发布验证。

## 7. 横切契约与风险

- Extension Host 是 Git 和源文本的唯一权威；Webview 不重算 Git 或接受任意复制文本。
- 所有 Reader 文本必须保持可选择和字符保真；不使用 Canvas/image 代替文本。
- 仅 T-08 修改组合根、manifest、nls 和最终 shared path；越界必须停止并提出 ownership change。
- source/Reader 消息必须绑定 session generation；dispose/取消必须释放资源。
- 手动 UI/a11y/clipboard 证据不能由低层单元测试伪造替代。

## 8. 同步规则

- Ticket frontmatter 是状态、依赖、深度和路径契约权威；Map 是投影。
- Goal Plan 写入后 Wave/Gate/owner 以 Goal Plan 为编排权威并同步本 Map。
- 每个 Ticket 状态改变都同步 Map、Evidence 和 change status。
- 依赖、合同覆盖或 ownership 变化后运行 SpecDev tickets/goal-plan validator。
