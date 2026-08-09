---
schema_version: 3
artifact: spec
change: 2026-08-09-review-all-git-changes
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-09-review-all-git-changes-consensus
  - ADR-001
  - ADR-002
---

# Spec: 一键审核当前仓库的全部 Git 变更

- **Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **当前 ADR：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ADR.md</Path>`
- **当前领域上下文：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/CONTEXT.md</Path>`

## 1. 问题与目标

### 问题陈述

开发者目前只能自行逐个定位并打开工作区中的 Git 变更，无法在 VS Code 内形成类似 GitHub `Files changed` 的连续审核流程。文件可能被遗漏，打开过的文件会被误认为已经审核，审核期间继续发生的修改也缺少明确的失效和刷新语义。

### 目标用户与场景

目标用户是在受信任的 VS Code 工作区中审核本地代码修改的开发者。主要场景是在提交前，从命令面板或 Source Control 一键启动 Review Session，沿稳定 Review Queue 从第一项审核至最后一项，随时看到当前位置、已审核、跳过和剩余数量，并在异常或工作树变化时安全恢复。

### 成功标准

- 用户无需手动逐个查找变更文件即可建立完整、稳定且可导航的 Review Queue。
- 每个审核项只有经过显式确认才进入已审核状态；打开、关闭或导航离开均不代表审核完成。
- Tree View、原生 diff 与状态栏始终投影同一 Review Session 状态。
- 特殊文件与局部失败不会被静默排除，也不会摧毁其余审核进度。
- 全部流程不修改 Git index、工作树、提交、分支或远程状态，并在结束后完整清理资源。

### 非目标

- 不审核当前分支相对基准分支或远程分支的差异。
- 不实现逐行评论、评论草稿、审批结论或 GitHub 远程 review。
- 不提供暂存、取消暂存、提交、推送、拉取或获取远端状态的能力。
- 不跨多个仓库聚合单个 Review Session，也不跨 VS Code 重启恢复进度。
- 不创建完整 diff Webview、独立 Activity Bar 容器或基于 proposed API 的 multi-diff 界面。

## 2. 解决方案与外部行为

### 解决方案摘要

扩展新增本地 Git Review Session。一次 session 绑定唯一仓库，把 staged、unstaged 和 untracked 变更归并为文件级 Review Queue；同一文件只出现一次，展示工作树相对 `HEAD` 的整体结果。Source Control 容器中的专用 Tree View 持续展示队列和状态，状态栏展示紧凑进度，内容审核使用 VS Code 稳定公开的原生 diff 能力。

### 主要流程

1. 用户从命令面板或 Source Control 标题栏执行“开始审核 Git 变更”。调用上下文或当前活动文件可唯一定位仓库时直接使用；只有一个候选仓库时直接使用；多个候选仍有歧义时让用户选择一个仓库。
2. 扩展在命令执行后检查 Workspace Trust、仓库和 Git 能力，并只读获取当前仓库全部未提交变更。无有效变更时显示可行动提示且不创建空 session。
3. 扩展创建稳定 Review Queue，激活第一项，在 Tree View 和状态栏显示进度，并为可呈现的条目打开原生 diff。
4. 用户可以直接选择任意审核项，也可以执行上一项、下一项、重试、跳过、刷新、结束或“标记已审核并转到下一项”。普通导航不改变审核状态。
5. 工作树发生变化时，当前队列不自动重排；session 进入待刷新状态并提示用户。显式刷新后重新构建队列，只为内容身份仍匹配的条目保留已审核或跳过状态，变化过的条目恢复为未审核。
6. 所有条目均为已审核或跳过后，扩展显示区分两类结果的本地总结并结束 session；不执行任何 Git 或远程写操作。

### 边界、失败与稳定错误行为

