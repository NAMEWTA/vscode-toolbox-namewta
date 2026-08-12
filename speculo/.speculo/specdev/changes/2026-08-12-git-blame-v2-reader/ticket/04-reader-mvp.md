---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-04
title: 交付 Full-file Blame Reader MVP
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 跨 Extension Host/Webview 建立新的用户可见 Editor Tab、CSP、模型投影和 logical-line soft-wrap 交互，事故半径包含安全与资源生命周期。
ready: true
risk: high
blocked_by: [T-01, T-03]
contract_ids: [AC-004, AC-005, AC-007, AC-015]
owner: unassigned
expected_changes:
  - '<Path>src/extension/presentation/git-blame-reader-*.ts</Path>'
  - '<Path>src/webview/git-blame-reader/</Path>'
  - '<Path>src/webview/git-blame-reader-main.tsx</Path>'
  - '<Path>build/build-webview.mjs</Path>'
writable_paths:
  - '<Path>src/extension/presentation/git-blame-reader-*.ts</Path>'
  - '<Path>src/webview/git-blame-reader/</Path>'
  - '<Path>src/webview/git-blame-reader-main.tsx</Path>'
  - '<Path>build/build-webview.mjs</Path>'
read_only_paths:
  - '<Path>src/core/contracts/</Path>'
  - '<Path>src/core/domains/git-blame/</Path>'
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
shared_paths:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/core/contracts/</Path>'
shared_path_owners:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path> => T-08'
  - '<Path>src/core/contracts/</Path> => T-01'
---

# Ticket T-04: 交付 Full-file Blame Reader MVP

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/04-reader-mvp.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-04.md</Path>`

## 1. 战略与来源

- **目标：** 提供真正的文件级 Git 历史阅读视图，替代原生 fake gutter 的完整阅读职责。
- **可观察产出：** 用户可从源文件打开独立 Reader，看到完整源码、行号、commit metadata、commit blocks 和正确 soft wrap。
- **来源：** `US-003`、`US-006`、`AC-004`、`AC-005`、`AC-007`、`AC-015`、ADR-001/002/003/005、永久 ADR-001。
- **当前事实：** 现有 `<Path>src/extension/presentation/git-review-panel-controller.ts</Path>` 已提供 WebviewPanel/CSP/message/dispose 先例，Webview 使用 React 和独立构建入口。
- **Planning Depth 原因：** 新增跨宿主 UI 和消息接缝，需 CSP、资源清理、取消和手动 E2E。

## 2. 决策状态

### 已锁定决策

- 使用 `createWebviewPanel`，不实现 Custom Editor。
- Webview 只渲染 Host model，不运行 Git。
- 每个 logical line 一个 source-line DOM，不为 visual wrap row 建 DOM。

### 已采用的低影响假设

- V2.0 Reader 标题显示文件名和相对路径，具体排版沿用 Git Review Webview。

### 未决问题

无。

## 3. 范围边界

| IN                                                                                                  | REUSE                                                                 | OUT                                                       |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| Reader Panel、CSP、Bootstrap、block/meta/source DOM、HEAD、Refresh/Ignore Whitespace/Search UI 占位 | Git Review Panel HTML、Webview bootstrap、message adapter、React 构建 | 结构化复制执行、双向导航、虚拟化细节和 commit detail 行为 |

## 4. 要构建什么

用户从源编辑器打开 Reader 后，Panel 接收 Host 生成的 model 并呈现 commit block。meta 是一个 block 级区域，source lines 按一基行号显示，源码作为安全转义普通文本。用户可以选择文字；基础键盘焦点和当前行高亮必须可用。Panel hidden 时保留上下文，dispose 时清理消息和请求。

## 5. 实现契约

- **入口或接缝：** Reader controller/panel 与 React Webview entry；Host 通过 `ToolboxGateway` 获取 blame/model。
- **输入与输出：** 输入 source URI、selection、visible range、revision 和 configuration；输出可序列化 Reader bootstrap/model 与 typed UI events。
- **公共接口变化：** 注册 Full-file Reader command/入口消息；不改变 Git Review message。
- **不变量：** CSP 只允许本扩展资源；源码内容经 HTML/React text-node 处理；logical line 不因 CSS wrap 改变身份。
- **状态或数据流：** source command → controller session → Gateway/model → bootstrap/postMessage → Webview render。
- **错误与失败行为：** invalid/unavailable model 显示稳定状态；Panel 不显示半截或错位 blame。
- **兼容要求：** 现有 Toolbox/Git Review Webview 继续可构建；只读 Reader 不修改源文件。
- **安全与隐私要求：** localResourceRoots、CSP nonce、message validator、Workspace Trust 和请求取消全部启用。

## 6. 执行路线

1. 为 bootstrap、CSP、空/错误/合法 model 渲染写失败测试。
2. 创建 Panel controller，复用现有 Webview resource/message/dispose 先例。
3. 创建 React Reader 视图和 CSS grid，验证 logical line soft wrap 与文本选择。
4. 接入 Reader model loader，支持 HEAD、maxLines、unavailable 和 refresh 初始行为。
5. 运行 Webview/Extension 定向测试和人工布局检查，形成 T-05/T-06 基线。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** frontmatter `writable_paths`；组合根、contracts 由 T-08/T-01 owner 修改。
- **只读上下文：** Core model、现有 Git Review Panel。
- **共享路径：** 仅声明 owner，不在本 Ticket 修改。
- **保留或不动：** 现有 Git Review Webview 入口和 CSS。

## 8. 验证矩阵

| 行为或风险                       | 验证接缝                    | 命令或步骤                                                      | 预期结果                               | Evidence                                                               |
| -------------------------------- | --------------------------- | --------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Panel/CSP/bootstrap              | Extension presentation test | `pnpm test:unit -- src/extension/presentation/git-blame-reader` | 资源、nonce、状态和 dispose 正确       | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-04.md</Path>` |
| logical line/wrap/text selection | Webview React test          | `pnpm test:unit -- src/webview/git-blame-reader`                | 每条 logical line 一个 row，源码可选择 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-04.md</Path>` |
| Reader happy/error path          | VS Code integration         | `pnpm test:integration`                                         | HEAD 文件可打开；不可用状态不伪造      | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-04.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** T-01 contract → T-03 model → T-04 Reader MVP；旧 editor gutter 由 T-02 并行止血，入口注册由 T-08 汇合。
- **兼容窗口：** Panel 是新增视图；现有编辑器 Blame 命令在 T-02 后只保留轻量能力。
- **监控信号：** Panel open/load/error/cancel/dispose 摘要，不记录源码。
- **回滚或前向恢复：** Reader 失败时保留 Normal Mode；Panel 可独立 dispose，下一次打开从最新 model 重建。
- **不可逆操作与批准点：** 无。
- **收缩条件：** Reader MVP 通过 AC-004/005/007 后才允许 T-05/T-06 接入更多操作。

## 10. 验收标准

- [x] `AC-004`、`AC-005`、`AC-007`、`AC-015` 通过。
- [x] Reader 可选择文本且不会把源文本解释为 HTML。
- [x] Panel 取消、隐藏和销毁无资源泄漏。
