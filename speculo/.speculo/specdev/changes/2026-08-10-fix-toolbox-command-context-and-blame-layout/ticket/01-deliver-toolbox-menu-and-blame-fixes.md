---
schema_version: 3
artifact: ticket
change: 2026-08-10-fix-toolbox-command-context-and-blame-layout
id: T-01
title: 交付菜单上下文、Blame 布局与可见命名修复
status: review
planning_depth: standard
planning_depth_reason: 跨 Extension Host 命令接缝、Core 纯格式器、VS Code Presentation 和 Manifest，但不改变公共 API 或持久数据
ready: true
risk: medium
blocked_by: []
contract_ids: [AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007]
owner: codex-local
expected_changes:
  - '<Path>src/extension/commands/**</Path>'
  - '<Path>src/extension/adapters/vscode-git-review-repository-adapter*</Path>'
  - '<Path>src/extension/presentation/git-blame-decoration-renderer*</Path>'
  - '<Path>src/core/domains/git-blame/git-blame-annotation-format*</Path>'
  - '<Path>tests/integration/git-review.integration.test.ts</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
  - '<Path>src/extension/presentation/git-blame-hover-provider*</Path>'
writable_paths:
  - '<Path>src/extension/commands/**</Path>'
  - '<Path>src/extension/adapters/vscode-git-review-repository-adapter*</Path>'
  - '<Path>src/extension/presentation/git-blame-decoration-renderer*</Path>'
  - '<Path>src/core/domains/git-blame/git-blame-annotation-format*</Path>'
  - '<Path>tests/integration/git-review.integration.test.ts</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
  - '<Path>src/extension/presentation/git-blame-hover-provider*</Path>'
