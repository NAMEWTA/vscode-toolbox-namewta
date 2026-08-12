---
schema_version: 3
artifact: spec
change: 2026-08-12-git-blame-v2-reader
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:Git Blame V2 完整设计方案
  - CODE:<Path>src/core/domains/git-blame/</Path>
  - CODE:<Path>src/extension/adapters/git/git-blame-port-adapter.ts</Path>
  - CODE:<Path>src/extension/presentation/git-blame-decoration-renderer.ts</Path>
  - CODE:<Path>src/extension/presentation/git-blame-hover-provider.ts</Path>
  - CODE:<Path>src/extension/presentation/git-review-panel-controller.ts</Path>
  - ADR:<Path>{roots.state}/specdev/adr/0001-aggregate-diff-webview.md</Path>
  - CONTEXT:<Path>{roots.state}/specdev/context/git-review.md</Path>
---

# Spec: Git Blame V2 Full-file Reader

- **Spec：** `<Path>{roots.state}/specdev/changes/2026-08-12-git-blame-v2-reader/spec.md</Path>`
- **当前 ADR：** `<Path>{roots.state}/specdev/changes/2026-08-12-git-blame-v2-reader/ADR.md</Path>`
- **当前领域上下文：** `<Path>{roots.state}/specdev/changes/2026-08-12-git-blame-v2-reader/CONTEXT.md</Path>`

## 1. 问题与目标

### 问题陈述

旧版 Git Blame 通过原生编辑器 decoration 的 `before.contentText` 和动态宽度把整文件历史塞进源码第 0 列之前。该文字参与编辑器布局，可能改变代码起点、光标、选择、缩进参考线、标尺、水平滚动和软换行关系；长 logical line 软换行后，后续 visual rows 还会脱离其 Blame 语义。完整历史阅读与正常编辑因此互相干扰。

### 目标用户与场景

目标用户是使用 VS Code 阅读和修改 Git 仓库代码、需要快速定位当前行来源并深入阅读整文件历史的开发者。日常编辑需要零布局侵入的当前行信息；调查历史、准备 Issue/PR/评审材料或向 AI 提供上下文时，需要完整、可选择、可复制的文件级 Blame Reader。

### 成功标准

- 开关 Git Blame 不改变原生编辑器源码布局和编辑行为。
- 光标所在行可在 Status Bar 和 Hover 首屏看到日期、作者、短 SHA 和摘要。
- Full-file Reader 以 logical line 和连续 commit block 展示完整源文件历史，软换行不破坏归属。
- Reader 中源码、日期、作者、SHA 和摘要是标准可选择文本，并支持浏览器原生复制和明确的结构化复制动作。
- Reader 与源编辑器可以按一基行号双向定位。
- 源文件变更只显示 stale 状态；只有保存或显式 Refresh 才重新查询 Git。
- 小文件可直接渲染，大文件按 logical line/block 控制 DOM 规模。

### 非目标

- 不把 Reader 做成可编辑源文件的 Custom Editor。
- 不在 V2.0 实现完整语法高亮、复杂 blame 查询语法、任意 revision 浏览或可配置复制模板。
- 不实现逐 hunk 编辑、提交、回滚或其他 Git 写操作。

## 2. 解决方案与外部行为

### 解决方案摘要

Git Blame V2 提供两个互补模式。Normal Editing Mode 复用现有 Git blame 数据，仅通过 Status Bar、Hover 和 `isWholeLine` 背景高亮表达当前行和当前 commit block，不向源码插入文字。Full-file Blame Reader 使用公开 `vscode.window.createWebviewPanel(...)` 创建独立 Editor Tab。Extension Host 负责 Git 查询、源文本读取、边界验证、模型生成和复制文本；Webview 负责安全投影、文本选择、键盘导航、搜索和发送 typed message。

### 主要流程

