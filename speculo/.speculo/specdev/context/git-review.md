# Git Review 领域术语

来源：`2026-08-10-copy-ranges-and-aggregate-git-review`，2026-08-10。

**精确引用**：由真实编辑器的 primary selection 生成的一基闭区间引用；VS Code 输入仍按零基、UTF-16、末端排他解释。

_Avoid_: 将编辑器的零基、UTF-16、末端排他坐标直接当作用户可见引用。

**聚合审核页**：一个可恢复的编辑器区 WebviewPanel，按 Merge Changes、Staged Changes、Changes 从上到下投影同一 Review Session。

_Avoid_: 为每个变更单独打开不可恢复的原生 diff 标签页来代替聚合审核页。

**审核项**：由 `itemId` 唯一标识的单个 Git 层变更；同一路径在 staged 与 unstaged 层可以各有一个审核项。

_Avoid_: 仅以文件路径作为审核项身份。

**文件级 Git 操作**：Stage、Unstage 和 Discard；这些操作与 reviewed/skipped 审核状态相互独立。

_Avoid_: 将审核状态变化误当成 Git 工作树或 index 写操作。

**内容身份**：写操作前用于发现过期状态的不可变摘要；身份不匹配时必须拒绝写入并要求刷新。

_Avoid_: 在未重新核验内容身份时复用旧的可写 Git 请求。

**Blame 注解列**：位于代码正文前、显示日期和作者的逐文档装饰区域；宽度由当前渲染文本决定，提交色只覆盖该列。

_Avoid_: 使用固定宽度或让装饰列覆盖代码正文。

**提交色块**：由稳定 commit hash 派生的实色色条与低透明度背景；文本仍承担语义，颜色不是唯一信息来源。

_Avoid_: 让颜色成为作者、日期或提交身份的唯一表达。
