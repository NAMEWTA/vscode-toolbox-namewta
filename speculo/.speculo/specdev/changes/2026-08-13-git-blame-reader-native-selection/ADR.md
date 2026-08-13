# Git Blame Reader 原生选择架构决定

## ADR-001：Blame 与 Code 使用独立连续文本层

状态：accepted。

Reader 以 Blame 和 Code 两个独立 DOM 文本流呈现同一组 logical lines，并通过 `ResizeObserver` 将每行的最大实际高度同步到两列。这样浏览器原生 Range 在任一列跨行选择时不会混入另一列内容，也不会依赖 subgrid 对独立选择树的重新耦合。该决定替代旧 change 中逐行交错 `line number → metadata → code` 的 DOM 结构。

## ADR-002：原生长距离选择优先于窗口虚拟化

状态：accepted。

`gitBlame.maxLines` 边界内的 logical lines 全部保留在 DOM，使用 `content-visibility` 与 containment 减少离屏绘制。该决定替代旧 change 的 5,000 行窗口虚拟化约束，因为卸载屏幕外 DOM 无法提供浏览器原生的跨长距离拖选。

## ADR-003：颜色只从现有 commit 数据确定性派生

状态：accepted。

Webview 依据现有 block/commit 数据生成主题自适应颜色，不扩展 Reader model 或 Host 协议。同一 SHA 保持同色，相邻不同 commit 避免同色；文本、block 边界和图标继续提供非颜色语义。
