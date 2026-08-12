---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-02
title: 移除原生编辑器 Fake Gutter 并交付当前行信息
status: done
planning_depth: standard
planning_depth_reason: 跨 Presentation、命令和国际化路径替换既有用户可见布局行为，但复用现有 Git Blame 数据与 Hover 操作。
ready: true
risk: high
blocked_by: [T-01]
contract_ids: [AC-001, AC-002, AC-003]
owner: unassigned
expected_changes:
  - '<Path>src/extension/presentation/git-blame-decoration-renderer.ts</Path>'
  - '<Path>src/extension/presentation/git-blame-annotation-controller.ts</Path>'
  - '<Path>src/extension/commands/git-blame-visibility-command.ts</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/extension/adapters/vscode-git-blame-configuration-adapter.ts</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
writable_paths:
  - '<Path>src/extension/presentation/git-blame-*.ts</Path>'
  - '<Path>src/extension/commands/git-blame-visibility-command.ts</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/extension/adapters/vscode-git-blame-configuration-adapter.ts</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
read_only_paths:
  - '<Path>src/core/domains/git-blame/</Path>'
  - '<Path>src/webview/</Path>'
shared_paths:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
shared_path_owners:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path> => T-08'
  - '<Path>package.json</Path> => T-08'
  - '<Path>package.nls.json</Path> => T-08'
  - '<Path>package.nls.zh-cn.json</Path> => T-08'
---

# Ticket T-02: 移除原生编辑器 Fake Gutter 并交付当前行信息

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/02-normal-editor-stop-gutter.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-02.md</Path>`

## 1. 战略与来源

- **目标：** 让原生编辑器恢复纯编辑布局，同时提供当前行 Status Bar、Hover 和 commit block 高亮。
- **可观察产出：** Blame 开关不会插入任何文字；光标所在行的日期、作者、短 SHA 和摘要可见。
- **来源：** `US-001`、`US-002`、`US-003`、`AC-001`、`AC-002`、`AC-003`、当前 change ADR-001。
- **当前事实：** `<Path>src/extension/presentation/git-blame-decoration-renderer.ts</Path>` 使用 `before.contentText`、`after.contentText`、动态宽度和 annotation formatter。
- **Planning Depth 原因：** 这是用户可见布局替换，需做反向扫描和 VS Code E2E。

## 2. 决策状态

### 已锁定决策

- 原生 renderer 只允许非侵入式 `isWholeLine` 背景高亮。
- Status Bar 和 Hover 不在 cursor movement 时重新执行 blame。
- 旧 fake gutter 不保留 legacy 模式。

### 已采用的低影响假设

- Status Bar 使用现有 VS Code Git commit 图标和国际化文案。

### 未决问题

无。

## 3. 范围边界

| IN                                                                            | REUSE                                                  | OUT                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| 删除原生文字 decoration；当前行 Status Bar；Hover 首屏重排；commit block 高亮 | 现有 annotation controller、GitBlameLine、Hover action | Full-file Reader Panel 与结构化 Copy |

## 4. 要构建什么

用户打开文件并启用 Blame 后，代码正文的视觉起点、selection 和 wrap 不发生变化。光标移动只从已加载的行数据更新 Status Bar/高亮；Hover 第一屏显示作者、日期、短 SHA、摘要，并保留现有行历史、提交变更、上一版本和复制 SHA 操作。无 blame 行时清理状态而不是显示占位伪数据。

## 5. 实现契约

- **入口或接缝：** `GitBlameAnnotationController`、`GitBlameDecorationRenderer`、VS Code selection/status bar/hover registration。
- **输入与输出：** 已加载 `GitBlameLine` 和当前一基行号输入；输出为 Status Bar 文本、Hover Markdown 和 whole-line ranges。
- **公共接口变化：** 新增当前行状态呈现模块；移除 renderer 对文字 annotation 的依赖。
- **不变量：** 不调用 `before.contentText`/`after.contentText`；不计算 annotation width；高亮不改变源码宽度。
- **状态或数据流：** Git 数据加载一次 → controller session → cursor event 仅更新 presentation。
- **错误与失败行为：** unavailable/failed/dirty 状态清空 Status Bar；保留现有错误提示和取消语义。
- **兼容要求：** toggle/show/hide/refresh、Hover action 和 Line History 命令保持可用。
- **安全与隐私要求：** 状态栏/文案不记录 email 或源码全文。

## 6. 执行路线

1. 为 renderer 写反向失败测试，证明旧文字 decoration 存在时目标合同失败。
2. 删除文字注解路径并改为 whole-line highlight，加入当前行 Status Bar 生命周期测试。
3. 调整 Hover 首屏字段与 Open Reader action 占位入口，保持已有 action contract。
4. 更新配置/国际化，并运行 presentation、extension integration 和布局反向扫描。

## 7. 路径访问契约

- **预计修改点：** `src/extension/presentation/git-blame-*.ts`、`src/extension/commands/git-blame-visibility-command.ts`、配置适配器。
- **可写范围：** frontmatter `writable_paths`；组合根、package.json 和 nls 由 T-08 owner 修改。
- **只读上下文：** Core Git Blame、Webview Reader。
- **共享路径：** T-08 独占；本 Ticket 只提交变更建议和测试导航。
- **保留或不动：** 现有 Git blame Core contracts 和 Hover action gateway。

## 8. 验证矩阵

| 行为或风险              | 验证接缝                      | 命令或步骤                                                                                                     | 预期结果                       | Evidence                                                               |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| 无文字布局侵入          | renderer 单测 + `rg` 反向扫描 | `pnpm test:unit -- src/extension/presentation/git-blame-decoration-renderer.test.ts`；扫描 `before.contentText | after.contentText              | annotationWidth`                                                       | 无文字 decoration/动态宽度 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-02.md</Path>` |
| 当前行 Status Bar/Hover | Presentation tests            | `pnpm test:unit -- src/extension/presentation/git-blame-hover-provider.test.ts`                                | 字段顺序和清理行为正确         | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-02.md</Path>` |
| 原生编辑器回归          | VS Code E2E                   | `pnpm test:integration` + 手动布局矩阵                                                                         | x 坐标、wrap、selection 等不变 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-02.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** T-01 contract 稳定后替换 renderer；T-08 统一注册新命令并删除旧配置。
- **兼容窗口：** 现有 toggle/show/hide/refresh 保持；发布前旧 fake gutter 调用点归零。
- **监控信号：** blame unavailable/failed、Status Bar 清理和 decoration dispose 日志。
- **回滚或前向恢复：** 若当前行信息回归，恢复到 T-02 最后绿色 checkpoint；不得恢复布局侵入的实现到最终发布状态。
- **不可逆操作与批准点：** 删除旧配置和 renderer 测试由 T-08 Gate G-06 批准。
- **收缩条件：** 静态扫描确认旧 fake gutter API 和 workaround 无调用点。

## 10. 验收标准

- [x] `AC-001`、`AC-002`、`AC-003` 已验证。
- [x] 原生编辑器布局反向验证和真实 VS Code 矩阵结果写入 Evidence。
- [x] 现有 Git Blame 命令、Hover action 和行历史回归通过。
