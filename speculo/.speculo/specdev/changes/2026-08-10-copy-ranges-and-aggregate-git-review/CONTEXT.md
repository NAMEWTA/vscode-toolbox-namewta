# 领域上下文

**精确引用**：由真实编辑器 primary selection 生成的一基闭区间引用；VS Code 传入的 Selection 仍按零基、UTF-16、末端排他解释。

**聚合审核页**：一个可恢复的编辑器区 WebviewPanel，按 Merge Changes、Staged Changes、Changes 从上到下投影同一 Review Session。

**审核项**：由 `itemId` 唯一标识的单个 Git 层变更。同一路径在 staged 与 unstaged 层可以各有一个审核项。

**文件级 Git 操作**：Stage、Unstage 和 Discard。它们与 reviewed/skipped 审核状态相互独立。

**内容身份**：写操作前用于发现过期状态的不可变摘要；身份不匹配时必须拒绝写入并要求刷新。
