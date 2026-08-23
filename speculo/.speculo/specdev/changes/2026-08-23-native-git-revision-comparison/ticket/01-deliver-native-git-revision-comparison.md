---
schema_version: 3
artifact: ticket
change: 2026-08-23-native-git-revision-comparison
id: T-01
title: 交付原生 Git 双节点比较
status: done
planning_depth: standard
planning_depth_reason: 该 Ticket 纵向跨 typed gateway、Git CLI 适配器、VS Code Presentation、manifest、国际化和文档，但无持久化迁移或 Git 写操作。
ready: true
risk: medium
blocked_by: []
contract_ids: [AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007]
owner: unassigned
expected_changes:
  - '<Path>src/core/domains/git-compare/**</Path>'
  - '<Path>src/core/contracts/tool-command-contract.ts</Path>'
  - '<Path>src/extension/adapters/git/git-compare-port-adapter*</Path>'
  - '<Path>src/extension/presentation/git-compare*</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/extension/commands/toolbox-command-manifest.test.ts</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
writable_paths:
  - '<Path>src/core/domains/git-compare/**</Path>'
  - '<Path>src/core/contracts/tool-command-contract.ts</Path>'
  - '<Path>src/extension/adapters/git/git-compare-port-adapter*</Path>'
  - '<Path>src/extension/presentation/git-compare*</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/extension/commands/toolbox-command-manifest.test.ts</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
read_only_paths:
  - '<Path>src/webview/**</Path>'
  - '<Path>src/extension/adapters/process/**</Path>'
shared_paths: []
shared_path_owners: []
---

