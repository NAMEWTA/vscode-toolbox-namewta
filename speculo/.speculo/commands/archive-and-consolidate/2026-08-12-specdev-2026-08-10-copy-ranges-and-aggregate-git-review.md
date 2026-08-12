# 归档计划

> 生成时间：2026-08-12 14:34 +0800
> Workflow：specdev
> 模式：archive-single + executed
> 用户确认：confirmed（2026-08-12）

## 执行摘要

- 本报告由 `<Path>speculo/workflows/specdev/A-archive-and-consolidate/A-archive-and-consolidate.md</Path>` 驱动，并按 `<Path>speculo/skills/archive-and-consolidate/SKILL.md</Path>` 生成。
- 仅 `2026-08-10-copy-ranges-and-aggregate-git-review` 通过 `change_status: completed`、Ticket、Evidence、验证和外部 reconcile 门，进入本次单 change 归档计划。
- `2026-08-09-review-all-git-changes` 仍为 `active`，T-04 为 `blocked`，存在 `B-T04-001`，不纳入归档。
- `2026-08-10-fix-toolbox-command-context-and-blame-layout` 仍为 `active`，当前 Work 为 `specdev/implement`，存在 `B-T01-002`，不纳入归档。
- 初始 dry-run 未执行副作用；用户确认后已按本报告执行归档移动、状态更新和永久知识写入。

## 路径上下文

| 名称            | 解析结果                                                                                | 检查                  |
| --------------- | --------------------------------------------------------------------------------------- | --------------------- |
| project_root    | `<Path>.</Path>`                                                                        | pass                  |
| workflow_root   | `<Path>speculo/workflows/specdev</Path>`                                                | pass                  |
| state_root      | `<Path>speculo/.speculo/specdev</Path>`                                                 | pass                  |
| changes_root    | `<Path>speculo/.speculo/specdev/changes</Path>`                                         | pass                  |
| archive_root    | `<Path>speculo/.speculo/specdev/archive</Path>`                                         | pass                  |
| commands_root   | `<Path>speculo/.speculo/commands</Path>`                                                | pass                  |
| workflow status | `<Path>speculo/.speculo/specdev/status.json</Path>`                                     | JSON/schema v4 可解析 |
| config          | `<Path>speculo/.speculo/specdev/config.json</Path>`、`<Path>speculo/config.json</Path>` | 均已读取              |

## 完成门与候选扫描

| Change                                                    | `.status.json`                                          | Ticket/Map/Evidence                     | 外部动作                                   | 归档资格        |
| --------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------- | ------------------------------------------ | --------------- |
| `2026-08-10-copy-ranges-and-aggregate-git-review`         | `completed`，无 blocker/deviation，`completed_at` 已有  | T-01 `done`；complete validator 0 error | `not-applicable`（Source 为 conversation） | ready           |
| `2026-08-09-review-all-git-changes`                       | `active`，`B-T04-001`                                   | T-04 `blocked`；complete validator 拒绝 | 无 triage，且本地完成门未通过              | blocked，未纳入 |
| `2026-08-10-fix-toolbox-command-context-and-blame-layout` | `active`，`current_work=specdev/implement`，`B-T01-002` | T-01 `review`；complete validator 拒绝  | `not-applicable`，但本地完成门未通过       | blocked，未纳入 |

## 归档移动计划

| #   | Change                                            | 源路径                                                                                          | 目标路径                                                                                                | 状态  | 备注                                            |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------- |
| 1   | `2026-08-10-copy-ranges-and-aggregate-git-review` | `<Path>speculo/.speculo/specdev/changes/2026-08-10-copy-ranges-and-aggregate-git-review</Path>` | `<Path>speculo/.speculo/specdev/archive/2026-08/2026-08-10-copy-ranges-and-aggregate-git-review</Path>` | ready | 名称符合日期 kebab 规则；目标不存在；源完整存在 |

确认执行后，计划按原子顺序：创建 `archive/2026-08/` 月目录；移动整个 change 目录；将该 change 从全局 `status.json.active` 移除并去重追加到 `archived`；更新归档目录内 `.status.json` 为 `change_status: archived`、`archived: true` 和归档相对路径。`changes/` 目录及其 `.gitkeep` 保留。

## 永久知识合并计划

当前永久 store 只有空的 `<Path>speculo/.speculo/specdev/adr/</Path>`、`<Path>speculo/.speculo/specdev/context/</Path>` 和 `<Path>speculo/.speculo/specdev/research/</Path>`；`.gitkeep` 均保留。以下写入全部需要确认执行后才发生。

### `adr/`

| 动作   | 目标                                                                                | 来源                                                                | 毕业判定             | 内容摘要                                                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create | `<Path>speculo/.speculo/specdev/adr/0001-aggregate-diff-webview.md</Path>`          | change `2026-08-10-copy-ranges-and-aggregate-git-review`，`ADR-001` | 稳定机制、接手者必知 | 目标 VS Code 稳定 API 没有公开 multi-diff 接口时，使用自有 React WebviewPanel 展示结构化 Unified patch，同时保留原生 `vscode.diff` 做单文件深入查看；不使用 proposed/private API。 |
| create | `<Path>speculo/.speculo/specdev/adr/0002-index-layered-git-review-writes.md</Path>` | 同 change，`ADR-002`                                                | 稳定机制、接手者必知 | Review 按 staged/unstaged/conflict 的 index 层分组；Stage、Unstage、Discard 必须经类型化 Gateway、Trust、内容身份和确认核验，并串行执行。                                          |

