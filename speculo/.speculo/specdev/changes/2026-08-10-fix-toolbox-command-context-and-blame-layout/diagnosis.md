---
schema_version: 1
artifact: diagnosis
change: 2026-08-10-fix-toolbox-command-context-and-blame-layout
status: root-cause-confirmed
feedback_loop_ready: true
red_command: pnpm exec vitest run <six targeted regression files>
red_evidence: 6 个新增断言在旧实现失败，修复后 6 文件 24 项测试通过
cleanup_status: clean
updated_at: 2026-08-10T09:11:00+08:00
---

# Diagnosis: 菜单上下文被误判且 Blame 列固定过宽

## 1. 现象与影响

SCM 标题栏的 Git Review 和行号右键的行历史入口失败；Blame 注解把短文本放入固定 `22em` 列中且颜色只作为独立字符渲染，无法形成清晰提交范围。

## 2. 红灯反馈回路

- **命令：** 定向 Vitest 回归测试，分别直接传入公开 `SourceControl` 与 `{ uri, lineNumber }` 上下文，并检查 Renderer 选项。
- **至少一次真实输出：** 用户日志已两次记录 Git Review `invalid-input`，行历史日志记录同类 `invalid-input`。
- **精确症状断言：** 合法菜单上下文不得触发错误；注解不得保留 `22em` 固定宽度。
- **耗时：** 秒级。
- **确定性/复现率：** 100%。
- **Agent 可运行性：** autonomous
- **无法建立时已尝试方式和所需输入：** 不适用。

## 3. 最小复现

- **环境与输入：** VS Code 1.100+、扩展 0.1.1、受信任 Git 工作区。
- **剩余步骤：** 从 `scm/title` 启动 Review；或从 `editor/lineNumber/context` 查看行历史；显示 Blame 后观察短作者文本。
- **逐项删除证据：** 零参数命令面板路径可工作；只有菜单注入上下文时被拒绝。移除固定宽度即可消除主要空白来源。
- **最后红灯证据：** 命令守卫分别要求零参数及旧的 `[Uri, number]` 形态；Renderer 固定 `width: '22em'`。
- **捕获物：** 用户对话中的日志与截图。

## 4. 假设与证伪

| 排名 | 假设与预测                               | 支持证据                               | 单变量实验             | 结果      |
| ---- | ---------------------------------------- | -------------------------------------- | ---------------------- | --------- |
| 1    | VS Code 菜单注入的上下文形态与守卫不一致 | 官方源码和本地守卫一致指向该差异       | 直接传入真实上下文     | confirmed |
| 2    | Gateway 输入契约错误                     | Gateway 命令面板与公开 API 路径可工作  | 绕过菜单参数调用       | rejected  |
| 3    | 空白来自作者格式器补空格                 | 格式器不补齐作者，Renderer 固定 `22em` | 检查生成文本与装饰宽度 | rejected  |

## 5. 已确认根因

- **触发条件：** 从 VS Code 上下文菜单执行命令，或显示短 Blame 文本。
- **失败机制：** Git Review 包装器拒绝所有参数；行历史只识别旧数组形态；Blame 装饰类型固定占用 `22em`，颜色条未覆盖注解单元。
- **根因位置：** `<Path>src/extension/commands/git-review-session-command.ts</Path>`、`<Path>src/extension/commands/view-line-history-command.ts</Path>`、`<Path>src/extension/presentation/git-blame-decoration-renderer.ts</Path>`。
- **漏检原因：** 现有测试只覆盖零参数命令和格式化纯文本，没有模拟菜单真实上下文或检查 Renderer CSS 选项。
- **为何排除其他候选：** Gateway、Git Port 和 QuickPick 在直接调用路径均有绿色测试。
- **确认实验：** 官方 VS Code `editorLineNumberMenu.ts` 传入 `{ lineNumber, uri }`，SCM 参数处理器将 provider 转为公开 `SourceControl`。

## 6. 修复契约

- **必须改变：** 验证并归一化两种菜单上下文；Blame 按最长显示文本确定列宽并覆盖整列提交色；全部可见标题增加前缀。
- **必须保持：** 命令 ID、Gateway、Extension API v1、配置键、Workspace Trust、零参数入口、Hover 类型化入口和资源清理。
- **正确测试 seam：** Extension Host 命令适配器、Blame 纯格式器与 Renderer、Manifest 本地化资源。
- **回归测试：** 修复前合法菜单上下文失败且固定宽度断言失败，修复后通过；畸形输入仍失败。
- **OUT：** 不改变代码正文背景，不重命名命令 ID，不新增 Webview，不远程发布。
- **风险与回滚：** 装饰 CSS 在主题间可能出现可读性差异；通过浅色、深色手动截图验收，必要时回退到仅色条。
- **推荐下游：** I-implement

## 7. 清理

- **原始回路重跑：** 6 个目标文件、24 项测试通过；最终 `pnpm check:ci` 通过。
- **`[DEBUG-...]` 搜索：** 无临时插桩。
- **一次性脚本/原型：** 无。
- **未清理项 owner 与删除条件：** 无。
