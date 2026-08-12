# 设计日志

## LOG-001: 引用坐标

- **结论：** 使用 VS Code UTF-16 列，输出一基闭区间；多光标只使用 primary selection；相对与绝对引用保持一致。

## LOG-002: 聚合 Diff 布局

- **结论：** 单栏 Unified；一个编辑器标签页；文件块默认展开并按需加载、虚拟化长列表。

## LOG-003: Git 操作范围

- **结论：** 文件级 Stage、Unstage、确认后 Discard；不实现逐 hunk 写入；冲突项进入 Merge Changes，解决后可 Stage。

## LOG-004: 发布边界

- **结论：** 合入当前未发布 0.1.2，生成本地 VSIX；不提交、推送、打标签或发布。

## LOG-005: Blame 左侧列

- **结论：** 使用稳定 Decoration API 为所有文档行建立等宽伪列；新增未提交行显示空白单元并继续占位。稳定 API 的 gutter 只支持图标，禁止为文字列引入私有编辑器 API。
