# VS Code 扩展开发规范

## 激活与入口

- `src/extension/extension.ts` 必须保持薄，只调用 Composition Root。
- 仅通过 Manifest 贡献命令懒激活；禁止 `*`、`onStartupFinished` 和无必要扫描。
- 激活时禁止扫描工作区、启动子进程、创建 Webview、访问网络或建立 Timer。
- 所有注册对象必须进入 `context.subscriptions` 或 Runtime 的 `dispose()`。

## API 与贡献点

- 只使用公开稳定 VS Code API；禁止 `_workbench.*` 和以下划线开头的私有命令。
- Manifest 命令 ID 与代码常量必须一致。
- 用户可见 Manifest 文案使用 `package.nls*.json`。
- 运行时文案使用 `vscode.l10n.t`，日志与用户提示分离。

## 工作区能力

- 基座在受限和虚拟工作区中提供安全的 System Info 与 UI。
- 未来执行代码、Git、Shell、任务或本地文件危险操作的领域必须在代码层检查 `workspace.isTrusted`。
- 远程工作区中的工作区型扩展应在远程 Extension Host 执行。
- 文件、URI 和选择等 VS Code 对象必须在适配层转换，不进入 Core 契约。

## Webview 安全与生命周期

- 仅在命令执行后创建。
- 必须限制 `localResourceRoots`、启用 nonce CSP、禁用远程脚本和 `unsafe-eval`。
- Panel 被关闭后必须取消请求、释放监听器并清空引用。
- `retainContextWhenHidden` 默认关闭，除非有测量和 ADR 支持。
