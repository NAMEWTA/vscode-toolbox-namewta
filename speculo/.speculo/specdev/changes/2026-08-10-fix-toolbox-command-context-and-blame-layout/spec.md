---
schema_version: 3
artifact: spec
change: 2026-08-10-fix-toolbox-command-context-and-blame-layout
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-10-toolbox-fixes
  - DIAG-001
---

# Spec: 修复 Toolbox 菜单上下文与 Git Blame 注解布局

- **Spec：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/spec.md</Path>`
- **当前 ADR：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/ADR.md</Path>`
- **当前领域上下文：** `<Path>{roots.state}/specdev/changes/2026-08-10-fix-toolbox-command-context-and-blame-layout/CONTEXT.md</Path>`

## 1. 问题与目标

### 问题陈述

0.1.1 将 VS Code 菜单注入的合法上下文误判为非法输入，Blame 注解列固定过宽且多个行首附件可能错位，日期也缺少分钟精度；可见命令也缺少统一的短前缀。

### 目标用户与场景

目标用户是在受信任工作区中从 Source Control、编辑器行号和命令面板使用 Toolbox 的开发者。

### 成功标准

- SCM 标题启动 Review 和行号右键查看历史均可用且选择正确仓库/行。
- Blame 注解列紧凑对齐，相同提交形成连续整列色块，不覆盖代码正文。
- 所有可见命令与菜单标题从 `toolbox-` 开始，现有命令 ID 和绑定继续工作。
- 默认日期显示为本地时区 `YYYY-MM-DD HH:mm`，0.1.4 VSIX 通过适用门禁并可安装。

### 非目标

不改变 Core Gateway 契约、Git 数据模型、命令 ID、配置键、代码正文配色或远程发布流程。

## 2. 解决方案与外部行为

### 解决方案摘要

在 Extension Host 命令接缝验证官方菜单上下文并转换为现有内部输入；Blame Formatter 输出本地时区分钟日期与稳定前景/背景配色，Renderer 用同一 decoration 的 `before/after` 附件按当前文档最长文本设置统一列宽；Manifest 标题直接增加前缀并移除分类。

### 主要流程

用户点击 SCM 标题命令时优先审核该 `SourceControl` 根目录；点击行号菜单时直接使用一基 `lineNumber`；显示 Blame 时每次渲染计算统一紧凑宽度并为每个已提交行绘制色块。

### 边界、失败与稳定错误行为

畸形外部对象仍返回 `invalid-input`；合法但不可执行的 Git 根目录保持现有能力不可用错误；未提交行不伪造提交颜色；空文本和合并显示仍保留列宽与范围。

### 状态转换与不变量

不新增持久状态。所有装饰与监听器仍随文档/Runtime 释放。

## 3. 用户故事

- **US-001**：作为开发者，我希望从实际菜单入口直接执行 Toolbox 操作，以便不必绕回命令面板。
- **US-002**：作为阅读代码的开发者，我希望 Blame 信息紧凑且分组清晰，以便保留代码阅读空间。
- **US-003**：作为安装多个扩展的用户，我希望 Toolbox 命令拥有统一前缀，以便快速识别来源。

## 4. 验收合同

| ID     | 前置条件                   | 动作或事件             | 可观察结果                                                                                                | 验证接缝                                |
| ------ | -------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| AC-001 | 受信任多仓库工作区         | 从 SCM 标题启动 Review | 使用被点击 SourceControl 仓库且不记录输入错误                                                             | 命令/仓库适配单元与 Extension Host 集成 |
| AC-002 | 任一会话命令               | 传入畸形上下文         | 稳定拒绝，非 start 命令仍为零参数                                                                         | 命令单元测试                            |
| AC-003 | 文件编辑器已打开           | 从行号右键查看历史     | 使用对象中的 URI 和一基行号打开历史                                                                       | 命令单元测试                            |
| AC-004 | 显示短或宽字符 Blame 文本  | Renderer 渲染          | 日期严格为本地时区 `YYYY-MM-DD HH:mm`，列宽按最长显示文本统一计算，无 `22em` 固定空白，单一附件不互相覆盖 | Formatter/Renderer 单元与截图           |
| AC-005 | 文档含一个或多个提交       | Renderer 渲染          | 已提交行显示连续实色色条和整列淡背景，未提交行无提交色；色条、日期和作者排列稳定且不覆盖正文              | Formatter/Renderer 单元与截图           |
| AC-006 | 查看命令面板或任一贡献菜单 | 列出 Toolbox 命令      | 中英文标题均以 `toolbox-` 开头，命令 ID 不变                                                              | Manifest 测试                           |
| AC-007 | 完成修复                   | 构建与打包             | 生成通过适用门禁的 0.1.4 VSIX，并由 `v0.1.4` 标签触发发布                                                 | check/集成/package/release              |

