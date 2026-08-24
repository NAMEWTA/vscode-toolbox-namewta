---
schema_version: 3
artifact: spec
change: 2026-08-24-git-visual-clarity-overhaul
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-24-git-visual-clarity-overhaul
  - USER-SCREENSHOTS:2026-08-24-git-compare-and-blame
  - CODE:<Path>src/extension/presentation/git-compare-document-uri.ts</Path>
  - CODE:<Path>src/webview/git-blame-reader/</Path>
  - CODE:<Path>src/extension/presentation/git-blame-decoration-renderer.ts</Path>
  - RESEARCH:lkqm-vscode-gitblame-annotations-cc2c600a75f98a6af39c33a6082cac8c1657c0b3
---

# Spec: Git 可视化清晰度彻底重构

## 1. 问题与目标

原生 Git Compare 的多文件标题全部显示为 `revision /`；Reader 在每行重复 SHA、相邻提交颜色接近、Code 与 Blame 背景不对应；提交详情使用 VS Code 通知；编辑器注解只有整行色块，缺少上游 Git Blame Annotations 已验证的固定元数据列。目标是让文件、提交块和逐行责任信息在浅色、深色与高对比主题中都能直接扫描和操作。

## 2. 解决方案与外部行为

1. 原生多文件比较的每个资源标题显示实际仓库相对路径。
2. Reader 每个连续提交块只显示一次 SHA/摘要，Blame 与 Code 使用一致提交 tint，并以边框分块。
3. info 图标打开 Reader 内 React 模态；复制、打开远程 commit、打开上一版本由明确按钮触发。
4. 编辑器注解在行首显示固定宽度日期和作者，可配置连续提交合并；窄色条表达时间 heat，hover 仅在注解起点出现，当前提交高亮保持可选。
5. 旧 renderer 与旧 Webview 提交详情协议直接删除，不建立兼容层。

## 3. 用户故事

- **US-001：** 作为多文件变更审阅者，我希望每个比较资源直接显示真实文件路径。
- **US-002：** 作为 Reader 用户，我希望每个提交块只出现一次身份信息，并能跨两列追踪同一色块。
- **US-003：** 作为提交详情查看者，我希望在当前 Reader 内完成查看和操作。
- **US-004：** 作为编辑器用户，我希望行首注解像固定列一样可快速扫描，并可控制日期、作者和连续行合并格式。

## 4. 验收合同

| ID     | 前置条件                                 | 动作                       | 可观察结果                                                             | 验证接缝                               |
| ------ | ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| AC-001 | 比较含多个文件或重命名                   | 打开 `vscode.changes`      | 每项标题为对应仓库相对路径，不出现固定 `revision /`                    | URI/Presentation 单元与 Extension Host |
| AC-002 | Reader 同一 commit 连续覆盖多行          | 查看 Blame 列              | SHA 与摘要只在块首显示一次，逐行元数据不重复 SHA                       | React 单元与真实 UI                    |
| AC-003 | Reader 含相邻不同 commit                 | 查看双列                   | 两列同 commit 背景一致，相邻块可由颜色和边界共同区分                   | React/CSS 合同与 UI 矩阵               |
| AC-004 | 点击块首 info                            | 查看并操作详情             | React 模态显示完整 metadata；Escape/关闭/焦点可用；不出现 VS Code 通知 | React、Host contract 与真实 UI         |
| AC-005 | 在编辑器显示 blame                       | 浏览连续提交               | 行首固定元数据列、连续提交合并和窄 heat 色条清晰；未提交行保持列宽     | Core 格式与 renderer 单元              |
| AC-006 | 悬停行首注解或执行动作                   | 查看 commit 信息           | hover 只在 character 0；打开 diff/远程动作只使用公开命令和已验证 URL   | Presentation 单元与集成                |
| AC-007 | 修改注解配置、文档进入脏状态或编辑器关闭 | 观察刷新与清理             | 配置即时刷新；代际/取消正确；所有 decoration/listener 被释放           | Controller 单元与 Extension Host       |
| AC-008 | 所有实现完成                             | 执行完整门禁与主题缩放矩阵 | TypeScript、lint、依赖、单测、集成、构建、VSIX 和真实 UI 全部有证据    | `pnpm check:ci` 与 UI runner           |

## 5. 范围

### IN

- Git Compare revision URI 文件标签和防篡改解析。
- Reader 分块、配色、两列背景、React 模态及 Host 特权动作。
- 编辑器注解纯格式模块、renderer、配置、hover、生命周期测试。
- 国际化、README、CHANGELOG、第三方声明、Speculo Evidence 和 VSIX。

### REUSE

- typed `ToolboxGateway`、Git CLI 参数数组 adapter、Reader model、blame generation/cancellation、公开 `vscode.diff`/外部 URI 与现有 UI runner 基础。

### OUT

- Git 写操作、工作树修改、私有 VS Code 命令、Webview 语法高亮、遥测、旧注解协议兼容层、复制上游进程/激活架构。

## 6. 已锁定实现约束

- Core 不导入 VS Code、React、Node 或 DOM；Webview 不导入 Extension/Node/VS Code。
- 外部 URI 和 Webview 消息在 Extension 边界验证；revision URI 不暴露绝对路径或 ref。
- 配色不能成为唯一信息通道；块首/块尾边框和文字结构必须保留。
- 用户已批准 Deep 实施点；本 change 不授权 commit、push 或 release。
- `ADR-002` supersedes 旧 Reader change 中与本次行为冲突的局部决定。

## 7. 数据、接口与兼容

- **公共接口变化：** Reader Webview action 使用新的 discriminated commit action；annotation 配置一次性切换到新字段；版本化 `activate()` 公共 API 不变。
- **持久化：** 只使用 VS Code 配置，不新增业务数据或迁移脚本。
- **兼容：** 不保留旧 Webview action、旧 renderer 或旧注解配置别名。

## 8. 非功能要求

- **安全：** URI、路径、消息、URL 和 Git 输出在进入特权动作前验证。
- **性能：** 注解按 commit 分组复用 decoration type；Reader 继续保留既有完整 DOM 与离屏渲染策略。
- **可访问性：** 颜色不是唯一信息通道；模态支持焦点、Escape、可读名称和高对比主题。

## 9. 验证策略

- 每项行为先运行对应 Vitest 红灯，再做最小实现并转绿。
- Git Compare 与编辑器注解补真实 Extension Host 覆盖。
- Reader 使用 Light/Dark/High Contrast × 100%/125%/150% UI 矩阵，检查文本、色块、模态、焦点和无重叠。
- 完成前运行 SpecDev validator、`pnpm check:ci`、`pnpm package:list`、`pnpm package:vsix`。

## 10. 风险、假设与未决问题

- `vscode.changes` 标题来自宿主实现，除 URI 单元断言外必须用 Extension Host 截图确认。
- 高对比主题可能抑制 tint，边框和块首文本是强制降级通道。
- 重构不修改 Git 数据与用户持久化，出现回归时可整体恢复 renderer/message contract；不需要迁移回滚。
