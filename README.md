# vscode-toolbox-namewta

这是一个模块化 VS Code 开发者工具扩展，提供代码位置引用复制和逐文档 Git Blame 工作流，同时保留类型化 Gateway 与 React Webview 基座。

所有业务操作都经过以下类型化调用链：

```text
VS Code 命令 / React Webview
        → 扩展宿主适配器
        → 类型化 ToolboxGateway
        → 领域处理器
        → 平台端口
        → 类型化结果
```

## 已包含能力

### Copy Reference

- 从活动编辑器复制相对或绝对代码引用，空选区包含一基行号，选区按单行或跨行格式输出。
- 从 Explorer 复制单个或多个资源；多项保持选择顺序。
- 支持可稳定表示的虚拟资源；绝对 URI 会移除 query 和 fragment。
- 只写入剪贴板，不提供 Paste 或跨域组合命令。

### Git Blame

- 对当前文档显式显示、隐藏、切换或刷新左侧日期/作者注解和 commit 热力条。
- 未保存编辑只保留可证明的旧归属，新增或不确定行显示为未提交。
- 已提交行 Hover 提供完整元数据、复制 hash、安全 remote 链接、提交单文件 Diff、上一版本和增量 Line History。
- 历史内容使用自有只读 URI 和公开 `vscode.diff`，不创建临时文件或依赖其他 Git 扩展。
- 每文档请求支持取消、10 秒超时、64 MiB 输出上限和 generation 防陈旧结果；默认拒绝超过 20,000 行的文档。

### 扩展基座

- 基于命令贡献点的 VS Code 懒激活。
- 精简的 `extension.ts` 与显式组合根（Composition Root）。
- 按业务域组织、与运行环境无关的 Core。
- 类型化的 `ToolboxGateway.execute(command, input)` 与能力发现。
- 由 `activate()` 返回的版本化扩展公共 API，供其他扩展调用。
- 使用 nonce、严格 CSP、VS Code 主题变量和类型化消息的 React Webview。
- Core、React 与扩展宿主测试基座。
- 使用 esbuild 构建扩展宿主与 Webview 产物。
- 严格 TypeScript、ESLint、Prettier、dependency-cruiser 与 Knip 质量门禁。
- 用于质量检查、集成测试和 VSIX 打包的 GitHub Actions。
- `docs/rules/` 下的完整仓库规范，以及 `AGENTS.md` 中的 AI 执行说明。
- 中文注释与中文开发文档约束。

## 环境要求

- VS Code 1.100 或更高版本。
- Node.js 22 LTS，用于开发、构建和打包。
- 已启用 Corepack。

扩展宿主 Bundle 以 Node 20 兼容语法为目标；当前开发与打包工具链需要 Node.js 22。

## 快速开始

```bash
npm install --global corepack@latest
corepack enable pnpm
pnpm install
pnpm dev
```

使用 VS Code 打开仓库，按 **F5**，选择 **运行扩展**。在新打开的扩展开发宿主中执行：

请直接打开本目录作为 VS Code 工作区根目录，避免加载上级目录而缺少本模板的 `.vscode/launch.json` 与任务配置。

- `vscode-toolbox-namewta: 打开工具箱`
- `vscode-toolbox-namewta: 显示运行时信息`
- `vscode-toolbox-namewta: 复制相对引用`
- `vscode-toolbox-namewta: 复制绝对引用`
- `vscode-toolbox-namewta: 切换 Git Blame 注解`
- `vscode-toolbox-namewta: 查看行历史`

Git Blame 必须由用户对具体文档显式开启；扩展激活时不会扫描仓库、启动 Git 或创建注解资源。默认快捷键仅分配给 Toggle：Windows/Linux 为 `Ctrl+Alt+B`，macOS 为 `Cmd+Alt+B`。

## 常用命令

| 命令                     | 用途                                    |
| ------------------------ | --------------------------------------- |
| `pnpm dev`               | 监听并重新构建扩展宿主与 Webview        |
| `pnpm clean`             | 清理构建、测试、打包与 VS Code 测试缓存 |
| `pnpm build`             | 生成生产构建产物                        |
| `pnpm typecheck`         | 检查全部 TypeScript 运行边界            |
| `pnpm lint`              | 执行带类型信息的 ESLint 规则            |
| `pnpm lint:dependencies` | 检查架构依赖边界                        |
| `pnpm lint:unused`       | 检测未使用文件、导出和依赖              |
| `pnpm test:unit`         | 运行 Core 与 React 单元测试             |
| `pnpm test:coverage`     | 运行测试并检查覆盖率阈值                |
| `pnpm test:integration`  | 在 VS Code 扩展宿主中运行集成测试       |
| `pnpm verify:foundation` | 检查基座结构、边界和中文文档规范        |
| `pnpm check`             | 运行日常完整质量门禁                    |
| `pnpm check:ci`          | 运行发布候选完整门禁                    |
| `pnpm package:list`      | 检查将进入 VSIX 的文件                  |
| `pnpm package:vsix`      | 在 `artifacts/` 中生成 VSIX             |