## 5. 范围

### IN

命令参数归一化、仓库选择、行号上下文、Blame 纯格式与装饰、Manifest/i18n、文档、版本、测试和本地打包。

### REUSE

现有 Gateway、Git Ports、QuickPick、逐文档 Controller、Workspace Trust、显示宽度计算和集中资源释放。

### OUT

- **OOS-001**：不重命名 `vscodeToolboxNamewta.*` 命令、配置或视图 ID。
- **OOS-002**：不把提交色扩展到代码正文整行。
- **OOS-003**：不发布 Marketplace/npm；本次已明确授权提交、推送、打 `v0.1.4` 标签并由工作流创建 GitHub Release。

## 6. 已锁定实现约束

- **DEC-001**：外部 VS Code 对象只在 Extension Host 接缝验证，Core 接口不变。来源：项目 ADR 0002。
- **DEC-002**：列宽使用现有显示宽度算法和每次渲染的最长文本，不增加用户配置；日期默认是 Extension Host 本地时区的 `YYYY-MM-DD HH:mm`。来源：用户 2026-08-11 确认。
- **DEC-003**：提交色块只补充日期/作者文本，不作为唯一信息。来源：仓库可访问性规则。
- **DEC-004**：日期/作者和提交色条必须在同一 decoration 实例中分别作为 `before/after` 附件渲染；不使用私有 Workbench API。来源：VS Code 公共 API 约束与用户确认。

## 7. 数据、接口与兼容

- **公共接口变化：** 无；仅可见 Manifest 标题变化。
- **数据模型与持久化：** 无。
- **兼容要求：** Extension API v1、全部命令 ID、快捷键和配置键保持不变。
- **迁移要求：** 配置键保持不变，默认日期格式更新为 `YYYY-MM-DD HH:mm`，版本从 0.1.3 提升至 0.1.4。
- **发布或运维影响：** 生成新的 VSIX，推送 `main` 和 `v0.1.4` 标签后由既有 GitHub Actions 发布。

## 8. 非功能要求

- **NFR-001 安全与隐私：** Workspace Trust 与路径验证不放宽，日志不新增路径或源码内容。
- **NFR-002 性能与容量：** 列宽与配色保持单次线性遍历，不为每个提交创建独立 DecorationType。
- **NFR-003 可用性与可靠性：** 菜单、命令面板、Hover 和零参数入口行为一致，资源可释放。
- **NFR-004 可观测性与运营：** 两类合法菜单入口不再产生 `invalid-input` 日志；失败仍结构化记录。

## 9. 验证策略

| 接缝                     | 层级                   | 覆盖合同                 | 现有先例或命令                                                               | Evidence 类型           |
| ------------------------ | ---------------------- | ------------------------ | ---------------------------------------------------------------------------- | ----------------------- |
| 命令与仓库适配           | 单元/Extension Host    | AC-001 至 AC-003         | `pnpm exec vitest run src/extension`、`pnpm test:integration`                | 参数、目标和 diff 断言  |
| Blame Formatter/Renderer | Core/Presentation 单元 | AC-004、AC-005           | `pnpm exec vitest run src/core/domains/git-blame src/extension/presentation` | 文本宽度和装饰选项      |
| Manifest/i18n            | 静态单元               | AC-006                   | Manifest Vitest                                                              | 全命令资源断言          |
| 发布候选                 | 项目门禁               | AC-007                   | `pnpm check:ci`                                                              | 命令输出和 VSIX 路径    |
| 实际 VS Code UI          | 手动                   | AC-001、AC-003 至 AC-006 | Extension Development Host                                                   | 菜单操作与浅/深主题截图 |

## 10. 风险、假设与未决问题

### 风险

Decoration attachment 的高度和排列由 VS Code 主题 CSS 影响，必须通过真实宿主截图确认连续性和可读性。

### 已采用的低影响假设

相同 commit hash 使用相同 HSL 色相；背景透明度固定为 14%，色条宽度固定为 `0.35em`。

### 未决问题

无。
