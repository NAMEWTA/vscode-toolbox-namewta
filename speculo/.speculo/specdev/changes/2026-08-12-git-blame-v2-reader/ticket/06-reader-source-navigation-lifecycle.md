---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-06
title: 实现 Reader 与源编辑器导航及生命周期
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 跨 Panel session、编辑器 selection/reveal、文档版本和请求取消，需保证双向定位及资源生命周期不产生过期写入或泄漏。
ready: true
risk: high
blocked_by: [T-01, T-03, T-04, T-05]
contract_ids: [AC-011, AC-012, AC-013, AC-019, AC-020]
owner: unassigned
expected_changes:
  - '<Path>src/extension/presentation/git-blame-reader-controller.ts</Path>'
  - '<Path>src/extension/presentation/git-blame-reader-panel.ts</Path>'
  - '<Path>src/extension/commands/</Path>'
  - '<Path>src/webview/git-blame-reader/</Path>'
writable_paths:
  - '<Path>src/extension/presentation/git-blame-reader-controller.ts</Path>'
  - '<Path>src/extension/presentation/git-blame-reader-panel.ts</Path>'
  - '<Path>src/extension/commands/git-blame-reader-command.ts</Path>'
  - '<Path>src/webview/git-blame-reader/reader-navigation.tsx</Path>'
  - '<Path>src/webview/git-blame-reader/reader-detail.tsx</Path>'
  - '<Path>src/webview/git-blame-reader/reader-lifecycle.css</Path>'
read_only_paths:
  - '<Path>src/core/contracts/</Path>'
  - '<Path>src/core/domains/git-blame/</Path>'
shared_paths:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
shared_path_owners:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path> => T-08'
---

# Ticket T-06: 实现 Reader 与源编辑器导航及生命周期

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/06-reader-source-navigation-lifecycle.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-06.md</Path>`

## 1. 战略与来源

- **目标：** 形成 Source → Reader → Source 的可恢复闭环，并明确何时刷新 Git blame。
- **可观察产出：** Reader 打开后定位原始行；点击/Enter/Open Source 返回同一源行；源文件修改显示 stale，保存或 Refresh 才重新查询。
- **来源：** `US-005`、`AC-011`、`AC-012`、`AC-013`、`AC-019`、`AC-020`、ADR-005。
- **当前事实：** 现有 Git Review Panel 已有 panel dispose、消息取消和 snapshot 模式；现有 VisibilityHost 已监听 save/change/selection。
- **Planning Depth 原因：** 生命周期和行号转换错误会造成导航错误、泄漏或隐式 Git 负载。

## 2. 决策状态

### 已锁定决策

- 保存 source URI、selection、visible range、documentVersion、sourceLine。
- 所有 reader message 携带或绑定 generation；旧 session 消息拒绝。
- cursor/scroll/selection/copy/theme 不触发 blame。

### 已采用的低影响假设

- 双击/Enter 视为打开源文件；单击只改变 Reader selection。

### 未决问题

无。

## 3. 范围边界

| IN                                                                         | REUSE                                                                  | OUT                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| 双向行导航、当前行同步、stale/refresh、commit detail action、dispose/abort | `showTextDocument`、`Selection`、`revealRange`、现有历史/commit opener | Custom Editor、自动高频刷新、完整 commit diff 页面 |

## 4. 要构建什么

从当前编辑器行 327 打开 Reader 时，Reader 将 line 327 滚动到可见区域并高亮。Reader 行交互按 logical line 映射回源编辑器的一基/零基坐标。文档内容变更不会偷偷重跑 Git；Panel 顶部显示 stale 和 Refresh。打开 commit detail 时展示完整 metadata，并可触发既有 commit/previous revision 行为。

## 5. 实现契约

- **入口或接缝：** Reader controller/panel、VS Code workspace/text editor events、message handler。
- **输入与输出：** source snapshot、line、selection、generation；输出 selection/reveal、stale/ready/detail/feedback events。
- **公共接口变化：** 新增 Reader command 和导航消息；现有 source editor 行为保持。
- **不变量：** Reader line N 映射原生 editor line N-1；过期 generation 不得导航/复制/刷新旧模型。
- **状态或数据流：** source event → session state → Webview event；显式 refresh/save → 新 generation → model reload。
- **错误与失败行为：** 源文档关闭、URI 无法解析、line 越界或 panel 已 dispose 时稳定失败，不保留悬挂请求。
- **兼容要求：** 既有历史内容和 line history opener 继续可用。
- **安全与隐私要求：** 仅打开已验证 source URI；不从 Webview 接受任意路径。

## 6. 执行路线

1. 为 line mapping、stale transition、generation rejection 和 dispose 写失败测试。
2. 实现 controller session 保存和 source event 监听。
3. 实现 Reader selection/openSource/commit detail 消息与 VS Code selection/reveal。
4. 接入 save/explicit Refresh，验证不会由 cursor/scroll/copy 触发 Git。
5. 运行 extension integration 和手动双向导航矩阵。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** frontmatter `writable_paths`；组合根由 T-08 owner 注册。
- **只读上下文：** T-01 contract、T-03 model、T-04 Panel。
- **共享路径：** `create-extension-runtime.ts` 由 T-08 独占。
- **保留或不动：** 现有 Git Review Panel 生命周期实现。

## 8. 验证矩阵

| 行为或风险               | 验证接缝                       | 命令或步骤                                                                         | 预期结果                          | Evidence                                                               |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| Source→Reader line sync  | controller test/E2E            | `pnpm test:unit -- src/extension/presentation/git-blame-reader-controller.test.ts` | 初始行滚动、高亮、metadata 同步   | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-06.md</Path>` |
| Reader→Source            | VS Code navigation integration | `pnpm test:integration`                                                            | 选择/Enter/Open Source 映射同一行 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-06.md</Path>` |
| stale/refresh discipline | lifecycle test                 | 定向测试 + 保存/修改手动步骤                                                       | 只有 save/Refresh 触发 blame      | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-06.md</Path>` |
| resource cleanup         | controller dispose test        | 定向测试                                                                           | listener/abort/panel 全部释放     | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-06.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** T-04 MVP 后接入导航；T-08 在组合根完成注册和最终回归。
- **兼容窗口：** Source editor 保持原生打开方式；Reader 是可关闭的附加视图。
- **监控信号：** stale、refresh、navigation failure、cancel 和 dispose 摘要。
- **回滚或前向恢复：** 导航失败不关闭 Reader；重新打开 source 或 Refresh 可恢复；资源泄漏则暂停后续 Wave。
- **不可逆操作与批准点：** 无。
- **收缩条件：** 旧 session/Panel listener 为零且测试覆盖 dispose 后消息拒绝。

## 10. 验收标准

- [x] `AC-011`、`AC-012`、`AC-013`、`AC-019`、`AC-020` 通过。
- [x] 不存在 cursor/scroll/copy/theme 触发 blame 的自动化与代码事实证据。
- [x] stale 和 generation 语义写入 Evidence。
