---
schema_version: 3
artifact: spec
change: 2026-08-23-native-git-revision-comparison
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-23-native-two-revision-comparison
  - RESEARCH:orca-v1.4.186-d802fdc7429f5f9d959b99a73656545bd760eace
  - CODE:<Path>src/core/domains/git-compare/</Path>
  - CODE:<Path>src/extension/presentation/git-compare-controller.ts</Path>
---

# Spec: 原生 Git 双节点比较

- **Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **当前 ADR：** `<Path>{roots.state}/specdev/changes/{change}/ADR.md</Path>`
- **当前领域上下文：** `<Path>{roots.state}/specdev/changes/{change}/CONTEXT.md</Path>`

## 1. 问题与目标

### 问题陈述

现有 Git 提交比较依赖 Explorer 中两个 TreeView 和隐式参考节点状态，只能从 HEAD 祖先列表操作，用户无法清楚确认比较方向、直接输入提交编号，或一次查看完整文件集合。单文件 `vscode.diff` 还把跨文件变化拆散，降低审阅清晰度。

### 目标用户与场景

需要在当前 Git 仓库中核对任意两个 commit 快照的开发者，从 SCM 标题栏进入，分别选择基准端和目标端，随后在 VS Code 原生多文件更改视图中查看 `base -> target`。

### 成功标准

- SCM 标题栏提供紧凑的比较图标入口。
- 两步选择器明确显示基准端和目标端，目标端默认当前 `HEAD`。
- 两端均可从分页提交历史选择或输入 4 到 64 位十六进制对象编号前缀。
- 比较结果一次呈现全部文件，并在标题中显示方向、端点与统计。
- Git 对象在解析后始终以完整 OID 进入比较和内容读取。

### 非目标

不比较工作区或暂存区，不引入 merge-base 语义，不构建 Webview Diff，不执行 Git 写操作，也不增加远程 ref 搜索。

## 2. 解决方案与外部行为

### 解决方案摘要

新增 `vscodeToolboxNamewta.gitCompare.start`，在 SCM 标题栏启动两步 QuickPick。选择器通过 typed `gitCompare.resolveRevision` 解析手输编号，以固定的完整 commit OID 调用既有 compare/content 能力，并通过公开命令 `vscode.changes` 打开原生多文件比较。

### 主要流程

1. 用户点击 SCM 标题栏的比较图标。
2. 第一步选择基准 commit；第二步选择目标 commit，默认激活 `HEAD`。
3. 任一步都可以加载更多历史，或输入合法十六进制前缀并解析为 commit。
4. 系统比较两个固定快照，在原生更改视图中显示所有文件；从该视图继续打开单文件原生 Diff。

### 边界、失败与稳定错误行为

- 非 Git 仓库、未受信任工作区、无提交仓库沿用结构化错误并显示国际化错误信息。
- 非十六进制输入不作为 revision 解析入口；不存在或不唯一的前缀保持选择器打开并显示错误。
- 两端解析到同一 OID 时不打开空比较，提示用户重新选择目标端。
- 空变更集合显示信息提示，不调用 `vscode.changes`。
- 新增、删除、重命名、二进制、submodule、超限内容均保留可辨认的两端资源语义。

### 状态转换与不变量

- `idle -> selecting-base -> selecting-target -> comparing -> idle`；取消会释放选择器和当前请求。
- 比较方向固定为用户选择的 `base -> target`，不隐式交换、不计算 merge-base。
- 手输前缀只用于解析；之后所有 Git 读取使用解析出的完整 40 或 64 位 OID。
- 任一时刻只有一个活跃选择会话，重开入口会取消旧会话。

## 3. 用户故事

- **US-001**：作为提交审阅者，我希望从 SCM 直接选择两个节点，以便明确比较方向。
- **US-002**：作为已知提交编号的用户，我希望直接输入 SHA 前缀，以便跳过历史翻找。
- **US-003**：作为跨文件变化的审阅者，我希望使用 VS Code 原生多文件比较，以便清晰导航所有变化。
- **US-004**：作为现有用户，我希望旧的 `gitCompare.openHistory` 命令仍能启动新流程，以便已有键绑定不会立即失效。

## 4. 验收合同

| ID     | 前置条件                                 | 动作或事件                    | 可观察结果                                              | 验证接缝                           |
| ------ | ---------------------------------------- | ----------------------------- | ------------------------------------------------------- | ---------------------------------- |
| AC-001 | 已打开受信任 Git 仓库                    | 点击 SCM 比较图标             | 打开两步端点选择器，第二步默认 `HEAD`                   | manifest 合同与扩展集成测试        |
| AC-002 | 选择器已打开                             | 分别选择任意两个历史 commit   | 以完整 OID 执行直接 `base -> target` 比较               | QuickPick、Handler 与 Git 集成测试 |
| AC-003 | 选择器已打开                             | 输入 4 到 64 位十六进制前缀   | 唯一 commit 被解析；不存在或歧义时显示错误且不比较      | Core guard 与适配器测试            |
| AC-004 | 比较含多种文件状态                       | 完成端点选择                  | `vscode.changes` 一次收到所有文件资源，标题含方向和统计 | Presentation 单元测试              |
| AC-005 | 比较含新增、删除、重命名或不可文本化内容 | 查看原生更改列表              | 两端路径和缺失端正确，特殊内容显示端点相关摘要          | Presentation 单元与 Git 集成测试   |
| AC-006 | 两端相同或没有变化                       | 完成端点选择                  | 显示信息且不打开空原生比较                              | Controller/Presentation 测试       |
| AC-007 | 已有键绑定调用旧入口                     | 执行 `gitCompare.openHistory` | 转发到新选择流程；旧 TreeView 命令和视图不再贡献        | manifest 与扩展集成测试            |

