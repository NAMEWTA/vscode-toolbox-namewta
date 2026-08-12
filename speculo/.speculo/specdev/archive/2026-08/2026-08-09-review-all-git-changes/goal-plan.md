---
schema_version: 3
artifact: goal-plan
change: 2026-08-09-review-all-git-changes
status: completed
modes: [coordination, high-assurance]
ready_for_execution: false
---

# Goal Plan: 一键审核当前仓库的全部 Git 变更

- **Goal Plan：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/goal-plan.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **Tickets Map：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/tickets-map.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/</Path>`

## 1. Outcome and Authority

### Outcome

交付一个只在受信任工作区按用户显式操作启动的本地 Git Review Session。用户能够在 Source Control Tree View、状态栏和 VS Code 原生 diff 组成的同一状态投影中，完整审核当前仓库 staged、unstaged 与 untracked 变更；只有显式操作才产生 `reviewed` 或 `skipped`，异常项不被静默遗漏，结束后不遗留资源，也不修改 Git index、工作树、分支或远程状态。

全部开发直接在当前 `main` 串行进行。T-01 至 T-04 仍是严格顺序的质量 Gate，而不是隔离交付单元：只有前一 Ticket 的 Evidence、必跑验证和双轴审查完整后，才能开始后一 Ticket。

### Success and False Completion

成功必须同时满足：T-01 至 T-04 全部 `done`；AC-001 至 AC-020 均映射到实际 Evidence；G-01 至 G-04 依次关闭；当前 `main` 的受控变更包含所有通过 Gate 的实现；最终 `pnpm check:ci`、真实 Extension Host、包清单、VSIX、键盘与辅助技术 Gate 均有实际结果。

以下均属于伪完成：仅打开全部 diff 而没有稳定 Review Session；把打开或导航当成已审核；静默排除二进制、submodule 或失败项；仅凭单元测试声称 UI/Extension Host 通过；省略 Trust、取消、资源清理或 Git 零写入审计；未执行命令却记录绿色；当前 Ticket Gate 失败后仍开始后继 Ticket；把未经路径审计的既有工作区改动归入当前 Ticket。

### Non-goals

- 不审核分支、tag、commit、merge-base、PR 或远端差异。
- 不实现逐行评论、审批、远程 review、持久化进度或跨仓库 session。
- 不引入完整 diff Webview、独立 Activity Bar 容器、私有命令或 proposed API。
- 不执行 push、远程 merge、部署、GitHub Release、Marketplace 发布或真实用户数据操作。

### Authoritative Inputs

| 优先级 | 来源                                                                                   | 负责内容                                       | 冲突处理                         |
| ------ | -------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| 1      | 用户最新明确决定                                                                       | 普通计划、当前 `main` 直接串行开发与高影响批准 | 更新真正拥有该决策的工件         |
| 2      | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ADR.md</Path>`  | 原生 diff 与 Source Control Tree View 架构决定 | 架构冲突时停止并返回设计决策     |
| 3      | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>` | 外部行为、范围、AC 与非功能要求                | 下游不得改写                     |
| 4      | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/</Path>` | 单 Ticket 范围、路径所有权、执行路线与验证     | Ticket 冲突时修订对应 Ticket     |
| 5      | 当前代码与工具链事实                                                                   | 可行性、实际脚本和运行基线                     | 事实冲突触发偏差，不静默改写上游 |

规划时源码固定点为本地 `main` 与 `origin/main` 共同指向 `dc6ccd84907eb57d25d87d8a3db7419343c8d473`；实测工具链为 Node.js `v22.22.3`、pnpm `11.18.0`。每个 Ticket 开始和 Gate 关闭时都记录 `HEAD`、工作区摘要和当前路径审计，以区分本 Ticket 变更与外部变更。

## 2. Execution Graph

### DAG and Critical Path

