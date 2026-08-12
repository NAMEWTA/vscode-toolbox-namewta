---
schema_version: 3
artifact: goal-plan
change: 2026-08-12-git-blame-v2-reader
status: completed
modes: [coordination, migration, high-assurance, release-coordination]
ready_for_execution: true
---

# Goal Plan: Git Blame V2 Full-file Reader

- **Goal Plan：** `<Path>{roots.state}/specdev/changes/{change}/goal-plan.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **Tickets Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/{change}/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/{change}/evidence/</Path>`

## 1. Outcome and Authority

### Outcome

交付 Git Blame V2：Normal Editing Mode 不改变原生编辑器布局，仅显示当前行 Status Bar、Hover 和 commit block 高亮；Full-file Blame Reader 以独立 Webview Editor Tab 提供完整 logical line/commit block 历史阅读、文本选择、结构化复制、搜索、双向导航、大文件虚拟化、stale/refresh 和可访问性。

### Success and False Completion

成功必须由代码、自动化验证、手动 UI 矩阵和逐条 Evidence 证明。以下均不算完成：只通过 Core 单测却未验证 Webview 选择/复制；只显示了 Reader 截图却没有复制结果；保留 `before.contentText` fake gutter；把未运行的主题、缩放、屏幕阅读器或剪贴板步骤标成通过；忽略 dispose、取消或过期 generation 风险。

### Non-goals

Custom Editor、完整语法高亮、复杂 blame 查询语法、任意 revision 浏览、全量历史分页、自定义复制模板和任何 Git 写操作不属于本 change。

### Authoritative Inputs

| 优先级 | 来源                                                                          | 负责内容                        | 冲突处理                 |
| ------ | ----------------------------------------------------------------------------- | ------------------------------- | ------------------------ |
| 1      | 用户最新明确决定                                                              | Git Blame V2 外部产品行为和批准 | 更新真正拥有该决策的工件 |
| 2      | `<Path>{roots.state}/specdev/changes/{change}/ADR.md</Path>`                  | 当前 change 架构决定            | 通过新决定替代           |
| 3      | `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`                 | 外部行为、范围和 AC-001..AC-020 | 下游不得改写             |
| 4      | `<Path>{roots.state}/specdev/changes/{change}/ticket/{ticket-file}.md</Path>` | 单 Ticket 契约、路径和验证      | Goal Plan 只编排         |
| 5      | 当前代码事实                                                                  | 现状和可行性                    | 冲突时触发 deviation     |

## 2. Execution Graph

### DAG and Critical Path

```text
T-01 [W0: shared contract]
  ├─→ T-02 [W1: Normal Editing stop-gutter]
  └─→ T-03 [W1: Reader model]
        └─→ T-04 [W2: Reader MVP]
              └─→ T-05 [W3: Structured Copy]
                    └─→ T-06 [W4: Navigation/Lifecycle]
                          └─→ T-07 [W5: Performance/A11y/Search]
                                └─→ T-08 [W6: Integration/Contract/Release]
T-02 ────────────────────────────────────────────────────────┘
```

关键路径为 T-01 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08；T-02 是可在 T-01 后并行的止血路径，但必须在 T-08 集成前完成。

### Waves and Ownership

| Wave | Ticket | 前置条件                     | 项目写路径                                   | Shared owner          | 集成点               |
| ---- | ------ | ---------------------------- | -------------------------------------------- | --------------------- | -------------------- |
| W0   | T-01   | Spec ready、无阻塞           | `src/core/contracts/`（仅此 Ticket）         | T-01                  | G0 合同稳定          |
| W1   | T-02   | G0 closed                    | Extension Presentation；组合根/package 只读  | T-08 for shared       | G1 Normal Mode       |
| W1   | T-03   | G0 closed                    | Core Reader model、Git adapter               | 无                    | G1 Reader model      |
| W2   | T-04   | T-01/T-03 Evidence           | Reader Panel 与基础 Webview files            | T-08 for registration | G2 Reader MVP        |
| W3   | T-05   | G2 closed                    | Copy formatter/service/action entry          | 无                    | G3 Copy              |
| W4   | T-06   | G3 closed                    | Controller/navigation/detail/lifecycle files | T-08 for composition  | G4 Navigation        |
| W5   | T-07   | G4 closed                    | performance/search/a11y files                | 无                    | G5 UI quality        |
| W6   | T-08   | T-02/T-05/T-06/T-07 Evidence | shared paths、manifest、build、旧实现收缩    | T-08                  | G6 release candidate |

