# 当前变更架构决策

## ADR-001：使用 VS Code 原生多文件更改视图

- **状态：** Accepted
- **决定：** 以公开命令 `vscode.changes` 展示完整文件集合，单文件内容继续由现有只读内容 provider 延迟提供。
- **原因：** 用户需要与编辑器一致的导航、主题和单文件 Diff 行为，同时仓库规则禁止私有 `_workbench.*` 命令。
- **后果：** Presentation 负责把 Git 文件状态映射为 label/original/modified URI 三元组；不增加 Webview。

## ADR-002：端点解析后固定完整 OID

- **状态：** Accepted
- **决定：** 历史选择项和手输前缀最终都转换为完整 40 或 64 位 commit OID，比较与内容读取禁止继续携带模糊 ref。
- **原因：** 选择过程与延迟内容读取之间 Git ref 可能移动；完整 OID 保证同一会话快照稳定。
- **后果：** typed gateway 增加 revision 解析操作，适配器承担 Git 输出校验。

## ADR-003：保留直接快照比较语义

- **状态：** Accepted
- **决定：** 比较严格执行用户选择的 `base -> target`，不自动取 merge-base 或 first parent。
- **原因：** 两端均可选择时，隐式改写端点会破坏方向可理解性；Orca 的两种模式只作为交互与降级策略参考。
- **后果：** 标题始终显示两个短 OID 和箭头，测试覆盖分叉历史。

## 永久知识提升候选

完成并进入 Archive Work 后，以“原生 Git 双节点比较”永久 ADR 取代 `0005-git-commit-comparison.md`。新 ADR 应保留直接快照语义与 typed gateway 边界，并将 TreeView、隐式 reference、空树单文件 Diff 和“没有稳定多文件命令”的旧决定标记为已被 `vscode.changes` 方案取代。