```text
main
  └─ T-01 Core contract/session
       └─ G-01 Contract Gate
            └─ T-02 read-only Git/Gateway
                 └─ G-02 Git Security Gate
                      └─ T-03 VS Code UX
                           └─ G-03 UX Gate
                                └─ T-04 integration/RC evidence
                                     └─ G-04 Release Candidate Gate → change completion audit
```

四张 Ticket 构成唯一关键路径，不存在安全并行机会。配置允许最大并发 3，但本 change 的实际并发容量固定为 1；后继 Ticket 只有在前一 Gate 的 Evidence、状态同步和路径审计全部完成后才能开始。

### Waves and Ownership

| Wave | Ticket | 前置条件                                               | 项目写路径摘要                                                 | Shared owner                                                                | 集成点 |
| ---- | ------ | ------------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| 1    | T-01   | Goal Plan 已写入；开始前记录 `main` 状态；Ticket Ready | Core contract 与 `<Path>src/core/domains/git-review/**</Path>` | T-01 拥有 Core contract/export                                              | G-01   |
| 2    | T-02   | G-01 关闭；T-01 Evidence 与当前状态一致                | Git Review Adapter 与领域注册点                                | T-02 拥有 `<Path>src/extension/bootstrap/register-domain-modules.ts</Path>` | G-02   |
| 3    | T-03   | G-02 关闭；Gateway capability 可观察                   | Manifest、i18n、命令、Presentation 与组合根                    | T-03 拥有 Manifest/i18n/组合根                                              | G-03   |
| 4    | T-04   | G-03 关闭；完整用户行为已验证                          | 集成测试与测试构建入口                                         | T-04 拥有 `<Path>build/build-tests.mjs</Path>`                              | G-04   |

全部 Ticket 的唯一执行 owner 为 `codex-local`。该 owner 只能修改对应 Ticket frontmatter 的 `writable_paths`；SpecDev 状态、Ticket、Map 与 Evidence 按工作流同步，不构成扩大项目代码写路径的授权。

### Ticket Quick Reference

| ID   | 行为产出                                 | Depth/Risk      | Dependencies | Wave/Gate | Owner       | Evidence                                                                                        |
| ---- | ---------------------------------------- | --------------- | ------------ | --------- | ----------- | ----------------------------------------------------------------------------------------------- |
| T-01 | 类型化契约与纯 Review Session 状态机     | deep/high       | —            | W1/G-01   | codex-local | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path>` |
| T-02 | 真实只读 Git inventory 可经 Gateway 使用 | deep/high       | T-01         | W2/G-02   | codex-local | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path>` |
| T-03 | 完整 VS Code Git Review 用户体验         | deep/high       | T-02         | W3/G-03   | codex-local | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path>` |
| T-04 | Extension Host、可访问性与发布候选证据   | standard/medium | T-03         | W4/G-04   | codex-local | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>` |

## 3. Gates and Completion Evidence

### Overall Definition of Done

- T-01 至 T-04 全部 `done`，无 cancelled/deferred Ticket、未批准偏差或未分类失败。
- AC-001 至 AC-020 均在 T-04 汇总 Evidence 中定位到自动或可重复手动证据。
- Core、Extension Host、Manifest、i18n、原生 diff、Tree View、状态栏与生命周期保持架构边界和单一状态权威。
- `pnpm check:ci` 实际通过，`pnpm test:integration`、`pnpm package:list` 和 `pnpm package:vsix` 结果及 VSIX 路径已记录。
- Git 调用审计证明产品只读，工作树/索引/远程状态在产品流程前后无非夹具写入。
- 每个 Gate 的开始与关闭状态、实际修改路径、命令结果和残余风险可追溯；当前 `main` 包含全部通过 Gate 的变更。
- Ticket、Tickets Map、Goal Plan、Evidence、change 状态与代码事实一致。

### Gates