## 架构

```text
src/
├── core/       # 契约、编排、业务域与最小内核
├── extension/  # VS Code/Node 适配器、命令、表现层与启动装配
└── webview/    # React 浏览器运行环境与类型化消息客户端
```

Core 禁止导入 VS Code、React、Node 或 DOM API。Webview 禁止导入 VS Code 或扩展宿主代码。业务域禁止访问其他业务域的内部实现。

进一步阅读：

- `docs/architecture/overview.md`
- `docs/architecture/adding-a-domain.md`
- `AGENTS.md`
- `docs/rules/`

## 新增工具

1. 在 `src/core/domains/<domain>/` 中定义领域模型和最小 Port。
2. 在 `ToolCommandMap` 中增加 `<domain>.<action>`，并实现输入运行时验证。
3. 实现并测试类型化 Handler。
4. 在 `src/extension/adapters/` 中实现平台适配器。
5. 在 `register-domain-modules.ts` 中注册业务域。
6. 增加调用同一 Gateway 命令的原生 VS Code 入口或 React Webview 功能。
7. 更新中文文档、国际化资源、信任规则和测试。

禁止创建巨型工具箱服务，也禁止绕过 Gateway 直接调用领域实现。

## 配置项

- `vscodeToolboxNamewta.logging.level`
- `vscodeToolboxNamewta.webview.requestTimeoutMs`
- `vscodeToolboxNamewta.gitBlame.dateFormatStyle`
- `vscodeToolboxNamewta.gitBlame.authorNameStyle`
- `vscodeToolboxNamewta.gitBlame.mergeCommitLines`
- `vscodeToolboxNamewta.gitBlame.highlightCurrentCommit`
- `vscodeToolboxNamewta.gitBlame.ignoreWhitespace`
- `vscodeToolboxNamewta.gitBlame.maxLines`

## 工作区信任与虚拟工作区

Copy Reference、工具箱 UI 和“系统信息”命令可在受限工作区运行；全部 Git Blame 操作在代码层要求工作区信任，拒绝时不会启动 Git。

Copy Reference 支持可稳定表示的虚拟 URI。Git Blame 只接受扩展宿主可映射到本机或远程文件系统路径、且该宿主可执行 Git 的资源；远程工作区由远程 Extension Host 的实际路径和 Git 环境决定。Untitled 不支持引用复制，未跟踪文件静默不显示 Blame。

## 测试策略

- 单元测试与实现文件共置。
- React 组件和 Hook 使用 Vitest、jsdom 与 Testing Library 测试。
- 跨模块与 VS Code 行为测试集中在 `tests/integration/`。
- 缺陷修复优先先增加可稳定复现问题的回归测试。

## 安装与发布

当前发布身份为 `NAMEWTA`，扩展 ID 为 `NAMEWTA.vscode-toolbox-namewta`。请从 [GitHub Releases](https://github.com/NAMEWTA/vscode-toolbox-namewta/releases) 下载 `vscode-toolbox-namewta-<version>.vsix`，再在 VS Code 的 Extensions 视图中选择 **Install from VSIX...** 安装。

发布提交必须先通过：

```bash
pnpm check:ci
```

将通过门禁的 `main` 提交推送后，再推送与 `package.json` 版本严格一致的 `v<version>` 标签，例如 `v0.1.0`。GitHub Actions 会重新运行完整门禁，上传 Actions Artifact，并使用 `gh` 创建同名 GitHub Release 和 VSIX 附件。标签与清单版本不一致时工作流会失败，不会创建 Release。

本项目不发布到 VS Code Marketplace，且不保存 Marketplace 凭据；`package.json` 保持 `private: true`，禁止 npm 发布。由于首发前没有已安装版本，旧的 `developerToolbox.*` 命令、配置和扩展 ID 不提供兼容别名。

## 中文规范

- 所有源码注释、JSDoc、Markdown 文档、ADR 和开发说明必须使用中文。
- 代码标识符、命令 ID、配置键、API 名称和工具要求的固定语法保持英文。
- 官方许可证原文不得擅自翻译替换；仓库同时提供中文参考译文。

## 遥测

当前基座不采集遥测数据。

## 许可证

项目采用 MIT 许可证。法律效力以 `LICENSE` 中的英文原文为准，中文参考译文见 `LICENSE.zh-CN.md`，第三方声明见 `THIRD_PARTY_NOTICES.md`。
