---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-01
title: 冻结 Git Blame V2 Reader 合同
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 锁定跨 Core、Extension Host、Webview 的公共模型、消息协议、复制格式、生命周期和验收边界，影响后续所有 Ticket 的共享合同。
ready: true
risk: high
blocked_by: []
contract_ids:
  [
    AC-004,
    AC-005,
    AC-006,
    AC-007,
    AC-008,
    AC-009,
    AC-010,
    AC-014,
    AC-015,
    AC-016,
    AC-019,
  ]
owner: specdev-integrator
expected_changes:
  - '<Path>speculo/.speculo/specdev/changes/2026-08-12-git-blame-v2-reader/ADR.md</Path>'
  - '<Path>speculo/.speculo/specdev/changes/2026-08-12-git-blame-v2-reader/CONTEXT.md</Path>'
  - '<Path>src/core/contracts/</Path>'
writable_paths:
  - '<Path>speculo/.speculo/specdev/changes/2026-08-12-git-blame-v2-reader/ADR.md</Path>'
  - '<Path>speculo/.speculo/specdev/changes/2026-08-12-git-blame-v2-reader/CONTEXT.md</Path>'
  - '<Path>src/core/contracts/</Path>'
read_only_paths:
  - '<Path>src/core/domains/git-blame/</Path>'
  - '<Path>src/extension/</Path>'
  - '<Path>src/webview/</Path>'
shared_paths:
  - '<Path>src/core/contracts/webview-message-contract.ts</Path>'
  - '<Path>src/core/contracts/index.ts</Path>'
shared_path_owners:
  - '<Path>src/core/contracts/webview-message-contract.ts</Path> => T-01'
  - '<Path>src/core/contracts/index.ts</Path> => T-01'
---

# Ticket T-01: 冻结 Git Blame V2 Reader 合同

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/01-freeze-reader-contract.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>`

## 1. 战略与来源

- **目标：** 把用户已确认的 V2 行为压缩成可验证的跨层合同，让实现者不重新决定 Reader model、消息安全或 Copy 输出。
- **可观察产出：** Core contracts 能验证 Reader message；当前 change ADR/CONTEXT 明确 V2 的模型、生命周期、复制和旧实现收缩规则。
- **来源：** `US-003`、`US-004`、`US-007`、`AC-004` 至 `AC-016`、`AC-019`、当前 change ADR、永久 `<Path>{roots.state}/specdev/adr/0001-aggregate-diff-webview.md</Path>`。
- **当前事实：** 现有 Webview contract 仅覆盖 Git Review；现有 Git Blame model 只有 annotation 行，不含 source text、blocks 或 Reader generation。
- **Planning Depth 原因：** 这是共享公共合同和安全验证的 Deep Ticket。

## 2. 决策状态

### 已锁定决策

- Reader revision V2.0 固定为 `HEAD`，模型保留 revision 字段。
- message 使用 discriminated union；Host 不接受 Webview 任意复制文本。
- 行号为一基 logical line；blockId 只在当前 session 内有效。

### 已采用的低影响假设

- 复制默认使用稳定换行格式，具体按钮文案由国际化资源维护。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                        | REUSE（复用且不改变契约）                                      | OUT（明确不做）                  |
| ------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| Reader model/message 类型、验证器和版本字段 | 现有 `ToolboxGateway`、`ToolResult`、Webview contract 验证风格 | Git 查询实现、Panel UI、复制执行 |

## 4. 要构建什么

建立 Reader model、block、line、commit detail、copy format 和 message 的类型与运行时验证。无效行号、blockId、generation、revision、消息字段和超出边界的输入必须被拒绝；合同测试从调用者可观察结果验证，而非内部实现。

## 5. 实现契约

- **入口或接缝：** `<Path>src/core/contracts/webview-message-contract.ts</Path>`、`<Path>src/core/contracts/tool-command-contract.ts</Path>` 和 Git Blame public API。
- **输入与输出：** Reader command 输入包含受验证的 executable resource、revision、documentVersion、lineCount、ignoreWhitespace 和 maxLines；消息输出为 `ToolResult` 或 Reader session event。
- **公共接口变化：** 增加版本化 Reader model/message/tool contract；现有 Git Blame command 保持兼容。
- **不变量：** model line 与 source line 一一对应；block 连续且不跨 kind；message 不能绕过 Host model；所有字符串有长度和 NUL 限制。
- **状态或数据流：** Webview message → contract validator → Host controller → Gateway/model → Extension message/result。
- **错误与失败行为：** invalid-input、not-found、cancelled、permission-denied 和 capability-unavailable 按现有 ToolError 语义返回。
- **兼容要求：** 不改变已有 Webview Git Review message；新消息必须通过现有总验证入口。
- **安全与隐私要求：** 不把源码全文写入日志或错误 details；禁止任意路径、revision、HTML 和复制文本注入。

## 6. 执行路线

1. 先为 model/message validator 写失败测试，覆盖合法最小模型、连续 block、非法范围和未知字段。
2. 增加类型、类型守卫、ToolCommandMap 注册和导出，保持 Git Review contract 绿色。
3. 增加复制格式的稳定字段定义和 generation/blockId 约束。
4. 运行 Core contract 单测、类型检查和 SpecDev tickets 校验，形成共享合同基线。

## 7. 路径访问契约

- **预计修改点：** `<Path>src/core/contracts/</Path>` 和当前 change ADR/CONTEXT。
- **可写范围：** 仅 frontmatter `writable_paths`。
- **只读上下文：** `<Path>src/core/domains/git-blame/</Path>`、`<Path>src/extension/</Path>`、`<Path>src/webview/</Path>`。
- **共享路径：** 由 T-01 独占；下游必须在该基线后重新预检。
- **保留或不动：** 现有 Git Review contract 和现有 Git Blame public command 输入。

## 8. 验证矩阵

| 行为或风险                 | 验证接缝            | 命令或步骤                                                              | 预期结果             | Evidence                                                               |
| -------------------------- | ------------------- | ----------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| 合法 Reader model/message  | Core contract       | `pnpm test:unit -- src/core/contracts`                                  | 合法输入通过         | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 非法 line/block/generation | schema validator    | 同上                                                                    | invalid-input 或拒绝 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 既有 Webview contract 回归 | 现有 contract tests | `pnpm test:unit -- src/core/contracts/webview-message-contract.test.ts` | Git Review 行为保持  | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 先增加新 contract，再由 T-04/T-05 消费；T-08 扫描旧 fake gutter 与旧 contract 调用点后收缩。
- **兼容窗口：** 实现期间保留现有 Git Blame command；V2 发布时删除 fake gutter 行为，不保留 legacy 配置。
- **监控信号：** contract validator 失败、过期 generation、取消和不可用原因的摘要日志。
- **回滚或前向恢复：** contract 或实现失败时保留旧分支工作区，恢复到最后绿色 checkpoint；不得恢复 fake gutter 到发布分支。
- **不可逆操作与批准点：** 删除旧 API/配置前由 T-08 的调用点扫描和项目门禁批准。
- **收缩条件：** 旧 fake gutter 调用点、`before/after.contentText`、动态 annotation width 的静态扫描结果为零。

## 10. 验收标准

- [x] Reader model/message 类型、验证器和复制格式合同已覆盖 AC-004 至 AC-016、AC-019。
- [x] 共享 contract 测试通过并写入 Evidence。
- [x] 无未批准公共契约或安全偏差。
