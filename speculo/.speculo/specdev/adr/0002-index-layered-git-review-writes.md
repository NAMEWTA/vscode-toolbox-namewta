# ADR-0002：按 index 层分组并受控执行 Git Review 写操作

- **状态：** Accepted
- **日期：** 2026-08-10
- **来源：** `2026-08-10-copy-ranges-and-aggregate-git-review` 的 `ADR-002`

## 背景

单一 `HEAD -> worktree` 结果无法准确表达 staged、unstaged 和 conflict，也会掩盖同一路径同时存在的 staged 与 unstaged 修改。审核页需要与 Git 状态层保持一致，并允许文件级处理。

## 决策

审核项按 staged、unstaged 和 conflict 分组；同一路径在不同层可以拥有独立的稳定 `itemId`。Stage、Unstage 和 Discard 必须经过类型化 Gateway、Workspace Trust、仓库根、路径、预期内容身份和必要确认核验，并串行执行。

## 后果

Git 状态变化后必须重新加载 inventory。内容身份过期、取消或确认拒绝不得产生写入；Discard 始终是用户确认的文件级操作，不实现逐 hunk 写入。