| Gate                        | 开启条件                                | 关闭证据                                                                                                                                | 阻塞范围          | Owner/批准人                         | 失败恢复                                                      |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| G-01 Contract Gate          | T-01 Ready；开始状态已记录              | Core/contract 定向测试、类型、依赖、完整回归、双轴审查、T-01 Evidence、路径审计                                                         | T-02 至 T-04      | codex-local；高影响偏差由用户批准    | 当前 Ticket 标记 blocked；修复本 Ticket 或建立对应偏差        |
| G-02 Git Security Gate      | G-01 关闭；T-01 Evidence 与当前状态一致 | 特殊路径、无 HEAD、Trust、取消、超时、只读参数、日志、进程清理、回归、双轴审查、T-02 Evidence、路径审计                                 | T-03 至 T-04      | codex-local；安全/契约偏差由用户批准 | 不返回不完整队列；需要 Core 改动时重新打开 G-01               |
| G-03 UX Gate                | G-02 关闭；capability 与 Handler 一致   | UI/命令定向测试、`pnpm check`、`package:list`、键盘与可访问性手动步骤、生命周期审查、T-03 Evidence、路径审计                            | T-04              | codex-local；产品/架构偏差由用户批准 | Manifest、Gateway 或生命周期问题退回对应 owner Gate           |
| G-04 Release Candidate Gate | G-03 关闭；完整行为已验证               | `pnpm test:integration`、`pnpm check:ci`、全部 AC 映射、Git 零写入审计、键盘/辅助技术结果、VSIX 路径、双轴审查、T-04 Evidence、路径审计 | change completion | codex-local；release 偏差由用户批准  | 分类失败；产品缺陷重新打开原 owner Gate，禁止在 T-04 越界修复 |

每个 Gate 在关闭前重新检查：当前 Ticket 修改未越界、开始前已有工作区快照、Evidence 完整、必跑命令退出码为 0、审查无未处理 finding，且没有未经归属的路径变更。任一条件失败都不得开始后继 Ticket。

### Contract and Reference Coverage

| 合同或参考要求                                                         | 覆盖 Ticket     | 验证接缝                                                 | Evidence            | 状态                 |
| ---------------------------------------------------------------------- | --------------- | -------------------------------------------------------- | ------------------- | -------------------- |
| AC-009 至 AC-012、AC-016 至 AC-019                                     | T-01，T-04 复核 | Core contract/state machine/Gateway                      | T-01、T-04 Evidence | verified             |
| AC-002、AC-004、AC-005、AC-007、AC-008、AC-012、AC-014、AC-016、AC-019 | T-02，T-04 复核 | Git Adapter、真实仓库、结构化错误                        | T-02、T-04 Evidence | verified             |
| AC-001、AC-003、AC-006 至 AC-018、AC-020                               | T-03，T-04 复核 | Manifest、commands、Tree View、statusbar、diff、生命周期 | T-03、T-04 Evidence | verified             |
| AC-001 至 AC-020                                                       | T-04 汇总       | Extension Host、手动 Gate、完整 CI/VSIX                  | T-04 Evidence       | verified-with-waiver |

## 4. Execution and Integration Protocol

### Ticket Execution Order

| Ticket | 开始条件                                          | 执行 owner  | 必跑验证                                                    | Evidence      | 后继条件                                |
| ------ | ------------------------------------------------- | ----------- | ----------------------------------------------------------- | ------------- | --------------------------------------- |
| T-01   | Goal Plan 已写入；记录当前 `main` 状态；W1 可开始 | codex-local | Ticket 验证矩阵与 G-01 命令                                 | T-01 Evidence | G-01 关闭后允许 T-02                    |
| T-02   | G-01 已关闭；T-01 Evidence 与当前代码一致         | codex-local | Ticket 验证矩阵与 G-02 安全审计                             | T-02 Evidence | G-02 关闭后允许 T-03                    |
| T-03   | G-02 已关闭；真实 Gateway capability 可用         | codex-local | Ticket 验证矩阵、`pnpm check`、`package:list`、手动 UX Gate | T-03 Evidence | G-03 关闭后允许 T-04                    |
| T-04   | G-03 已关闭；完整产品行为位于当前 `main`          | codex-local | Ticket 验证矩阵、`test:integration`、`check:ci`、Git 审计   | T-04 Evidence | G-04 关闭后进行 change completion audit |