- 不可信工作区拒绝启动 Git Review，并使用本地化提示说明需要信任工作区；不得仅靠隐藏按钮实现权限控制。
- 虚拟工作区、Git 不可用、路径不能映射为可执行仓库、仓库解析失败或读取超时，均不创建空 session，并提供可行动提示；技术原因写入输出日志。
- 多仓库存在歧义时取消选择不会创建或替换 session。
- 单个 diff 无法打开时，该审核项保留在队列中并显示失败原因，用户可以重试或显式跳过；其他审核项仍可继续。
- 二进制、submodule 或其他无法提供文本 diff 的条目使用只读摘要展示类型、路径和变更性质，不读取或记录不必要的完整内容。
- 删除项展示基准内容到空内容的语义；新增及 untracked 项展示空内容到当前内容的语义；重命名项保留前后路径。没有 `HEAD` 的新仓库以空基准解释现有变更。
- Gateway 继续使用已有结构化错误分类，包括 `permission-denied`、`capability-unavailable`、`invalid-input`、`timeout`、`cancelled` 和 `internal-error`；用户提示不得依赖匹配英文错误消息。
- 启动另一个 session 时，若当前 session 仍有未处理项，必须先获得用户确认；取消替换时原 session 不变。

### 状态转换与不变量

Review Session 的外部状态为：`inactive → loading → active ↔ stale → refreshing → active → completed → inactive`。取消、替换、失败或扩展停用可以从非终态进入 `inactive`，同时释放资源。

审核项的处理状态为 `unreviewed | reviewed | skipped`；呈现能力和处理状态相互独立，diff 打开失败不能自动变成 `skipped`。以下不变量始终成立：

- 一个窗口最多存在一个活动 Review Session，一个 session 只绑定一个仓库。
- Review Queue 中每个当前路径最多有一个文件级审核项；staged 与 unstaged 不拆分。
- `reviewed` 只能由用户显式操作产生；`skipped` 必须单独计数和展示。
- session 未刷新时队列顺序不因工作树变化而改变。
- 内容身份发生变化的审核项不得保留原 `reviewed` 或 `skipped` 状态。
- Tree View、状态栏和命令操作使用同一 session 状态权威。
- 所有 Git 调用均为只读参数数组，不执行拼接 Shell 字符串或远程操作。

## 3. 用户故事

- **US-001**：作为准备提交代码的开发者，我希望从命令面板或 Source Control 一键开始审核当前仓库的全部未提交变更，以免手动寻找和遗漏文件。
- **US-002**：作为审核者，我希望在原生 diff 中按稳定队列查看每个文件，并持续看到当前位置和整体进度，以便从头到尾完成审核。
- **US-003**：作为键盘用户，我希望直接跳转、前后导航并显式标记已审核或跳过，以便控制审核结论而不依赖鼠标。
- **US-004**：作为审核期间仍在修改代码的开发者，我希望知道队列已经过时，并在刷新后撤销变化内容的旧审核状态，以免把新修改误认为已审核。
- **US-005**：作为审核者，我希望删除、重命名、二进制、submodule 和 diff 失败项仍有明确去向，以免特殊变更被静默遗漏。
- **US-006**：作为处于多仓库、不可信工作区或 Git 不可用环境中的用户，我希望获得明确且可恢复的反馈，而不是空白界面或丢失现有进度。
- **US-007**：作为完成或取消审核的用户，我希望看到准确总结并确保所有临时状态和资源被清理，同时不产生任何 Git 或远程写操作。

## 4. 验收合同

