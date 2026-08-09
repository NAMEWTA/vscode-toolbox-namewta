---
schema_version: 3
artifact: ticket
change: 2026-08-09-review-all-git-changes
id: T-01
title: 建立类型化 Git Review 契约与 Review Session 状态机
status: ready
planning_depth: deep
planning_depth_reason: 扩展公共 ToolCommandMap、Extension API capability 和共享 Core 状态契约，属于公共 API 与共享核心路径变更
ready: true
risk: high
blocked_by: []
contract_ids:
  - AC-009
  - AC-010
  - AC-011
  - AC-012
  - AC-016
  - AC-017
  - AC-018
  - AC-019
owner: unassigned
expected_changes:
  - '<Path>src/core/contracts/tool-command-contract.ts</Path>'
  - '<Path>src/core/contracts/tool-command-contract.test.ts</Path>'
  - '<Path>src/core/contracts/index.ts</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
writable_paths:
  - '<Path>src/core/contracts/tool-command-contract.ts</Path>'
  - '<Path>src/core/contracts/tool-command-contract.test.ts</Path>'
  - '<Path>src/core/contracts/index.ts</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
read_only_paths:
  - '<Path>src/core/orchestration/**</Path>'
  - '<Path>src/core/domains/git-blame/**</Path>'
  - '<Path>docs/architecture/overview.md</Path>'
  - '<Path>docs/adr/0002-typed-tool-gateway.md</Path>'
shared_paths:
  - '<Path>src/core/contracts/tool-command-contract.ts</Path>'
  - '<Path>src/core/contracts/index.ts</Path>'
shared_path_owners:
  - '<Path>src/core/contracts/tool-command-contract.ts</Path> => T-01'
  - '<Path>src/core/contracts/index.ts</Path> => T-01'
---

