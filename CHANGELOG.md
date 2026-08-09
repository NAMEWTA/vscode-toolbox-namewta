# 变更日志

本文件记录项目的重要变化。

## [未发布]

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
