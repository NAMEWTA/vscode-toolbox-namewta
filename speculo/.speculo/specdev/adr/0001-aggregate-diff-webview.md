# ADR-0001：使用自有 WebviewPanel 承载聚合 Diff

- **状态：** Superseded by `0006-native-git-search-and-review.md`
- **日期：** 2026-08-10
- **来源：** `2026-08-10-copy-ranges-and-aggregate-git-review` 的 `ADR-001`

## 背景

目标 VS Code 稳定 API 没有公开的 multi-diff 接口，内置 Git 使用的能力属于 proposed API。产品需要在一个编辑器标签页内连续查看全部变更，同时保持单文件深入查看能力。

## 决策

使用命令创建的 React `WebviewPanel` 展示经过边界验证的结构化 Unified patch；继续使用公开稳定的原生 `vscode.diff` 进行单文件深入查看。不调用 proposed API 或私有命令。

## 后果

Extension Host 负责 Git patch 生成与解析，Core 只持有可序列化模型，Webview 负责渲染和虚拟化。消息验证、内容上限、取消和完整资源清理属于该 Panel 的必备生命周期合同。

## 取代说明

VS Code 目标版本已验证公开 `vscode.changes` 可满足多文件聚合呈现。自 2026-08-24 起，Git Review 直接复用与 Git Commit Compare 相同的原生 Changes presenter，本 ADR 的自有 WebviewPanel、结构化 patch 与虚拟化决定不再适用。
