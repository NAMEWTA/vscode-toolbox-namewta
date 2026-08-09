---
schema_version: 3
artifact: ticket
change: 2026-08-09-review-all-git-changes
id: T-03
title: 交付 VS Code 一键审核交互
status: ready
planning_depth: deep
planning_depth_reason: 新增公共命令、Manifest 贡献点、原生 diff 内容 Provider、Tree View、状态栏和跨 UI 生命周期，影响公共接口与高事故半径资源治理
ready: true
risk: high
blocked_by:
  - T-02
contract_ids:
  - AC-001
  - AC-003
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
  - AC-020
owner: unassigned
expected_changes:
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/extension/adapters/vscode-git-review-*.ts</Path>'
  - '<Path>src/extension/commands/git-review-*.ts</Path>'
  - '<Path>src/extension/presentation/git-review-*.ts</Path>'
writable_paths:
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/extension/adapters/vscode-git-review-*.ts</Path>'
  - '<Path>src/extension/adapters/vscode-git-review-*.test.ts</Path>'
  - '<Path>src/extension/commands/git-review-*.ts</Path>'
  - '<Path>src/extension/commands/git-review-*.test.ts</Path>'
  - '<Path>src/extension/presentation/git-review-*.ts</Path>'
  - '<Path>src/extension/presentation/git-review-*.test.ts</Path>'
read_only_paths:
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
  - '<Path>src/extension/bootstrap/register-domain-modules.ts</Path>'
  - '<Path>src/extension/adapters/vscode-command-registration-adapter.ts</Path>'
  - '<Path>src/extension/presentation/git-historical-document-provider.ts</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>build/build-tests.mjs</Path>'
shared_paths:
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
shared_path_owners:
  - '<Path>package.json</Path> => T-03'
  - '<Path>package.nls.json</Path> => T-03'
  - '<Path>package.nls.zh-cn.json</Path> => T-03'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path> => T-03'
---