1. 用户在受信任 Git 仓库的源编辑器执行 `Git Blame: Open Full-file Blame Reader`，系统保存 source URI、当前 selection、当前行、可见范围和文档版本。
2. Host 以 `HEAD` 和当前配置执行一次 blame，读取同一版本的源文本，构建 `GitBlameReaderModel`，按连续相同 SHA/kind 生成 blocks。
3. Reader 打开后滚动并高亮原始当前行；每个 block 的元数据只显示一次，源码按 logical line 渲染，窄窗口下仅在 code 区软换行。
4. 用户可以选择任意文本、使用键盘移动、搜索源码、查看 commit detail、复制代码或 Blame 信息，所有结构化复制由 Host 根据 model 生成。
5. 用户点击源码行、Enter 或 Open Source 时，Host 打开/激活源编辑器并选择对应行；源文件变化时 Reader 标记 stale，显式 Refresh 或保存后才重新查询。

### 边界、失败与稳定错误行为

- 无活动编辑器：提示用户先打开文件，不创建 Panel。
- 非文件、未跟踪、非 Git 仓库、空文件或超过 `maxLines`：不创建可误导的 Reader，显示稳定的不可用原因。
- 工作区不受信任：拒绝 Git 查询和结构化复制，保持现有 permission-denied 语义。
- Blame 输出与文档行数/版本不一致：拒绝模型，显示加载失败并允许 Refresh；不得渲染错位数据。
- 无效 Webview message、越界行号、未知 blockId 或过期 session generation：忽略或返回稳定 invalid-input/not-found/cancelled 结果，不执行操作。
- Git 查询取消、超时或 Panel dispose：终止请求并释放监听器、AbortController、Timer 和 Panel 引用。
- 未提交行的主 UI 显示 `Uncommitted`/`Working Tree`，不显示全零 SHA。

### 状态转换与不变量

Reader session 状态为 `opening → loading → ready | unavailable | stale | failed → disposed`；显式 Refresh 从 `ready/stale/failed` 回到 `loading`。一个 session 只接受其 generation 的消息。模型的每条 line 为一基 logical line，文本原样保留；block 只合并连续且 commit SHA/kind 相同的行。

## 3. 用户故事

- **US-001**：作为日常编码的开发者，我希望启用 Git Blame 时源码布局完全不变，以便正常编辑不受历史信息干扰。
- **US-002**：作为定位问题的开发者，我希望光标所在行立即显示日期、作者、短 SHA 和提交摘要，以便无需打开完整历史就能判断来源。
- **US-003**：作为历史调查者，我希望打开独立的 Full-file Blame Reader，以便按 commit block 阅读整文件历史且软换行不丢失归属。
- **US-004**：作为需要共享上下文的开发者，我希望选择、复制或结构化导出代码及 Blame 信息，以便放入 Issue、PR、评审记录或 AI 提示。
- **US-005**：作为在源文件与历史视图间工作的开发者，我希望两者按行号双向跳转并保留当前行，以便快速往返定位。
- **US-006**：作为使用键盘、屏幕阅读器或高对比主题的开发者，我希望 Reader 的文字、焦点和状态可访问，以便不依赖颜色或鼠标完成工作。
- **US-007**：作为打开大型文件的开发者，我希望 Reader 控制 DOM 和 Git 请求规模，以便阅读和复制不会因文件大小失控。

## 4. 验收合同

