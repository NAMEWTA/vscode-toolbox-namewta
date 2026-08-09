---
schema_version: 3
artifact: tickets-map
change: 2026-08-09-review-all-git-changes
status: ready
---

# Tickets Map: 一键审核当前仓库的全部 Git 变更

- **Map：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/tickets-map.md</Path>`
- **Spec：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/spec.md</Path>`
- **Ticket 目录：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/</Path>`
- **Evidence 目录：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/evidence/</Path>`
- **可选 Goal Plan：** `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/goal-plan.md</Path>`

## 1. 目标与拆分策略

4 个 Ticket 共同交付 US-001 至 US-007 和 AC-001 至 AC-020。拆分先由 T-01 建立唯一 shared-contract prefactor 与纯 Core 状态权威，再由 T-02 形成可从 Extension API 观察的真实只读 Git/Gateway 切片，T-03 完成全部 VS Code 用户交互，最后由 T-04 独立执行真实扩展宿主与发布候选集成 Gate。

不采用按 Core、Adapter、UI 随意水平拆层：T-01 是明确解除公共契约冲突的安全 prefactor，T-02 交付 API 可调用行为，T-03 交付完整用户行为，T-04 只拥有集成证据和测试入口。不存在旧协议替换或调用方迁移，因此不使用 expand-contract。

用户最新决定：全部 Ticket 直接在当前 `main` 串行开发。每个 Ticket 必须在自身 Evidence、适用质量门禁、路径审计和双轴审查通过后关闭对应 Gate；后继 Ticket 只能从该 Gate 已关闭且状态同步完成的当前工作区开始。后续 `D-R01` 明确授权当前 change 的 `0.1.1` commit、push 和 GitHub Release；该例外不授权远程 merge、Marketplace、npm 或 destructive reset，也不关闭人工 Gate。

## 2. 执行清单

| ID   | Ticket                                                                                                                           | 可观察产出                                                    | Blocked By | Depth    | Risk   | Ready | Owner       | Contract IDs                                                           | Wave/Gate     | Status  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------- | -------- | ------ | ----- | ----------- | ---------------------------------------------------------------------- | ------------- | ------- |
| T-01 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/01-establish-git-review-contract.md</Path>`        | 类型化 Git Review 契约与纯 Review Session 状态机              | —          | deep     | high   | yes   | codex-local | AC-009 至 AC-012、AC-016 至 AC-019                                     | Wave 1 / G-01 | done    |
| T-02 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/02-connect-read-only-git-review-gateway.md</Path>` | 真实只读 Git change inventory 可经 Extension API/Gateway 使用 | T-01       | deep     | high   | yes   | codex-local | AC-002、AC-004、AC-005、AC-007、AC-008、AC-012、AC-014、AC-016、AC-019 | Wave 2 / G-02 | done    |
| T-03 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/03-deliver-vscode-git-review-experience.md</Path>` | 完整 Source Control Review Queue、原生 diff、命令与进度体验   | T-02       | deep     | high   | yes   | codex-local | AC-001、AC-003、AC-006 至 AC-018、AC-020                               | Wave 3 / G-03 | done    |
| T-04 | `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/ticket/04-verify-git-review-integration-gate.md</Path>`   | 真实 Extension Host、键盘、质量门禁和 VSIX 完整 Evidence      | T-03       | standard | medium | no    | codex-local | AC-001 至 AC-020                                                       | Wave 4 / G-04 | blocked |

Ticket frontmatter 是状态、依赖、深度和路径访问契约的权威；本表是同步投影，不得独立修改出另一套真相。

## 3. 依赖 DAG

```text
T-01 [READY, shared contract]
  └─→ G-01: Evidence + gate closure
        └─→ T-02 [READY, Git + Gateway]
              └─→ G-02: Evidence + gate closure
                    └─→ T-03 [READY, VS Code UX]
                          └─→ G-03: Evidence + gate closure
                                └─→ T-04 [READY, integration gate]
                                      └─→ G-04: Evidence + gate closure
