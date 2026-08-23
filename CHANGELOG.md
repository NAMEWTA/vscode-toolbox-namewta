# 变更日志

本文件记录项目的重要变化。

## [未发布]

### 新增

- 增加 Git Commit Compare：从 Source Control 标题栏分两步选择基准端与目标端，目标端默认当前 `HEAD`，两端均支持分页历史和 4 到 64 位 SHA 前缀输入。
- 比较结果通过 VS Code 公开的原生多文件更改视图一次展示，标题明确显示 `base → target`、文件数和增删统计；新增、删除、重命名及特殊内容保留正确端点语义。
- 新增 `gitCompare.resolveRevision` Gateway 能力，并与 `listCommits`、`compareCommits`、`getRevisionContent` 一起固定完整 commit OID；所有 Git 查询支持受信任工作区、参数数组、取消、超时和输出限制。
- 移除旧 Git Compare Explorer TreeView 及其 reference 状态命令；`gitCompare.openHistory` 暂时保留为新流程的隐藏兼容入口。

## [0.1.7] - 2026-08-13

### 变更

- 重构 Full-file Git Blame Reader：Blame 与 Code 现在是两个可独立拖选、复制的原生文本列；移除复制按钮和普通文本点击导航。
- 为相邻 commit 提供稳定色块与 Code 细标记，增加显式源码打开/提交详情图标、软换行和可拖动 Blame 列分隔线。
- 大文件 Reader 保留完整 DOM，改用 `content-visibility` 抑制离屏绘制，保留跨屏原生选择能力。

## [0.1.6] - 2026-08-12

### 新增

- 增加独立的 Full-file Git Blame Reader Editor Tab，按 logical line 和连续 commit block 展示完整文件历史。
- Reader 支持源码搜索、键盘导航、源文件双向定位、完整提交详情和八类结构化复制。
- 超过 5,000 行的文件使用虚拟化渲染；Copy All 始终由 Extension Host 权威模型生成并保留字符与行尾语义。

### 变更

- Normal Editing Mode 删除会改变编辑器布局的拟态 gutter，改为 Status Bar、Hover 和整行 commit block 背景高亮。
- Reader 的 Git 查询、源文本、消息验证和系统剪贴板操作统一通过类型化 `ToolboxGateway` 与 Host session model 执行。
- 同步命令、双语本地化、配置、README、构建入口和 VSIX 清单。

### 修复

- 修复 macOS `/tmp` 实路径解析导致 Reader 无法识别仓库资源的问题。
- 修复未保存文档 Refresh 未使用同一快照、刷新失败状态不可见和 commit detail 缺少邮箱与日期的问题。
- 修复窄宽、高缩放和高对比主题下 Reader 控件与长行布局问题。

## [0.1.5] - 2026-08-12

### 新增

- 更新扩展 logo：以工具箱、代码括号和 Git 审核时间线构成统一的开发者工具品牌标识。

### 文档

- 按 VS Code 扩展用户的采用路径重写 README，补充安装、核心工作流、配置、信任边界、开发和发布说明。

## [0.1.4] - 2026-08-11

### 修复

- 修复 Git Blame 左侧日期/作者列与提交色条使用多个行首装饰导致的错位和覆盖。
- Git Blame 默认显示扩展宿主本地时区的 `YYYY-MM-DD HH:mm`，Hover 绝对时间与注解保持一致。

### 变更

- 使用单一 `before/after` decoration 实例渲染左侧拟态列，保留自适应宽度、未提交空单元和提交色块。

## [0.1.3] - 2026-08-11

### 修复

- 修复 SCM 上下文缺少 `rootUri` 时错误回退到其他仓库的问题。
- 修复无 HEAD 仓库的 staged binary 变更未被正确识别的问题。
- 修复聚合审核页异步导航后可能把错误条目标记为已审核的问题。
- 修复 Git Review 完成摘要通知阻塞命令状态回收的问题。

### 变更

- 发布精确 Copy Reference、聚合 Git Review、文件级 Git 操作和固定列 Git Blame 布局。
- 聚合审核页支持 staged、unstaged、conflict、binary 和 submodule 变更。

## [0.1.2] - 2026-08-10

### 修复

- 修复从 SCM 标题菜单启动 Git Review 时错误拒绝 Source Control 上下文的问题。
- 修复从编辑器行号菜单查看行历史时错误拒绝 `{ uri, lineNumber }` 上下文的问题。
- 修复 Git Blame 注解使用固定宽度导致留白过多的问题，列宽现在根据实际内容自适应。
- 修复继续编辑或追加新行时 Git Blame 注解列位置变化的问题；未提交行现在保留同宽空单元，源码区域保持稳定。

### 变更

- Git Blame 注解对已提交行显示连续提交色条和整列淡色背景，单一提交文件同样可见。
- 全部可见命令与右键菜单标题统一以 `toolbox-` 开头，稳定命令 ID 和配置键不变。
- Copy Reference 增加跨行 `path:1-10` 与单行字符 `path:2(5-9)` 精确引用，并修复编辑器右键来源路由。
- SCM Git Review 入口改为小型图标；审核主视图改为单标签页纵向聚合 Diff，按冲突、已暂存和未暂存分层。
- Git Review 增加文件级 Stage、Unstage、确认后 Discard、打开文件、原生 Diff、复制引用、标记已审核和 Merge Changes 入口。
- 扩展版本更新为 `0.1.2`。

## [0.1.1] - 2026-08-09

### 新增

- 增加仅在受信任工作区按用户显式操作启动的 Git Review Session，可审核 staged、unstaged 与 untracked 变更。
- 增加 Review Queue、状态栏进度、公开命令和 VS Code 原生只读 diff 导航，并保持 Git index、工作树、分支与远程状态不被产品流程修改。
- 增加真实 Git/Extension Host 集成覆盖，包括无 `HEAD`、删除、重命名、二进制内容、状态过期和刷新场景。

### 改进

- 仓库无可审核变更时显示本地化且可行动的提示，而不是通用仓库不可用提示。

### 已知验证限制

- 物理键盘与屏幕阅读器的最终手动验收尚未完成；自动化可访问标签断言、真实 Extension Host 测试和完整发布候选门禁均已通过。

## [0.1.0] - 2026-08-09

### 新增

- 初始化模块化 VS Code 扩展开发基座。
- 增加类型化 Tool Gateway、Registry、版本化扩展 API 和能力发现。
- 增加“系统信息”示例业务域。
- 增加带类型化扩展宿主消息的 React Webview。
- 增加构建、测试、Lint、架构约束、CI、中文文档和 VSIX 打包基座。
- 增加源码注释与开发文档必须使用中文的仓库规则。
- 增加 Editor/Explorer 的相对与绝对 Copy Reference，并支持虚拟资源和安全剪贴板反馈。
- 增加逐文档 Git Blame 注解、未保存行映射、六项配置和唯一 Toggle 快捷键。
- 增加安全 Hover、提交 hash/remote/上一版本/提交 Diff 操作，以及可取消的增量 Line History。
- 增加受控 Git 子进程、Historical Document Provider、信任/资源边界和真实 Git Extension Host 测试。
- 增加公开 GitHub 仓库发布工作流：推送与清单版本一致的标签后，在完整门禁成功时创建 GitHub Release 并上传 VSIX。

### 变更

- 将仓库、扩展包、显示名、扩展 ID、命令、配置、内部 URI 方案、输出通道和公共 TypeScript API 统一重命名为 `vscode-toolbox-namewta`。
- 首次发布版本为 `0.1.0`；不发布到 VS Code Marketplace，也不发布到 npm。
