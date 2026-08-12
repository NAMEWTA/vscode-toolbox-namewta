---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-08
title: 集成注册、删除旧实现并完成发布门禁
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 是 shared path 集成 owner，负责组合根、manifest/i18n、旧调用点收缩、全量门禁和不可逆发布前批准。
ready: true
risk: critical
blocked_by: [T-02, T-05, T-06, T-07]
contract_ids:
  [
    AC-001,
    AC-002,
    AC-003,
    AC-004,
    AC-008,
    AC-009,
    AC-010,
    AC-011,
    AC-012,
    AC-013,
    AC-014,
    AC-015,
    AC-016,
    AC-017,
    AC-018,
    AC-019,
    AC-020,
  ]
owner: specdev-integrator
expected_changes:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/extension/commands/</Path>'
  - '<Path>src/core/contracts/</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>build/build-webview.mjs</Path>'
  - '<Path>src/**</Path>'
writable_paths:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/extension/commands/</Path>'
  - '<Path>src/core/contracts/</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>build/build-webview.mjs</Path>'
  - '<Path>src/**</Path>'
read_only_paths:
  - '<Path>speculo/.speculo/specdev/changes/2026-08-12-git-blame-v2-reader/</Path>'
shared_paths:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>'
  - '<Path>src/core/contracts/</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>src/**</Path>'
shared_path_owners:
  - '<Path>src/extension/bootstrap/create-extension-runtime.ts</Path> => T-08'
  - '<Path>src/core/contracts/</Path> => T-08 after T-01 contract checkpoint'
  - '<Path>package.json</Path> => T-08'
  - '<Path>package.nls.json</Path> => T-08'
  - '<Path>package.nls.zh-cn.json</Path> => T-08'
  - '<Path>src/**</Path> => T-08 integration owner for conflict resolution only'
---

