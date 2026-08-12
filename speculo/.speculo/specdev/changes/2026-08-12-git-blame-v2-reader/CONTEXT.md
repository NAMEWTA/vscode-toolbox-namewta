# Git Blame V2 领域上下文

## 当前领域事实

当前 Git Blame 实现从 `git blame --line-porcelain` 生成 `GitBlameLine`，通过 Extension Host 的 Git 适配器进入 Core Handler，再由原生编辑器装饰渲染。现有实现已经提供当前行 Hover、行历史、提交变更、历史内容和提交 SHA 复制能力。

现有永久 context 中的“Blame 注解列”是旧版实现术语：它描述位于源码正文前的文字装饰区域。Git Blame V2 将该区域从原生编辑器删除，Reader 中的元数据列只属于独立历史阅读视图。

## V2 术语

**Normal Editing Mode**：原生 VS Code 编辑器中的正常代码编辑模式，只显示当前行 Status Bar、Hover 和非侵入式 commit block 高亮。

**Full-file Blame Reader**：独立 Webview Editor Tab，提供完整文件的 Git 历史阅读、logical line 布局、commit block、搜索、导航、选择和结构化复制。

**logical line**：源文件中的一条 Git blame 行，以一基行号和完整原始文本表示。Reader 的软换行不能把它拆成多个 Git blame 行。

**commit block**：连续 logical line 且 commit SHA 和 committed/uncommitted kind 相同的区间。相同 SHA 的非连续区间必须是不同 block。

**结构化复制**：由 Host 根据模型生成的 Copy Code、Copy Line With Blame、Copy Commit SHA、Copy Commit Info、Copy Block Code、Copy Block With Blame、Copy All Code 和 Copy All With Blame。

**未提交行**：工作树中尚无提交归属的行。主 UI 显示 `Uncommitted` 或 `Working Tree`，不显示全零 SHA；原始 Git 数据只在明确的 Raw Blame 导出语义中保留。

## 避免

- 不把完整 Blame 文本重新放回原生编辑器 gutter。
- 不按 visual wrap row 绑定或重复 Blame 元数据。
- 不让颜色成为作者、日期或提交身份的唯一语义来源。
- 不把只读 Reader 做成不可选择、不可复制的 Canvas 或图片。
- 不让 cursor movement、scroll、selection、copy 或 theme change 隐式执行 Git blame。
