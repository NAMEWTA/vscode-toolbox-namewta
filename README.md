# vscode-toolbox-namewta

![vscode-toolbox-namewta logo](./media/icon.png)

面向代码阅读、变更审核和日常定位的 VS Code 开发者工具箱。它把精确的代码引用、逐文件 Git Blame 和聚合 Git Review 放在编辑器与 Source Control 的原生工作流里，命令、配置和资源生命周期保持可预测。

[![CI](https://github.com/NAMEWTA/vscode-toolbox-namewta/actions/workflows/ci.yml/badge.svg)](https://github.com/NAMEWTA/vscode-toolbox-namewta/actions/workflows/ci.yml)
[![最新 Release](https://img.shields.io/github/v/release/NAMEWTA/vscode-toolbox-namewta?label=release)](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases)
[![许可证](https://img.shields.io/badge/license-MIT-79d7e7.svg)](./LICENSE)

## 适合什么场景

如果你经常在编辑器、终端和 Git 客户端之间切换，这个扩展提供四条紧凑的路径：

| 能力               | 解决的问题                                               | 入口                                                 |
| ------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| Copy Reference     | 把当前文件、选区或 Explorer 资源转成可粘贴的代码位置引用 | 右键菜单、`Ctrl/Cmd+Alt+C` / `Ctrl/Cmd+Alt+V`        |
| Git Blame          | 查看当前行来源，并在独立 Reader 中阅读完整文件历史       | 编辑器行号右键、命令面板、`Ctrl+Alt+B` / `Cmd+Alt+B` |
| Git Review         | 在原生多文件 Changes 中分层审核当前工作树变更            | Source Control 标题栏                                |
| Git Commit Compare | 选择或输入两个 commit，查看有明确方向的完整快照差异      | Source Control 标题栏                                |

扩展不替换 Git，不修改提交历史，也不要求安装其他 Git 扩展。

## 安装

当前开发版本为 `0.1.12`。项目暂不发布到 VS Code Marketplace，请从 [GitHub Releases](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases) 下载对应的 `vscode-toolbox-namewta-<version>.vsix`。

在 VS Code 中打开命令面板，执行 **Extensions: Install from VSIX...**，选择下载的 VSIX。安装完成后重新加载窗口；命令面板中应能看到以 `toolbox-` 开头的命令。

## 快速开始

1. 在 VS Code 中打开一个文件夹，并在需要 Git 能力的工作区选择 **Trust**。
2. 在编辑器中打开任意文件，右键选择 `toolbox-复制相对引用`，把结果粘贴到 Issue、Review 或提交信息中。
3. 对已提交文件执行 `toolbox-切换 Git Blame 注解` 查看当前行信息，或执行 `toolbox-打开完整文件 Blame 阅读器` 阅读整文件历史。
4. 在 Source Control 标题栏点击 Git 比较图标，先选择基准提交，再选择目标提交。
5. 需要审核工作树变更时，在 Source Control 标题栏执行 `toolbox-开始审核 Git 变更`。

成功标志：Copy Reference 写入剪贴板；Git Blame 只添加可关闭的行首注解，不修改源码内容，完整历史在独立 Reader 中呈现；Git Compare 在原生多文件比较中显示明确的两个端点；Git Review 在原生多文件 Changes 中显示当前工作树变更，并在 Review Queue 中提供审核与变更操作。

## 核心能力

### Copy Reference

- 活动编辑器的空选区复制一基行号，例如 `` `src/main.ts:12` ``。
- 单行字符选区复制列范围，例如 `` `src/main.ts:12(5-9)` ``。
- 跨行选区复制行范围，例如 `` `src/main.ts:12-18` ``。
- Explorer 支持单个或多个资源，多个资源保持用户选择顺序。
- 相对引用以工作区根为基准；绝对引用保留平台路径，但会移除 URI 的 query 和 fragment。
- 支持可稳定表示的虚拟资源；Untitled 文档和不具备稳定路径的资源不会生成引用。
- `Ctrl/Cmd+Alt+C` 复制相对引用，`Ctrl/Cmd+Alt+V` 复制绝对引用；快捷键在可稳定表示的活动编辑器和 Explorer 文件、文件夹或多选资源中生效。

### Git Blame

- 必须由用户对具体文档显式开启，不会在扩展激活时扫描仓库或启动 Git。
- 编辑器行首使用固定宽度的日期、作者与可选版本编号列，并以窄色条表达提交时间；连续提交块可只在首行显示元数据。
- Status Bar 显示当前行的作者、提交时间与短 SHA；Hover 只在行首注解位置出现，提供完整提交元数据、复制 hash、受限 remote 链接、提交 Diff、上一版本和增量 Line History。
- 可选的当前提交高亮只改变整行背景，不改变源码起点、选择、软换行或水平滚动。
- Full-file Blame Reader 将 Blame 与 Code 分成两个独立的原生文本选择区；同一提交在两列使用一致背景，相邻提交同时由高区分度颜色和块边界分隔。
- Reader 每个连续提交块只显示一次短 SHA 与摘要；info 图标在 Reader 内打开可键盘操作的提交详情模态，不再触发 VS Code 通知。
- Reader 不再用复制按钮或整行点击驱动操作；在任一列直接拖选后使用系统 `Ctrl/Cmd+C`，只有显式图标会打开源码行或提交详情。
- 大文件保留完整 logical line DOM，并使用浏览器离屏绘制抑制来维持跨屏原生选择。

### Git Review

- 从 Source Control 标题栏进入，直接复用与 Git Commit Compare 相同的 VS Code 原生 Changes 多文件界面。
- 冲突、已暂存、未暂存和未跟踪内容按 `layer/path` 标题区分；同一路径的 staged/unstaged 变更保持独立。
- HEAD、index 与 worktree 内容在原生 Diff 打开时延迟读取；刷新库存会取消旧请求并使旧文档 token 失效。
- Review Queue 保留上一项、下一项、标记已审核和跳过；条目上下文提供 Stage、Unstage 与确认后的 Discard。

### Git Commit Compare

- 从 Source Control 标题栏的 Git 比较图标进入；SCM 命令上下文仓库优先于活动编辑器，无法唯一确定时再选择仓库。
- 第一步选择基准端，第二步选择目标端；目标端默认激活当前 `HEAD`，标题始终显示 `base → target` 方向。
- 两端都可以从分页提交历史中选择；输入至少两个字符会搜索当前仓库全部本地/远端分支和标签可达提交的消息与 ref 名。已知提交编号时，输入 4 到 64 位十六进制 SHA 前缀，再选择对应项。
- 加载更多只扩展当前列表；第二步可返回重新选择基准端，取消会终止未完成的 Git 请求。
- 完成选择后使用 VS Code 原生多文件更改视图一次显示全部文件，并在标题中显示两个短 SHA、文件数和增删统计；从列表可继续打开单文件原生 Diff。
- 新增、删除和重命名保留正确的前后路径；二进制、子模块和过大文件使用包含端点的只读摘要。
- 比较严格读取用户所选的两个 commit 快照，不自动计算 merge-base，也不包含工作树或 index，更不会修改分支、远程或任何 Git 状态。

## 配置

所有配置键都以 `vscodeToolboxNamewta.` 开头，可在 Settings JSON 中调整：

| 配置                              | 默认值  | 作用                                             |
| --------------------------------- | ------- | ------------------------------------------------ |
| `logging.level`                   | `info`  | 扩展输出日志级别                                 |
| `webview.requestTimeoutMs`        | `10000` | Webview 请求超时，范围 `1000-120000` ms          |
| `gitBlame.highlightCurrentCommit` | `false` | 是否高亮当前提交                                 |
| `gitBlame.dateFormatStyle`        | `Y/M/D` | 行首注解日期格式，可选绝对或相对时间             |
| `gitBlame.authorNameStyle`        | `full`  | 行首注解显示作者全名、名或姓                     |
| `gitBlame.showCommitNumber`       | `false` | 是否显示提交在仓库历史中的版本编号               |
| `gitBlame.mergeCommitLines`       | `false` | 同一提交连续出现时是否只在块首显示元数据         |
| `gitBlame.ignoreWhitespace`       | `false` | 计算 Blame 时忽略空白变化                        |
| `gitBlame.maxLines`               | `20000` | 允许显示 Blame 的最大文档行数，范围 `100-200000` |

## 信任与资源边界

- Copy Reference、工具箱 UI 和运行时信息可在受限工作区使用。
- Git Blame、Git Compare 和 Git Review 只在受信任工作区运行，并要求 Extension Host 能映射到可执行 Git 的仓库。
- 远程工作区由远程 Extension Host 的实际路径和 Git 环境决定。
- 扩展不会记录秘密、令牌、Cookie、私钥或源码全文；日志只记录诊断所需的最小信息。
- Git Blame 与 Git Compare 不修改 Git index、工作树、分支或远程状态；Git Review 只会在用户显式执行 Stage、Unstage 或确认后的 Discard 时修改 index 或工作树，不修改分支历史与远程状态。

## 开发

环境要求：Node.js 22 LTS、Corepack 和仓库固定的 pnpm 版本。

```bash
corepack enable pnpm
pnpm install
pnpm dev
```

使用 VS Code 打开仓库根目录并按 **F5**，选择 **运行扩展**。常用质量命令：

| 命令                    | 用途                                                 |
| ----------------------- | ---------------------------------------------------- |
| `pnpm check`            | 日常格式、Lint、类型、单元测试、覆盖率和生产构建门禁 |
| `pnpm test:integration` | 在真实 VS Code Extension Host 中运行集成测试         |
| `pnpm check:ci`         | 发布候选完整门禁并生成 VSIX                          |
| `pnpm package:list`     | 审核 VSIX 将包含的文件                               |
| `pnpm package:vsix`     | 在 `artifacts/` 生成 VSIX                            |

源码按运行边界组织：`src/core/` 不依赖 VS Code、Node、React 或 DOM；`src/extension/` 负责平台适配；`src/webview/` 运行在浏览器环境。所有业务操作经过类型化 `ToolboxGateway`，组合根为 `create-extension-runtime.ts`。

## 贡献与发布

修改前请阅读 [AGENTS.md](./AGENTS.md)、[架构总览](./speculo/.speculo/specdev/context/overview.md) 和相关 `docs/rules/` / ADR。新行为先增加测试，再运行 `pnpm check`；涉及 VS Code 宿主或发布时运行 `pnpm check:ci`。

提交信息使用简洁的 Conventional Commits 风格。发布由 GitHub Actions 执行：推送与 `package.json` 版本严格一致的 `v<version>` 标签后，工作流会重新运行完整门禁并创建 GitHub Release 上传 VSIX。项目不发布到 Marketplace 或 npm。

## 许可证

MIT，详见 [LICENSE](./LICENSE)。法律效力以许可证英文原文为准；仓库同时提供 [中文参考译文](./LICENSE.zh-CN.md)。

## 相关链接

- [GitHub Releases](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases)
- [问题反馈](https://github.com/NAMEWTA/vscode-toolbox-namewta/issues)
- [安全策略](./SECURITY.md)
- [贡献指南](./CONTRIBUTING.md)
- [第三方声明](./THIRD_PARTY_NOTICES.md)