# Ticket T-08: 集成注册、删除旧实现并完成发布门禁

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/08-integrate-release-gates.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>`

## 1. 战略与来源

- **目标：** 由唯一集成 owner 将 Reader command、Gateway、Panel、Webview、配置和国际化接入组合根，并完成旧 fake gutter 收缩及发布验证。
- **可观察产出：** 插件可从命令面板/编辑器进入 Reader；完整 V2 门禁、旧调用点扫描、项目级质量门禁和 UI 矩阵均有 Evidence。
- **来源：** 全部 `AC-001` 至 `AC-020`、Goal Plan Gate G-06、ADR-001 至 ADR-005。
- **当前事实：** `<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>` 是唯一组合根；`package.json`、nls、contracts 和 build entry 是 shared path。
- **Planning Depth 原因：** 这是高事故半径的不可逆收缩、共享路径集成和发布候选门禁。

## 2. 决策状态

### 已锁定决策

- 只有 T-08 修改组合根、manifest、nls 和最终 shared contracts。
- 不自动 commit、push、PR、merge、deploy、release 或执行生产动作。
- 删除旧 fake gutter 前必须完成静态调用点扫描和全量回归。

### 已采用的低影响假设

- VSIX 只在用户另行授权发布时生成；本 Ticket 默认只运行 package:vsix 验证构建结果。

### 未决问题

无。

## 3. 范围边界

| IN                                                                     | REUSE                            | OUT                                     |
| ---------------------------------------------------------------------- | -------------------------------- | --------------------------------------- |
| 组合根注册、命令/menu/config/i18n、旧实现删除、全量门禁、Evidence 汇总 | 所有已完成 Ticket 实现和项目命令 | 提交、推送、发布、部署、远程 Issue 操作 |

## 4. 要构建什么

集成所有前置 Ticket 后，用户可通过 `Git Blame: Open Full-file Blame Reader` 进入 Reader，Normal Mode 与 Reader 行为闭环，复制/导航/搜索/大文件/a11y 门禁可验证。删除旧 fake gutter 相关代码、配置和测试后，静态扫描和项目门禁证明没有旧调用点。

## 5. 实现契约

- **入口或接缝：** `create-extension-runtime.ts`、command registration、package contributions、build entry、SpecDev Evidence。
- **输入与输出：** 前置 Ticket 的绿色 checkpoint 和 Evidence；输出可加载扩展、构建产物、全量验证摘要和完成状态候选。
- **公共接口变化：** 增加 Reader command/config/message capability；已有 Git Blame command 保持。
- **不变量：** 唯一组合根；无未注册命令；无 fake gutter；所有 shared path 有单一 owner；状态/Evidence/Map/Goal Plan 一致。
- **状态或数据流：** Ticket checkpoints → integration branch/workspace → project gates → manual UI matrix → Evidence/status。
- **错误与失败行为：** 任一 Gate 失败则暂停 T-08 及 change completion，分类新失败/基线失败/环境失败并回到拥有该行为的 Ticket。
- **兼容要求：** 既有 Git Blame Hover/History/Commit Changes 集成继续通过。
- **安全与隐私要求：** 运行依赖扫描、消息反向验证和日志审计；不执行用户未授权外部动作。

## 6. 执行路线

1. 核对 T-02/T-05/T-06/T-07 Evidence、源码 checkpoint 和 shared path ownership。
2. 在组合根注册 Reader controller、command、configuration、Webview assets 和 capability。
3. 运行定向 integration tests，修复只影响集成的局部问题并回写 Evidence。
4. 执行旧 fake gutter/legacy config/旧调用点扫描，满足收缩条件后删除。
5. 运行 `pnpm check`、`pnpm test:integration`、`pnpm package:list`、`pnpm package:vsix` 和 UI 矩阵。
6. 运行双轴审查、SpecDev implement validator，汇总 T-08 Evidence；未经用户授权不提交或发布。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** shared path 及必要的项目路径；不修改 SpecDev 规划工件之外的归档目录。
- **只读上下文：** 所有前置 Ticket Evidence、ADR、CONTEXT、Spec 和 Goal Plan。
- **共享路径：** 由 T-08 独占；其他 Ticket 不得并行修改。
- **保留或不动：** 既有 Git Review aggregate Panel 行为。

## 8. 验证矩阵

| 行为或风险                        | 验证接缝              | 命令或步骤                                | 预期结果                                 | Evidence                                                               |
| --------------------------------- | --------------------- | ----------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- | --------------- | ------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| command/config/build registration | extension integration | `pnpm test:integration`、`pnpm build`     | Reader command 可发现且 Webview 构建成功 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>` |
| 旧实现收缩                        | 静态反向扫描          | `rg -n "before:                           | after:                                   | contentText                                                            | annotationWidth | legacy" src package.json` | 无 V2 禁止调用点，或有已批准历史说明 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>` |
| 项目质量                          | 项目门禁              | `pnpm check`、`pnpm test:integration`     | 全部适用门禁通过或分类接受               | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>` |
| 发布候选                          | VSIX listing/package  | `pnpm package:list`、`pnpm package:vsix`  | 包含 Reader assets，路径可定位           | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>` |
| 用户 UI                           | 手动 VS Code 矩阵     | 主题、缩放、选择、导航、长 Markdown、a11y | AC-001..AC-020 逐条有结果                | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-08.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** expand（T-01/T-04 新 contract/Reader）→ migrate（T-02/T-05/T-06/T-07 消费）→ observe（扫描/门禁/UI）→ contract（删除 fake gutter/legacy 配置）→ verify（全量验证）。
- **兼容窗口：** 实现期间旧 Git Blame command 可用；最终发布行为为 Normal Mode + Reader，不提供旧 full-file gutter。
- **监控信号：** 命令注册、Reader load/copy/navigation failure、消息拒绝、资源 dispose、构建/集成失败。
- **回滚或前向恢复：** 收缩前保留最后绿色 checkpoint；收缩后若发现回归，优先前向修复 Reader/Normal Mode，必要时恢复配置兼容但不得恢复布局侵入设计。
- **不可逆操作与批准点：** 删除旧代码、配置和测试前需静态扫描、全量门禁、双轴审查和用户确认；不自动发布。
- **收缩条件：** `before.contentText`、`after.contentText`、动态 annotation width、fake gutter workaround 和旧 full-file 命令调用点全部清零并有 Evidence。

## 10. 验收标准

- [x] 全部 `AC-001` 至 `AC-020` 有验证映射和 Evidence。
- [x] 项目级门禁、E2E/UI 矩阵、静态收缩扫描和双轴审查通过。
- [x] change 状态、Tickets Map、Goal Plan、Ticket、Evidence 和源码 checkpoint 一致。
