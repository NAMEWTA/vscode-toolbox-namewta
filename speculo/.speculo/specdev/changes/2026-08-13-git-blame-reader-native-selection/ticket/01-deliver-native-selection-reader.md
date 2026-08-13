---
schema_version: 3
artifact: ticket
change: 2026-08-13-git-blame-reader-native-selection
id: T-01
title: 交付双列原生选择 Reader
status: review
planning_depth: standard
planning_depth_reason: 该 Ticket 跨 React DOM、布局、交互、性能、本地化和真实 VS Code E2E，但不改变公共 model、wire contract 或持久化。
ready: true
risk: high
blocked_by: []
contract_ids:
  - AC-001
  - AC-002
  - AC-003
  - AC-004
  - AC-005
  - AC-006
  - AC-007
  - AC-008
  - AC-009
  - AC-010
owner: unassigned
expected_changes:
  - '<Path>src/webview/git-blame-reader/**</Path>'
  - '<Path>src/extension/presentation/git-blame-reader-*.ts</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
writable_paths:
  - '<Path>src/webview/git-blame-reader/**</Path>'
  - '<Path>src/extension/presentation/git-blame-reader-*.ts</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
read_only_paths:
  - '<Path>src/core/**</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/webview/git-review/**</Path>'
shared_paths: []
shared_path_owners: []
---

