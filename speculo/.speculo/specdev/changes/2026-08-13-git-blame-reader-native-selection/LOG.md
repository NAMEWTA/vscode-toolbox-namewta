# Git Blame Reader 原生选择设计日志

## LOG-001 — 2026-08-13

用户通过真实使用截图指出：Reader 不区分 commit 颜色，整行单击会在准备选择文本时立即跳转，顶部复制按钮无助于编辑器式拖选，Blame 与 Code 缺少清晰且可独立选择的边界。

## LOG-002 — 2026-08-13

用户锁定：Blame 色块加 Code 同色标记；源码导航改为显式图标；顶部复制按钮全部移除；Code 自动软换行；Blame/Code 分隔线可拖动且只在当前 Panel 会话保留；commit 详情从 block 首行 info 图标进入；大文件优先原生选择并放弃窗口虚拟化；Blame 复制排除行号。

## LOG-003 — 2026-08-13

本 change 使用一个 Standard 垂直 Ticket 交付完整行为，不拆成 React、CSS、测试等水平任务。公共 Reader model、Gateway 与 Host 消息协议保持兼容。

## LOG-004 — 2026-08-13

实现采用 `ResizeObserver` 同步独立 Blame/Code DOM 的 logical row 最大高度，不使用 subgrid。原因是保持两个连续原生选择树，同时避免依赖 subgrid 重新耦合选择边界；不改变用户可观察契约或公共接口。
