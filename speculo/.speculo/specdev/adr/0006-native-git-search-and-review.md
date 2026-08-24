# ADR-0006：共享原生 Git Changes 呈现与全 refs 搜索

- **状态：** Accepted
- **日期：** 2026-08-24
- **来源：** `2026-08-24-git-navigation-and-native-review` 的 `ADR-001`
- **取代：** `0001-aggregate-diff-webview.md`

## 背景

Git Compare 从 SCM 标题入口启动时丢弃仓库上下文，QuickPick 又只过滤已载入的 HEAD 分页，因此可见分支节点仍可能搜不到。Git Review 同时维护一套独立 React 聚合 Diff，文件标题、折叠和导航行为与 Compare 的原生 Changes 不一致。

## 决策

1. Compare 与 Review 共享验证 SCM 参数的仓库解析器；命令上下文优先于活动编辑器和工作区发现。
2. Compare 默认浏览保留 HEAD 拓扑分页，输入搜索通过 typed Gateway 查询 `--all` 提交消息以及本地、远端和标签 ref 名；SHA 前缀仍使用受限对象号解析。
3. Compare 与 Review 共享 `VscodeNativeChangesPresenter`，只调用公开 `vscode.changes`。
4. Review 资源按 `layer/path` 标识，token URI 不暴露仓库根或 content identity；HEAD、index 与 worktree 内容由既有 Git adapter 延迟读取。
5. 删除 Review React Webview、结构化 patch 读取命令和专用依赖；Stage、Unstage、Discard 迁移到队列条目命令并重新验证当前 session identity。
6. Relative / Absolute Reference 固定使用 `Ctrl/Cmd+Alt+C` 与 `Ctrl/Cmd+Alt+V`；foundation 快捷键合同同步更新，并继续禁止 Git Review 默认快捷键。

## 后果

原生 Changes 的折叠、文件导航与单文件 Diff 交互由 VS Code 统一维护。搜索、文档 provider、Timer、进程和会话刷新都必须支持取消与代际隔离。原生宿主布局不能由扩展 CSS 定制，因此真实 Extension Host 验证是发布门禁的一部分。
