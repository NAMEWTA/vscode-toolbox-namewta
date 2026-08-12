---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-03
title: 构建 logical line 与 commit block Reader 模型
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 在 Core/Git 适配器接缝上建立源文本与 blame 元数据的一致性、不变式、未提交语义和大文件保护。
ready: true
risk: high
blocked_by: [T-01]
contract_ids: [AC-004, AC-005, AC-006, AC-010, AC-015, AC-016]
owner: unassigned
expected_changes:
  - '<Path>src/core/domains/git-blame/git-blame-reader-model.ts</Path>'
  - '<Path>src/core/domains/git-blame/git-blame-reader-model-builder.ts</Path>'
  - '<Path>src/core/domains/git-blame/git-blame-reader-copy-format.ts</Path>'
  - '<Path>src/extension/adapters/git/git-blame-port-adapter.ts</Path>'
writable_paths:
  - '<Path>src/core/domains/git-blame/git-blame-reader-*.ts</Path>'
  - '<Path>src/extension/adapters/git/git-blame-port-adapter.ts</Path>'
read_only_paths:
  - '<Path>src/core/contracts/</Path>'
  - '<Path>src/extension/presentation/</Path>'
  - '<Path>src/webview/</Path>'
shared_paths: []
shared_path_owners: []
---

# Ticket T-03: 构建 logical line 与 commit block Reader 模型

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/03-build-reader-model.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-03.md</Path>`

## 1. 战略与来源

- **目标：** 为 Reader 提供 Host 生成的字符保真、可复制、可虚拟化纯数据模型。
- **可观察产出：** 长行软换行不拆分 blame 归属；连续相同 commit 合并，非连续相同 commit 拆分；未提交行有明确 kind。
- **来源：** `US-003`、`US-004`、`US-007`、`AC-004`、`AC-005`、`AC-006`、`AC-010`、`AC-015`、`AC-016`、ADR-002/003/005。
- **当前事实：** 现有 `GitBlameLine` 只表达提交元数据，源文本由文档另行提供；porcelain parser 已验证 blame 行连续性。
- **Planning Depth 原因：** 涉及数据完整性、行号契约、复制保真和大文件事故半径。

## 2. 决策状态

### 已锁定决策

- model 保存一基 logical line 原文及 block 元数据。
- block 分组条件是连续位置、相同 SHA、相同 kind。
- Host 生成 Copy All 所需文本，不依赖 DOM。

### 已采用的低影响假设

- 源文档行尾在模型中统一以逻辑行数组表达，导出时使用项目默认换行；源行字符本身不变。

### 未决问题

无。

## 3. 范围边界

| IN                                                             | REUSE                                                             | OUT                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------ |
| model、builder、block grouping、未提交投影、Copy All formatter | `GitBlameLine`、porcelain parser、现有 maxLines 和 Git Trust 检查 | Webview DOM、Panel、Status Bar |

## 4. 要构建什么

Host 读取同一文档版本的完整源文本和 blame lines，生成 `GitBlameReaderModel`。builder 拒绝行数/版本不一致、缺失 blame 或非法文本；合法模型可以直接生成整文件纯代码、逐行 blame、block code 和 block blame 字符串。5,000 行以上模型仍可供虚拟化读取，不能截断 Copy All。

## 5. 实现契约

- **入口或接缝：** Core 纯 builder/copy formatter，Git blame port adapter 的结果接缝。
- **输入与输出：** 输入为 `GitBlameLine[]`、源逻辑行数组、URI、revision、documentVersion、kind 配置；输出为不可变 model 或稳定 ApplicationError。
- **公共接口变化：** 导出 Reader model/builder/copy formatter 类型；不改变已有 annotation command。
- **不变量：** 一基行号严格递增；block 行范围与内容一致；源码不 trim/format/HTML render；全零 SHA 映射为 uncommitted。
- **状态或数据流：** Git adapter → Handler → builder → immutable model → Panel/Webview/copy consumers。
- **错误与失败行为：** 空、未跟踪、超限、行数不一致和非法 metadata 显式返回 unavailable/invalid-input，不生成部分模型。
- **兼容要求：** 既有 annotation/line history 使用的 `GitBlameLine` 语义不变。
- **安全与隐私要求：** 不把源全文写入日志；长度、NUL、路径和 revision 继续由现有 validator 保护。

## 6. 执行路线

1. 用手工 fixture 为空行、中文、tab、HTML、CRLF、长 URL 和 A,A,B,A,A 写失败测试。
2. 实现 immutable model 和连续 block builder，先通过 grouping/行号测试。
3. 实现代码、逐行 blame、block 和整文件 Copy formatter，保留精确字符。
4. 接入现有 Git blame adapter 的源文本/版本保护，验证取消、超限和未跟踪路径。
5. 运行 Core、adapter 和大文件定向测试，形成 T-04 可消费基线。

## 7. 路径访问契约

- **预计修改点：** Core Git Blame reader 文件和 Git blame adapter。
- **可写范围：** frontmatter `writable_paths`。
- **只读上下文：** `<Path>src/core/contracts/</Path>`、`<Path>src/extension/presentation/</Path>`、`<Path>src/webview/</Path>`。
- **共享路径：** 无。
- **保留或不动：** 现有 `GitBlameLine` 公共字段和 parser 输出。

## 8. 验证矩阵

| 行为或风险          | 验证接缝                    | 命令或步骤                                                                            | 预期结果                           | Evidence                                                               |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 连续 block grouping | Core builder                | `pnpm test:unit -- src/core/domains/git-blame/git-blame-reader-model-builder.test.ts` | A:1-2、B:3、A:4-5                  | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-03.md</Path>` |
| 文本/行尾保真       | Core formatter              | 同上                                                                                  | tab、Unicode、HTML、空行保持       | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-03.md</Path>` |
| 大文件 Copy All     | Core integration-style test | 定向 Vitest fixture >5,000 行                                                         | 完整输出且不依赖 DOM               | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-03.md</Path>` |
| 无效/未提交/超限    | Handler/adapter tests       | 现有 Git blame tests + 新 fixture                                                     | 稳定 unavailable/error，不伪造 SHA | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-03.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** 先增加 Reader model，不改变 annotation model；T-04 消费后由 T-08 删除无用 fake gutter formatter。
- **兼容窗口：** `GitBlameLine` 与现有 command contract 保持；Reader model 只新增。
- **监控信号：** 行数不一致、builder 拒绝原因、模型行数和构建耗时摘要。
- **回滚或前向恢复：** builder 失败时 Reader 不打开或显示失败状态；annotation 模式继续可用，修复后从最后模型测试绿色点恢复。
- **不可逆操作与批准点：** 无数据迁移；旧 formatter 删除由 T-08 G-06 批准。
- **收缩条件：** Reader 消费路径稳定且旧 full-file annotation formatter 调用点为零。

## 10. 验收标准

- [x] `AC-004`、`AC-005`、`AC-006`、`AC-010`、`AC-015`、`AC-016` 已验证。
- [x] model/copy formatter 单测覆盖字符保真和边界失败。
- [x] T-04 可只依赖该模型读取，不在 Webview 重算 Git。