### Ticket Quick Reference

| ID   | Ticket                                                                                                | 行为产出                    | Depth/Risk    | Dependencies        | Wave/Gate | Owner                | Evidence                                                               |
| ---- | ----------------------------------------------------------------------------------------------------- | --------------------------- | ------------- | ------------------- | --------- | -------------------- | ---------------------------------------------------------------------- |
| T-01 | `<Path>{roots.state}/specdev/changes/{change}/ticket/01-freeze-reader-contract.md</Path>`             | model/message/copy contract | deep/high     | —                   | W0/G0     | specdev-integrator   | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| T-02 | `<Path>{roots.state}/specdev/changes/{change}/ticket/02-normal-editor-stop-gutter.md</Path>`          | 原生编辑器恢复正常          | standard/high | T-01                | W1/G1     | implementation owner | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-02.md</Path>` |
| T-03 | `<Path>{roots.state}/specdev/changes/{change}/ticket/03-build-reader-model.md</Path>`                 | logical line/block model    | deep/high     | T-01                | W1/G1     | implementation owner | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-03.md</Path>` |
| T-04 | `<Path>{roots.state}/specdev/changes/{change}/ticket/04-reader-mvp.md</Path>`                         | Reader MVP                  | deep/high     | T-01,T-03           | W2/G2     | implementation owner | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-04.md</Path>` |
| T-05 | `<Path>{roots.state}/specdev/changes/{change}/ticket/05-structured-copy-system.md</Path>`             | 结构化复制                  | standard/high | T-01,T-03,T-04      | W3/G3     | implementation owner | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-05.md</Path>` |
| T-06 | `<Path>{roots.state}/specdev/changes/{change}/ticket/06-reader-source-navigation-lifecycle.md</Path>` | 双向导航/生命周期           | deep/high     | T-01,T-03,T-04,T-05 | W4/G4     | implementation owner | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-06.md</Path>` |
| T-07 | `<Path>{roots.state}/specdev/changes/{change}/ticket/07-reader-performance-accessibility.md</Path>`   | 性能/搜索/a11y              | standard/high | T-04,T-05,T-06      | W5/G5     | implementation owner | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-07.md</Path>` |
| T-08 | `<Path>{roots.state}/specdev/changes/{change}/ticket/08-integrate-release-gates.md</Path>`            | 集成/收缩/发布候选          | deep/critical | T-02,T-05,T-06,T-07 | W6/G6     | specdev-integrator   | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>` |

## 3. Gates and Completion Evidence

### Overall Definition of Done

- 所有 T-01 至 T-08 为 done，Evidence、Map、Goal Plan、change status 和源码 checkpoint 一致。
- AC-001 至 AC-020 逐条有自动化、集成、手动或代码扫描 Evidence；未运行项必须保持 `not-run` 并记录风险，不能伪造通过。
- 原生编辑器不存在 fake gutter；Reader 文本可选择、复制、搜索、键盘导航和双向定位。
- `pnpm check`、`pnpm test:integration`、`pnpm package:list`、`pnpm package:vsix` 及适用人工矩阵完成。
- 无未批准 deviation、未处置 blocker 或高风险 `unverified` 声明。

### Gates

| Gate                   | 开启条件                          | 关闭证据                                                | 阻塞范围          | Owner/批准人         | 失败恢复                                 |
| ---------------------- | --------------------------------- | ------------------------------------------------------- | ----------------- | -------------------- | ---------------------------------------- |
| G0 合同稳定            | Spec ready；T-01 preflight        | T-01 Evidence、contract tests、tickets validator        | 全部下游          | T-01 owner           | 修订 T-01/ADR，重新验证                  |
| G1 首条双路径          | T-02/T-03 完成                    | Normal Mode tests + model tests + fake gutter red-scan  | T-04 及下游       | implementation owner | 回到 T-02/T-03 最后绿色点                |
| G2 Reader MVP          | T-04 完成                         | Panel/CSP/Webview tests、Reader E2E                     | T-05/T-06         | T-04 owner           | 保留 Normal Mode，修复 Reader            |
| G3 Copy 合同           | T-05 完成                         | 8 类 copy 字面量、Clipboard 集成和 invalid message test | T-06/T-07         | T-05 owner           | 禁用失败 action，不重跑 blame            |
| G4 Navigation 生命周期 | T-06 完成                         | 双向行号、stale/refresh、dispose/abort Evidence         | T-07              | T-06 owner           | 暂停 UI 收尾，修复 session               |
| G5 UI 质量             | T-07 完成                         | virtualization/search/a11y 自动化 + 手动矩阵            | T-08              | T-07 owner           | 回退仅 UI 实现，保留 model/copy contract |
| G6 集成发布候选        | T-02/T-05/T-06/T-07 Evidence 齐全 | T-08 全量门禁、旧调用点扫描、双轴审查和用户批准         | change completion | T-08 owner/用户      | 标记 blocked/deviated，回到具体 Ticket   |

### Contract and Reference Coverage

| 合同或参考要求                | 覆盖 Ticket         | 验证接缝                               | Evidence                       | 状态    |
| ----------------------------- | ------------------- | -------------------------------------- | ------------------------------ | ------- |
| AC-001..AC-020                | T-01..T-08          | Core、Extension、Webview、E2E、手动 UI | 各 Ticket Evidence + T-08 汇总 | covered |
| 用户四句最终原则              | T-02,T-04,T-05,T-06 | Normal/Reader 集成                     | T-08                           | covered |
| 永久 ADR-001 Webview 资源合同 | T-01,T-04,T-06      | CSP/message/cancel/dispose             | T-04/T-06                      | covered |

## 4. Execution and Integration Protocol

### Ticket Execution Order

| Ticket | 开始条件                          | 执行 owner           | 必跑验证                                           | Evidence | 集成条件                |
| ------ | --------------------------------- | -------------------- | -------------------------------------------------- | -------- | ----------------------- |
| T-01   | Spec ready                        | contract owner       | Core contract tests、tickets validator             | T-01     | G0 closed               |
| T-02   | G0 closed、路径无冲突             | implementation owner | Presentation tests、布局反向扫描、E2E              | T-02     | G1 closed               |
| T-03   | G0 closed、路径无冲突             | implementation owner | model/adapter tests                                | T-03     | G1 closed               |
| T-04   | T-01/T-03 Evidence                | implementation owner | Panel/Webview tests、integration                   | T-04     | G2 closed               |
| T-05   | G2 closed                         | implementation owner | copy formatter/message/clipboard tests             | T-05     | G3 closed               |
| T-06   | G3 closed                         | implementation owner | navigation/lifecycle/integration tests             | T-06     | G4 closed               |
| T-07   | G4 closed                         | implementation owner | Webview/performance/a11y tests、手动矩阵           | T-07     | G5 closed               |
| T-08   | G5 closed、所有 shared owner 可用 | specdev-integrator   | `pnpm check`、integration、package、scan、双轴审查 | T-08     | G6 closed，用户批准完成 |

### Authorization Matrix

| 动作                                                | 状态           | 目标与条件                                                   |
| --------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| Local changes                                       | allowed        | 仅限每个 Ticket 的 writable_paths；shared path 由 T-08 owner |
| Commit                                              | not-authorized | 用户未要求提交；保留工作树 checkpoint 和 Evidence            |
| Push / PR / Merge                                   | not-authorized | 本 change 不执行远程协作动作                                 |
| Deploy / Migration                                  | not-authorized | 无生产部署和不可逆数据迁移                                   |
| Production configuration / feature / real user data | not-authorized | 不接触生产配置或真实用户数据                                 |

### Evidence Return and Integration

每个 Ticket 按 `<Path>{roots.workflows}/specdev/I-implement/I-implement.md</Path>` 执行，写入对应 Evidence，更新 Ticket/Map/Goal Plan/status。T-08 汇总所有 Gate、运行集成门禁和双轴审查；只有用户批准且 change completion 条件满足后，才转入 Triage/Archive。

## 5. Constraints, Risk and Recovery

### Non-negotiable Constraints

- 原生编辑器不得有 Blame 文本布局 decoration；违反将阻塞 G1/G6。来源：ADR-001、AC-001。
- Webview 不得运行 Git 或接受任意复制文本；违反将阻塞 G0/G3/G6。来源：ADR-002/004。
- Reader 文本必须原样可选择；违反将阻塞 G2/G3/G5。来源：ADR-005、AC-007/010。
- session generation、取消和 dispose 必须可验证；违反将阻塞 G4/G6。来源：永久 ADR-001、AC-014/019。
- shared path 只能由 T-08 owner 修改；违反需暂停并提出 ownership change。

### Verification Integrity

自动化测试不得以 Mock 调用次数替代用户行为，不得依赖当前 DOM 验证 Copy All，不得将未运行的物理键盘、剪贴板、主题、缩放或屏幕阅读器步骤标为通过。`rg` 静态扫描只证明调用点事实，不能替代 E2E 布局证据。

### Migration or Release Sequence

`expand`：T-01/T-03/T-04 增加新 model/contract/Reader；`migrate`：T-02/T-05/T-06/T-07 迁移用户路径；`observe`：T-08 运行静态扫描、全量门禁和 UI 矩阵；`contract`：确认旧 fake gutter 调用点为零后删除；`verify`：重新运行完整测试、package list/package 和双轴审查。实施阶段未执行 commit、push 或 release；用户在完成验收后于 2026-08-12 明确授权这些发布动作。

### Risks, Monitoring and Recovery

| 风险                  | 触发信号                           | 预防/检测                           | 恢复                                     |
| --------------------- | ---------------------------------- | ----------------------------------- | ---------------------------------------- |
| 原生布局回归          | x 坐标、wrap 或 selection 改变     | renderer unit + 反向扫描 + E2E      | 回到 T-02 checkpoint                     |
| 模型错位/字符丢失     | 行数、block 或 Copy fixture 不匹配 | builder/export tests + long fixture | Reader fail closed，修复 T-03            |
| Webview 注入/过期消息 | validator 拒绝或错误导航           | CSP、typed validator、generation    | 丢弃消息并刷新当前 session               |
| 资源泄漏/重复 blame   | dispose 后 listener/request 仍活动 | controller dispose/abort tests      | 暂停 G4/G6，修复 T-06                    |
| UI/a11y 未验证        | 手动矩阵缺项                       | Evidence 保留 not-run               | 不标记完成，补跑或经用户批准记录残余风险 |

### Deviation Control

遵循 `<Path>{roots.workflows}/specdev/common/rules/deviation-control.md</Path>`。改变外部行为、公共 contract、阈值、范围或不可逆收缩时，暂停受影响 Wave，回到 Spec/ADR/Ticket owner；不静默扩大 writable_paths。

## 6. Progress and Decisions

### Current Status

`WAVE_STATUS wave=6 ready=[] active=[] done=T-01,T-02,T-03,T-04,T-05,T-06,T-07,T-08 blocked=[]`

`GATE_STATUS gate=G6 state=closed evidence=<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path> risks=none`

`TICKET_STATUS id=T-08 state=done evidence=<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path> deviation=none`

### Pending Decisions and Blockers

无待决策或 blocker。代码、自动化、Extension Host 集成、VSIX、Light/Dark/High Contrast × 100/125/150% zoom、真实键鼠选择、系统剪贴板、导航、生命周期和屏幕阅读器优化模式下的 Accessibility Tree 均已验证；G0 至 G6 全部关闭。

### Resume Protocol

change 已完成。后续若用户授权归档，先读取本 Goal Plan、T-08 Evidence、Tickets Map、Spec 和 completed change status，再进入 Archive；不在 completed change 内追加实现修改。

### Reporting Format

每次执行返回 `WAVE_STATUS`、`GATE_STATUS`、`TICKET_STATUS`、失败分类、Evidence 路径、源码 checkpoint、未验证项和恢复条件。

## Assumptions

- 采用普通 Goal Plan；本计划不建立委派角色或交付合同。
- `max_parallel=3` 是资源上限，不要求并行；只有不相交 writable path 的 Ticket 才能并行。
- 用户批准当前 change 的设计方案；实施阶段未授权外部动作，完成验收后于 2026-08-12 追加授权 commit、push 和 release，merge 与 deploy 仍不在范围内。
