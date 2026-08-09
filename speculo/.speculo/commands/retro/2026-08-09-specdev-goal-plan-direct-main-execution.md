---
command: retro
mode: issue-retro
scope: specdev-goal-plan
workflows:
  - specdev
changes:
  - 2026-08-09-review-all-git-changes
generated_at: 2026-08-09T14:17:04+08:00
target_repository: NAMEWTA/Speculo
---

# Speculo Retro Report

## 范围

本报告记录 `specdev/goal-plan` 在 change `2026-08-09-review-all-git-changes` 中产生的规划偏差：用户选择普通 Goal Plan 后，初版计划仍写入了隔离 worktree、Ticket 分支和逐 Ticket 合并；用户指出该 DAG 完全串行，应该直接在当前分支开发。计划随后已修订为当前工作区中的串行执行。

## 信号与证据

- 用户反馈：`我选择了普通计划，为什么还需要里面写入 worktree？应该也不做规定，可直接在当前分支上进行开发`。
- `speculo/workflows/specdev/common/rules/path-ownership.md` 明确规定：只读调查和顺序执行默认共用当前工作区；只有并行或临时隔离项目写入时使用独立 worktree。
- `speculo/workflows/specdev/P-goal-plan/P-goal-plan.md` 与 `planning-modes.md` 明确普通计划不启用委派，但没有把顺序执行的当前工作区默认值纳入普通 Goal Plan 的强制规划约束。
- `speculo/.speculo/specdev/changes/2026-08-09-review-all-git-changes/LOG.md` 的 `LOG-015` 记录了修订后的决定：T-01 至 T-04 在当前 `main` 串行执行，不创建隔离工作区、Ticket 分支或逐 Ticket 合并规则。

## 去重结果

2026-08-09 在 `NAMEWTA/Speculo` 的开放和已关闭 Issue 中执行以下语义检索，均无命中：

- `Goal Plan worktree`
- `普通 Goal Plan 串行 开发`
- `P-goal-plan worktree merge`

## Issue 候选

- **处置：** `file-issue`
- **类型：** `bug`
- **优先级：** `medium`
- **影响范围：** `specdev` 工作流、`P-goal-plan`、普通 Goal Plan 模板与验证规则
- **目标仓库：** `NAMEWTA/Speculo`
- **候选标题：** `bug: 防止普通 Goal Plan 将可选隔离机制设为默认要求`
- **候选标签：** `bug`、`area:workflows`、`needs-triage`。
- **标签映射说明：** 目标仓库没有 `priority:medium` 标签，现有 `priority:high` 的定义会夸大本问题的影响；因此保留文本优先级 `medium`，使用 `needs-triage` 请求维护者按仓库标签体系定级。

### 根因

普通 Goal Plan 的角色选择只排除了委派字段和派单协议，却没有同时规定：当 DAG 串行、写路径按 Ticket 有序交接且不存在明确隔离要求时，计划必须默认使用当前工作区。模板和检查项也没有要求隔离机制具备触发条件。因此规划者可能把 worktree、分支和合并流程当作通用的安全步骤，覆盖了已有路径所有权规则中的默认值。

### 建议修复

1. 在 `P-goal-plan.md` 与 `planning-modes.md` 中明确：普通且顺序执行的 Goal Plan 默认在当前工作区推进；只有并行写入、用户明确要求隔离，或存在可说明的临时隔离需求时才规划 worktree。
2. 要求计划在写入 worktree、Ticket 分支或合并步骤前记录具体触发条件；没有触发条件时不得出现这些安排。
3. 调整 `goal-plan-template.md`，使普通计划不再默认出现隔离、分支或合并占位；需要时按触发条件加入。
4. 为普通 Goal Plan 增加检查项或 fixture：无隔离理由的串行计划出现 worktree、Ticket 分支或逐 Ticket 合并时应被标记。

### 验收标准

- 普通、串行的 Goal Plan 明确采用当前工作区默认值。
- 无隔离触发条件时，普通计划和模板不包含 worktree、Ticket 分支或逐 Ticket 合并安排。
- 并行写入、用户明确隔离或可说明的临时隔离场景仍可启用 worktree，并记录原因。
- 有自动化 fixture、验证规则或等效的可重复检查覆盖这一约束。

## 丢弃与降级项

没有额外条目。该问题不是一次性经验记录：它来自工作流文件之间未闭合的默认规则，并已造成一次实际计划返工，因此保留为 Issue 候选。

## 目标仓库预检

- `NAMEWTA/Speculo` 为公开仓库，已启用 Issues。
- 当前 GitHub 凭据对目标仓库具有 `ADMIN` 权限。
- `issue-create` dry-run 已通过，目标、标题、正文文件和三个候选标签均可用；没有执行 `--apply`。

## 提交记录

- **状态：** 已创建并回读确认。
- **远端 Issue：** [#38 — bug: 防止普通 Goal Plan 将可选隔离机制设为默认要求](https://github.com/NAMEWTA/Speculo/issues/38)
- **回读结果：** `OPEN`；标签为 `bug`、`area:workflows`、`needs-triage`。
- **提交方式：** 已通过 `issue-transport` 的 `issue-create --apply` 创建。
- **正文草案：** `speculo/.speculo/commands/retro/2026-08-09-specdev-goal-plan-direct-main-execution.issue.md`