### `context/`

| 动作   | 目标                                                          | 来源                                                                   | 毕业判定             | 术语                                                                                                 |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| create | `<Path>speculo/.speculo/specdev/context/git-review.md</Path>` | change `2026-08-10-copy-ranges-and-aggregate-git-review`，`CONTEXT.md` | 接手者必知、稳定机制 | 精确引用、聚合审核页、审核项、文件级 Git 操作、内容身份；每项保留来源 change 标注和 `_Avoid_` 说明。 |

### 不提升（ephemeral）

以下内容随 change 归档保留，不写入永久 store：`LOG-001` 至 `LOG-005` 的讨论轨迹、Source/Spec/Ticket 的一次性交付边界、T-01 的命令输出与 VSIX 摘要、实现文件清单、临时测试修复过程和本 change 的残余风险。它们未形成额外跨 change 的稳定知识，或已由 ADR/CONTEXT 唯一捕获。

### 冲突与重复检查

- 当前 `adr/`、`context/` 均只有 `.gitkeep`，没有同主题文件或术语定义冲突。
- `ADR.md` 中的两个 ADR 是唯一毕业候选；不从 LOG/Evidence 重复生成 ADR。
- `ADR-001/002` 明确 supersede 了前一 change 的历史决定，但前一 change 尚未完成，故本计划不改写或删除其工件；历史关系保留在归档 change 内。
- 没有写入未在 SpecDev `INDEX.md` 声明的 store；`research/` 不产生新条目。

## 清理候选

| 路径                                                      | 分类 | 理由                                                      | 风险 |
| --------------------------------------------------------- | ---- | --------------------------------------------------------- | ---- |
| `<Path>speculo/.speculo/specdev/adr/.gitkeep</Path>`      | keep | `adr/` 仍为空，归档执行前后均需保留目录占位               | low  |
| `<Path>speculo/.speculo/specdev/context/.gitkeep</Path>`  | keep | `context/` 仍为空；确认合并时创建术语文件但不删除目录占位 | low  |
| `<Path>speculo/.speculo/specdev/research/.gitkeep</Path>` | keep | 本次没有 research 提升，永久目录仍需保留                  | low  |

未发现可安全 `delete`、`merge` 或 `rewrite` 的已存在知识条目。归档 change 内的历史工件不是清理候选，不在归档后改写或删除。

## 计划后验证

确认执行后必须重读并满足：源 change 路径不存在；目标目录完整；归档 `.status.json` 的状态字段和 `archive_path` 一致；全局 `active` 不含该 change 且 `archived` 去重包含该 change；ADR/context 目标内容存在且来源标注正确；`node <Path>speculo/workflows/specdev/common/tools/validate-specdev.mjs</Path> --stage complete <Path>speculo/.speculo/specdev/archive/2026-08/2026-08-10-copy-ranges-and-aggregate-git-review</Path>` 与 `--self-check` 均通过。

## 执行结果与重读验证

| 动作             | 结果 | 证据                                                                                                                                                                         |
| ---------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 创建归档月目录   | pass | `<Path>speculo/.speculo/specdev/archive/2026-08</Path>` 存在                                                                                                                 |
| 移动 change 目录 | pass | 源 `<Path>speculo/.speculo/specdev/changes/2026-08-10-copy-ranges-and-aggregate-git-review</Path>` 不存在；目标完整存在，共 9 个文件                                         |
| 更新全局索引     | pass | `<Path>speculo/.speculo/specdev/status.json</Path>` 的 `active` 已移除 change，`archived` 去重包含 change，无重叠                                                            |
| 更新归档状态     | pass | 归档 `.status.json` 为 `change_status: archived`、`archived: true`，`archive_path` 与目标一致                                                                                |
| 写入永久 ADR     | pass | `<Path>speculo/.speculo/specdev/adr/0001-aggregate-diff-webview.md</Path>`、`<Path>speculo/.speculo/specdev/adr/0002-index-layered-git-review-writes.md</Path>` 均存在且非空 |
| 写入永久上下文   | pass | `<Path>speculo/.speculo/specdev/context/git-review.md</Path>` 存在且包含 5 个来源术语及 `_Avoid_` 说明                                                                       |
| 清理动作         | pass | 无批准的 delete/merge/rewrite；三个 `.gitkeep` 保留                                                                                                                          |

### 验证命令

- 归档前：`node <Path>speculo/workflows/specdev/common/tools/validate-specdev.mjs</Path> --stage complete <Path>speculo/.speculo/specdev/changes/2026-08-10-copy-ranges-and-aggregate-git-review</Path>`：pass，0 error、0 warning。
- 执行后：`node <Path>speculo/workflows/specdev/common/tools/validate-specdev.mjs</Path> --self-check`：pass，0 error、0 warning。
- 执行后尝试对归档目录运行 `--stage complete`：按设计返回 1 error（归档状态为 `archived`，该 stage 要求 `completed`），不是归档失败；状态专用重读验证已 pass。
- `git diff --check`：pass。

## 用户确认

当前状态：**confirmed / executed / verified**。归档目录只读；后续修正应通过新 change 和 supersedes 链进行。