# Ticket T-01: 交付原生 Git 双节点比较

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/01-deliver-native-git-revision-comparison.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>`

## 1. 战略与来源

- **目标：** 把隐式参考节点和 Explorer TreeView 流程替换为 SCM 中明确的两端选择和原生多文件比较。
- **可观察产出：** 用户可选择或输入任意两个 commit，清楚查看 `base -> target` 的完整文件集合。
- **来源：** `US-001..US-004`、`AC-001..AC-007`、`ADR-001..003`、`USER-DECISION:2026-08-23-native-two-revision-comparison`。
- **当前事实：** `<Path>src/extension/presentation/git-compare-controller.ts</Path>` 维护 TreeView 的 reference/target 隐式状态；manifest 把两个 view 放在 Explorer；Core 尚无 revision 解析操作。
- **Planning Depth 原因：** 改动触及公开命令、typed gateway 和多个 extension 层，但沿用既有模块边界且可一次性回退。

## 2. 决策状态

### 已锁定决策

- SCM 标题栏以 `$(git-compare)` 小图标启动新流程。
- 两步 QuickPick 分别选择 base 与 target，target 默认 `HEAD`，两端都支持分页历史和 SHA 前缀。
- 解析完成后只使用完整 OID，比较语义固定为直接 `base -> target`。
- 默认通过公开 `vscode.changes` 展示所有文件；旧 `openHistory` 只保留兼容转发。

### 已采用的低影响假设

- 复用现有分页大小和 Git commit 展示格式；相同端点保持选择器打开并提示。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                                                    | REUSE（复用且不改变契约）                                           | OUT（明确不做）                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| revision 解析、双端选择、SCM 入口、原生 changes、旧视图收缩、测试和文档 | typed gateway、Git runner、compare model、内容 provider、国际化机制 | 工作树/index、merge-base、Webview Diff、Git 写入、远程 ref |

## 4. 要构建什么

用户从 SCM 点击比较图标，先选择基准 commit，再选择默认指向 HEAD 的目标 commit。每步都可从分页历史选择或输入十六进制 SHA 前缀。系统将端点固定为完整 OID，直接比较两个快照，并在 VS Code 原生更改视图一次展示全部文件。取消、返回、解析失败、相同端点和空结果都有明确且可恢复的反馈。

## 5. 实现契约

- **入口或接缝：** `vscodeToolboxNamewta.gitCompare.start`、`ToolboxGateway.execute('gitCompare.resolveRevision')`、`vscode.changes`。
- **输入与输出：** revision 输入为受信任仓库绝对路径和 4 到 64 位十六进制前缀；输出为既有 `GitCompareCommit` 完整 metadata。Presentation 输出 label/original/modified URI 三元组。
- **公共接口变化：** `ToolCommandMap` 增加一个 typed 操作；扩展命令增加 start，保留 openHistory 兼容别名。
- **不变量：** 解析后 OID 完整；方向不交换；target 默认 HEAD；选择会话唯一；不存在的文件端使用 `undefined` URI。
- **状态或数据流：** SCM command → repository resolve → paged QuickPick/resolve handler → compare handler → native changes resources → VS Code command。
- **错误与失败行为：** 取消不报错；非法输入不执行 Git；解析失败保留会话；同端点和空结果不打开 changes；结构化 permission/not-found/invalid-input 按既有错误展示。
- **兼容要求：** openHistory 转发；旧 TreeView 专用 UI 和命令删除；版本化 Extension API 不变。
- **安全与隐私要求：** 所有 Git 参数以数组传递；外部路径、OID 和 Git 输出继续通过边界 guard；不记录内容。

## 6. 执行路线

1. 以 Core/Handler/Adapter 回归测试建立 revision 解析红灯，实现输入校验、完整 OID 和结构化失败。
2. 以 fake QuickPick 建立两步选择、分页、手输、返回、取消和同端点红灯，实现选择会话。
3. 以 presentation 边界测试建立原生 changes 资源映射红灯，实现全部状态和端点标题。
4. 接入 controller、composition root 和 manifest，移除旧 TreeView 贡献并保留兼容别名。
5. 同步国际化、README、CHANGELOG 和永久 ADR，运行聚焦回归。
6. 执行双轴审查、SpecDev 校验、`pnpm check:ci` 和 VSIX 清单，回写 Evidence。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** frontmatter `writable_paths`；仅本次 Git compare 纵向切片和必要注册点。
- **只读上下文：** Webview 与进程适配器基础设施。
- **共享路径：** 无；单 Ticket 顺序执行。
- **保留或不动：** Git Review Webview、Git Blame Reader、Extension 公共 API 版本、其他业务域和只允许 Archive Work 提升的永久 ADR namespace。

## 8. 验证矩阵

| 行为或风险              | 验证接缝                     | 命令或步骤              | 预期结果                                            | Evidence                                                               |
| ----------------------- | ---------------------------- | ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| revision 正常与失败路径 | Core/Adapter 单元和 Git 集成 | 定向 Vitest             | 唯一前缀返回完整 commit；非法、不存在、歧义稳定失败 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 两端选择交互            | QuickPick fake 单元          | 定向 Vitest             | base/target、默认 HEAD、分页、返回、取消均符合合同  | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 多文件原生比较          | Presentation 单元            | 定向 Vitest             | 所有状态映射正确且只调用公开 `vscode.changes`       | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| UI 入口 E2E             | VS Code 扩展集成             | `pnpm test:integration` | SCM command 已贡献和注册，兼容别名可执行            | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 回归与发布包            | 项目完整门禁                 | `pnpm check:ci`         | 类型、lint、测试、覆盖率、构建、集成和 VSIX 全绿    | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |

E2E owner 为当前顺序执行 owner，不使用 Agent 委派。

## 9. 发布、迁移与恢复

- **迁移顺序：** typed 操作先扩展并通过测试，再替换 Presentation 和 manifest；同一交付中删除旧视图贡献。
- **兼容窗口：** openHistory 保留一个发布周期，其他仅服务旧视图的命令不承诺兼容。
- **监控信号：** 不适用：无运行遥测；通过结构化错误与集成门禁发现问题。
- **回滚或前向恢复：** 可整体回退 manifest、controller 和新 typed 操作；不涉及用户数据。
- **不可逆操作与批准点：** 无。
- **收缩条件：** 旧 TreeView id、provider 和专用命令在生产注册及 manifest 中扫描为零。

## 10. 验收标准

- [x] `AC-001..AC-007` 均通过对应验证接缝。
- [x] 所有比较和内容读取都使用解析后的完整 OID。
- [x] 生产代码不调用 VS Code 私有命令，不增加 Webview 或 Git 写操作。
- [x] 验证矩阵执行并记录到 `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>`。
- [x] 实际项目修改未超出 `writable_paths`，无未批准偏差。
- [x] Ticket、Tickets Map 和 Evidence 状态一致。
