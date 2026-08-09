---
command: retro
mode: issue-retro
scope: specdev-dev-worktree
workflows:
  - specdev
changes:
  - 2026-08-09-review-all-git-changes
generated_at: 2026-08-09T14:46:42+08:00
target_repository: NAMEWTA/Speculo
---

# Speculo Retro Report

## 复盘范围

本报告覆盖 `specdev` 的 Ticket worktree 生命周期。用户要求：当 worktree 中的 Ticket 完成时，应由工作流自行合并回声明的父分支，不应在完成阶段再次等待人工确认。

## 信号来源

- 用户反馈：`当 worktree 完成 tiket 之后应该自行 merge 回到父分支，而不应该需要人工确认`。
- `speculo/workflows/specdev/common/skills/dev-worktree/SKILL.md` 明确规定：合并、推送、PR、删除分支或 worktree 仍需用户授权。
- 同一 Skill 的生命周期规定 Ticket worktree 到达 `review` 后，由 workspace owner 集成或清理；但没有把本地集成定义为已声明结束动作下的自动步骤。
- `speculo/workflows/specdev/I-implement/I-implement.md` 规定不自动推送、合并、部署、发布或执行不可逆迁移，因而覆盖了已完成 Ticket 的本地 worktree 集成。
- `speculo/workflows/specdev/common/skills/dev-worktree/references/finalize.md` 已定义集成前的 Evidence、路径契约与回归验证，但没有定义无需再次人工确认的合并执行条件。

## 改进提案

### enhancement: 完成 worktree Ticket 后自动合并回父分支

- **处置：** `file-issue`
- **类型：** `enhancement`
- **优先级：** `medium`
- **影响范围：** `specdev` worktree 生命周期、Goal Plan 的结束动作授权、I-implement 的提交与返回规则
- **受影响资产：**
  - `speculo/workflows/specdev/common/skills/dev-worktree/SKILL.md`
  - `speculo/workflows/specdev/common/skills/dev-worktree/references/finalize.md`
  - `speculo/workflows/specdev/I-implement/I-implement.md`
  - 需要时的 `P-goal-plan` 授权矩阵和相关验证 fixture
- **去重结论：** 以下检索均无命中：`worktree 完成 Ticket 自动合并 父分支`、`worktree merge parent branch confirmation`、`dev-worktree manual approval merge`。已创建的 #38 只处理普通串行计划不应默认使用 worktree，与本提案不同。
- **候选标签：** `enhancement`、`area:workflows`、`needs-triage`。
- **标签映射说明：** 目标仓库没有 `priority:medium` 标签；现有 `priority:high` 会夸大该问题影响，因此保留文本优先级 `medium`，使用 `needs-triage` 请求维护者定级。
- **创建预检：** `issue-create` dry-run 已通过；尚未使用 `--apply`。

#### 根因

当前规则把本地、已验证的 worktree 集成与推送、PR、远程合并、删除分支等不同风险等级的操作一并要求逐次用户授权。调用方即使已在创建时声明 workspace owner、父分支和允许的结束动作，Ticket 到达 `review` 后仍不能闭合 `review → integrated` 生命周期，导致每个 worktree Ticket 都需要额外人工确认。

#### 建议改动

1. 为 Ticket worktree 定义可持久化的本地集成授权：创建时已明确父分支、workspace owner 与 `integrate` 结束动作的，完成 Evidence 和集成验证后由 workspace owner 自动合并。
2. 在 `finalize.md` 中定义自动集成步骤：重读父分支与 worktree checkpoint、验证路径契约和 Evidence、执行本地合并、运行受影响验证、写入 `integrated` 状态与合并证据。
3. 只对冲突、父分支漂移导致需作出非机械决策、验证失败、目标分支不符合已声明条件或其他无法安全恢复的情况暂停并请求人工决策。
4. 保持现有边界：自动本地集成不授权自动提交、推送、PR、远程合并、部署、发布、删除 worktree 或删除分支；这些动作继续各自遵循现有授权规则。
5. 调整 `I-implement`，使其对已授权 Ticket worktree 的本地集成设置例外，而非将其与所有 merge 操作一律禁止。

#### 验收标准

- 创建 Ticket worktree 时已声明父分支与 `integrate` 结束动作，且 Ticket 完成 Evidence 与集成验证通过后，workspace owner 无需再次询问用户即可完成本地合并。
- 合并后持久化父分支、来源 checkpoint、合并结果、验证结果和 `integrated` 状态。
- 冲突、不可安全处理的基线漂移、验证失败或未经声明的目标分支会保留 worktree 并进入 `blocked`，不静默合并。
- 自动集成不会推送、创建/合并 PR、删除分支或 worktree，也不会绕过已有提交授权。
- 有 fixture、验证规则或等效可重复检查覆盖成功与阻塞路径。

## 丢弃与降级项

没有额外条目。该诉求改变的是现有明确的授权边界，且会在每个合法的并行或隔离 Ticket 中重复出现，不能只记为一次性操作偏好。

## 目标仓库

`NAMEWTA/Speculo`

## 用户确认记录

用户在展示去重结果和 Issue 草案后明确回复“确认创建”。

## 提交结果

已创建并回读确认。

- **候选标题：** `enhancement: 完成 worktree Ticket 后自动合并回父分支`
- **远端 Issue：** [#39 — enhancement: 完成 worktree Ticket 后自动合并回父分支](https://github.com/NAMEWTA/Speculo/issues/39)
- **回读结果：** `OPEN`；标签为 `enhancement`、`area:workflows`、`needs-triage`。
- **提交方式：** 已通过 `issue-transport` 的 `issue-create --apply` 创建。
- **正文草案：** `speculo/.speculo/commands/retro/2026-08-09-specdev-dev-worktree-auto-merge.issue.md`
