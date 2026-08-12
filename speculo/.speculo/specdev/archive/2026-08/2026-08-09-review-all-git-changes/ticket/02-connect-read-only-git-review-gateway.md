---
schema_version: 3
artifact: ticket
change: 2026-08-09-review-all-git-changes
id: T-02
title: 接入只读 Git 变更数据与 Gateway
status: done
planning_depth: deep
planning_depth_reason: 接入不可信 Git、路径和进程边界并执行 Workspace Trust 权限控制，属于安全与外部数据完整性高风险切片
ready: true
risk: high
blocked_by:
  - T-01
contract_ids:
  - AC-002
  - AC-004
  - AC-005
  - AC-007
  - AC-008
  - AC-012
  - AC-014
  - AC-016
  - AC-019
owner: codex-local
expected_changes:
  - '<Path>src/extension/adapters/git/git-review-*.ts</Path>'
  - '<Path>src/extension/adapters/git/git-review-*.test.ts</Path>'
  - '<Path>src/extension/bootstrap/register-domain-modules.ts</Path>'
writable_paths:
  - '<Path>src/extension/adapters/git/git-review-*.ts</Path>'
  - '<Path>src/extension/adapters/git/git-review-*.test.ts</Path>'
  - '<Path>src/extension/bootstrap/register-domain-modules.ts</Path>'
read_only_paths:
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
  - '<Path>src/extension/adapters/git/git-command-runner.ts</Path>'
  - '<Path>src/extension/adapters/git/git-resource-resolver.ts</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
shared_paths:
  - '<Path>src/extension/bootstrap/register-domain-modules.ts</Path>'
shared_path_owners:
  - '<Path>src/extension/bootstrap/register-domain-modules.ts</Path> => T-02'
---