# Ticket T-01: 交付双列原生选择 Reader

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/01-deliver-native-selection-reader.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>`

## 1. 战略与来源

- **目标：** 把 Reader 从按钮驱动、整行可点击的交错列表改成可自由拖选的双列阅读器。
- **可观察产出：** 用户在 Blame 或 Code 独立跨行复制，commit 清晰着色，只有显式图标执行导航/详情，20,000 行内不受虚拟窗口限制。
- **来源：** `US-001..US-004`、`AC-001..AC-010`、`ADR-001..003`、`USER-DECISION:2026-08-13-reader-native-selection`。
- **当前事实：** `<Path>src/webview/git-blame-reader/reader-performance.tsx</Path>` 将 metadata 与 Code 逐行交错并给整行绑定点击；超过 5,000 行后使用窗口虚拟化。
- **Planning Depth 原因：** 多文件 UI 纵向切片且有大文件性能事故半径，但公共契约和持久化均不变。

## 2. 决策状态

### 已锁定决策

- Blame 色块与 Code 同色细标记；Code 保持编辑器背景。
- 顶部复制按钮全部删除；原生 Range 与 `Ctrl/Cmd+C` 是主复制路径。
- Code 自动软换行，分隔线可拖动，列宽只在当前 Panel 会话保留。
- 源码与详情由显式 Lucide 图标进入；普通文本点击无副作用。
- 大文件使用全 DOM 与离屏绘制抑制，不实现自定义虚拟选区。

### 已采用的低影响假设

- 使用 `ResizeObserver` 同步两列 logical row 的最大实际高度；真实 VS Code Chromium E2E 是软换行兼容性的权威。

### 未决问题

无。

## 3. 范围边界

| IN（本 Ticket 构建）                                                | REUSE（复用且不改变契约）                                                    | OUT（明确不做）                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| 双列 DOM、颜色、分隔线、原生选择、显式图标、全 DOM 性能、测试和文档 | Reader model、typed actions、search/refresh、commit detail、VS Code 主题变量 | 语法高亮、编辑、持久列宽、协议删除、自定义选区 |

## 4. 要构建什么

用户打开 Reader 后看到清晰的 Blame 与 Code 两列。Blame gutter 行号不可选择，metadata 与 Code 分别形成连续可选择文本流。拖选、点击或复制不导航；打开源码和提交详情必须使用图标。分隔线调整 Blame 宽度时 Code 软换行，两列仍逐行对齐。大文件全部 logical lines 保留在 DOM，使原生跨屏选区可继续扩展。

## 5. 实现契约

- **入口或接缝：** `GitBlameReaderApp`、Reader layout components、Panel strings 与真实 VS Code Webview。
- **输入与输出：** 输入现有 `GitBlameReaderModel`、status、strings 和 typed `post`；输出双列 DOM、CSS custom properties 与现有 `openSource`/`commitDetail`/`refresh` action。
- **公共接口变化：** 无；仅收缩 Webview 实际发送的 copy action。
- **不变量：** 两列第 N row 对应同一 logical line；选择不跨列；Code 字符保真；颜色不作为唯一语义。
- **状态或数据流：** model → commit palette/双列 rows → browser Range；显式图标 → typed action → Host。
- **错误与失败行为：** 缺失 block metadata 时仍渲染文本；分隔线宽度 clamp；未提交行使用稳定样式。
- **兼容要求：** Git Review virtualization 不变；Host copy/commit detail 继续工作；Refresh 不重置 session 列宽。
- **安全与隐私要求：** 源码仍为 React text node，不写日志、attribute 或任意 HTML。

## 6. 执行路线

1. 扩充 React/CSS 合同测试，先复现整行点击导航、复制工具栏、交错 DOM 和无 commit 色彩。
2. 建立确定性 commit palette 与双列共享 logical row 布局，删除 Reader 窗口虚拟化。
3. 实现原生选择边界、显式图标与鼠标/键盘分隔线，保持 search/refresh/current line。
4. 更新 Panel strings、国际化、README 和 CHANGELOG，删除失效的复制按钮承诺。
5. 在真实 VS Code 中验证主题/缩放、系统剪贴板、跨屏选择、20,000 行、软换行与列宽。
6. 运行双轴审查、SpecDev complete/self-check、`pnpm check:ci` 和 VSIX 清单。

## 7. 路径访问契约

- **预计修改点：** frontmatter `expected_changes`。
- **可写范围：** frontmatter `writable_paths`；新增 Reader 局部组件和测试属于 Reader glob。
- **只读上下文：** Core contracts/model、Composition Root 和 Git Review。
- **共享路径：** 无；本 change 只有一个 Ticket。
- **保留或不动：** `src/core/**`、`src/extension/bootstrap/**`、Git Review virtualization。

## 8. 验证矩阵

| 行为或风险         | 验证接缝                   | 命令或步骤                       | 预期结果                                 | Evidence                                                               |
| ------------------ | -------------------------- | -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| 双列选择/显式动作  | React DOM + 真实剪贴板     | 定向 Vitest 与 VS Code UI runner | 两列复制互不污染，普通点击不 post        | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 软换行/分隔线/颜色 | Chromium layout + 主题矩阵 | 9 组合截图与几何测量             | logical row 对齐、相邻 commit 可区分     | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 20,000 行性能/选择 | 真实 VS Code fixture       | 打开、滚动、搜索、跨屏拖选       | DOM 完整且交互可用，不重复 Git           | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| 回归               | 项目完整门禁               | `pnpm check:ci`                  | 单元、覆盖率、构建、Host 集成、VSIX 全绿 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |

E2E owner 为当前顺序执行 owner，不使用 Agent 委派。

## 9. 发布、迁移与恢复

- **迁移顺序：** 先测试，再一次性替换 Reader DOM；Host contract 保持兼容。
- **兼容窗口：** 不适用：无公共协议升级。
- **监控信号：** UI runner 的 DOM 行数、布局几何、滚动、搜索和消息计数。
- **回滚或前向恢复：** 定向回退 Webview DOM/CSS，不影响 Host model 或 Git 数据。
- **不可逆操作与批准点：** 无。
- **收缩条件：** 顶部复制 toolbar 和 Reader `useVirtualizer` 调用点扫描为零。

## 10. 验收标准

- [x] `AC-001..AC-010` 均已映射到 Evidence；真实 UI 未运行项已明确标记。
- [x] Blame/Code DOM 独立，普通文本点击不导航。
- [ ] 20,000 行真实工作台、软换行几何、分隔线拖动和 9 组合主题/缩放仍需真实 Chromium 验收。
- [x] 已执行的验证矩阵已记录到 `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>`。
- [x] 实际项目修改未超出 `writable_paths`。
- [x] `DEV-001-reader-row-sync` 已同步到 LOG/ADR/Spec，不是未批准范围偏差。
- [x] Ticket、Tickets Map 和 Evidence 状态为 review，彼此一致。
