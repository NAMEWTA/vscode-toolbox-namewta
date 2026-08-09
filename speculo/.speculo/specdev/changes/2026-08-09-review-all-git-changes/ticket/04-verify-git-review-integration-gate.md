---
schema_version: 3
artifact: ticket
change: 2026-08-09-review-all-git-changes
id: T-04
title: 完成扩展宿主集成与发布候选验证
status: blocked
planning_depth: standard
planning_depth_reason: 跨 Core、Git Adapter、Extension Host 和 Manifest 执行最终集成 Gate，但不再改变公共契约、数据或产品范围
ready: false
risk: medium
blocked_by:
  - T-03
contract_ids:
  - AC-001
  - AC-002
  - AC-003
  - AC-004
  - AC-005
  - AC-006
  - AC-007
  - AC-008
  - AC-009
  - AC-010
  - AC-011
  - AC-012
  - AC-013
  - AC-014
  - AC-015
  - AC-016
  - AC-017
  - AC-018
  - AC-019
  - AC-020
owner: codex-local
expected_changes:
  - '<Path>AGENTS.md</Path>'
  - '<Path>CLAUDE.md</Path>'
  - '<Path>build/build-tests.mjs</Path>'
  - '<Path>eslint.config.mjs</Path>'
  - '<Path>speculo/commands/**</Path>'
  - '<Path>speculo/skills/**</Path>'
  - '<Path>speculo/workflows/**</Path>'
  - '<Path>src/extension/extension.integration.test.ts</Path>'
  - '<Path>tests/integration/git-review*.integration.test.ts</Path>'
writable_paths:
  - '<Path>AGENTS.md</Path>'
  - '<Path>CLAUDE.md</Path>'
  - '<Path>build/build-tests.mjs</Path>'
  - '<Path>eslint.config.mjs</Path>'
  - '<Path>speculo/commands/**</Path>'
  - '<Path>speculo/skills/**</Path>'
  - '<Path>speculo/workflows/**</Path>'
  - '<Path>src/extension/extension.integration.test.ts</Path>'
  - '<Path>tests/integration/git-review*.integration.test.ts</Path>'
read_only_paths:
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/extension/adapters/git/git-review-*.ts</Path>'
  - '<Path>src/extension/commands/git-review-*.ts</Path>'
  - '<Path>src/extension/presentation/git-review-*.ts</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>tests/integration/suite/index.ts</Path>'
shared_paths:
  - '<Path>build/build-tests.mjs</Path>'
shared_path_owners:
  - '<Path>build/build-tests.mjs</Path> => T-04'
---