```

每条阻塞边都表示真实开始条件：T-02 依赖已验证的公共契约；T-03 依赖已验证且可用的真实 Gateway；T-04 依赖已验证的完整产品行为。Evidence 不完整、路径越界、未归属工作区变更或审查未通过都会阻塞后继 Ticket。

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket            | 验证接缝                                 | 状态    | 说明                                 |
| ----------- | ---------------------- | ---------------------------------------- | ------- | ------------------------------------ |
| AC-001      | T-03, T-04             | Manifest/命令与 Extension Host           | covered | 双入口且无默认快捷键                 |
| AC-002      | T-02, T-04             | Gateway/真实仓库                         | covered | 唯一仓库直接绑定                     |
| AC-003      | T-03, T-04             | Repository adapter/选择器                | covered | 多仓库歧义与取消                     |
| AC-004      | T-02, T-04             | Git parser/真实仓库                      | covered | staged、unstaged、untracked 完整归并 |
| AC-005      | T-02, T-04             | Git parser/无 HEAD 与 rename/delete 夹具 | covered | 空基准和前后路径语义                 |
| AC-006      | T-03, T-04             | Tree View/statusbar/diff                 | covered | 同一状态投影与直接选择               |
| AC-007      | T-02, T-03, T-04       | 内容 Port/公开 `vscode.diff`             | covered | 正确前后文本且无私有 API             |
| AC-008      | T-02, T-03, T-04       | 特殊描述/只读摘要                        | covered | 二进制、submodule 和 diff 降级       |
| AC-009      | T-01, T-03, T-04       | 状态机/命令                              | covered | 导航不改变审核状态                   |
| AC-010      | T-01, T-03, T-04       | 状态机/组合命令                          | covered | 显式审核并前进                       |
| AC-011      | T-01, T-03, T-04       | 状态机/Tree View/总结                    | covered | skipped 与 reviewed 分离             |
| AC-012      | T-01, T-02, T-03, T-04 | 内容身份/刷新归并                        | covered | stale 稳定与失效恢复                 |
| AC-013      | T-03, T-04             | 重载/存储检查                            | covered | 不跨重启恢复                         |
| AC-014      | T-02, T-03, T-04       | Gateway/Trust/用户提示                   | covered | 无空 session 和可行动反馈            |
| AC-015      | T-03, T-04             | diff 失败与重试                          | covered | 局部失败不破坏队列                   |
| AC-016      | T-01, T-02, T-03, T-04 | 状态机/总结/Git 审计                     | covered | 完成、总结和零写入                   |
| AC-017      | T-01, T-03, T-04       | lifecycle/dispose                        | covered | 取消所有请求和 UI 资源               |
| AC-018      | T-01, T-03, T-04       | 替换确认/状态机                          | covered | 取消保留原 session                   |
| AC-019      | T-01, T-02, T-04       | Contract/Gateway/输入守卫                | covered | unknown 边界与类型化业务操作         |
| AC-020      | T-03, T-04             | i18n/键盘/辅助技术 Gate                  | covered | 可访问且不只依赖图标或颜色           |

无 `uncovered` 或 `deferred` 合同。

## 5. 并行与路径所有权

- 最大并发为 `<Path>{roots.state}/specdev/config.json</Path>` 中的 3，但真实依赖要求本 change 在当前 `main` 串行执行；不为利用并发而制造额外执行环境。
- 每个 Ticket 直接在当前 `main` 的已验证状态继续。前一 Ticket Gate 关闭、Evidence 写入并同步状态前，后一 Ticket 不得开始。
- 项目路径契约以 Ticket frontmatter 为准；需要越界时停止并提出 ownership deviation。

| Ticket A | Ticket B | Writable 交集 | 真实依赖 | 处理        |
| -------- | -------- | ------------- | -------- | ----------- |
| T-01     | T-02     | 无            | 是       | G-01 后串行 |
| T-02     | T-03     | 无            | 是       | G-02 后串行 |
| T-03     | T-04     | 无            | 是       | G-03 后串行 |

共享路径唯一 owner：

- T-01：`<Path>src/core/contracts/tool-command-contract.ts</Path>`、`<Path>src/core/contracts/index.ts</Path>`。
- T-02：`<Path>src/extension/bootstrap/register-domain-modules.ts</Path>`。
- T-03：`<Path>package.json</Path>`、`<Path>package.nls.json</Path>`、`<Path>package.nls.zh-cn.json</Path>`、`<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>`。
- T-04：`<Path>build/build-tests.mjs</Path>`；`D-T04-001` 的既有 Extension Host 回归断言，以及 `D-T04-002` 的 foundation 文档、ESLint 配置与 Speculo 格式/CLI 质量修正。

## 6. Gate、Wave 与集成点

- **Wave 1 / G-01 Contract Gate：** T-01 Schema、Core 测试、类型、依赖和双轴审查通过；Evidence、路径审计和状态同步完成后关闭 Gate。
- **Wave 2 / G-02 Git Security Gate：** T-02 特殊路径、Trust、只读参数、取消、超时、日志和回归通过；Evidence、路径审计和状态同步完成后关闭 Gate。
- **Wave 3 / G-03 UX Gate：** T-03 `pnpm check`、`package:list`、键盘/可访问性手动流程和 UI 生命周期通过；Evidence、路径审计和状态同步完成后关闭 Gate。
- **Wave 4 / G-04 Release Candidate Gate：** T-04 `test:integration`、`check:ci`、VSIX、Git 零写入审计和全部 AC Evidence 通过；Evidence、路径审计和状态同步完成后关闭 Gate。

每个 Gate 必须记录开始与关闭时的 `HEAD`、工作区摘要、实际修改路径、命令结果、Evidence、审查结果和残余风险。未归属变更、路径越界、门禁失败或审查未通过时停止并将当前 Ticket 标记 `blocked`；禁止通过跳过测试、越界修改或 destructive reset 继续。

存在 3 张 Deep Ticket、4 个 Gate 和共享公共契约，因此使用 `<Path>{roots.workflows}/specdev/P-goal-plan/P-goal-plan.md</Path>` 固化 Gate owner、直接串行执行和恢复顺序。

## 7. 横切契约与风险

- 所有业务操作经过类型化 Gateway，Core 不依赖 VS Code/Node/React/DOM，组合根仍是唯一装配点。
- Git 只读、参数数组、Workspace Trust、超时、取消、输出上限和无敏感日志适用于所有 Ticket。
- 只使用稳定公开 VS Code API；Tree View、状态栏和 diff 投影同一 session 状态，不引入 Webview 或 proposed multi-diff。
- 用户可见 Manifest 和运行时文案必须同步英文与简体中文，状态不只依赖颜色或图标。
- 每个 Ticket Gate 关闭是后继开始条件；除用户已记录的 `D-R01` 外，不授权自动提交、push、远程 merge、部署、Release 或 Marketplace 发布。
- T-04 发现产品缺陷时必须退回对应 owner，不得越界修改 T-01 至 T-03 的实现路径。

## 8. 同步规则

- Ticket 状态变化后同步执行清单，并同时更新 Ticket、Map、Evidence 和 change 状态。
- Ticket ID、路径、依赖或 frontmatter 不一致时，以 Ticket 文件为权威并修复本 Map。
- Goal Plan 存在时，Wave、Gate、当前 `main` 的执行顺序和 owner 以 `<Path>{roots.state}/specdev/changes/2026-08-09-review-all-git-changes/goal-plan.md</Path>` 为编排权威。
- 依赖、合同覆盖或路径所有权变化后运行 `<Path>{roots.workflows}/specdev/common/tools/validate-specdev.mjs</Path>`。
- 内部工件不得使用相对 Markdown 链接；任何 commit、push 或发布结果不得在未执行时声称成功。