### Authorization Matrix

| 动作                                                | 状态           | 目标与条件                                                                                     |
| --------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| Local changes                                       | allowed        | 直接在当前 `main` 开发；仅限当前 Ready Ticket 的 `writable_paths` 和必需 SpecDev 状态/Evidence |
| Commit                                              | allowed        | 用户于 `2026-08-09T19:42:07+08:00` 明确授权提交本 change 的 `0.1.1` 版本内容。                 |
| Push / remote merge / PR                            | allowed        | 仅推送该版本提交到 `origin/main`，再推送严格匹配清单版本的 `v0.1.1` 标签；不创建或合并 PR。    |
| Deploy / Release                                    | allowed        | 仅由标签触发 GitHub Release 与 VSIX 附件；不发布 Marketplace 或 npm，且不因此关闭 G-04。       |
| Production configuration / feature / real user data | not-authorized | 本 change 不接触生产配置、开关或真实用户数据                                                   |

### Evidence Return and Integration

1. 每张 Ticket 在当前 `main` 按 I-implement 执行 TDD、路径审计、适用门禁与双轴审查。
2. 开始前记录 `HEAD`、`git status --short` 和与当前 Ticket 路径相关的 diff 摘要；Evidence 必须区分既有变更、本 Ticket 变更和环境产物。
3. Gate 关闭时写入 Evidence、同步 Ticket/Map/Goal Plan/change 状态，并重新检查合同覆盖、路径所有权和必跑验证。
4. 只有 Gate 关闭后才能开始下一 Ticket；当前工作区中出现未归属或越界变更时立即停止并按偏差控制处理。
5. T-04 关闭后由最后一个 Implement 汇总全部 Gate 与 Evidence，并按 change completion 合同判断 completed；不自动 push 或归档。

## 5. Constraints, Risk and Recovery

### Non-negotiable Constraints

- 所有业务操作经过类型化 `ToolboxGateway`；Core 不导入 VS Code、Node、React 或 DOM；来源为项目 ADR 0002 与 Spec DEC-003。违反时重新打开 G-01。
- Git 仅使用受信任工作区中的只读参数数组，保留超时、取消、输出上限和进程清理；禁止 Shell 字符串、写子命令、远程子命令和敏感日志。违反时重新打开 G-02 并停止全部后继 Wave。
- 只使用 VS Code 稳定公开 API；Review Queue、状态栏与原生 diff 投影同一 session 状态；激活阶段不扫描、不运行 Git、不创建 Review UI。违反时重新打开 G-03。
- `reviewed` 只由显式用户动作产生，`skipped` 独立计数，内容身份变化使旧处理状态失效，特殊项不得静默遗漏。违反时返回对应 Core/Adapter owner Gate。
- 每张 Ticket 只能修改其 `writable_paths`，shared path 只由指定 Ticket 拥有；越界必须先建立偏差。
- 当前 Ticket Gate 未关闭前不得开始后继 Ticket；不得以跳过测试、放宽类型、删除用例、rebase 或 destructive reset 制造绿色。

### Verification Integrity

- 不修改的判卷接缝包括现有 Gateway/Extension API v1 回归、依赖边界、Workspace Trust、真实 Git 临时仓库、公开 `vscode.diff`、Extension Host、包清单和 VSIX。
- T-02 必须包含能证明写/远程 Git 操作不被执行的反向测试或参数审计；临时破坏只读允许集时测试必须变红，恢复后重新绿色。
- T-03 必须扫描或测试不存在 `_workbench.*`、proposed API 和默认 Git Review 快捷键；破坏 Manifest/注册一致性时 foundation 检查必须失败。
- T-04 必须在产品流程前后比较 Git 状态，并证明任何写入只来自受控测试夹具；不能以代码阅读代替该证据。
- 既有失败、环境失败与本 Ticket 新失败分开记录；关键验证未运行时状态保持 `unverified`，不得关闭 Gate。

