# Git Blame V2 设计日志

## LOG-001 — 2026-08-12

用户提供并确认 Git Blame V2 完整设计方案，核心原则为“编辑器负责编辑，Blame Reader 负责阅读”。

## LOG-002 — 2026-08-12

按 `S-spec → T-tickets → P-goal-plan` 顺序建立规划链。本 change 采用普通 Goal Plan，不启用 Agent 委派分支；实现仍须按 `I-implement` 的 Ready、TDD、双轴审查和 Evidence 合同执行。

## LOG-003 — 2026-08-12

代码事实确认：Git Blame 现有 Core model/Handler、Git porcelain parser、原生 decoration controller/renderer、Hover action 和 WebviewPanel/message adapter 均可复用；旧 renderer 的 `before.contentText` fake gutter 是 V2 必须删除的结构性实现。

## LOG-004 — 2026-08-12

完成 T-01 至 T-08 实现：建立 Reader typed contract、Host 权威 model/copy handler、独立 Webview Editor Tab、结构化复制、双向导航、stale/Refresh/save 生命周期、5,001 行虚拟化、搜索和 Accessibility Tree 语义；Normal Editing Mode 收缩为 Status Bar、Hover 与 whole-line 高亮。

## LOG-005 — 2026-08-12

真实 VS Code 验证发现并修复 macOS `/tmp` 实路径解析、窄宽响应式布局、未保存文档 Refresh 快照不一致和 commit detail 缺少邮箱/日期问题。最终 UI runner 在 Light/Dark/High Contrast × 100/125/150% 下完成 9 组合，并通过真实系统剪贴板 8 种格式、全选、跨 block 鼠标拖选、可信键盘、导航、生命周期、不可用路径和 5,001 行大文件虚拟化。

## LOG-006 — 2026-08-12

最终复核发现 Refresh 失败状态绑定未展示的新 generation，会被 Webview 过滤并保留旧提示。change 重新打开后增加 Controller 回归与真实仓库能力消失故障注入，修复为在当前可见 generation 上显示 loading/unavailable。最终 `pnpm check:ci` 通过：73 个测试文件、239 个单元测试、20 个 Extension Host 集成测试、覆盖率、构建、包清单和 VSIX 全部绿色；fake gutter、私有命令和架构边界反向扫描为零。全部 AC-001 至 AC-020、Ticket 和 Goal Gate 已有 Evidence，change 转换为 completed。

## LOG-007 — 2026-08-12

用户明确授权 commit、push 和 release。由于 `v0.1.5` 已存在并指向 change 基线，按语义化版本前向发布 `0.1.6`，不移动或覆盖既有标签与 Release。

## LOG-008 — 2026-08-12

产品提交 `6bf1b1c8d8368809e0d59b022716605fa7c591a1` 已推送 `origin/main`，annotated tag `v0.1.6` 指向该提交。GitHub Actions Run 31595900875 完整通过并创建正式 Release，上传的 VSIX 为 276118 bytes。Linux CI 与 macOS 本地 VSIX 的外层 ZIP SHA-256 因跨平台容器元数据不同，但解压后的 20 个文件逐字节一致。
