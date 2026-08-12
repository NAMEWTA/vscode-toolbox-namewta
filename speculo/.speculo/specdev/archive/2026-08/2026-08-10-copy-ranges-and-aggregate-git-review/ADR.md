# 当前 Change 架构决策

## ADR-001: 使用自有 WebviewPanel 承载稳定 API 下的聚合 Diff

**Status:** accepted
**Source:** USER-DECISION:2026-08-10-aggregate-review
**Supersedes:** 2026-08-09-review-all-git-changes/ADR-001、ADR-002 中关于单文件原生 diff 和不创建 diff Webview 的决定

### Context

目标 VS Code `^1.100.0` 没有公开稳定的 multi-diff 接口，内置 Git 使用的能力属于 proposed API。用户明确要求单个编辑器标签页内连续展示全部变更。

### Decision

使用命令后创建的 React WebviewPanel 展示经过验证的结构化 Unified patch。继续保留原生 `vscode.diff` 作为单文件深入查看能力，不调用私有命令或 proposed API。

### Consequences

Extension Host 负责 Git patch 生成与解析，Core 只持有可序列化模型，Webview 负责虚拟化渲染。必须新增消息验证、内容上限、取消和完整资源清理。

## ADR-002: Git Review 按 index 层分组并允许受控文件级写入

**Status:** accepted
**Source:** USER-DECISION:2026-08-10-git-actions
**Supersedes:** 2026-08-09-review-all-git-changes 中只读 Git 与相对 HEAD 合并审核项的决定

### Context

单一 `HEAD -> worktree` 结果无法准确表达 Stage、Unstage，也会掩盖同一文件同时存在的 staged 与 unstaged 修改。

### Decision

审核项分为 staged、unstaged 和 conflict；Git 写操作必须经过类型化 Gateway、Workspace Trust、预期内容身份核验与串行执行。Discard 始终要求模态确认，且只作用于已验证的精确路径。

### Consequences

同一路径可以拥有多个 item，导航必须使用稳定 itemId。Git 状态变化后重新加载 inventory；过期身份、取消或确认拒绝不得产生写入。