### Migration or Release Sequence

本 change 是向后兼容的附加能力：T-01 expand 类型契约但不宣称运行时可用；T-02 注册真实能力；T-03 暴露用户入口；T-04 只固化集成与发布候选证据。不存在持久化数据迁移或旧协议收缩。用户已通过 `D-R01` 明确授权将通过门禁的 `0.1.1` 提交推送并推送同名标签，由既有 GitHub Actions 创建 VSIX Release；该例外不关闭 AC-020 或 G-04，也不授权 Marketplace、npm 或其他远程操作。

发现问题时，先停止受影响 Gate 并保留可审计的工作区状态。存在用户授权的对应本地提交时可使用显式 revert；否则记录精确 diff、归属和恢复方案，禁止 destructive reset。

### Risks, Monitoring and Recovery

| 风险                                    | 触发信号与事故半径                                     | 预防与检测                                             | 恢复                                              | Owner/批准点                    |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------- | ------------------------------- |
| Git 特殊路径或状态解析遗漏              | 队列数与真实状态不一致；可能产生错误完成               | NUL-safe/无歧义解析、特殊夹具、大列表与真实仓库测试    | 阻塞 G-02；保持 capability 失败，不返回不完整队列 | codex-local；契约变化需用户批准 |
| 异步 generation 或资源泄漏              | 旧 Promise 覆盖新 session、监听器/请求残留             | 状态投影、取消、重复 dispose 和活动资源测试            | 阻塞 G-03；保留现场并修复生命周期                 | codex-local；架构变化需用户批准 |
| 当前工作区出现未归属变更                | 路径超出当前 Ticket 授权，或基线摘要与 Evidence 不一致 | 每张 Ticket 开始/关闭时记录状态与 diff，检查路径所有权 | 当前 Gate blocked；先识别归属或建立偏差           | codex-local；扩大范围需用户批准 |
| Extension Host 或手动可访问性证据不稳定 | 自动化/手动 Gate 无法重复                              | 确定性临时仓库、无网络夹具、明确键盘步骤和环境记录     | 分类为环境或验证无效；修复验证后重跑 G-04         | codex-local；降低验收需用户批准 |

### Deviation Control

遵循 `<Path>{roots.workflows}/specdev/common/rules/deviation-control.md</Path>`。local 偏差只记录 Evidence；ticket 偏差暂停当前 Gate 与全部后继 Wave；spec、architecture 或 release 偏差返回对应上游工件并等待用户批准。shared path 越界、验证接缝失效、未归属工作区变更或新增安全风险均不得先改后报。

## 6. Progress and Decisions

### Current Status

```text
WAVE_STATUS wave=4 ready=none active=none done=T-01,T-02,T-03,T-04 blocked=none
GATE_STATUS gate=G-01 state=closed evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path> risks=none
GATE_STATUS gate=G-02 state=closed evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path> risks=none
GATE_STATUS gate=G-03 state=closed evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path> risks=D-T03-001-runtime-l10n
TICKET_STATUS id=T-01 state=done evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-01.md</Path> deviation=none
TICKET_STATUS id=T-02 state=done evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-02.md</Path> deviation=none
TICKET_STATUS id=T-03 state=done evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-03.md</Path> deviation=D-T03-001
TICKET_STATUS id=T-04 state=done evidence=<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path> deviation=D-T04-001-approved,D-T04-002-approved,D-R01-approved,D-A-2026-08-12-approved
BLOCKER id=B-T04-001 owner=user needed=运行物理键盘和辅助技术手动 Gate impact=AC-020;G-04 resolution=waived-by-user-2026-08-12
DECISION id=D-T04-001 owner=codex-local status=approved impact=仅同步既有 Extension Host 测试的公开 capability/命令回归断言
DECISION id=D-T04-002 owner=user-objective status=approved impact=修复 foundation 文档、格式与 Speculo CLI 质量门禁，不改变产品行为
DECISION id=D-R01 owner=user status=approved impact=提交、推送并发布 `0.1.1` GitHub Release；不作为 AC-020 或 G-04 的人工通过证据
DECISION id=D-A-2026-08-12 owner=user status=approved impact=接受 AC-020 人工键盘/辅助技术步骤未运行的残余风险并关闭 T-04/G-04
```

