# Git Blame Reader 原生选择上下文

**双列选择面**：Reader 中视觉并排但 DOM 文本流彼此独立的 Blame 与 Code 区域。任一侧的原生选区不得混入另一侧内容。

**Blame gutter**：不可选择的 logical line number 区域；它属于 Blame 侧视觉结构，但不进入 Blame 剪贴板文本。

**commit 色块**：由 commit SHA 确定性派生的 Blame 背景与边界增强。颜色不得成为唯一语义，相邻 block 仍有边界和显式 metadata。

**显式导航**：只有打开源码图标或其键盘 Enter 操作才导航；普通文本点击、拖选和复制不产生导航副作用。

_Avoid_：整行点击导航、跨列混合选区、顶部复制按钮带、窗口虚拟化选区。
