# 背景

当一个 Ticket 需要合法使用独立 worktree 时，Ticket 在 worktree 内完成并通过 Evidence 与集成验证后，应由 workspace owner 自动合并回已声明的父分支。该步骤不应因“本地合并”本身再次等待人工确认。

## 当前行为

`speculo/workflows/specdev/common/skills/dev-worktree/SKILL.md` 将合并与推送、PR、删除分支或 worktree 一并要求用户授权；`speculo/workflows/specdev/I-implement/I-implement.md` 也规定不自动合并。

这使已经完成的 Ticket worktree 只能停在 `review`，由 workspace owner 在取得额外人工确认后才能进入 `integrated`。对于创建时已声明工作区 owner、父分支与允许结束动作的 worktree，这个确认会在每个 Ticket 中重复出现。

## 期望行为

创建 Ticket worktree 时，调用方可持久化以下本地集成授权：

- workspace owner；
- 目标父分支；
- `integrate` 结束动作；
- 可验证的基线与来源 checkpoint。

当 Ticket 到达 `review`，且 Evidence、路径契约和集成验证通过后，workspace owner 应自动执行本地集成：重读父分支和来源 checkpoint，完成合并，运行受影响验证，并将 worktree 状态更新为 `integrated`。不应为这一次本地合并再次请求人工确认。

## 必须保留的边界

- 冲突、无法机械处理的父分支漂移、验证失败、未声明的目标分支或其他不满足安全条件的情况必须保留 worktree 并转为 `blocked`，请求人工决策。
- 自动本地集成不等于自动提交、推送、创建或合并 PR、远程写入、部署、发布、删除分支或删除 worktree。
- 已有的提交授权、远程操作授权和清理授权保持独立。

## 建议改动

1. 在 `dev-worktree/SKILL.md` 中将“本地集成”从一律需要用户授权的 merge 操作中分离出来，并要求创建记录含父分支和 `integrate` 结束动作。
2. 在 `references/finalize.md` 中定义自动集成的预检、合并、验证、Evidence 和状态转换。
3. 调整 `I-implement.md`，允许已授权 Ticket worktree 的本地集成自动完成，同时继续禁止未授权的其他合并与所有远程操作。
4. 补充成功路径、冲突路径和验证失败路径的 fixture 或等效验证。

## 验收标准

- 已声明父分支与 `integrate` 结束动作的 Ticket worktree 在完成验证后可自动合并到父分支，无需再次人工确认。
- 记录包含父分支、来源 checkpoint、合并结果、验证结果和 `integrated` 状态。
- 不安全条件会阻止合并并保留现场。
- 自动化不会越权执行提交、推送、PR、远程合并或清理。