| ID     | 前置条件                                                        | 动作或事件                                           | 可观察结果                                                                                                                         | 验证接缝                                                |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| AC-001 | 已打开受信任 Git 文件                                           | 开启或关闭 Normal Editing Mode                       | 源码 x 坐标、selection、word wrap breakpoint、indent guides、rulers、horizontal scrolling 均保持不变；不存在 Blame 文本 decoration | Extension presentation 单测、VS Code E2E 与反向代码扫描 |
| AC-002 | 光标位于已有 blame 的 logical line                              | 移动光标                                             | Status Bar 显示日期、作者、短 SHA；Hover 首屏按价值顺序显示作者、日期、SHA、摘要                                                   | Status Bar/Hover 稳定接缝测试                           |
| AC-003 | 当前行属于 committed commit block                               | 开启当前 commit 高亮                                 | 仅改变相关 logical source lines 的背景视觉，不插入文字、不改变宽度                                                                 | Decoration renderer 单测与 E2E                          |
| AC-004 | 文件可执行 blame 且行数在上限内                                 | 打开 Full-file Reader                                | 独立 Webview Editor Tab 以 `HEAD` 展示完整源文本、日期、作者、SHA、摘要、行号和连续 commit blocks                                  | Panel/controller 集成测试与 E2E                         |
| AC-005 | Reader 存在长 logical line                                      | 调整 Reader 宽度或缩放                               | soft wrap 只发生在 code 区；一条 logical line 仍只有一个 line number 和一个 Blame 归属                                             | Core model 测试、Webview 渲染测试与手动矩阵             |
| AC-006 | 文件行归属为 A,A,B,A,A                                          | 构建 Reader model                                    | 生成 A:1-2、B:3、A:4-5 三个连续 blocks                                                                                             | Core builder 单测                                       |
| AC-007 | Reader 已加载任意文本                                           | 鼠标/键盘选择、Ctrl/Cmd+C、Ctrl/Cmd+A、跨 block 拖选 | 日期、作者、SHA、摘要和源码均为标准可选择文本，复制结果保持原始字符                                                                | Webview DOM/交互测试与手动 E2E                          |
| AC-008 | Reader 选中或悬停某行                                           | 执行 Copy Code/Copy Line With Blame                  | 剪贴板分别得到纯源码或明确的日期/作者/短 SHA/行号/源码格式                                                                         | Copy formatter 单测、Gateway/Clipboard 集成测试         |
| AC-009 | Reader 中存在 commit block                                      | 执行 Copy SHA/Info/Block Code/Block With Blame       | 剪贴板得到对应 block 的完整、可预测文本；不弹 Modal，仅有轻量成功反馈                                                              | Copy protocol 单测与 E2E                                |
| AC-010 | Reader 已加载模型，可能启用虚拟化                               | 执行 Copy All Code/Copy All With Blame               | 输出来自 Host model 而非当前 DOM，包含完整文件且保留空格、tab、Unicode 和行尾语义                                                  | Core export 单测与大文件集成测试                        |
| AC-011 | Reader 从源编辑器某行打开                                       | Reader ready                                         | 自动滚动并高亮原始当前行，顶部/详情显示其 commit metadata                                                                          | Panel controller 集成测试与 E2E                         |
| AC-012 | Reader 已显示任意 source line                                   | 单击、Enter、双击或 Open Source                      | 源编辑器打开并选择同一 logical line，且 reveal 到该行                                                                              | Navigation controller 测试与 E2E                        |
| AC-013 | Reader 已加载，源文档发生修改                                   | 修改、保存或显式 Refresh                             | 修改后显示 stale；cursor/scroll/selection/copy 不触发 blame；保存或显式 Refresh 才重新查询                                         | 生命周期单测与 E2E                                      |
| AC-014 | Webview 发送未知/越界/过期消息                                  | Host 接收消息                                        | 消息被拒绝或返回稳定错误，不访问错误行、不复制错误内容、不执行导航                                                                 | Message contract 单测                                   |
| AC-015 | Reader 文件未跟踪、非仓库、空文件、超限或 workspace 不受信任    | 打开 Reader                                          | 显示稳定不可用/权限状态，不展示伪造 blame 或全零 SHA 主 UI                                                                         | Handler/adapter 测试与 E2E                              |
| AC-016 | 文件超过 5,000 logical lines 但未超过 maxLines                  | 打开 Reader、滚动、复制全部                          | 采用 logical line/block 虚拟化；滚动不重复 Git blame；Copy All 仍完整                                                              | Webview 性能测试与大文件集成测试                        |
| AC-017 | Reader 已打开                                                   | 使用 Ctrl/Cmd+F 并输入文本                           | 搜索源码并定位匹配 logical line，不解析 HTML，不改变源文本                                                                         | Webview 交互测试与 E2E                                  |
| AC-018 | Reader 在 Light、Dark 或 High Contrast 主题及 100/125/150% zoom | 阅读、选择、导航                                     | 使用 VS Code CSS variables；文本、焦点、状态不重叠、不截断，颜色不是唯一语义                                                       | 手动 UI 矩阵与截图/审查 Evidence                        |
| AC-019 | Reader 打开或销毁、请求取消或刷新                               | 触发对应生命周期                                     | 监听器、Panel、AbortController、Timer 和 session 引用完整释放，无悬挂 Promise                                                      | Controller/adapter 资源测试                             |
| AC-020 | Reader 中有 commit SHA                                          | 点击 SHA/Commit Detail                               | 显示完整 commit detail，并提供 Copy SHA、Copy Info、Open Commit、Previous Revision 等明确动作                                      | Message/command 集成测试与 E2E                          |