# Ticket T-01: 建立类型化 Git Review 契约与 Review Session 状态机

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/01-establish-git-review-contract.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>`

## 1. 战略与来源

- **目标：** 以一个无 VS Code、Node、React 或 DOM 依赖的 Core 领域，建立 Git Review 的类型化命令、运行时输入校验、Review Session 状态机和 Port，使后续 Git 适配与 UI 只实现边界能力，不重新决定业务状态。
- **可观察产出：** Core 测试可以证明 session 的建立、稳定导航、显式审核、跳过、内容失效、刷新归并、完成、替换与释放行为；Extension API 类型系统认识全部 Git Review 命令，但本 Ticket 不宣称 Git 能力已经可用。
- **来源：** `US-003`、`US-004`、`US-007`、`AC-009` 至 `AC-012`、`AC-016` 至 `AC-019`、`ADR-001`、`ADR-002`、项目 `ADR 0002`、`USER-DECISION:2026-08-09-merge-each-ticket`。
- **当前事实：** 所有业务操作必须经 `<Path>src/core/orchestration/toolbox-gateway.ts</Path>`；当前 `<Path>src/core/contracts/tool-command-contract.ts</Path>` 没有 Git Review 命令，Core 也没有可复用的本地审核状态模型。
- **Planning Depth 原因：** 本 Ticket 修改公开命令联合、运行时守卫和共享 Core 契约，错误设计会扩散到 Extension API、后续适配器和 UI，因此按 Deep 规划并需要人工批准；用户已批准本拆分。

## 2. 决策状态

### 已锁定决策

- 领域规范术语使用 Review Session、Review Queue、审核项和跳过，不创建冲突同义词。
- 每个 session 只绑定一个仓库，审核项处理状态为 `unreviewed | reviewed | skipped`；呈现失败是独立维度。
- 普通导航不改变处理状态；只有显式命令可以产生 `reviewed` 或 `skipped`。
- 刷新仅为稳定内容身份匹配的条目保留处理状态，路径相同但内容变化必须恢复为 `unreviewed`。
- ToolCommandMap 必须覆盖 Spec DEC-008 的业务操作，输入输出可序列化，Extension API `apiVersion` 保持 1。

### 已采用的低影响假设

- 队列排序使用规范化仓库相对路径的确定顺序；排序器必须对大小写、Unicode 和重命名保持确定性。
- 一个 Core session service 同时只持有一个 session；新 session 替换未完成 session 的确认由 Extension Host 负责，Core 只提供可判定快照和原子替换操作。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                                                               | REUSE（复用且不改变契约）                                                       | OUT（明确不做）                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Git Review 模型、Port、Handler、session 状态转换、输入守卫、公共类型导出及共置测试 | ToolboxGateway、ToolRegistry、ToolResult、ApplicationError 与现有可辨识联合惯例 | Git 子进程、VS Code 命令、Tree View、状态栏、diff、Manifest、持久化和远程能力 |

## 4. 要构建什么

调用方通过类型化 Gateway 请求创建 session 或执行导航、标记、跳过、刷新和结束操作。Core 验证输入并返回可序列化 session 快照；每次操作必须保持单仓库、单当前项、队列唯一、状态互斥和内容失效不变量。Port 提供只读变更清单与内容能力，但 Core 不认识 URI、文件系统或 Git 子命令。无 session、越界导航、失效刷新、取消和 Port 失败均返回结构化错误或稳定快照，不匹配错误消息文本。

## 5. 实现契约

- **入口或接缝：** `ToolCommandMap`、Git Review Handler、Review Session service 与领域 `public-api.ts`。
- **输入与输出：** 输入仅包含可序列化的仓库定位、审核项定位、session 操作和内容身份；输出是队列、当前项、状态、计数、stale/complete 标记或只读内容描述，不包含 VS Code 对象。
- **公共接口变化：** Extension API v1 的命令联合和 capabilities 类型增加 Git Review 操作；现有命令输入输出保持不变。
- **不变量：** 与 Spec“状态转换与不变量”逐项一致；所有公开状态使用可辨识联合并穷尽处理。
- **状态或数据流：** Gateway 输入 → 运行时守卫 → Handler → session service → 只读 Port 或纯状态转换 → ToolResult 快照。
- **错误与失败行为：** 无效输入为 `invalid-input`，无 session 或能力缺失使用现有结构化错误语义，取消为 `cancelled`；不得吞错或把 Port 错误转换为已审核/跳过。
- **兼容要求：** `apiVersion: 1`、现有 `ToolCommandMap` 条目、capability 排序和所有现有 Core 测试保持兼容。
- **安全与隐私要求：** Core 不记录源码、diff、秘密或绝对路径日志；外部输入在 Gateway 前后均不得以类型断言代替守卫。

## 6. 执行路线

1. 先添加覆盖输入守卫、状态转换、刷新归并、完成和 dispose 的失败测试，确认现有仓库缺少目标契约。
2. 定义最小 Git Review 模型、Port 和可序列化 ToolCommandMap 输入输出，保持 Core 运行时独立。
3. 实现 Review Session 的纯状态机与内容身份归并，覆盖重复、越界、stale、取消和替换。
4. 实现类型化 Handler 与公共导出，并确保未注册能力不会在 `getCapabilities()` 中伪装可用。
5. 运行 Core 定向测试、完整单元测试、类型检查和依赖边界检查。
6. 写入 Evidence 与双轴审查结果；全部通过后提交 Ticket 分支并按本 Ticket Gate 合并回父分支。

## 7. 路径访问契约

- **预计修改点：** `<Path>src/core/contracts/tool-command-contract.ts</Path>`、对应测试和导出，以及 `<Path>src/core/domains/git-review/**</Path>`。
- **可写范围：** 仅 frontmatter `writable_paths`；不得修改 Extension Host、Webview、Manifest 或 SpecDev 工作流包。
- **只读上下文：** Core orchestration、Git Blame 相邻领域、架构总览和类型化 Gateway ADR。
- **共享路径：** `<Path>src/core/contracts/tool-command-contract.ts</Path>` 与 `<Path>src/core/contracts/index.ts</Path>` 仅由 T-01 修改；后续 Ticket 只读。
- **保留或不动：** Extension API 返回结构、现有命令行为和其他领域公共入口。

## 8. 验证矩阵

| 行为或风险 | 验证接缝                       | 命令或步骤                                                                                                     | 预期结果                                                                    | Evidence                                                                                        |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 正常路径   | Core 状态机与 Handler 单元测试 | `pnpm test -- src/core/domains/git-review`                                                                     | 创建、导航、审核、跳过、刷新和完成快照符合 AC-009 至 AC-012、AC-016、AC-018 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>` |
| 失败路径   | Contract/Gateway 定向测试      | `pnpm test -- src/core/contracts/tool-command-contract.test.ts src/core/orchestration/toolbox-gateway.test.ts` | 无效输入、取消、未注册能力和错误映射符合 AC-017、AC-019                     | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>` |
| 回归       | Core 完整门禁                  | `pnpm typecheck && pnpm lint:dependencies && pnpm test`                                                        | 现有命令、依赖方向和 Extension API v1 均保持绿色                            | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>` |
| E2E        | 不适用                         | 本 Ticket 不影响用户界面交互                                                                                   | 由 T-03/T-04 覆盖 UI 与扩展宿主                                             | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 先扩展 Core 契约和纯状态机，保持未注册 Git Review capability 不可用；T-02 只在此 Ticket 已合并后接入 Adapter。
- **兼容窗口：** 现有命令与 Extension API v1 持续工作；新增命令类型在 T-02 注册前不出现在运行时 capabilities。
- **监控信号：** 类型检查、Gateway capability 测试、依赖边界和状态机覆盖率。
- **回滚或前向恢复：** merge 前可丢弃隔离 Ticket 分支；merge 后使用显式 revert 提交回退本 Ticket，不使用 destructive reset。T-02 未开始前不存在数据迁移。
- **不可逆操作与批准点：** 无生产不可逆操作。用户已授权在 Evidence、双轴审查和适用门禁全部通过后，将 T-01 本地分支 merge 回记录的父分支；不授权 push。
- **收缩条件：** 全部新增命令都有运行时守卫，状态分支穷尽，Core 依赖扫描无 VS Code/Node/React/DOM 导入，Evidence 完整。

## 10. 验收标准

- [ ] AC-009、AC-010、AC-011、AC-012、AC-016、AC-017、AC-018、AC-019 的 Core 行为均有可判定测试。
- [ ] 所有新增命令输入输出可序列化、无 `any` 且经运行时守卫验证。
- [ ] Core 依赖边界和现有 Extension API v1 行为保持不变。
- [ ] 验证矩阵全部执行并记录到 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>`。
- [ ] 实际项目修改未超出 `writable_paths`，shared path 仅由 T-01 修改。
- [ ] Ticket 分支已在 Evidence 和审查通过后 merge 回父分支，并记录 base、提交和 merge 结果；T-02 只能从合并后的父分支开始。
- [ ] 未执行 push，未发生未批准的范围、契约或发布偏差。
- [ ] Ticket、Tickets Map 和 Evidence 状态一致。
