---
schema_version: 3
artifact: adr
change: 2026-08-24-git-navigation-and-native-review
status: accepted
decision_id: ADR-001
---

# ADR-001: 统一 Git 仓库解析、节点搜索与原生 Changes 呈现

## 决定

1. Compare 与 Review 共享一个可验证 SCM 上下文的仓库解析器，命令参数优先于活动编辑器回退。
2. 历史分页继续服务默认浏览；输入搜索新增 typed Gateway 操作，从当前仓库所有可达 refs 查询提交消息、对象号和 ref 名。
3. Compare 与 Review 共享原生 Changes presenter。Review 通过 token 化只读 URI 延迟读取 HEAD、index 与 worktree 内容。
4. 删除 Git Review 专用 React 主视图及其 bootstrap/message/patch 加载链路；队列树继续承载会话导航。
5. Relative / Absolute Reference 分别绑定 `Ctrl/Cmd+Alt+C` 与 `Ctrl/Cmd+Alt+V`。
6. 用户本次明确决策取代 foundation 中“只允许 Git Blame 默认快捷键”的旧合同；新合同精确允许 Copy Reference 的 C/V 与 Git Blame 的 B 三项快捷键。

## 理由

仓库上下文、搜索数据源和呈现器都是这三个缺陷的真实所有权边界。继续在 QuickPick 本地过滤或复制一套 Review Webview 会保留行为漂移。共享公开 VS Code 原生能力可获得相同的折叠、文件标题、导航和 diff 交互。

## 影响

- 本决定取代永久 ADR `0001-aggregate-diff-webview.md` 中“Git Review 主视图必须是聚合 Webview”的决定。
- Review 不再加载自定义 React 资源；包体积与 Webview 特权消息面缩小。
- 原生 Changes 的宿主布局由 VS Code 控制，扩展只控制标题和资源 URI。
