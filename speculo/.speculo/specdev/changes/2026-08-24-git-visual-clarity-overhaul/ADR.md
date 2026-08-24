# 当前变更架构决策

## ADR-001：原生比较 URI 携带真实文件路径

- **状态：** Accepted
- **决定：** 自定义只读 revision URI 继续以不可猜测 token 作为 authority，但 pathname 改为已验证的仓库相对文件路径；解析时同时校验 token 记录与 pathname。
- **原因：** `vscode.changes` 使用资源 URI 生成文件标题，固定 `/revision` 无法区分多文件；token 仍负责内容查找与防篡改。
- **后果：** 新增、删除、重命名分别使用实际存在端的路径，不把仓库绝对路径或 ref 暴露到 URI。

## ADR-002：Reader 以提交块为最小视觉单元

- **状态：** Accepted
- **决定：** SHA 与摘要只在提交块首显示；Blame 和 Code 两列共享同一提交 tint，并以块边框补充非颜色分隔；提交详情改为 React 模态。
- **原因：** 逐行重复 SHA 产生噪声，单列 tint 与相近主题 token 无法建立稳定对应关系，VS Code 通知也脱离当前阅读上下文。
- **后果：** Host message contract 只保留复制和受验证的特权动作，不再负责渲染提交详情通知。
- **Supersedes：** `2026-08-13-git-blame-reader-native-selection/ADR.md` 中 Code 仅使用细色标记、通知式详情的相关决定。

## ADR-003：编辑器注解采用纯格式模块和 VS Code decoration adapter

- **状态：** Accepted
- **决定：** 删除现有仅整行高亮的 renderer，改为 Core 纯格式模块输出固定宽度元数据与稳定色值，由 Extension decoration adapter 渲染 `before` 文本、窄色条和当前提交高亮。
- **原因：** 该接缝把显示规则集中在可直接测试的深层模块，同时保持 Core 无 VS Code/Node 依赖；上游项目已证明固定列、连续提交合并和 heat 色条更适合逐行扫描。
- **后果：** 配置一次性切换到新格式，不提供旧注解 UI/协议兼容层；hover 只在注解起点生效；不采用上游私有 `_workbench.*` 命令、`any`、不受控 `child_process` 或 trusted Markdown。
