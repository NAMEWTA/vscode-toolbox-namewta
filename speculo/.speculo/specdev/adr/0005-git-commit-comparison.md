# ADR 0005：使用原生 TreeView 实现 Git 提交快照比较

- 状态：已接受
- 日期：2026-08-13

## 背景

用户需要在提交历史中选定一个 commit 作为基础参考，再选择另一个 commit 查看两棵提交快照之间的全部文件差异。比较结果需要支持新增、删除、重命名、二进制和子模块，并能够打开单文件原生 Diff。

公开插件实现显示，GitLens 和 Git Graph 都将“选择参考提交”和“执行比较”分成两个明确动作，再按两个 revision 计算文件变化。VS Code 的 `vscode.diff` 是公开命令，足以打开单文件 Diff；Workbench 内部的 `_workbench.*` 命令不属于稳定扩展 API。

## 决定

1. 新增独立 `git-compare` Core 领域，不复用 `git-blame` 的提交父变更模型，也不让 `git-review` 承担提交快照比较。
2. 使用两个原生 `TreeView`：一个展示当前 `HEAD` 的全部祖先提交并提供分页；另一个展示比较结果和统计。
3. 比较语义固定为 `git diff base target` 的两棵快照直接比较，不计算 merge-base ahead/behind。
4. Git raw/numstat 输出使用 NUL 分隔解析，路径和重命名双路径不通过换行或制表符拆分。
5. 文本 revision 通过受控只读文档 URI 提供给公开 `vscode.diff`；新增或删除文件使用空树 revision。二进制、子模块和过大文件展示摘要，不加载全文。
6. reference 只保存在当前扩展会话内，持续到显式清除、切换仓库或扩展重启；不写入持久化状态。
7. 所有 Git 查询和 revision 内容读取都经过类型化 `ToolboxGateway`，并遵守受信任工作区、参数数组、超时、取消和资源释放约束。

## 后果

- 原生 TreeView 获得 VS Code 的键盘、可访问性和宿主生命周期支持，不需要新建 Webview 协议。
- 结果树能列出所有 Git 状态，但单文件 Diff 仍是一次打开一个文件；不依赖私有多文件 Diff API。
- 分页以当前 HEAD 和 offset 组成 cursor。HEAD 变化后 cursor 会失效并要求刷新，避免列表静默跳跃。
- TreeView 隐藏本身没有可靠的“关闭视图”事件，因此隐藏视图不会清除 reference；清除、切换仓库和扩展释放提供确定的生命周期边界。
