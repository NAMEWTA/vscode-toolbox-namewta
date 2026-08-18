# AGENTS.md

## 仓库用途

本仓库是单一 VS Code 开发者工具合集插件的可复用基座，采用模块化单体架构。它不是独立 Web 产品、服务端、Electron 应用或 Monorepo。当前“系统信息”业务域只用于端到端验证架构。

## 修改前必须阅读

修改代码前依次阅读：

1. `docs/rules/00-governance-and-fixed-defaults.md`
2. `docs/rules/01-project-scope-and-fixed-stack.md`
3. `docs/rules/03-project-architecture-and-directory-layout.md`
4. 与本次修改相关的规则文档
5. `speculo/.speculo/specdev/context/overview.md`
6. `speculo/.speculo/specdev/adr/` 中相关 ADR

用户明确决定和平台硬约束优先于仓库默认规则。不得重复询问这些文档已经回答的问题。

## 架构边界

- `src/core/**` 禁止导入 `vscode`、React、Node 内置模块、DOM API、扩展宿主代码或 Webview 代码。
- `src/webview/**` 禁止导入 `vscode`、`node:*` 或 `src/extension/**`。
- `src/extension/**` 负责把 VS Code 与 Node 能力适配为 Core Port。
- 业务域不得深层导入其他业务域；跨域场景必须使用业务域 `public-api.ts` 和明确的编排工作流。
- `create-extension-runtime.ts` 是唯一组合根。禁止新增服务定位器或全局可变容器。
- 每个业务操作都必须经过类型化 `ToolboxGateway`。
- `activate()` 只返回版本化公共 API，禁止暴露 Registry、Panel、适配器或可变内部对象。

## 中文规则

- 所有新增或修改的源码注释、JSDoc、Markdown 文档、ADR、开发说明和脚本注释必须使用中文。
- 注释解释 WHY，不逐行翻译代码。
- 代码标识符、命令 ID、配置键、文件路径、第三方工具名和协议固定字段保持原始英文。
- 官方许可证原文必须保留；中文译文只能标记为参考译文。
- 用户可见文案必须通过 VS Code 对应国际化机制维护，不得以“中文注释规则”为理由破坏多语言能力。

## 命名与结构

- 目录和普通 TypeScript 文件使用 kebab-case。
- React 业务组件使用 PascalCase `.tsx`。
- 文件名必须表达业务域和职责。禁止新增 `utils.ts`、`helpers.ts`、`common.ts`、`misc.ts`、全局 `types.ts` 或全局 `constants.ts`。
- 小型业务域优先局部平铺；只有形成稳定子领域或独立生命周期时才增加子目录。
- 默认使用命名导出。`index.ts` 只能作为有意设计的包或业务域公共边界。

## 常用命令

```bash
corepack enable pnpm
pnpm install
pnpm dev
pnpm check
pnpm test:integration
pnpm package:list
pnpm package:vsix
```

`pnpm check:ci` 是本地发布候选完整门禁。

## 修改流程

1. 确认运行边界和业务域。
2. 定义可观察行为、契约、失败模型、信任要求和清理要求。
3. 新增或更新测试；缺陷修复先增加失败的回归测试。
4. 实现最小且职责明确的代码。
5. 公共行为或架构发生变化时，同步更新中文文档、国际化资源、配置和 ADR。
6. 运行所有适用门禁，并如实报告结果。

## 硬性禁止事项

- 禁止为了让 CI 通过而关闭 TypeScript 严格模式、核心 ESLint 规则、覆盖率、依赖规则或测试。
- 禁止让 `any` 进入公共 API。
- 禁止使用 VS Code 私有命令或 `_workbench.*` 命令。
- 禁止执行拼接后的 Shell 字符串；未来进程适配器必须使用参数数组，并支持超时与取消。
- 禁止在扩展激活阶段创建 Webview。
- 禁止在未验证边界输入的情况下信任 Webview、JSON、配置、URI、路径、Git 或其他外部数据。
- 禁止遗留未释放的监听器、Timer、进程、AbortController、Panel 或待处理 Promise。
- 禁止记录秘密、源码全文、令牌、Cookie、私钥或非必要个人信息。
- 禁止提交英文源码注释或英文开发文档；技术固定语法与官方许可证原文除外。

## 完成报告

每个实质性任务必须报告：

- 创建或修改的关键文件；
- 架构决定与偏离；
- 实际执行的命令；
- 每项质量门禁结果；
- 适用时生成的 VSIX 路径；
- 显式占位项和剩余风险。

禁止声称未执行的检查已经通过。

<SPECULO>
## Speculo 运行时配置

### 初始化状态检查

运行时必须读取以下文件以确认 Speculo 初始化状态：

- ./speculo/.speculo/workspace.json — 工作区根别名配置
- ./speculo/config.json — 项目配置文件

若上述文件不存在或内容为空，说明项目尚未完成 Speculo 初始化。
此时必须提示用户：请先运行 speculo init 完成初始化配置。

### 工作流入口（强制读取）

初始化时已选择以下工作流，运行时必须强制读取对应入口文件：

- `./speculo/workflows/specdev/INDEX.md`
  </SPECULO>
