# 领域上下文：Git 可视化清晰度重构

- **文件标签：** VS Code 原生多文件比较中用于识别单个资源的仓库相对路径。
- **提交块：** Reader 中由同一 commit 连续覆盖的一组 logical lines；SHA 和摘要只在块首展示一次。
- **提交色：** 同一 commit 在 Blame 与 Code 两列共享的稳定视觉标识，必须同时有非颜色边界。
- **提交详情模态：** Reader 内由 React 管理的可访问对话框；只把特权动作发送给 Extension Host。
- **编辑器注解：** 编辑器行首固定宽度的日期、作者与可选 revision 元数据，以及窄色条和当前提交高亮。
- **上游参考：** `lkqm/vscode-gitblame-annotations` 固定提交 `cc2c600a75f98a6af39c33a6082cac8c1657c0b3`；只借鉴可观察交互，不复制其私有命令或不受控进程实现。
