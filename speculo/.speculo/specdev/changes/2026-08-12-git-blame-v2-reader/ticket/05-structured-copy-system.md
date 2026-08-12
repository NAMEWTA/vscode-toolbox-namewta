---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-05
title: 实现 Reader 结构化复制系统
status: done
planning_depth: standard
planning_depth_reason: 该 Ticket 贯穿 Webview 操作、Host message handler、Gateway 和 Clipboard Adapter，但公共消息合同由 T-01 锁定。
ready: true
risk: high
blocked_by: [T-01, T-03, T-04]
contract_ids: [AC-007, AC-008, AC-009, AC-010, AC-014]
owner: unassigned
expected_changes:
  - '<Path>src/extension/presentation/git-blame-reader-copy-service.ts</Path>'
  - '<Path>src/extension/presentation/git-blame-reader-message-handler.ts</Path>'
  - '<Path>src/webview/git-blame-reader/reader-copy-actions.tsx</Path>'
  - '<Path>src/extension/adapters/vscode-clipboard-adapter.ts</Path>'
writable_paths:
  - '<Path>src/extension/presentation/git-blame-reader-copy-service.ts</Path>'
  - '<Path>src/extension/presentation/git-blame-reader-message-handler.ts</Path>'
  - '<Path>src/webview/git-blame-reader/reader-copy-actions.tsx</Path>'
  - '<Path>src/extension/adapters/vscode-clipboard-adapter.ts</Path>'
read_only_paths:
  - '<Path>src/core/contracts/</Path>'
  - '<Path>src/core/domains/git-blame/</Path>'
shared_paths: []
shared_path_owners: []
---

# Ticket T-05: 实现 Reader 结构化复制系统

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/05-structured-copy-system.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-05.md</Path>`

## 1. 战略与来源

- **目标：** 让 Reader 的只读语义不阻断文本选择、系统复制和 Git 历史导出。
- **可观察产出：** 用户能明确复制代码、单行 Blame、SHA、commit info、block 和整文件；复制结果稳定且可复现。
- **来源：** `US-004`、`AC-007` 至 `AC-010`、`AC-014`、ADR-004/005。
- **当前事实：** 仓库已有 `VscodeClipboardAdapter` 和 `GitCopyCommitHashHandler`；Webview 已有消息适配器，可复用 Gateway/取消模式。
- **Planning Depth 原因：** 结构化导出涉及用户数据准确性、消息安全和跨层副作用。

## 2. 决策状态

### 已锁定决策

- 普通浏览器选择复制由 Webview 原生完成；按钮复制由 Host 写系统剪贴板。
- Host 只接受 line/block/session 引用，不接受 Webview 传入的最终文本。
- 复制成功显示轻量非 Modal 反馈。

### 已采用的低影响假设

- 默认 Blame 行格式为 `date author shortHash line | code`。

### 未决问题

无。

## 3. 范围边界

| IN                                                            | REUSE                                                  | OUT                                |
| ------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| Copy actions、格式化、Host clipboard flow、成功反馈、复制测试 | `ToolboxGateway`、Clipboard Port、model copy formatter | 可配置模板、远程剪贴板、Git 写操作 |

## 4. 要构建什么

用户点击明确的 Copy Code/Copy Line With Blame/Copy Commit SHA/Copy Commit Info/Copy Block Code/Copy Block With Blame/Copy All Code/Copy All With Blame 动作时，Webview 发送 typed reference，Host 校验当前 session 并从 model 生成文本，经 Gateway/Clipboard Adapter 写入系统剪贴板。过期或越界引用不复制任何内容。

## 5. 实现契约

- **入口或接缝：** Reader Webview message handler、Core copy formatter、`VscodeClipboardAdapter`。
- **输入与输出：** 输入 session generation、line/block reference、format；输出 clipboard write result 和轻量 feedback event。
- **公共接口变化：** 消费 T-01 已锁定 Reader copy message/tool contract。
- **不变量：** Copy All 不依赖 DOM；代码文本不 trim、不 HTML 解码、不丢空格/tab/Unicode；SHA/Info 与选定 block 一致。
- **状态或数据流：** Webview reference → validator → Host model formatter → `ToolboxGateway` → Clipboard Port → feedback。
- **错误与失败行为：** 无效引用、disposed session、取消或 clipboard 失败返回稳定错误，不显示成功反馈。
- **兼容要求：** 现有 `gitBlame.copyCommitHash` 继续工作。
- **安全与隐私要求：** 不记录复制全文；不得执行 Webview 任意文本写入。

## 6. 执行路线

1. 为所有 copy format 写字面量 fixture 的失败测试。
2. 实现 Host copy service 和引用校验，接入 Clipboard Port。
3. 将 Reader 操作按钮接入 typed message，加入成功/失败反馈。
4. 验证跨 block 选择、虚拟化模型和整文件输出，运行定向回归。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** frontmatter `writable_paths`。
- **只读上下文：** T-01 contracts、T-03 model、T-04 Panel。
- **共享路径：** 无。
- **保留或不动：** 现有 Clipboard Adapter 公共接口。

## 8. 验证矩阵

| 行为或风险    | 验证接缝                      | 命令或步骤                                                                                                      | 预期结果             | Evidence                                                               |
| ------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| 8 类复制格式  | Core formatter/Host service   | `pnpm test:unit -- src/core/domains/git-blame src/extension/presentation/git-blame-reader-copy-service.test.ts` | 每类输出字面量匹配   | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-05.md</Path>` |
| 无效/过期引用 | message handler               | 定向测试                                                                                                        | 不写剪贴板且返回错误 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-05.md</Path>` |
| 系统剪贴板    | Clipboard adapter/integration | `pnpm test:integration` 与手动 Ctrl/Cmd+C                                                                       | 写入准确文本         | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-05.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 先消费 T-01/T-03/T-04；旧单 SHA copy 保持兼容；T-08 做最终命令清单检查。
- **兼容窗口：** 新 Copy actions 是新增能力，旧 Hover copy SHA 不移除。
- **监控信号：** copy failure/cancel 摘要和不含文本的 action id。
- **回滚或前向恢复：** Clipboard 失败只影响当前 action，Reader 继续可读；修复后可重试，不重跑 blame。
- **不可逆操作与批准点：** 无。
- **收缩条件：** 无旧结构化复制协议需删除。

## 10. 验收标准

- [x] `AC-007`、`AC-008`、`AC-009`、`AC-010`、`AC-014` 自动化验证通过。
- [x] 真实系统选择复制与按钮复制均有 Evidence，未将未运行项记为通过。
