# Git 可视化清晰度重构设计日志

## LOG-001 — 2026-08-24

用户通过三张真实 VS Code 截图锁定五项问题：原生比较文件标题错误、Reader SHA 逐行重复、两列提交颜色关联不清、提交详情错误使用通知、编辑器注解需要完全替换为基于 `lkqm/vscode-gitblame-annotations` 的固定列设计。

## LOG-002 — 2026-08-24

用户明确无需兼容旧注解实现，并批准按先前计划彻底重构。实现保留仓库现有 typed gateway、取消/代际控制和资源释放能力，只替换可观察 UI、消息合同、格式模块和 decoration renderer。

## LOG-003 — 2026-08-24

上游参考固定在 commit `cc2c600a75f98a6af39c33a6082cac8c1657c0b3`。采用日期/作者固定宽度、连续提交合并、色条和行首 hover；拒绝私有命令、不受控 Shell、`any`、`content.isTrusted` 与 activation 时创建 UI。

## LOG-004 — 2026-08-24

实施完成 Compare URI 真实路径、Reader 连续提交分块与 React 模态、编辑器固定元数据列与 heat 色条。真实 VS Code 矩阵发现零宽 range 上的独立 `after` 无法显示，改为在同一稳定 `before` attachment 末尾渲染窄色条，不改变源码内容或选区语义。

## LOG-005 — 2026-08-24

Light、Dark、High Contrast × 100%、125%、150% 九组 UI 矩阵、21 项 Extension Host 集成、278 项 Vitest、完整 `pnpm check:ci` 与 VSIX 打包通过。T-01 证据、Map 和 change 状态已同步为完成；未执行 commit、push 或 release。