# Ticket T-02: 接入只读 Git 变更数据与 Gateway

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/02-connect-read-only-git-review-gateway.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>`

## 1. 战略与来源

- **目标：** 将受信任工作区中的真实 Git 未提交变更适配为 T-01 的 Core Port，并在唯一领域注册点接入全部 Git Review Handler，使 Extension API 调用方能通过 Gateway 操作真实 Review Session。
- **可观察产出：** `getCapabilities()` 只在 Handler 注册后报告 Git Review 能力；Gateway 能只读获取 staged、unstaged、untracked、删除、重命名、二进制、submodule 和无 `HEAD` 仓库的稳定描述，并返回可用于原生 diff 或摘要的内容能力。
- **来源：** `US-001`、`US-004` 至 `US-006`、`AC-002`、`AC-004`、`AC-005`、`AC-007`、`AC-008`、`AC-012`、`AC-014`、`AC-016`、`AC-019`、`DEC-004`、`USER-DECISION:2026-08-09-direct-main-development`。
- **当前事实：** `<Path>src/extension/adapters/git/git-command-runner.ts</Path>` 已使用 `shell: false`、参数数组、超时、取消、输出上限和进程清理；`<Path>src/extension/adapters/git/git-resource-resolver.ts</Path>` 已集中检查 Workspace Trust 和可执行仓库。当前没有工作树 change inventory 或 Git Review Port Adapter。
- **Planning Depth 原因：** Git 输出、URI、路径、工作区信任和子进程都是不可信边界，遗漏、目录穿越、命令写入或错误取消会破坏审核可信度与安全，因此按 Deep 规划。

## 2. 决策状态

### 已锁定决策

- 只处理当前工作树未提交变更，不执行 fetch、分支比较或任何 Git 写操作。
- staged 与 unstaged 按当前路径合并为工作树相对 `HEAD` 的单一审核项；untracked 和无 `HEAD` 仓库使用空基准。
- Git 输出解析必须无歧义地支持空格、Unicode、换行、删除和重命名；不能以人类可读文本的脆弱切分作为信任边界。
- 二进制、submodule 和不可呈现内容仍产生队列描述，不能静默过滤。
- 所有 Handler 通过 `<Path>src/extension/bootstrap/register-domain-modules.ts</Path>` 注册，组合根不新增服务定位器或全局容器。

### 已采用的低影响假设

- 复用现有 Git Runner 的默认超时和输出上限；只有定向证据证明不够时才在本 Ticket 内调整请求级参数，不改变全局默认。
- 内容身份由能够区分状态、前后路径和实际内容变化的稳定只读材料计算；具体 Git 批量命令由实现者选择，但必须有特殊路径和大列表测试。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                                                                                              | REUSE（复用且不改变契约）                                                                   | OUT（明确不做）                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Git change inventory 解析、Port Adapter、基准/当前内容能力、内容身份、Trust/取消/错误映射、Handler 注册和单元测试 | T-01 Core 契约、GitCommandRunner、GitResourceResolver、ToolRegistry 与现有 ApplicationError | VS Code 命令、仓库选择 UI、Tree View、状态栏、diff 命令调用、Manifest、远程和 Git 写操作 |

## 4. 要构建什么

当 Extension API 或后续 UI 通过 Gateway 请求开始 Review Session 时，Adapter 在受信任工作区中验证仓库根，运行只读 Git 操作并把所有未提交变更解析成 Core 描述。一个当前路径只产生一个审核项；新增、删除、重命名、无 `HEAD`、二进制和 submodule 均有稳定状态。Core 根据描述建立 session；需要基准内容或摘要时通过同一 Port 读取，取消、超时、Git 缺失、仓库无效和输出异常以结构化错误返回，不泄露 stderr 或源码全文。

## 5. 实现契约

- **入口或接缝：** T-01 定义的 Git Review Port、Handler 和 ToolCommandMap；唯一注册点为 `register-domain-modules`。
- **输入与输出：** 输入仓库根、仓库相对路径和取消信号必须验证；输出仅包含序列化 change descriptor、内容身份、基准内容/摘要及非敏感元数据。
- **公共接口变化：** 运行时 `getCapabilities()` 开始报告 T-01 已定义的 Git Review 命令；Extension API 结构和版本不变。
- **不变量：** 只读、单仓库、队列完整、同路径单项、内容变化可识别、特殊项不静默丢失。
- **状态或数据流：** Gateway → Handler → Git Review Port → GitCommandRunner → 无歧义解析/验证 → Core session service → ToolResult。
- **错误与失败行为：** 不可信工作区为 `permission-denied`；Git/仓库/方案不可用为 `capability-unavailable`；超时、取消和无效输入保留已有结构化 code；Git stderr 不直接成为用户消息。
- **兼容要求：** 现有 Git Blame/History Adapter 和命令不变；不让 git-review 领域深层导入 git-blame 领域，跨域只复用无业务含义的进程适配能力或公共 API。
- **安全与隐私要求：** 所有子进程 `shell: false`，参数数组无 NUL，cwd/路径经过验证；禁止写命令、远程命令、源码/diff 日志和未释放子进程。

## 6. 执行路线

1. 从 AC-004、AC-005、AC-014、AC-019 建立 parser/adapter 失败测试，覆盖特殊路径、无 HEAD、Trust、取消、超时和错误输出。
2. 实现只读 change inventory 解析与内容身份映射，逐项验证所有外部字段后再交给 Core。
3. 实现基准内容、当前内容描述和特殊项摘要 Port 能力，复用现有 Runner 的上限与清理。
4. 在唯一领域注册点构造 session service、Adapter 和全部 Handler，使 capabilities 与实际可用命令一致。
5. 运行 Adapter/Handler 定向测试、完整单元测试、类型检查、依赖边界和构建。
6. 写入 Evidence 与双轴审查；全部通过后关闭 G-02 并同步当前 `main` 状态，T-03 才可开始。

## 7. 路径访问契约

- **预计修改点：** 新增 `<Path>src/extension/adapters/git/git-review-*.ts</Path>` 及共置测试，修改 `<Path>src/extension/bootstrap/register-domain-modules.ts</Path>`。
- **可写范围：** 仅 frontmatter `writable_paths`；T-01 的 Core 契约和 T-03 的 UI/Manifest 全部只读或越界。
- **只读上下文：** T-01 产物、Git Runner、资源解析器和组合根。
- **共享路径：** `<Path>src/extension/bootstrap/register-domain-modules.ts</Path>` 仅由 T-02 修改。
- **保留或不动：** Git Blame/History 领域、现有 Git Runner 默认安全策略、`create-extension-runtime.ts`、Manifest 和本地化资源。

## 8. 验证矩阵

| 行为或风险 | 验证接缝                        | 命令或步骤                                                                         | 预期结果                                                          | Evidence                                                                                        |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 正常路径   | Git Review Adapter/Handler 单元 | `pnpm test -- src/extension/adapters/git/git-review`                               | staged、unstaged、untracked 正确归并并可通过 Gateway 创建 session | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>` |
| 失败路径   | Adapter 安全边界                | 定向运行 Trust、无 HEAD、Git 缺失、超时、取消、特殊路径、损坏输出测试              | 错误结构稳定，无遗漏、写操作、源码日志或资源泄漏                  | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>` |
| 回归       | 项目静态与单元门禁              | `pnpm lint && pnpm lint:dependencies && pnpm typecheck && pnpm test && pnpm build` | Git Blame、Copy Reference、Gateway 和构建保持绿色                 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>` |
| E2E        | 不适用                          | 本 Ticket 不新增 VS Code UI；真实扩展宿主仓库验证由 T-04 执行                      | Adapter 单元接缝完整，T-04 Gate 有明确 owner                      | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 必须在 G-01 关闭后的当前 `main` 开始 T-02；先实现 Adapter 与测试，再注册 Handler，最后确认 capabilities 只投影真实可用命令。
- **兼容窗口：** 新能力是 API v1 的向后兼容扩展；现有 Git 行为持续可用，没有磁盘状态或配置迁移。
- **监控信号：** 结构化错误 code、Git 操作类别和非敏感计数日志，配合进程清理、超时和 parser 测试。
- **回滚或前向恢复：** G-02 失败时只在当前 Ticket 授权路径内修订；存在用户授权的本地提交时使用显式 revert，不 reset T-01 契约。若仅某类 Git 状态异常，保持 capability 失败而不返回不完整队列。
- **不可逆操作与批准点：** 无生产不可逆操作。用户已选择直接在当前 `main` 串行开发；G-02 关闭不执行分支合并、push、远程写入或产品 Git 工作树修改。
- **收缩条件：** 所有 T-01 Git Review Handler 已注册且 capability/Handler 一致，外部 Git 字段全部验证，允许的 Git 参数集合只读并有审计证据。

## 10. 验收标准

- [x] AC-002、AC-004、AC-005、AC-007、AC-008、AC-012、AC-014、AC-016、AC-019 均有 Adapter/Handler 证据。
- [x] 特殊路径、无 HEAD、删除、重命名、二进制、submodule、取消、超时和 Trust 均有失败或正常测试。
- [x] Git 调用审计证明没有写入或远程子命令，日志不包含源码全文或不必要敏感路径。
- [x] 验证矩阵全部执行并记录到 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>`。
- [x] 实际修改未超出 `writable_paths`，共享注册点仅由 T-02 修改。
- [x] G-02 已在 Evidence 和审查通过后关闭，并记录开始/关闭时的 HEAD、工作区摘要和实际修改路径；T-03 只能从该已验证状态开始。
- [x] 未执行 push，未发生未批准偏差，Map/Evidence/Ticket 状态一致。