# Ticket T-04: 完成扩展宿主集成与发布候选验证

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/04-verify-git-review-integration-gate.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>`

## 1. 战略与来源

- **目标：** 以真实临时 Git 仓库和 VS Code Extension Host 固化完整跨层证据，执行发布候选质量门禁，并证明当前 `main` 中每张前置 Ticket 的已验证状态仍满足全部 Spec 合同。
- **可观察产出：** 自动集成测试覆盖真实 Git change inventory、公开 Extension API、命令入口、原生 diff、Workspace Trust、刷新、完成与 dispose；手动 Gate 覆盖 Tree View、状态栏、键盘和辅助技术可达性；完整 `pnpm check:ci` 生成有效 VSIX。
- **来源：** `AC-001` 至 `AC-020`、Spec 验证策略、仓库发布门禁、`USER-DECISION:2026-08-09-direct-main-development`。
- **当前事实：** `<Path>tests/integration/suite/index.ts</Path>` 自动发现构建后的 integration tests，但 `<Path>build/build-tests.mjs</Path>` 需要显式加入新入口；现有 `<Path>tests/integration/git-history.integration.test.ts</Path>` 提供临时真实 Git 仓库、Extension API 和 Provider 测试先例。
- **Planning Depth 原因：** 本 Ticket 是跨层集成和发布候选 Gate，修改范围集中且不改变公共契约，因此为 Standard；失败可能揭示上游偏差，但不得越界顺手修改产品代码。

## 2. 决策状态

### 已锁定决策

- T-04 只增加集成/验收证据和测试构建入口，不扩大产品行为或修改 T-01 至 T-03 的 owned paths。
- 发现产品缺陷时将相应上游 Ticket/实现状态退回并提出 ownership deviation；不能在 T-04 中越界修复。
- `pnpm check:ci`、真实 Extension Host 测试和 VSIX 路径是最终 Gate；未运行或环境失败必须分类记录，不能伪装通过。
- T-04 通过后关闭 G-04；本 change 之后是否完成由 Implement 的 completion owner 按完整 Evidence 判定。

### 已采用的低影响假设

- 自动化无法可靠读取的屏幕阅读器语义和视觉进度由可重复手动步骤补证；其余可观察行为优先自动化。
- 临时仓库夹具在测试结束后无论成功失败均清理，不依赖网络、用户 Git 配置或本机固定路径。

### 已处理偏差

- `D-T04-001`：既有 `<Path>src/extension/extension.integration.test.ts</Path>` 已由本 Ticket 的测试构建入口执行，且必须同步 Git Review capability 回归断言。该项为 Ticket 级路径偏差；G-04 Gate owner `codex-local` 于 `2026-08-09T17:26:44+08:00` 批准将该测试路径纳入本 Ticket。批准范围仅限公开 capability 与命令的既有回归断言同步，不允许修改产品实现、公共契约或发布范围。
- `D-T04-002`：完整 `check:ci` 首次执行暴露 foundation 文档、格式和 CLI Lint 失败。用户明确要求完成本 Goal Plan，且 `B-T04-002` 要求对应 owner 修复或接受，因此将根级 foundation 文档、ESLint 配置与 `speculo/commands`、`speculo/skills`、`speculo/workflows` 的最小质量修正纳入本 Ticket；其中架构报告模板的单个 `Path` 标记保留格式保护，避免 Prettier 改写后破坏 Speculo 自检语义。该范围只恢复既有质量门禁，不改变 Git Review 产品行为、公共契约、Git 安全边界或发布动作。
- `D-R01`：用户于 `2026-08-09T19:42:07+08:00` 明确授权当前 change 的 `0.1.1` commit、`origin/main` push、同名标签 push 和 GitHub Release。该授权仅适用于版本提交与既有标签工作流，不发布 Marketplace 或 npm，也不把 Release 视为 G-04 关闭。

### 未决问题

- `B-T04-001`：物理键盘与辅助技术手动 Gate 尚未在可控制的 Extension Development Host 中执行。

## 3. 范围边界

| IN（本 Ticket 构建）                                                                                                             | REUSE（复用且不改变契约）                                                                   | OUT（明确不做）                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 新 integration test 入口、临时真实仓库场景、Extension Host 命令/API/diff/Trust/lifecycle 证据、键盘手动 Gate 和完整 CI/VSIX 验证 | T-01 至 T-03 已验证实现、现有 test CLI、suite discovery、Git fixture 模式和 package scripts | 产品缺陷修复、公共契约改变、新功能、Marketplace/npm 发布及 `D-R01` 范围外的远程操作 |

## 4. 要构建什么

从 G-03 关闭后的当前 `main` 构建并运行 Extension Host，在隔离临时仓库内制造 staged、unstaged、untracked、删除、重命名、无 `HEAD` 和特殊项，验证 Extension API 与用户命令形成一致 Review Session。测试必须观察原生 diff 激活、状态转换、stale/refresh、完成、错误和 dispose，并审计没有 Git 写入或远程调用。自动化之后执行仅键盘和辅助技术手动流程，再运行完整发布候选门禁并记录 VSIX。

## 5. 实现契约

- **入口或接缝：** VS Code Test CLI、公开 Extension API v1、公开命令、临时 Git 仓库、活动编辑器/文档和可重复手动验收。
- **输入与输出：** 测试只创建临时目录、确定性文件与本地 Git 提交；输出为断言、命令退出码、日志摘要、手动步骤结果和 VSIX 路径。
- **公共接口变化：** 无；只验证既有 Spec 合同。
- **不变量：** 测试独立、可重复、无网络、无固定机器路径、无共享可变仓库、finally 清理；不把私有 VS Code API 当验证接缝。
- **状态或数据流：** 构建测试 Bundle → 启动隔离 Extension Host → 创建仓库/变更 → 调用 API/命令 → 观察 diff/session → dispose/清理 → 完整质量与打包 Gate。
- **错误与失败行为：** 失败分类为新失败、基线失败、环境失败或验证无效；任何关键 Gate 未通过时 Ticket 保持非 done，并记录可复现证据。
- **兼容要求：** 现有全部 integration tests、Linux xvfb、Windows/macOS CI 路径和 package scripts 保持可用。
- **安全与隐私要求：** 测试不使用真实凭据、远程仓库或用户目录数据；临时内容不得包含秘密，日志不输出源码全文。

## 6. 执行路线

1. 将 Git Review integration 入口加入测试构建，并建立会在缺少完整跨层行为时失败的最小真实仓库场景。
2. 扩展正常路径覆盖 staged/unstaged/untracked、导航、审核、跳过、完成和原生 diff。
3. 增加无 HEAD、删除、重命名、特殊项、Workspace Trust、stale/refresh、局部失败、替换和 dispose 场景。
4. 审计测试执行前后 Git 状态，证明没有 stage、commit、push、fetch 或其他非夹具写操作。
5. 运行 `pnpm test:integration` 和仅键盘/辅助技术手动 Gate，分类并记录全部结果。
6. 运行 `pnpm check:ci`，确认 VSIX 路径、package list 和回归门禁；只在全部通过后形成 Evidence。
7. 完成双轴审查、关闭 G-04 并同步当前 `main` 状态；`D-R01` 仅允许 `0.1.1` 的 GitHub Release，不把 push 或发布当作 Gate 关闭证据。

## 7. 路径访问契约

- **预计修改点：** `<Path>build/build-tests.mjs</Path>`、既有 `<Path>src/extension/extension.integration.test.ts</Path>` 与新的 `<Path>tests/integration/git-review*.integration.test.ts</Path>`。
- **可写范围：** 仅 frontmatter `writable_paths`；`src/extension/extension.integration.test.ts` 是测试构建入口已包含的既有 Extension Host 测试，仅用于同步公共 capability/命令断言。`D-T04-002` 仅允许 foundation 文档、格式、Node CLI Lint 配置和既有 Speculo CLI 的最小修正；产品实现、Manifest、Core、Adapter 与 Presentation 保持只读。
- **只读上下文：** T-01 至 T-03 实现、现有集成测试、Manifest、本地化和测试发现器。
- **共享路径：** `<Path>build/build-tests.mjs</Path>` 仅由 T-04 修改。
- **保留或不动：** 现有 integration 入口、CI matrix、发布工作流和产品源码。

## 8. 验证矩阵

| 行为或风险 | 验证接缝                                                 | 命令或步骤                                                           | 预期结果                                                                  | Evidence                                                                                        |
| ---------- | -------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 正常路径   | 真实仓库 Extension Host                                  | `pnpm test:integration`                                              | AC-001 至 AC-012、AC-016、AC-019 的跨层流程通过                           | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>` |
| 失败路径   | Trust/错误/生命周期集成                                  | `pnpm test:integration` 中定向场景                                   | AC-013 至 AC-018 的反馈、恢复、无持久化和清理通过                         | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>` |
| 回归与打包 | 完整发布候选门禁                                         | `pnpm check:ci`                                                      | 格式、Lint、依赖、类型、覆盖率、构建、集成、package list 和 VSIX 全部通过 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>` |
| E2E        | Extension Development Host；当前执行 owner 为 T-04 owner | 仅键盘走完整流程并核对 Tree View、状态栏、本地化、辅助技术名称和总结 | AC-020 通过，步骤和结果可重复                                             | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 必须在 G-03 关闭后的当前 `main` 开始 T-04；先建立集成红灯，再补全场景，最后运行发布候选门禁。
- **兼容窗口：** 无公共契约或数据迁移；测试构建只增加入口，保留所有现有测试。
- **监控信号：** integration 退出码、手动 Gate、`check:ci` 各子门禁、package list、VSIX 路径和 Git 状态审计。
- **回滚或前向恢复：** 测试或入口问题可在当前 Ticket 授权路径内修订；产品失败必须退回对应上游 owner。存在用户授权的本地提交时使用 revert，不删除现有测试来获得绿色。
- **不可逆操作与批准点：** 用户于 `2026-08-09T19:42:07+08:00` 通过 `D-R01` 明确授权提交当前 change、推送 `origin/main` 和 `v0.1.1` 标签，并由既有工作流创建 GitHub Release。该例外不授权 Marketplace、npm、PR 或其他远程操作，也不关闭 G-04。
- **收缩条件：** 不适用：本 Ticket 不引入兼容层；完成条件是全部 AC 有 Evidence、门禁绿色且无未批准偏差。

## 10. 验收标准

- [ ] AC-001 至 AC-020 均在 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>` 中映射到自动或手动证据。
- [x] `pnpm test:integration` 与 `pnpm check:ci` 实际通过；生成的 VSIX 路径和 package list 已记录。
- [ ] 键盘、辅助技术、Trust、真实 Git 特殊状态、刷新、失败恢复和 dispose 有可重复证据。
- [x] Git 状态审计证明产品流程没有执行写入或远程操作，临时夹具已完整清理。
- [x] 实际修改已在更新后的 `writable_paths` 和 `D-T04-001`、`D-T04-002` 范围内，发现产品缺陷时均回到原 owner 路径修复。
- [ ] G-04 已在 Evidence 和审查通过后关闭，并记录开始/关闭时的 HEAD、工作区摘要和实际修改路径；`D-R01` 的发布不替代该完成条件。
- [x] Ticket、Tickets Map、Evidence 和 change 状态一致，所有路径偏差均已明确记录。