| ID     | 前置条件                                           | 动作或事件                               | 可观察结果                                                                                                  | 验证接缝                                    |
| ------ | -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AC-001 | 扩展已激活                                         | 用户查看命令面板或 Source Control 标题栏 | 两处均可启动 Git Review，且扩展未贡献默认快捷键                                                             | Manifest 检查与扩展宿主集成测试             |
| AC-002 | 当前活动文件或调用上下文唯一对应一个仓库           | 用户开始审核                             | 直接绑定该仓库，不出现无意义选择器                                                                          | Core 决策单元测试与扩展宿主集成测试         |
| AC-003 | 存在多个候选仓库且无法唯一判断                     | 用户开始审核                             | 显示仓库选择；取消时不创建或替换 session                                                                    | Extension Host 适配测试                     |
| AC-004 | 仓库同时包含 staged、unstaged 和 untracked 变更    | 用户开始审核                             | 所有变更进入队列，同一当前路径只出现一个相对 `HEAD` 的文件级审核项                                          | Git 适配集成测试                            |
| AC-005 | 仓库没有 `HEAD` 或包含新增、删除、重命名           | 打开对应审核项                           | 新增使用空基准，删除使用空结果，重命名保留前后路径                                                          | Git 解析单元测试与真实仓库集成测试          |
| AC-006 | session 创建成功                                   | 首项激活或用户直接选择队列项             | Tree View 展示稳定完整队列和每项状态，状态栏展示同步进度，目标项在原生 diff 或只读摘要中打开                | Presentation 单元测试与扩展宿主集成测试     |
| AC-007 | 当前项为可呈现文本变更                             | 用户打开该项                             | 使用 VS Code 稳定公开 `vscode.diff` 能力展示正确前后内容，不调用私有或 proposed API                         | Provider 单元测试与扩展宿主集成测试         |
| AC-008 | 当前项是二进制、submodule 或无法呈现文本 diff      | 用户打开该项                             | 显示本地化只读摘要或明确失败状态，条目仍留在队列且可重试或跳过                                              | Presentation 单元测试                       |
| AC-009 | 存在当前审核项                                     | 用户执行上一项、下一项或直接跳转         | 当前位置和 UI 投影同步变化，原项处理状态保持不变                                                            | Core 状态机单元测试                         |
| AC-010 | 当前项为 `unreviewed`                              | 用户执行“标记已审核并转到下一项”         | 当前项变为 `reviewed`，进度更新并激活下一可处理项                                                           | Core 状态机单元测试与命令集成测试           |
| AC-011 | 当前项无法或无需完成内容审核                       | 用户显式跳过                             | 当前项变为 `skipped`，与 `reviewed` 分开计数并出现在最终总结                                                | Core 状态机与 Presentation 单元测试         |
| AC-012 | active session 的工作树发生变化                    | 变化被检测或用户刷新                     | 队列先保持稳定并进入 `stale`；刷新后内容身份匹配项保留状态，变化项恢复为 `unreviewed`                       | Core 刷新单元测试与真实仓库集成测试         |
| AC-013 | session 正在进行                                   | VS Code 窗口重载或扩展重启               | 不恢复旧审核进度，不向仓库写入 session 状态                                                                 | 扩展宿主集成测试与存储检查                  |
| AC-014 | 工作区不可信、Git 不可用、仓库无变更或路径不可执行 | 用户开始审核                             | 不创建空 session，显示本地化且可行动的提示；日志包含非敏感技术原因                                          | Gateway 失败测试与 Workspace Trust 集成测试 |
| AC-015 | 单个审核项打开 diff 失败                           | 用户继续审核、重试或跳过                 | session、当前位置以外的队列和已有进度保持可用，不静默吞掉失败                                               | Presentation 失败与清理单元测试             |
| AC-016 | 全部审核项均为 `reviewed` 或 `skipped`             | 最后一个处理动作完成                     | 显示 reviewed、skipped 和总数的本地总结并结束 session，不执行任何 Git 或远程写操作                          | Core 完成测试与 Git 调用审计                |
| AC-017 | session active、stale、loading 或 refreshing       | 用户结束、确认替换或扩展停用             | 取消待处理请求并释放监听器、状态栏、Tree View 状态、Provider 引用和 `AbortController`，不遗留未处理 Promise | 生命周期单元测试与扩展停用集成测试          |
| AC-018 | 当前 session 仍有未处理项                          | 用户再次开始另一个 session               | 先提示确认；取消时保留原 session，确认后清理原 session 再创建新 session                                     | Core 与命令编排测试                         |
| AC-019 | 任一 Git Review 命令收到外部参数                   | 参数进入扩展边界                         | 输入以 `unknown` 接收并经类型守卫验证，所有业务操作经过类型化 `ToolboxGateway`                              | Contract 与 Gateway 单元测试                |
| AC-020 | 用户只使用键盘或屏幕阅读器                         | 执行完整审核流程                         | 所有命令、Tree View 项和状态均可达且有可理解的本地化名称，不仅依赖颜色或图标传达状态                        | 扩展宿主手动验收与 Manifest/i18n 检查       |

