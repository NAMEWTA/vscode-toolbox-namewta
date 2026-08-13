---
schema_version: 3
artifact: spec
change: 2026-08-13-git-blame-reader-native-selection
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-13-reader-native-selection
  - CODE:<Path>src/webview/git-blame-reader/GitBlameReaderApp.tsx</Path>
  - CODE:<Path>src/webview/git-blame-reader/reader-performance.tsx</Path>
---

# Spec: Git Blame Reader 原生选择与双列布局

- **Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **当前 ADR：** `<Path>{roots.state}/specdev/changes/{change}/ADR.md</Path>`
- **当前领域上下文：** `<Path>{roots.state}/specdev/changes/{change}/CONTEXT.md</Path>`

## 1. 问题与目标

### 问题陈述

当前 Reader 把行号、Blame metadata 和 Code 按 logical line 交错放在同一 DOM 流中，并在整行绑定单击导航。用户无法像编辑器一样稳定拖选纯 Blame 或纯 Code；不同 commit 没有清晰颜色区分；复制按钮占据主要空间却不能替代自由选择。

### 目标用户与场景

需要阅读大型文件历史并摘取源码或归属信息的开发者，在 Reader 中直接拖选、跨行、跨 block 和跨屏复制文本，同时仍能通过明确入口查看提交详情或返回源编辑器。

### 成功标准

- Blame 与 Code 视觉分界清晰且选区互不污染。
- 普通点击和拖选不导航，显式图标才导航或打开详情。
- 同一 commit 保持同色，相邻不同 commit 可区分，Code 阅读底色不被覆盖。
- 20,000 行边界内保留原生长距离选择，并维持可接受的打开、滚动和搜索行为。

### 非目标

不增加语法高亮、源码编辑、自定义复制模板、列宽持久化配置或 Git 写操作。

## 2. 解决方案与外部行为

### 解决方案摘要

Reader 改为共享 logical row 高度的双列布局：Blame 列包含不可选择行号与可选择 metadata，Code 列只包含原始源码。顶部只保留标题、状态、搜索与 Refresh。可拖动分隔线调整 Blame 宽度，commit 色彩从 SHA 确定性派生。

### 主要流程

1. 用户打开 Reader，当前源码行滚动到视口并以非破坏性标记突出。
2. 用户在 Blame 或 Code 列按下并拖动，浏览器形成只属于该列的原生 Range；`Ctrl/Cmd+C` 使用浏览器默认复制。
3. 用户拖动分隔线改变 Blame 宽度，Code 自动软换行，两列继续按 logical line 对齐。
4. 用户点击行号旁的打开图标返回源码，或点击 block 首行 info 图标查看提交详情。

### 边界、失败与稳定错误行为

- 窄视图限制两列最小宽度，不允许分隔线把任一列压至不可读。
- High Contrast 下使用显式边框；无法计算 commit 色时仍显示 metadata 与 block 边界。
- 大文件不卸载 logical line DOM；超过现有 `gitBlame.maxLines` 时继续沿用 Host 的不可用行为。
- 未提交行使用独立 Working Tree 样式，不伪造 commit SHA。

### 状态转换与不变量

- Refresh 更新 model 但保留当前 Panel 会话内的列宽。
- Blame 与 Code 的第 N 个 row 始终对应同一 logical line。
- 文本选择、复制、滚动、搜索和调整列宽不得触发 Git blame 或源码导航。
- Code 文本不 trim、不格式化、不解释为 HTML。

## 3. 用户故事

- **US-001**：作为历史阅读者，我希望在 Blame 或 Code 区独立拖选复制，以便得到没有跨列污染的文本。
- **US-002**：作为代码阅读者，我希望普通点击不跳离 Reader，以便自由定位和开始拖选。
- **US-003**：作为提交调查者，我希望不同 commit 有稳定且可访问的颜色与边界，以便快速扫描归属变化。
- **US-004**：作为大文件用户，我希望跨较远范围使用原生选择，以便不依赖复制按钮或受可见窗口限制。

## 4. 验收合同

| ID     | 前置条件                                             | 动作或事件                        | 可观察结果                                                  | 验证接缝                        |
| ------ | ---------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| AC-001 | Reader 已加载多个 commit block                       | 阅读 Blame 与 Code                | 同 SHA 同色，相邻不同 SHA 色块可区分；Code 仅有同色细标记   | React/CSS 合同与真实主题矩阵    |
| AC-002 | Reader 已加载                                        | 在 Blame 跨行拖选并复制           | 只得到日期、作者、SHA，不含行号或源码                       | 真实 DOM Range 与系统剪贴板 E2E |
| AC-003 | Reader 已加载                                        | 在 Code 跨行、跨 block 拖选并复制 | 只得到原始源码，不含 Blame metadata                         | 真实 DOM Range 与系统剪贴板 E2E |
| AC-004 | Reader 已加载                                        | 单击或开始拖选任意文本            | 不发送 `openSource` 或其他 Host action                      | React 交互回归测试              |
| AC-005 | Reader 已加载                                        | 点击打开源码图标或使用其键盘激活  | 只在显式操作后导航到同一 logical line                       | React/Controller 集成测试       |
| AC-006 | Reader 已加载                                        | 查看顶部和 block 首行             | 无复制按钮带；info 图标可打开现有提交详情                   | React/Panel 测试与 E2E          |
| AC-007 | Reader 已加载长行                                    | 拖动分隔线                        | Blame 宽度受限，Code 自动软换行且两列 logical row 继续对齐  | 浏览器布局测量 E2E              |
| AC-008 | Reader 已加载 20,000 行以内文件                      | 滚动、搜索、跨屏拖选              | 全部 logical lines 保留可选择文本，滚动/搜索不重复 Git 查询 | 大文件真实 VS Code E2E          |
| AC-009 | Reader 处于 Light/Dark/High Contrast 与 100/125/150% | 阅读、选择、调整列宽              | 无重叠、裁切或不可见焦点，颜色不是唯一语义                  | 9 组合 UI 矩阵                  |
| AC-010 | Reader Refresh 或 stale                              | 刷新 model                        | 当前 Panel 的列宽不重置，selection/navigation 合同保持      | React 状态测试与 E2E            |