read_only_paths:
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/core/orchestration/**</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
shared_paths:
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
shared_path_owners:
  - '<Path>package.json</Path> => T-01'
  - '<Path>package.nls.json</Path> => T-01'
  - '<Path>package.nls.zh-cn.json</Path> => T-01'
---

# Ticket T-01: 交付菜单上下文、Blame 布局与可见命名修复

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/ticket/01-deliver-toolbox-menu-and-blame-fixes.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/T-01.md</Path>`

## 1. 战略与来源

- **目标：** 恢复两个真实菜单入口、稳定左侧 Blame 拟态列并统一可见命令来源标识。
- **可观察产出：** 用户可从 SCM 和行号菜单直接完成操作，Blame 列使用本地 `YYYY-MM-DD HH:mm`、紧凑且不发生附件错位，0.1.4 VSIX 可安装并发布。
- **来源：** `AC-001` 至 `AC-007`、`DIAG-001`、`USER-DECISION:2026-08-10-toolbox-fixes`。
- **当前事实：** 命令守卫与 VS Code 官方上下文形态不匹配；Renderer 固定 `22em`；Manifest 通过 category 和无前缀 title 呈现。
- **Planning Depth 原因：** 单一用户体验修复跨多个运行接缝但保持公共契约和数据不变，使用 Standard。

## 2. 决策状态

### 已锁定决策

- 只改可见命名，不改命令 ID。
- Blame 使用自适应宽度、严格本地时区 `YYYY-MM-DD HH:mm`、单一 decoration 的 `before/after` 附件、0.35em 实色色条和 14% 透明整列背景，不覆盖代码正文。
- 已有 `v0.1.3` Release；本次版本提升至 `0.1.4`，并由用户授权提交、推送和标签发布。

### 已采用的低影响假设

- 一个 Ticket 串行拥有所有共享 Manifest 路径，无并发写入。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                                                      | REUSE（复用且不改变契约）                                           | OUT（明确不做）                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| 菜单参数归一化、Blame 纯格式与装饰、Manifest/i18n、文档、版本、测试和打包 | Gateway、Git Port、QuickPick、Controller、Workspace Trust 和命令 ID | Webview、Core 公共契约、配置迁移、代码整行着色和远程发布 |

## 4. 要构建什么

合法 VS Code 菜单上下文必须在 Extension Host 被识别并转换为现有内部输入；Blame 对每次文档渲染形成统一紧凑列和按提交连续的颜色单元；所有贡献命令在命令面板和菜单中直接以 `toolbox-` 标识，升级包保持所有程序化调用兼容。

## 5. 实现契约

- **入口或接缝：** Git Review/行历史命令、仓库解析 Adapter、Blame Formatter/Renderer、Manifest 本地化。
- **输入与输出：** 外部参数继续为 `unknown[]` 并经守卫验证；Renderer 接收纯格式结果并输出可释放 VS Code Decoration。
- **公共接口变化：** 无；可见标题和包版本变化。
- **不变量：** Workspace Trust、命令 ID、Gateway、配置键、零参数与 Hover 路径、未提交语义和 dispose 保持。
- **状态或数据流：** 菜单上下文 → Command/Adapter 验证 → 现有 Gateway；Blame 行 → 纯格式/配色 → 统一列宽 Decoration。
- **错误与失败行为：** 畸形输入仍结构化失败，不将未知对象静默当作活动编辑器。
- **兼容要求：** 0.1.1 用户快捷键与程序化命令调用升级后继续工作。
- **安全与隐私要求：** 不放宽路径或 Trust，不新增敏感日志。

## 6. 执行路线

1. 为 SCM/行号真实上下文、Blame 宽度色块和全命令前缀分别建立红灯回归。
2. 在现有 Command/Adapter 接缝最小实现上下文归一化并保持畸形输入拒绝。
3. 扩展纯格式配色与本地日期，并让 Renderer 用单一 `before/after` 实例按最长文本形成整列色块，验证清理行为。
4. 更新 Manifest/i18n、版本和中文文档，执行定向回归。
5. 运行完整门禁、真实 Extension Host 手动验收和 VSIX 打包，完成双轴审查与 Evidence。

## 7. 路径访问契约

- **预计修改点：** 与 frontmatter `expected_changes` 一致。
- **可写范围：** 仅 frontmatter `writable_paths`；越界前停止。
- **只读上下文：** Core 契约、编排和组合根保持只读。
- **共享路径：** 三个 Manifest/i18n 路径由 T-01 唯一拥有。
- **保留或不动：** Webview、Git 子进程命令、公共 Extension API 和远程工作流。

## 8. 验证矩阵

| 行为或风险 | 验证接缝                   | 命令或步骤                                                       | 预期结果                           | Evidence                                                                                                              |
| ---------- | -------------------------- | ---------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 正常路径   | 定向单元与 Extension Host  | `pnpm exec vitest run <affected tests>`、`pnpm test:integration` | AC-001、AC-003 至 AC-006 通过      | `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/T-01.md</Path>` |
| 失败路径   | 输入守卫单元               | 畸形对象和非 start 参数测试                                      | AC-002 通过且 Trust 不放宽         | `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/T-01.md</Path>` |
| 回归       | 完整门禁                   | `pnpm check:ci`                                                  | 全部质量、集成和打包步骤通过       | `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/T-01.md</Path>` |
| E2E        | Extension Development Host | 从真实 SCM/行号菜单执行并检查浅/深主题截图                       | 无输入错误，布局符合 AC-004/AC-005 | `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/T-01.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 先保持命令 ID兼容，再修改可见资源和版本。
- **兼容窗口：** 0.1.4 直接兼容 0.1.3 命令绑定，无别名或数据迁移。
- **监控信号：** 输出日志不再出现两类合法上下文 `invalid-input`。
- **回滚或前向恢复：** 所有变更可通过代码回退；视觉问题可独立退回原装饰样式而不影响命令修复。
- **不可逆操作与批准点：** `main`、`v0.1.4` 标签和 GitHub Release 已由用户明确批准；Marketplace/npm 仍不执行。
- **收缩条件：** 不适用：不引入临时兼容层。

## 10. 验收标准

- [ ] `AC-001` 至 `AC-007` 均有可定位证据：仅 AC-004、AC-005 的真实主题截图待补。
- [ ] 验证矩阵全部执行并记录到 `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/evidence/T-01.md</Path>`：人工视觉 E2E 未运行。
- [x] 实际项目修改未超出 `writable_paths`，shared path 由 T-01 修改。
- [x] 未发生未批准的范围、契约或发布偏差。
- [x] Ticket、Tickets Map 和 Evidence 状态一致。

## 11. 当前阻塞

当前视觉截图仍需在可控制 Extension Host 的环境完成；自动化、真实 Extension Host 集成和 0.1.4 包构建通过后才能关闭该验收项。
