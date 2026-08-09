# 当前 Change 架构决策

## ADR-001: 使用 VS Code 原生 diff 承载 Review Session

**Status:** accepted
**Source:** LOG-003
**Supersedes:** none

### Context

Review Session 需要连续导航全部变更并表达审核进度。自建完整 diff Webview 会复制编辑器差异渲染、语言能力、大文件处理与可访问性，而仅批量打开标签页又无法维护可靠队列状态。

### Decision

使用 VS Code 公开能力打开原生 diff 编辑器，插件自身维护 Review Queue、当前项、显式已审核状态和 session 生命周期。首版不创建完整 diff Webview，也不调用 VS Code 私有命令。

### Trade-off

该方案接受原生 diff 界面不能完全仿制 GitHub `Files changed` 单页布局的限制，换取与编辑器生态一致的语言能力、性能、键盘操作和维护边界。

### Consequences

Core 只表达 Review Session 状态与操作，不依赖 VS Code；Extension Host 负责 Git 与原生 diff 适配。Webview 不承担本功能的 diff 呈现。

### Verification / Migration

集成测试必须证明全部支持的变更类型可通过公开 API 打开或获得明确替代摘要，且流程不调用 `_workbench.*` 等私有命令。

## ADR-002: 以 Source Control Tree View 作为 Review Session 主视图

**Status:** accepted
**Source:** LOG-012
**Supersedes:** none

### Context

Review Session 需要持续展示完整队列、当前位置、每项审核状态和总体进度。QuickPick 只适合短暂选择，单独状态栏无法呈现完整队列，独立 Activity Bar 容器对单一工具过重；当前目标版本也不能依赖 proposed multi-diff API。

### Decision

在 Source Control 容器中贡献专用 Review Queue Tree View，作为 session 的主视图并支持直接跳转审核项；使用状态栏投影紧凑进度，使用户聚焦原生 diff 时仍能看到当前审核状态。首版不要求 QuickPick，也不创建独立 Activity Bar 容器。

### Trade-off

该方案会占用 Source Control 侧栏空间，并需要维护 Tree View 与状态栏的一致投影；作为交换，用户无需反复打开临时选择器，也不会产生新的顶层导航容器。

### Consequences

Review Session 状态必须由单一 Core 模型拥有，Tree View、状态栏和命令只能读取或驱动同一状态。Extension Host 负责将该状态适配为 VS Code UI，并在 session 结束、替换或扩展停用时统一释放资源。

### Verification / Migration

测试必须覆盖 Tree View 的队列顺序与状态、直接跳转、状态栏进度同步，以及 session 清理后两个投影均复位。
