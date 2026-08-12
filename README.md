# vscode-toolbox-namewta

![vscode-toolbox-namewta logo](./media/icon.png)

面向代码阅读、变更审核和日常定位的 VS Code 开发者工具箱。它把精确的代码引用、逐文件 Git Blame 和聚合 Git Review 放在编辑器与 Source Control 的原生工作流里，命令、配置和资源生命周期保持可预测。

[![CI](https://github.com/NAMEWTA/vscode-toolbox-namewta/actions/workflows/ci.yml/badge.svg)](https://github.com/NAMEWTA/vscode-toolbox-namewta/actions/workflows/ci.yml)
[![最新 Release](https://img.shields.io/github/v/release/NAMEWTA/vscode-toolbox-namewta?label=release)](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases)
[![许可证](https://img.shields.io/badge/license-MIT-79d7e7.svg)](./LICENSE)

## 适合什么场景

如果你经常在编辑器、终端和 Git 客户端之间切换，这个扩展提供三条紧凑的路径：

| 能力           | 解决的问题                                               | 入口                                                 |
| -------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Copy Reference | 把当前文件、选区或 Explorer 资源转成可粘贴的代码位置引用 | 编辑器、行号、Explorer 右键菜单                      |
| Git Blame      | 查看当前行来源，并在独立 Reader 中阅读完整文件历史       | 编辑器行号右键、命令面板、`Ctrl+Alt+B` / `Cmd+Alt+B` |
| Git Review     | 在一个聚合视图中按冲突、暂存和未暂存分层审核变更         | Source Control 标题栏                                |

扩展不替换 Git，不修改提交历史，也不要求安装其他 Git 扩展。

## 安装

当前版本为 `0.1.6`。项目暂不发布到 VS Code Marketplace，请从 [GitHub Releases](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases) 下载对应的 `vscode-toolbox-namewta-<version>.vsix`。

在 VS Code 中打开命令面板，执行 **Extensions: Install from VSIX...**，选择下载的 VSIX。安装完成后重新加载窗口；命令面板中应能看到以 `toolbox-` 开头的命令。

## 快速开始

1. 在 VS Code 中打开一个文件夹，并在需要 Git 能力的工作区选择 **Trust**。
2. 在编辑器中打开任意文件，右键选择 `toolbox-复制相对引用`，把结果粘贴到 Issue、Review 或提交信息中。
3. 对已提交文件执行 `toolbox-切换 Git Blame 注解` 查看当前行信息，或执行 `toolbox-打开完整文件 Blame 阅读器` 阅读整文件历史。
4. 在 Source Control 标题栏点击 Git Compare 图标，执行 `toolbox-开始审核 Git 变更`。

成功标志：Copy Reference 写入剪贴板；Git Blame 不改变源码布局，完整历史在独立 Reader 中呈现；Git Review 在单个编辑器标签页中显示变更队列。

## 核心能力

### Copy Reference

- 活动编辑器的空选区复制一基行号，例如 `` `src/main.ts:12` ``。
- 单行字符选区复制列范围，例如 `` `src/main.ts:12(5-9)` ``。
- 跨行选区复制行范围，例如 `` `src/main.ts:12-18` ``。
- Explorer 支持单个或多个资源，多个资源保持用户选择顺序。
- 相对引用以工作区根为基准；绝对引用保留平台路径，但会移除 URI 的 query 和 fragment。
- 支持可稳定表示的虚拟资源；Untitled 文档和不具备稳定路径的资源不会生成引用。

### Git Blame

- 必须由用户对具体文档显式开启，不会在扩展激活时扫描仓库或启动 Git。
- Status Bar 和 Hover 显示当前行的作者、提交时间、短 SHA 与摘要，不向源码插入文字。
- 可选的当前提交高亮只改变整行背景，不改变源码起点、选择、软换行或水平滚动。
- Hover 提供完整提交元数据、复制 hash、受限 remote 链接、提交 Diff、上一版本和增量 Line History。
- Full-file Blame Reader 按连续 commit block 展示完整源码、行号与归属信息，支持搜索、键盘导航和八类结构化复制。
- 超过 5,000 logical lines 时 Reader 使用虚拟化，Copy All 始终从 Extension Host 的完整模型生成。

### Git Review

- 从 Source Control 标题栏进入，在一个聚合编辑器中从上到下审核全部变更。
- 冲突、已暂存、未暂存和未跟踪内容分层展示；同一路径的 staged/unstaged 变更保持独立。
- 每个条目支持打开文件、打开原生 Diff、复制引用、标记已审核和跳过。
- 适用时提供 Stage、Unstage、确认后的 Discard 和 Merge Changes；Discard 始终逐文件二次确认。
- 聚合 patch 单项限制为 8 MiB，最多同时加载两个文件；面板关闭或状态变化时会取消旧请求。

## 配置

所有配置键都以 `vscodeToolboxNamewta.` 开头，可在 Settings JSON 中调整：

| 配置                              | 默认值  | 作用                                             |
| --------------------------------- | ------- | ------------------------------------------------ |
| `logging.level`                   | `info`  | 扩展输出日志级别                                 |
| `webview.requestTimeoutMs`        | `10000` | Webview 请求超时，范围 `1000-120000` ms          |
| `gitBlame.highlightCurrentCommit` | `false` | 是否高亮当前提交                                 |
| `gitBlame.ignoreWhitespace`       | `false` | 计算 Blame 时忽略空白变化                        |
| `gitBlame.maxLines`               | `20000` | 允许显示 Blame 的最大文档行数，范围 `100-200000` |

## 信任与资源边界

- Copy Reference、工具箱 UI 和运行时信息可在受限工作区使用。
- Git Blame 和 Git Review 只在受信任工作区运行，并要求 Extension Host 能映射到可执行 Git 的仓库。
- 远程工作区由远程 Extension Host 的实际路径和 Git 环境决定。
- 扩展不会记录秘密、令牌、Cookie、私钥或源码全文；日志只记录诊断所需的最小信息。
- Git Blame 和 Git Review 不修改 Git index、工作树、分支或远程状态。

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

修改前请阅读 [AGENTS.md](./AGENTS.md)、[架构总览](./docs/architecture/overview.md) 和相关 `docs/rules/` / ADR。新行为先增加测试，再运行 `pnpm check`；涉及 VS Code 宿主或发布时运行 `pnpm check:ci`。

提交信息使用简洁的 Conventional Commits 风格。发布由 GitHub Actions 执行：推送与 `package.json` 版本严格一致的 `v<version>` 标签后，工作流会重新运行完整门禁并创建 GitHub Release 上传 VSIX。项目不发布到 Marketplace 或 npm。

## 许可证

MIT，详见 [LICENSE](./LICENSE)。法律效力以许可证英文原文为准；仓库同时提供 [中文参考译文](./LICENSE.zh-CN.md)。

## 相关链接

- [GitHub Releases](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases)
- [问题反馈](https://github.com/NAMEWTA/vscode-toolbox-namewta/issues)
- [安全策略](./SECURITY.md)
- [贡献指南](./CONTRIBUTING.md)
- [第三方声明](./THIRD_PARTY_NOTICES.md)
