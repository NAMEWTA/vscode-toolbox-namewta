# Git Blame V2 当前架构决策

## ADR-001：将编辑与完整历史阅读拆为两个互补模式

**状态：** Accepted
**日期：** 2026-08-12
**来源：** `USER-DECISION`：Git Blame V2 完整设计方案。

原生 VS Code 编辑器只负责正常编辑和当前行轻量 Blame 信息；完整文件历史由独立 `WebviewPanel` Reader 承载。不得再使用 `before.contentText`、`after.contentText` 或动态假 gutter 改变源码布局。V2.0 不实现 `CustomTextEditorProvider`。

## ADR-002：Extension Host 生成纯数据模型，Webview 只负责交互投影

Git 查询、源文本读取、行数/版本校验、连续 commit block 构建、复制文本生成和安全验证均由 Extension Host 完成。Webview 接收可序列化模型，只负责 logical line 渲染、选择、键盘交互、搜索和发送类型化操作意图。

## ADR-003：Reader 以 logical line 和连续 commit block 为布局单位

软换行只发生在源码 logical line 内，不为 visual wrap row 创建独立 Blame 记录。Commit block 只合并连续且 commit SHA 与 committed/uncommitted kind 相同的行；同一 SHA 非连续出现时必须拆分。

## ADR-004：复制通过验证消息和类型化 Gateway 完成

浏览器原生文本选择用于普通复制；结构化复制操作通过 Webview 消息进入 Extension Host，由 Host 从当前 session model 生成文本，并经类型化 `ToolboxGateway` 和 Clipboard Port 调用 `vscode.env.clipboard.writeText(...)`。Webview 不得提交任意复制文本。

## ADR-005：V2.0 优先保证文本保真、选择复制和可恢复生命周期

源码不 trim、不格式化、不改变 tab、Unicode、行尾语义，也不自动 Markdown 渲染。Reader 必须可选择、可复制、可键盘导航，并在 Panel dispose、取消、刷新和源文档变更时释放资源或显示 stale 状态。语法高亮、复杂 blame 查询和自定义复制模板延期。

## 与永久知识的关系

永久 ADR-001 `aggregate-diff-webview` 的 Extension Host 生成结构化模型、Webview 渲染/虚拟化、消息验证、取消和资源清理原则继续适用。本 change 完成并归档时，永久 context 中旧的“Blame 注解列”定义应标记为历史定义，并补充 V2 当前定义。