用户故事覆盖关系：US-001 对应 AC-001、AC-002、AC-003、AC-004、AC-005；US-002 对应 AC-006、AC-007；US-003 对应 AC-009、AC-010、AC-011、AC-020；US-004 对应 AC-012、AC-013；US-005 对应 AC-005、AC-008、AC-015；US-006 对应 AC-002、AC-003、AC-014、AC-018；US-007 对应 AC-016、AC-017、AC-019。

## 5. 范围

### IN

- 当前仓库未提交变更的只读发现、归并、内容身份与稳定排序。
- 单窗口、单仓库、仅当前扩展会话存活的 Review Session 状态机。
- 命令面板与 Source Control 标题栏启动入口，以及审核导航、标记、跳过、重试、刷新和结束命令。
- Source Control 容器中的 Review Queue Tree View、状态栏进度、原生 diff 与特殊项只读摘要。
- 多仓库消歧、Workspace Trust、虚拟工作区、Git 不可用、空队列、超时、取消和局部失败行为。
- 英文与简体中文 Manifest 文案、运行时本地化、日志边界、单元测试和扩展宿主集成测试。

### REUSE

- 类型化 Gateway、运行时输入校验和结构化错误：`<Path>src/core/contracts/tool-command-contract.ts</Path>`、`<Path>src/core/orchestration/toolbox-gateway.ts</Path>`。
- Core Port 与 Extension Host Adapter 的领域边界及唯一组合根：`<Path>src/extension/bootstrap/register-domain-modules.ts</Path>`、`<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>`。
- 参数数组、超时、取消、输出上限和进程清理：`<Path>src/extension/adapters/git/git-command-runner.ts</Path>`。
- Workspace Trust 与可执行仓库解析：`<Path>src/extension/adapters/git/git-resource-resolver.ts</Path>`。
- 自有历史内容 URI、取消和稳定公开 `vscode.diff` 先例：`<Path>src/extension/presentation/git-historical-document-provider.ts</Path>`。
- 命令错误边界与资源集中释放：`<Path>src/extension/adapters/vscode-command-registration-adapter.ts</Path>`、`<Path>src/core/kernel/disposable.ts</Path>`。
- 现有真实临时 Git 仓库集成测试方式：`<Path>tests/integration/git-history.integration.test.ts</Path>`。

### OUT

- **OOS-001**：分支、tag、commit、merge-base、PR 或远端差异审核；首版只处理工作树未提交变更。
- **OOS-002**：逐行评论、评论持久化、批准或拒绝结论、GitHub API 和远程 review。
- **OOS-003**：stage、unstage、discard、commit、amend、push、pull、fetch、checkout 或其他 Git 写操作。
- **OOS-004**：跨仓库聚合队列与同时运行多个 Review Session。
- **OOS-005**：跨重启持久化、共享审核状态、协作同步或把进度写入仓库。
- **OOS-006**：自建 diff Webview、独立 Activity Bar 容器、以 QuickPick 作为主队列或使用 proposed multi-diff API。
- **OOS-007**：新增默认快捷键；用户仍可按 VS Code 机制自行绑定公开命令。

## 6. 已锁定实现约束