## 5. 范围

### IN

- Normal Editing Mode 止血改造、当前行 Status Bar、Hover、commit 高亮。
- `createWebviewPanel` 形式的 Full-file Blame Reader，`HEAD` revision。
- Host 生成纯 Reader model、logical line、连续 commit block、未提交行投影。
- 原生文本选择、键盘导航、源码搜索、双向行导航。
- 结构化单行、block、commit 和整文件复制。
- stale/refresh 生命周期、取消、超时、资源清理、虚拟化和可访问性。
- 中英文国际化文案与必要配置。

### REUSE

- `<Path>src/core/domains/git-blame/</Path>` 中的 Git Blame 数据模型、Handler、边界校验和历史能力。
- `<Path>src/extension/adapters/git/git-blame-port-adapter.ts</Path>` 的 porcelain blame 查询和受信任工作区校验。
- `<Path>src/extension/presentation/git-blame-hover-provider.ts</Path>` 的现有 Hover 操作语义。
- `<Path>src/extension/presentation/git-review-panel-controller.ts</Path>`、`<Path>src/extension/presentation/git-review-panel-html.ts</Path>` 和 `<Path>src/extension/adapters/vscode-webview-message-adapter.ts</Path>` 的 Panel、CSP、消息验证、取消和资源清理模式。
- `<Path>src/extension/bootstrap/create-extension-runtime.ts</Path>` 的唯一组合根和 `<Path>src/core/orchestration/</Path>` 的 `ToolboxGateway`。
- `<Path>src/extension/adapters/vscode-clipboard-adapter.ts</Path>` 的 Clipboard Port 适配器。

### OUT

- **OOS-001**：Custom Text Editor；等待 Reader MVP 稳定后另行评估。
- **OOS-002**：完整语法高亮和语言解析器。
- **OOS-003**：`author:`, `date:`, `commit:` 高级查询语法。
- **OOS-004**：任意 revision selector、全量历史分页和可配置复制模板。
- **OOS-005**：任何修改源文件、Git index 或工作树的操作。

## 6. 已锁定实现约束

- **DEC-001**：原生编辑器不得通过 Blame 文字 decoration 改变源码布局；来源：当前 change `ADR-001`、用户设计方案。
- **DEC-002**：Reader 使用公开 `vscode.window.createWebviewPanel(...)`；来源：当前 change `ADR-001`、永久 `<Path>{roots.state}/specdev/adr/0001-aggregate-diff-webview.md</Path>`。
- **DEC-003**：Extension Host 生成纯数据模型，Webview 仅渲染和交互；来源：当前 change `ADR-002`、永久 ADR-001。
- **DEC-004**：Reader 以 logical line 和连续 commit block 为布局单位；来源：当前 change `ADR-003`。
- **DEC-005**：结构化复制必须经过验证消息、`ToolboxGateway` 和 Clipboard Port；来源：当前 change `ADR-004`、仓库架构规则。
- **DEC-006**：文本必须原样保真且可选择复制；来源：当前 change `ADR-005`、用户设计方案。

## 7. 数据、接口与兼容

- **公共接口变化：** 增加版本化 Reader 命令与 Webview message/model contracts；现有 Git Blame、Line History、Commit Changes 和公开 Extension API 保持兼容。
- **数据模型与持久化：** 不新增持久化数据；Reader model 只存在于 session 内，包含 source URI、revision、lineCount、blocks 和 generation。
- **兼容要求：** 保留现有 Hover、行历史、提交变更和提交 SHA 复制；删除 fake gutter 属于 V2 行为替换，不保留 legacy 模式。
- **迁移要求：** 先建立 Reader/新配置和命令，再迁移 Presentation；旧 fake gutter 调用点验证为零后删除。
- **发布或运维影响：** 需要重新构建 Webview 和 VSIX；不执行远程、生产或部署动作。

