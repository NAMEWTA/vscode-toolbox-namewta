# 开发流程与 AI 执行规范

## 修改前

1. 必须阅读 `AGENTS.md`、本目录规则和相关 ADR。
2. 必须确认修改属于 Core、Extension Host 还是 Webview。
3. 必须寻找已有领域公共入口，禁止跨域深层导入。
4. 必须评估 Workspace Trust、虚拟工作区、远程环境和资源清理。

## 实施

- 新行为先定义可观察结果和失败模型。
- 缺陷修复优先先写失败的回归测试。
- 依赖通过 Composition Root 显式注入，不读取全局容器。
- 外部输入使用 `unknown` 并在边界验证。
- Promise 必须有归宿，监听器、Timer、进程和 Webview 必须释放。

## 完成门禁

至少运行：

```bash
pnpm format:check
pnpm lint
pnpm lint:dependencies
pnpm lint:unused
pnpm typecheck
pnpm test:coverage
pnpm build
```

涉及 VS Code 行为时继续运行：

```bash
pnpm test:integration
pnpm package:list
pnpm package:vsix
```

禁止通过跳过测试、降低覆盖率、关闭核心规则、扩大 `any`、删除检查或放宽严格配置获得表面通过。

## AI 完成报告

AI 必须列出关键改动、实际运行命令、每项结果、生成产物、显式占位项和未解决风险。不得声称未运行的检查已经通过。
