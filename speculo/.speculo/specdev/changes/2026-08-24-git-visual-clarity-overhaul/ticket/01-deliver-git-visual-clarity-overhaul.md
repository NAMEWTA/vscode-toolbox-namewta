---
schema_version: 3
artifact: ticket
change: 2026-08-24-git-visual-clarity-overhaul
id: T-01
title: 交付 Git 可视化清晰度彻底重构
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 同时替换 Git Compare URI、Reader React/Host 合同和编辑器 decoration 模块，并要求真实 VS Code 主题缩放验证，但不涉及数据迁移或 Git 写操作。
ready: true
risk: high
blocked_by: []
contract_ids: [AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008]
owner: Codex
expected_changes:
  - '<Path>src/core/domains/git-blame/**</Path>'
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/extension/adapters/git/**</Path>'
  - '<Path>src/extension/configuration/**</Path>'
  - '<Path>src/extension/presentation/git-compare*</Path>'
  - '<Path>src/extension/presentation/git-blame*</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/webview/git-blame-reader/**</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
  - '<Path>THIRD_PARTY_NOTICES.md</Path>'
writable_paths:
  - '<Path>src/core/domains/git-blame/**</Path>'
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/extension/adapters/git/**</Path>'
  - '<Path>src/extension/configuration/**</Path>'
  - '<Path>src/extension/presentation/git-compare*</Path>'
  - '<Path>src/extension/presentation/git-blame*</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/webview/git-blame-reader/**</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
  - '<Path>THIRD_PARTY_NOTICES.md</Path>'
read_only_paths:
  - '<Path>src/webview/git-review/**</Path>'
  - '<Path>src/extension/adapters/process/**</Path>'
shared_paths: []
shared_path_owners: []
---

# Ticket T-01: 交付 Git 可视化清晰度彻底重构

## 1. 战略与来源

- **目标：** 一次性修复用户截图中的五项可辨识性问题，并用固定上游提交的成熟交互替换编辑器注解。
- **可观察产出：** 文件标签可识别、Reader 提交块可扫描、详情留在 React 上下文、编辑器逐行归属清晰。
- **来源：** `AC-001..AC-008`、`ADR-001..003`、用户实施批准、上游 commit `cc2c600a75f98a6af39c33a6082cac8c1657c0b3`。
- **Deep 批准点：** 用户明确要求按先前 Plan 执行到完成，并明确无需兼容性。

## 2. 决策状态

### 已锁定决策

- revision URI 的 pathname 使用真实仓库相对路径，authority token 与 store 记录仍是内容授权依据。
- Reader SHA/摘要只在块首展示，两列共享 tint，详情使用 React 模态。
- 编辑器注解完全替换为固定元数据列、heat 色条和可选当前提交高亮。
- 拒绝上游私有命令、不受控进程、`any` 与 trusted Markdown。

### 已采用的低影响假设

- 同一 commit 非连续出现时，每个连续块仍各显示一个块首。
- 稳定产品命令 ID 继续表达同一业务操作，不视为旧注解实现兼容层。

### 未决问题

无。

## 3. 范围边界

| IN                                                              | REUSE                                                                         | OUT                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Compare 标签、Reader 分块/配色/模态、编辑器注解替换、测试和文档 | Gateway、Git runner、Reader model、generation/cancellation、公开 VS Code 命令 | Git 写入、Webview syntax highlight、遥测、私有命令、旧 UI/协议兼容 |

## 4. 要构建什么

用户打开多文件比较时，每项直接显示真实相对路径；打开 Reader 时，每个连续 commit 构成跨 Blame/Code 两列的清晰色块，info 在 Panel 内打开可访问模态；开启编辑器注解时，行首出现固定宽度 metadata、连续块合并与窄 heat 色条，并保持刷新、取消和释放语义。

## 5. 实现契约

- **Interface：** typed Gateway、revision URI store、Reader discriminated message contract、纯 annotation formatter、VS Code decoration/hover adapter。
- **不变量：** 真实路径不绕过 store token；同 commit 同色；颜色不是唯一分隔；Webview 不能直接打开未验证 URL；旧 decoration 与通知详情实现删除。
- **错误行为：** URI/path、Webview action、remote URL 和 Git 输出验证失败时稳定拒绝，不泄露路径、不执行特权动作。
- **生命周期：** generation/cancellation、dirty document 映射、panel/listener/decoration dispose 必须保持。
- **兼容：** 不保留旧 Webview action、旧 renderer 结构或旧注解配置别名；稳定产品 command id 可继续指向同一业务操作。

## 6. 执行路线

1. Git Compare URI 文件标签红绿。
2. Reader 块首、共享配色与 React 模态红绿。
3. 注解纯格式模块、固定列 renderer、配置与 hover 红绿。
4. 同步 composition root、国际化、配置、文档与第三方声明。
5. 运行定向回归、Extension Host、真实 UI 矩阵、双轴审查、完整门禁和 VSIX。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** frontmatter `writable_paths`；只有本 Ticket 顺序写入。
- **只读上下文：** Git Review Webview 和底层进程 runner。
- **共享路径：** 无并发 owner；根配置/文档由当前唯一 owner 修改。
- **保留不动：** 版本化 Extension API、其他业务域、归档 change 和永久 ADR namespace。

## 8. 验证矩阵

| 行为或风险     | 验证接缝                                                  | 命令或步骤                                          | 预期结果                                 | Evidence                                                               |
| -------------- | --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| AC-001         | URI/Presentation 单元 + Extension Host                    | 定向 Vitest 与集成测试                              | 文件标题是实际相对路径且 token 防篡改    | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-002..AC-004 | React/contract/controller 单元 + UI                       | 定向 Vitest 与 UI runner                            | SHA 一次、两列同色、模态可访问且无通知   | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-005..AC-007 | Core formatter、renderer/controller 单元 + Extension Host | 定向 Vitest 与集成测试                              | 固定列、合并、hover 起点、刷新与释放成立 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-008         | 完整发布候选门禁                                          | SpecDev validator、`pnpm check:ci`、UI runner、VSIX | 全部门禁有实际证据                       | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** URI、Reader、annotation 各自红绿后再统一更新配置和 composition root。
- **兼容窗口：** 不适用；用户批准一次性替换旧注解实现和 Reader action。
- **监控信号：** 结构化错误、UI matrix、Extension Host 与完整门禁；不新增遥测。
- **回滚：** 变更不写 Git 或业务数据，可按三个功能面整体回退源码与配置。
- **不可逆操作：** 无；本 Ticket 不授权 commit、push、release。

## 10. 验收标准

- [x] AC-001..AC-008 全部通过并映射到 Evidence。
- [x] 每个行为有可追踪的红绿记录。
- [x] 不存在 `_workbench.*`、不受控 Shell、`any`、非受限 trusted Markdown 或架构越层。
- [x] 实际修改位于 `writable_paths`，文档和第三方声明同步。
- [x] Ticket、Map、Evidence 与 change 状态一致。