## 8. 非功能要求

- **NFR-001 安全与隐私：** 验证所有 Git、URI、路径、revision、行号、blockId 和 Webview 消息；不记录源码全文、秘密或非必要个人信息；沿用 Workspace Trust。
- **NFR-002 性能与容量：** 使用现有 `maxLines` 保护；不超过 5,000 logical lines 时可完整渲染，超过后按 logical line/block 虚拟化；Copy All 不依赖 DOM；scroll/copy/selection 不触发 Git blame。
- **NFR-003 可用性与可靠性：** Reader 使用 VS Code CSS variables，支持文本选择、键盘导航、搜索、stale/refresh、双向定位、取消和完整 dispose。
- **NFR-004 可观测性与运营：** 记录命令失败、取消、超时和不可用原因的摘要，不记录源码、token、Cookie、私钥或完整 Git 输出。

## 9. 验证策略

| 接缝                                    | 层级                        | 覆盖合同                                       | 现有先例或命令                                                                                                                                        | Evidence 类型               |
| --------------------------------------- | --------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Reader model builder/copy formatter     | Core 稳定单元接缝           | AC-005、AC-006、AC-008、AC-009、AC-010、AC-015 | `<Path>src/core/domains/git-blame/*test.ts</Path>`、`pnpm test:unit -- --run`                                                                         | 测试输出和模型快照          |
| Git blame adapter/Handler               | Extension/Core 集成接缝     | AC-004、AC-013、AC-015                         | `<Path>tests/integration/git-blame-repository.integration.test.ts</Path>`、`<Path>tests/integration/git-blame-annotations.integration.test.ts</Path>` | 集成测试                    |
| Reader message contract/Host controller | Extension presentation 接缝 | AC-007、AC-011、AC-012、AC-014、AC-019、AC-020 | `<Path>src/extension/presentation/*test.ts</Path>`、`<Path>src/core/contracts/webview-message-contract.test.ts</Path>`                                | 单元/集成测试               |
| Webview DOM and interaction             | Webview 稳定 UI 接缝        | AC-005、AC-007、AC-009、AC-016、AC-017、AC-018 | `<Path>src/webview/git-review/*.test.tsx</Path>` 先例、`pnpm test:unit`                                                                               | DOM/交互测试                |
| VS Code user workflow                   | E2E/manual                  | AC-001..AC-020                                 | `pnpm test:integration` 加手动主题、缩放、选择矩阵                                                                                                    | 截图、剪贴板结果和 E2E 日志 |
| Static and dependency gates             | 项目级门禁                  | 全部回归风险                                   | `pnpm typecheck`、`pnpm lint`、`pnpm lint:dependencies`、`pnpm lint:unused`、`pnpm build`、`pnpm check`                                               | 命令结果                    |

## 10. 风险、假设与未决问题

### 风险

- 原生编辑器布局恢复和 Reader 新增 UI 同时变更，可能造成命令、状态和旧测试回归。
- 大文件虚拟化、软换行和原始文本复制之间可能出现字符或定位偏差。
- Webview 消息、Panel 生命周期和源编辑器生命周期可能产生过期请求或资源泄漏。
- VS Code 手动主题、缩放、屏幕阅读器和物理复制验证不能完全由现有单元测试替代。

### 已采用的低影响假设

- V2.0 的 revision 固定为 `HEAD`；接口保留 revision 字段，未来扩展时由新 Spec 决定。
- 5,000 logical lines 作为初始虚拟化阈值；若基线性能测试显示不适用，由实现阶段记录偏差并回到本 Spec。
- Copy All 默认使用 UTF-8 文本和稳定换行格式；源码行内容本身不改写。
- 普通 Goal Plan 由当前实现者顺序或按路径隔离执行，不启用 Agent 委派。

### 未决问题

无。