## 5. 范围

### IN

- 双列 DOM、commit 色彩、可拖动分隔线、原生选择、显式源码/详情入口。
- 删除顶部复制工具栏和 Reader 窗口虚拟化。
- Webview/Panel strings、测试、README、CHANGELOG 和真实 UI Evidence。

### REUSE

- 现有 Reader model、search、stale/refresh、`openSource`、`commitDetail` 与 Host copy contract。
- `gitBlame.maxLines`、Workspace Trust、CSP、typed message 和 session lifecycle。

### OUT

- **OOS-001**：语法高亮或可编辑 Code surface。
- **OOS-002**：持久化列宽配置或按文件保存布局。
- **OOS-003**：自定义虚拟选区、Canvas 渲染或选择覆盖层。
- **OOS-004**：删除 Host 结构化 copy protocol；提交详情仍复用 Copy SHA/Info。

## 6. 已锁定实现约束

- **DEC-001**：Blame 与 Code 必须使用独立连续文本层。来源：`ADR-001`。
- **DEC-002**：原生长距离选择优先于窗口虚拟化。来源：`ADR-002`、`USER-DECISION`。
- **DEC-003**：commit 颜色从现有 model 确定性派生，不扩展公共契约。来源：`ADR-003`。
- **DEC-004**：普通文本点击永不导航；源码和提交详情只使用显式图标入口。来源：`USER-DECISION`。

## 7. 数据、接口与兼容

- **公共接口变化：** 无；Reader model、ToolboxGateway 和 Extension API 保持兼容。
- **数据模型与持久化：** 无新增持久化；列宽只存在当前 React Panel 会话。
- **兼容要求：** Host copy 消息仍可由提交详情使用；Git Review 的 `@tanstack/react-virtual` 不受影响。
- **迁移要求：** React DOM 一次性替换；删除 Reader 对 `useVirtualizer` 的消费与对应测试假设。
- **发布或运维影响：** 需要重新构建 Webview 与 VSIX；本 change 不授权 commit、push 或 release。

## 8. 非功能要求

- **NFR-001 安全与隐私：** 继续使用 React text node、CSP 与 typed message；不记录源码或选区内容。
- **NFR-002 性能与容量：** 20,000 行边界内采用全 DOM 加 `content-visibility`/containment；验证 DOM 完整性、打开、滚动和搜索。
- **NFR-003 可用性与可靠性：** 支持鼠标、键盘、软换行、主题、高对比和缩放；图标具有国际化可访问名称。
- **NFR-004 可观测性与运营：** 不新增运行日志；性能与交互由可重复 UI runner 记录摘要，不记录源码全文。

## 9. 验证策略

| 接缝                 | 层级           | 覆盖合同                       | 现有先例或命令                                                                     | Evidence 类型                |
| -------------------- | -------------- | ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------- |
| Reader React/DOM     | Webview 单元   | AC-001、AC-004..AC-007、AC-010 | `<Path>src/webview/git-blame-reader/GitBlameReaderApp.test.tsx</Path>`             | 交互断言                     |
| Panel strings/styles | Extension 合同 | AC-006、AC-009                 | `<Path>src/extension/presentation/git-blame-reader-styles.contract.test.ts</Path>` | 静态合同                     |
| 真实 VS Code Reader  | UI E2E         | AC-001..AC-010                 | 旧 change UI runner 先例                                                           | 截图、布局、消息与剪贴板摘要 |
| 项目门禁             | CI             | 全部回归                       | `pnpm check:ci`                                                                    | 命令结果与 VSIX 清单         |

## 10. 风险、假设与未决问题

### 风险

- 全 DOM 会提高大文件内存占用；以现有 20,000 行上限、离屏绘制抑制和真实 fixture 验证缓解。
- 独立双列通过 `ResizeObserver` 同步每个 logical row 的最大实际高度；离屏行进入视口时重新测量，不以 jsdom 推断真实布局。

### 已采用的低影响假设

- Blame 默认宽度 360px，常规限制 220–640px；窄视图可降至 160px，Code 至少 180px。
- 使用 12 色确定性 palette，并在相邻不同 SHA 映射冲突时顺延颜色。

### 未决问题

无。