- **DEC-001**：内容审核必须使用 VS Code 稳定公开的原生 diff；插件不实现 diff Webview，也不调用 `_workbench.*` 或 proposed API。来源：`ADR-001`。
- **DEC-002**：Source Control 中的 Review Queue Tree View 是 session 主视图，状态栏是同一状态的紧凑投影；不新增独立 Activity Bar 容器。来源：`ADR-002`。
- **DEC-003**：所有业务操作必须经过类型化 `ToolboxGateway`；Core 状态和契约不得依赖 `vscode`、Node、React 或 DOM。来源：项目 `ADR 0002` 与 `<Path>docs/architecture/overview.md</Path>`。
- **DEC-004**：Git 能力只由 Extension Host Adapter 提供，必须检查 Workspace Trust，使用参数数组、超时、取消、输出上限和明确清理；不得执行任何写入或远程子命令。来源：仓库治理与现有 Git Runner。
- **DEC-005**：session 进度只驻留当前扩展会话；刷新只按稳定内容身份保留处理状态，不能仅按路径保留。来源：`LOG-007`、`LOG-008`。
- **DEC-006**：审核项的 `unreviewed`、`reviewed`、`skipped` 必须建模为互斥状态；diff 呈现失败属于独立错误维度。来源：`LOG-009`、`LOG-010`。
- **DEC-007**：扩展公共 API 的 `apiVersion` 保持 `1`，`getCapabilities()` 增加 Git Review 能力；新增输入输出必须可序列化、无 `any` 且在边界完成运行时验证。来源：项目 `ADR 0002`。
- **DEC-008**：用户可绑定的命令 ID 固定使用 `vscodeToolboxNamewta.gitReview.start`、`vscodeToolboxNamewta.gitReview.previous`、`vscodeToolboxNamewta.gitReview.next`、`vscodeToolboxNamewta.gitReview.markReviewedAndNext`、`vscodeToolboxNamewta.gitReview.retry`、`vscodeToolboxNamewta.gitReview.skip`、`vscodeToolboxNamewta.gitReview.refresh`、`vscodeToolboxNamewta.gitReview.end`；Tree View ID 使用 `vscodeToolboxNamewta.gitReview.queue`。来源：`LOG-004`、`LOG-010`、`LOG-012` 与现有命名约定。

## 7. 数据、接口与兼容

- **公共接口变化：** Manifest 增加 DEC-008 中的命令与 Tree View；`ToolCommandMap` 和 Extension API capabilities 增加相应类型化 Git Review 操作，但 `activate()` 返回结构与 `apiVersion: 1` 不变。所有 VS Code 命令参数视为不可信输入。
- **数据模型与持久化：** 新增仅驻内存的 Review Session、Review Queue、审核项状态、内容身份和进度快照；不写 `workspaceState`、`globalState`、仓库文件或外部服务。
- **兼容要求：** 保持 VS Code `^1.100.0`、Node.js 22 开发工具链、扩展 Node 20 目标语法、远程 Extension Host 行为、现有 Git Blame/Copy Reference/System Info 命令和 Extension API v1 调用方兼容。
- **迁移要求：** 无持久化数据或配置迁移；升级后新增命令和视图，降级时不存在需要清理的磁盘状态。
- **发布或运维影响：** Manifest、英文和简体中文本地化资源、能力描述与 VSIX 内容发生变化；不增加网络、凭据、遥测、Marketplace 发布或后台常驻任务。

## 8. 非功能要求

- **NFR-001 安全与隐私：** 仅在受信任工作区执行 Git；外部命令参数、URI、路径和 Git 输出必须验证；日志不得记录源码全文、diff、秘密或非必要绝对路径；不会发起网络请求。
- **NFR-002 性能与容量：** 扩展激活阶段不得扫描工作区、运行 Git 或创建 Review UI 资源；只在显式启动后加载变更。Git 操作沿用有上限的输出、超时和取消策略，队列处理不得无界并发；不预加载所有文件完整内容来维持 UI。
- **NFR-003 可用性与可靠性：** 队列顺序确定且 session 内稳定；重复、取消、刷新、替换和 dispose 必须幂等；局部失败不丢失其他进度，过期状态不得伪装为已审核。
- **NFR-004 可观测性与运营：** 输出日志只记录操作类别、结构化错误码、非敏感计数和生命周期结果；用户提示使用 `vscode.l10n.t`，Manifest 文案同步维护英文和简体中文。
- **NFR-005 可访问性：** 所有主要动作可通过公开命令和键盘完成；Tree View 和状态栏文本可被辅助技术理解，审核状态不能只靠颜色或图标区分。

## 9. 验证策略

