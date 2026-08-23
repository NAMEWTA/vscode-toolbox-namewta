# 领域上下文：Git 双节点比较

- **基准端（base）：** 变化计算的左侧 commit 快照。
- **目标端（target）：** 变化计算的右侧 commit 快照，默认当前 `HEAD`。
- **节点：** 本功能中只表示可解析为 commit 的 Git object，不包括工作树和 index。
- **直接比较：** 使用固定的 `base target` 两端生成差异，不计算 merge-base。
- **完整 OID：** Git 当前对象格式下的完整 40 或 64 位十六进制 commit id。
- **原生更改视图：** 由公开命令 `vscode.changes` 打开的 VS Code 多文件比较界面。
