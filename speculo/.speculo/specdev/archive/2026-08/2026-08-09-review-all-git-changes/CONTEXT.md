# Git 变更审核

**Review Session**：一次绑定唯一 Git 仓库的本地变更审核会话，维护固定范围内的 Review Queue、当前审核项、已审核状态和整体进度。
_Avoid_: 批量打开文件、远程 review

**Review Queue**：Review Session 中按稳定顺序组织的未提交 Git 变更审核项集合，内容来源包括 staged、unstaged 和 untracked 变更。
_Avoid_: 跨仓库队列

**审核项**：Review Queue 中一个文件级变更单位；同一文件的 staged 与 unstaged 修改合并为工作树相对 HEAD 的整体变化。审核状态必须由用户显式确认，打开或导航离开不构成已审核。
_Avoid_: staged 审核项、unstaged 审核项

**跳过**：用户确认当前审核项无法或无需完成内容审核的显式状态；它与已审核不同，必须在 session 总结中单独呈现。
_Avoid_: 已审核