# Ticket T-03: 交付 VS Code 一键审核交互

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/03-deliver-vscode-git-review-experience.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>`

## 1. 战略与来源

- **目标：** 将 T-02 已可用的 Gateway 行为适配为完整 VS Code 用户流程：双入口启动、单仓库消歧、Review Queue Tree View、状态栏进度、原生 diff/只读摘要、导航、显式审核、跳过、重试、刷新、总结、替换确认和资源清理。
- **可观察产出：** 用户可在 Source Control 内一键开始并从第一项审核到最后一项；完整队列和进度持续可见，所有操作可用键盘触发，错误可恢复，完成后无 Git 写入或遗留 UI/请求资源。
- **来源：** `US-001` 至 `US-007`、`AC-001`、`AC-003`、`AC-006` 至 `AC-018`、`AC-020`、`ADR-001`、`ADR-002`、`DEC-008`、`USER-DECISION:2026-08-09-merge-each-ticket`。
- **当前事实：** `<Path>src/extension/presentation/git-historical-document-provider.ts</Path>` 已证明自有 URI、取消和稳定公开 `vscode.diff` 可用；`<Path>src/extension/adapters/vscode-command-registration-adapter.ts</Path>` 提供统一命令错误边界；当前 Manifest 没有 Git Review 命令、`scm` View 或菜单贡献。
- **Planning Depth 原因：** 本 Ticket 同时改变用户可绑定命令、Manifest、Tree View、状态栏、Provider 和组合根，必须维持多语言、Workspace Trust、可访问性与完整 dispose，属于公共接口和高事故半径 UI 生命周期变更。

## 2. 决策状态

### 已锁定决策

- 内容审核只使用稳定公开 `vscode.diff`；不使用 `_workbench.*`、proposed multi-diff 或完整 diff Webview。
- Tree View ID 和八个用户可绑定命令 ID 使用 Spec DEC-008；启动命令同时进入命令面板和 `scm/title`，不贡献默认快捷键。
- Source Control 中的 Review Queue Tree View 是主视图，状态栏只投影紧凑进度；两者驱动同一 Gateway session 快照。
- 打开或导航离开不改变处理状态；“标记已审核并转到下一项”是唯一组合动作。
- session stale 时队列不自动重排，只有显式刷新更新队列；重启不恢复进度。
- 全部完成只显示本地总结并结束 session，不执行 stage、commit、push 或远程 review。

### 已采用的低影响假设

- 多仓库消歧可使用 QuickPick，但 QuickPick 不承担 Review Queue 主视图。
- 状态栏文本优先显示当前序号、总数和剩余数；具体简短文案由实现者遵循本地化和窄窗口适配决定。
- 未完成 session 的结束或替换使用可取消的确认提示；用户取消时原状态完全保留。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                                                                                                                          | REUSE（复用且不改变契约）                                                                                  | OUT（明确不做）                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Manifest/本地化、仓库上下文适配、命令编排、Tree View、状态栏、Review 内容 Provider/URI、diff/摘要、错误提示、生命周期与 Presentation 单元测试 | T-01/T-02 Gateway 能力、命令注册适配器、DisposableStore、现有 historical provider 模式和 VS Code 主题/图标 | Git 解析与状态机重写、Webview、默认快捷键、远程、持久化、产品代码以外的集成测试 Gate |

## 4. 要构建什么

用户从任一入口启动时，Extension Host 根据调用上下文、活动文件或唯一候选仓库进行确定，歧义时允许选择。Gateway 创建 session 后，controller 将同一快照投影为 Tree View 和状态栏，并打开第一项。用户可直接选择或通过公开命令导航、审核、跳过、重试、刷新和结束。可呈现文本使用原生 diff；特殊项或局部失败使用可访问的只读摘要并保留队列状态。工作树变化进入 stale 提示；窗口重载、session 替换、结束和扩展停用统一取消请求并清理所有 UI 与 Provider 状态。

## 5. 实现契约

- **入口或接缝：** Manifest command/view/menu 贡献、VscodeCommandRegistrationAdapter、一个 feature-local Git Review controller、TreeDataProvider、StatusBarItem 和 TextDocumentContentProvider。
- **输入与输出：** VS Code 命令参数以 `unknown` 接收并验证；Repository/URI 等 VS Code 对象只在适配层转换为 T-01 的可序列化输入。UI 只消费 Gateway session 快照和结构化错误。
- **公共接口变化：** 新增 DEC-008 的命令和 View ID；Manifest 英文/简体中文文案同步；Extension API v1 结构不变。
- **不变量：** Tree View、状态栏和当前 diff 投影同一 generation 的 session；过期 Promise 不覆盖新 session；普通导航不审核；skip/review 分开；inactive 时 UI 复位。
- **状态或数据流：** VS Code 入口 → repository adapter/确认 → Gateway → session snapshot → controller → Tree View/statusbar/diff；用户动作再次经 Gateway 返回新快照。
- **错误与失败行为：** 空队列或启动失败不创建 UI session；单项打开失败保留队列并允许重试/跳过；用户提示本地化并可打开非敏感日志；取消和过期结果不显示错误噪音。
- **兼容要求：** 激活阶段不得扫描工作区、运行 Git、创建 Webview 或启动 session；现有命令、菜单、Git Blame UI 和 Extension API v1 保持不变。
- **安全与隐私要求：** UI 隐藏不能代替 T-02 Trust 检查；自有 URI 不暴露不必要绝对路径；日志不包含源码、diff、秘密或完整个人信息。

## 6. 执行路线

1. 先用 fake Gateway/VS Code view 接缝添加启动、投影、导航、失败、stale、替换和 dispose 的 Presentation 失败测试。
2. 一次性添加完整命令、View 和菜单 Manifest 契约及英/简中文案，保持无默认快捷键并通过 foundation 检查。
3. 实现仓库上下文/选择适配、feature controller 和全部公开命令，使所有业务动作只经过 Gateway。
4. 实现 Tree View、状态栏与可访问状态文本，确保 generation、一致投影和 inactive 复位。
5. 实现安全 Review 内容 URI/Provider、原生 diff 和特殊项只读摘要，接通取消、重试和局部失败。
6. 在唯一组合根注册 feature 资源并集中 dispose，运行 UI 定向测试、完整 `pnpm check` 和 `pnpm package:list`。
7. 完成可重复键盘手动验收、Evidence 和双轴审查；全部通过后提交并 merge 回父分支。

## 7. 路径访问契约

- **预计修改点：** Manifest/本地化、`create-extension-runtime.ts`，以及新的 Git Review VS Code adapter、commands、presentation 和共置测试。
- **可写范围：** 仅 frontmatter `writable_paths`；不得修改 T-01 Core 契约、T-02 Git Adapter/注册点、Webview 或 T-04 集成测试路径。
- **只读上下文：** T-01/T-02 产物、命令注册适配器、历史 Provider 先例、集成测试与构建入口。
- **共享路径：** `package.json`、两个 `package.nls` 文件和 `create-extension-runtime.ts` 仅由 T-03 修改。
- **保留或不动：** 现有默认快捷键、Git Blame/Copy Reference/System Info 行为、Extension API 版本和 Webview Bundle。

## 8. 验证矩阵

| 行为或风险 | 验证接缝                                                                  | 命令或步骤                                                                             | 预期结果                                                                                        | Evidence                                                                                        |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 正常路径   | Presentation/commands 单元                                                | `pnpm test -- src/extension/commands/git-review src/extension/presentation/git-review` | 启动、队列、diff、导航、显式审核、跳过、刷新、总结符合 AC-003、AC-006 至 AC-012、AC-016、AC-018 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>` |
| 失败路径   | Fake Gateway/VS Code 生命周期                                             | 定向运行空队列、取消、过期 Promise、diff 失败、重试、替换和 dispose 测试               | 原 session/队列不丢失，错误可行动，资源释放符合 AC-013 至 AC-017                                | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>` |
| 回归       | 完整本地门禁与包清单                                                      | `pnpm check && pnpm package:list`                                                      | Manifest、i18n、依赖、类型、覆盖率、构建和 VSIX 文件清单绿色                                    | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>` |
| E2E        | VS Code Extension Development Host 手动流程；当前执行 owner 为 T-03 owner | 仅键盘启动、选择、导航、审核、跳过、刷新和结束，核对可访问名称与进度                   | AC-001、AC-020 可重复通过；自动扩展宿主 Gate 由 T-04 固化                                       | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 必须从已合并 T-02 的父分支创建 T-03；先锁定 Manifest 契约，再实现 controller/UI，最后接入组合根和包清单验证。
- **兼容窗口：** 新命令和 View 为附加能力，现有命令与 API v1 不变；session 不持久化，无数据迁移或降级清理。
- **监控信号：** UI 状态投影测试、活动 AbortController/订阅数量、结构化命令错误、`pnpm check`、`package:list` 和手动键盘验收。
- **回滚或前向恢复：** merge 前丢弃隔离分支；merge 后使用 revert 提交同时移除 Manifest 贡献、组合根注册和 feature 文件，不能只隐藏 View 留下命令或资源。
- **不可逆操作与批准点：** 无生产不可逆操作。用户已授权 T-03 在 Evidence、双轴审查、完整本地门禁和手动 UI Gate 通过后本地 merge 回父分支；不授权 push 或发布。
- **收缩条件：** 全部 Manifest 命令都有真实注册与本地化，Tree View/statusbar/diff 使用稳定公开 API，所有 feature 资源进入统一 dispose，T-04 可从父分支运行集成 Gate。

## 10. 验收标准

- [ ] AC-001、AC-003、AC-006 至 AC-018、AC-020 的用户交互和失败行为均有自动或明确手动证据。
- [ ] 命令面板与 `scm/title` 可启动，Tree View/状态栏/diff 同步，且无默认快捷键或私有/proposed API。
- [ ] 键盘、可访问状态、本地化、Workspace Trust、stale、局部失败、替换和 dispose 均通过验证。
- [ ] `pnpm check` 与 `pnpm package:list` 实际执行并记录到 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>`。
- [ ] 实际修改未超出 `writable_paths`，四个 shared path 仅由 T-03 修改。
- [ ] Ticket 分支已 merge 回父分支并记录 base、提交和 merge 结果；T-04 只能从合并后的父分支开始。
- [ ] 未执行 push、发布或 Git 工作树写操作，未发生未批准偏差，状态投影一致。