- G-03 已关闭；T-04 的自动化验证、完整 `check:ci` 与 VSIX 已完成，路径偏差均已记录。人工辅助技术 Gate 未运行，用户于 2026-08-12 明确接受该残余风险并关闭 T-04/G-04。
- T-04 发布候选审计发现的两个 Git Review 未使用导出已由 T-01/T-02 原 owner 在各自既有路径内修正；`pnpm lint:unused` 已通过，未扩大 T-04 范围。
- T-04 发布候选审计发现 T-03 的空变更提示曾降级结构化 `reason: no-changes`；原 owner 已在 T-03 适配器和已授权运行时 l10n 范围内修正，并通过定向和最终整套自动化复核，未扩大 T-04 范围。
- 初次发布候选 Gate 暴露的中文 foundation、格式与 Speculo CLI Lint 问题已在 `D-T04-002` 中修复；最终 `pnpm check:ci` 完整通过，没有通过放宽规则、增加忽略路径或降低覆盖率取得绿色。
- 用户于 `2026-08-09T19:42:07+08:00` 明确批准 `D-R01`：提交当前 change、推送 `origin/main` 并推送 `v0.1.1` 标签，由既有工作流创建 GitHub Release；该发布授权不改变 T-04 的 blocked 状态。
- 当前规划固定点：`main == origin/main == dc6ccd84907eb57d25d87d8a3db7419343c8d473`。
- 最近规划验证：Tickets stage、Goal Plan stage 与 Speculo self-check 均为 `0 error / 0 warning`；本次最终 Evidence 同步后将再次复核。

### Pending Decisions and Blockers

- `D-T04-001` 已由 G-04 Gate owner `codex-local` 于 `2026-08-09T17:26:44+08:00` 批准；范围仅限既有 Extension Host 测试的公开 capability/命令回归断言同步，详情见 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>`。
- `D-T04-002` 依据用户的完成目标，记录 foundation 文档、格式和 Speculo CLI 质量修复；完整 `check:ci` 已通过，详情见 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/T-04.md</Path>`。
- `D-R01` 依据用户的明确发布授权，允许 `0.1.1` 的 commit、`origin/main` push、`v0.1.1` tag push 和 GitHub Release；不替代 `B-T04-001`。
- `B-T04-001` 已按用户 2026-08-12 决定豁免；未运行的人工步骤和残余风险保留在 T-04 Evidence，不伪装成通过。

### Resume Protocol

恢复时依次读取本 Goal Plan、当前 Ticket、最新 Evidence、`<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/.status.json</Path>` 与 `<Path>{roots.state}/specdev/status.json</Path>`，再核对当前 `main` 的 HEAD、状态和受影响路径 diff。只从最后已验证且已记录的 Gate 状态继续；不重复询问已确认的普通计划选择或直接串行开发决定。

### Reporting Format

```text
WAVE_STATUS wave=<n> ready=<ids> active=<ids> done=<ids> blocked=<ids>
GATE_STATUS gate=<id> state=open|closed evidence=<paths> risks=<summary>
TICKET_STATUS id=<id> state=<state> evidence=<path> deviation=<none|id>
BLOCKER id=<id> owner=<owner> needed=<decision-or-input> impact=<scope>
DECISION id=<id> owner=<owner> status=pending|approved|rejected impact=<scope>
```

## Assumptions

- 当前 `main` 是本 change 的唯一开发位置；每个 Gate 以前一 Ticket 的 Evidence 和已验证工作区状态为开始条件。
- 直接串行开发不改变 Ticket 的路径所有权、验收合同或 Gate；它只移除不必要的隔离与合并步骤。
- 未获授权的提交、push、发布和 destructive Git 操作不自动执行。