| 接缝                                         | 层级                        | 覆盖合同                                                                       | 现有先例或命令                                                                                                                     | Evidence 类型                                                       |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Review Session 状态机与刷新归并              | Core 单元                   | AC-004、AC-009、AC-010、AC-011、AC-012、AC-013、AC-016、AC-017、AC-018         | 共置 Vitest；参考 `<Path>src/core/orchestration/toolbox-gateway.test.ts</Path>`                                                    | 定向测试输出与状态转换断言                                          |
| ToolCommandMap、输入守卫、Handler 与 Gateway | Core 契约/单元              | AC-019                                                                         | `<Path>src/core/contracts/tool-command-contract.test.ts</Path>`、`pnpm test`                                                       | 无效输入、取消、结构化错误和 capability 断言                        |
| Git 变更解析、内容身份与只读命令边界         | Adapter 单元                | AC-004、AC-005、AC-012、AC-014、AC-016                                         | `<Path>src/extension/adapters/git/git-command-runner.test.ts</Path>`                                                               | 参数数组、特殊路径、超时、取消和无写命令审计                        |
| Tree View、状态栏、命令与 diff/摘要投影      | Extension Presentation 单元 | AC-003、AC-006、AC-007、AC-008、AC-009、AC-010、AC-011、AC-015、AC-017、AC-020 | `<Path>src/extension/presentation/git-commit-changes-quick-pick.test.ts</Path>`                                                    | Fake VS Code view/command 接缝的状态与清理断言                      |
| 临时真实 Git 仓库                            | 扩展宿主集成                | AC-002、AC-004、AC-005、AC-006、AC-007、AC-012、AC-014、AC-015、AC-016、AC-017 | `<Path>tests/integration/git-history.integration.test.ts</Path>`、`pnpm test:integration`                                          | staged/unstaged/untracked、rename/delete、无 HEAD、刷新和 diff 证据 |
| Workspace Trust、激活和公开命令              | 扩展宿主集成                | AC-001、AC-013、AC-014、AC-017、AC-020                                         | `<Path>tests/integration/trusted-workspace.integration.test.ts</Path>`、`<Path>src/extension/extension.integration.test.ts</Path>` | 受限模式、命令注册、重载与 dispose 断言                             |
| Manifest、依赖边界、国际化与完整回归         | 静态/构建                   | AC-001、AC-019、AC-020 及兼容要求                                              | `pnpm check`、`pnpm package:list`                                                                                                  | 格式、Lint、依赖、类型、覆盖率、构建和 VSIX 文件列表                |
| 键盘与辅助技术流程                           | 可重复手动验收              | AC-020                                                                         | VS Code Extension Development Host                                                                                                 | 操作记录；必要时附截图和辅助技术结果                                |

## 10. 风险、假设与未决问题

### 风险

- Git 状态包含空格、Unicode、换行、重命名或平台特定路径时，解析错误可能导致遗漏或错误归并；实现必须使用无歧义输出并覆盖真实路径夹具。
- 大型仓库的内容身份计算和大量 Tree View 项可能影响响应性；实现应复用 Git 批量能力、限制并发并避免不必要的完整内容复制。
- 原生 diff 对二进制、submodule 或特殊 URI 的支持有限；只读摘要与显式跳过是必需降级路径，不能依赖失败后静默继续。
- 多个 UI 投影和异步 Git 请求可能产生状态竞态或资源泄漏；单一状态权威、generation/取消检查和集中 dispose 是完成门禁。

### 已采用的低影响假设

- Review Queue 默认按规范化仓库相对路径稳定排序；通过含大小写、Unicode 和重命名路径的单元测试验证确定性。
- 一个 VS Code 窗口最多保留一个活动 session；替换未完成 session 前要求确认，通过命令编排测试验证。
- QuickPick 仅可用于多仓库消歧，不作为 Review Queue 主载体；通过 Presentation 测试验证启动与取消行为。
- 没有 `HEAD` 的仓库以空树作为基准；通过临时真实仓库集成测试验证。

### 未决问题

无。