## 5. 范围

### IN

- Git revision 解析契约、适配器与测试。
- 两端 QuickPick、SCM 标题栏入口、原生 `vscode.changes` 展示。
- 移除旧 Git compare Explorer TreeView 与仅服务该视图的命令。
- 国际化、README、CHANGELOG、ADR 和 Speculo Evidence。

### REUSE

- `ToolboxGateway`、Git CLI 进程适配器、提交分页、比较模型、revision 内容 provider 和 VS Code 原生 URI/provider 机制。

### OUT

- **OOS-001**：工作树、index、stash、远程仓库或 Pull Request 比较。
- **OOS-002**：Orca 的 Monaco Diff UI、merge-base 分支比较或 first-parent 单提交模式。
- **OOS-003**：Git 写入、ref 创建、checkout 或持久化端点偏好。

## 6. 已锁定实现约束

- **DEC-001**：使用公开稳定的 `vscode.changes` 命令，不调用 `_workbench.*` 私有命令。来源：`USER-DECISION`、`RESEARCH`。
- **DEC-002**：比较语义是两个 commit 快照的直接 `base -> target`，不采用 Orca 的 merge-base/first-parent 隐式语义。来源：`USER-DECISION`。
- **DEC-003**：手输值仅接受 4 到 64 位十六进制对象编号前缀，并通过 `rev-parse --verify --end-of-options <prefix>^{commit}` 解析。来源：`SECURITY`。
- **DEC-004**：入口位于 `scm/title` 且使用图标；旧 `openHistory` 仅作为隐藏兼容别名。来源：`USER-DECISION`。

## 7. 数据、接口与兼容

- **公共接口变化：** `ToolCommandMap` 新增 `gitCompare.resolveRevision`；扩展贡献新增 `gitCompare.start`。版本化 `activate()` 公共 API 形状不变。
- **数据模型与持久化：** 无持久化；新增 revision 输入/输出仅存在进程内。
- **兼容要求：** `gitCompare.openHistory` 保留并转发；旧 TreeView 专用命令从 manifest 和注册点移除。
- **迁移要求：** 一次性替换 UI 入口，无用户数据迁移。
- **发布或运维影响：** 重新生成 VSIX；本 change 不授权 commit、push 或 release。

## 8. 非功能要求

- **NFR-001 安全与隐私：** revision 输入严格校验并作为参数数组传给 Git；不记录源码或 Git 内容。
- **NFR-002 性能与容量：** 历史按现有页大小分页；文件内容继续按原生视图需要延迟读取。
- **NFR-003 可用性与可靠性：** 支持取消、返回、加载更多、错误后重试；标题和文件标签不依赖颜色表达方向。
- **NFR-004 可观测性与运营：** 不新增遥测；结构化错误和测试结果作为证据。

## 9. 验证策略

| 接缝                      | 层级                | 覆盖合同               | 现有先例或命令                           | Evidence 类型            |
| ------------------------- | ------------------- | ---------------------- | ---------------------------------------- | ------------------------ |
| Git compare Core/Adapter  | 单元与真实 Git 集成 | AC-002、AC-003、AC-005 | `pnpm exec vitest run ...git-compare...` | 输入、命令参数和输出断言 |
| Revision QuickPick        | Presentation 单元   | AC-001..AC-003、AC-006 | 相邻 QuickPick fake 先例                 | 状态转换和结果断言       |
| 原生 changes Presentation | Presentation 单元   | AC-004..AC-006         | mocked `vscode` 边界                     | 命令和资源三元组断言     |
| Manifest/Extension        | 集成                | AC-001、AC-007         | `pnpm test:integration`                  | 命令贡献与注册断言       |
| 项目发布门禁              | CI                  | 全部回归               | `pnpm check:ci`                          | 命令结果与 VSIX 路径     |

## 10. 风险、假设与未决问题

### 风险

- `vscode.changes` 的资源三元组需要正确表达缺失端与重命名；通过 presentation 边界测试锁定。
- Git SHA-256 仓库需要 64 位完整 OID；模型和 guard 同时支持 40/64 位。

### 已采用的低影响假设

- 使用现有提交页大小与历史格式，不新增配置项。
- `gitCompare.openHistory` 保留一个发布周期作为兼容入口，但不再出现在 UI 菜单。

### 未决问题

无。
