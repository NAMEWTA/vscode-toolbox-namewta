# 归档计划

> 生成时间：2026-08-12 14:48 +0800
> Workflow：specdev
> 模式：archive-batch + executed
> 用户确认：confirmed（2026-08-12）

## 执行摘要

用户明确要求全部剩余 change 关闭并归档。本批次处理：

- `2026-08-09-review-all-git-changes`
- `2026-08-10-copy-ranges-and-aggregate-git-review`（已于前序确认中归档）
- `2026-08-10-fix-toolbox-command-context-and-blame-layout`

前两项剩余 change 的未运行人工 UI/辅助技术步骤按用户决定作为验收豁免关闭；Evidence 保留 `not-run` 和残余风险，没有把未运行检查记为通过。

## 批量预检

| Change                                                    | 完成校验                              | blocker          | external_action  | 结果   |
| --------------------------------------------------------- | ------------------------------------- | ---------------- | ---------------- | ------ |
| `2026-08-09-review-all-git-changes`                       | `--stage complete` 0 error、0 warning | 已由用户豁免清空 | 无远程来源       | ready  |
| `2026-08-10-copy-ranges-and-aggregate-git-review`         | 归档前已通过                          | 0                | `not-applicable` | 已归档 |
| `2026-08-10-fix-toolbox-command-context-and-blame-layout` | `--stage complete` 0 error、0 warning | 已由用户豁免清空 | `not-applicable` | ready  |

## 移动结果

| Change                                                    | 源路径                                                                                                  | 目标路径                                                                                                        | 结果             |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- |
| `2026-08-09-review-all-git-changes`                       | `<Path>speculo/.speculo/specdev/changes/2026-08-09-review-all-git-changes</Path>`                       | `<Path>speculo/.speculo/specdev/archive/2026-08/2026-08-09-review-all-git-changes</Path>`                       | moved            |
| `2026-08-10-copy-ranges-and-aggregate-git-review`         | 前序归档已完成                                                                                          | `<Path>speculo/.speculo/specdev/archive/2026-08/2026-08-10-copy-ranges-and-aggregate-git-review</Path>`         | already archived |
| `2026-08-10-fix-toolbox-command-context-and-blame-layout` | `<Path>speculo/.speculo/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout</Path>` | `<Path>speculo/.speculo/specdev/archive/2026-08/2026-08-10-fix-toolbox-command-context-and-blame-layout</Path>` | moved            |

## 状态结果

`<Path>speculo/.speculo/specdev/status.json</Path>` 已更新为 `active: []`，`archived` 去重包含全部三个 change。两个本批次归档 `.status.json` 均更新为 `change_status: archived`、`archived: true` 和对应 `archive_path`。

## 知识沉淀

- `2026-08-09-review-all-git-changes` 的原生 diff/Source Control Tree View ADR 不重复提升：已归档 change 的聚合 Webview ADR 明确取代旧的“仅原生 diff”决定，旧决策保留在历史归档中。
- `2026-08-10-fix-toolbox-command-context-and-blame-layout` 的稳定 Blame 注解列和提交色块术语已追加到 `<Path>speculo/.speculo/specdev/context/git-review.md</Path>`；没有创建重复 ADR。
- 已有 `<Path>speculo/.speculo/specdev/adr/0001-aggregate-diff-webview.md</Path>`、`<Path>speculo/.speculo/specdev/adr/0002-index-layered-git-review-writes.md</Path>` 保留不改。

## 清理结果

无批准的 delete、merge 或 rewrite。`adr/.gitkeep`、`context/.gitkeep` 和 `research/.gitkeep` 保留。

## 执行后验证

- 三个 change 的源路径均不存在，归档目录完整存在。
- 全局 `active` 为空，`archived` 包含且仅包含三个已归档 change，无重叠。
- 归档状态、路径和永久上下文重读一致。
- 两个剩余 change 归档前 `--stage complete` 通过；归档后的目录按设计不再运行 complete stage。
- `--self-check` 与 `git diff --check` 作为批次结束门禁执行。

当前状态：**confirmed / executed / verified**。归档目录只读；后续纠正通过新 change 和 supersedes 链进行。
