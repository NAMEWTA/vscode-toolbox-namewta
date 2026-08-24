---
schema_version: 3
artifact: spec
change: 2026-08-24-git-navigation-and-native-review
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-24-git-navigation-and-native-review
  - USER-SCREENSHOT:2026-08-24-missing-revision-search
  - CODE:<Path>src/extension/presentation/git-compare-revision-quick-pick.ts</Path>
  - CODE:<Path>src/extension/presentation/vscode-git-review-presentation.ts</Path>
---

# Spec: Git 节点搜索与原生 Review

## 1. 问题与目标

修复比较命令选择错误仓库及节点漏搜；让 Git Review 与 Git Compare 使用完全一致的原生 Changes 界面；为两种引用复制增加 C/V 快捷键。

## 2. 解决方案与外部行为

1. Compare 与 Review 共享验证 SCM 命令上下文的仓库解析器。
2. Revisions 输入通过 typed Gateway 搜索所有 refs 可达提交及 ref 名，同时保留 SHA 前缀解析。
3. Review 删除专用 React Webview，复用 Compare 的公开 `vscode.changes` 呈现与惰性内容读取。
4. Review Queue 保留会话导航，并为分层条目提供经过身份复验的 Stage、Unstage 和确认后 Discard。
5. Relative / Absolute Reference 分别增加 `Ctrl/Cmd+Alt+C` 与 `Ctrl/Cmd+Alt+V`。

## 3. 用户故事

- **US-001：** 作为多仓库用户，我希望从 SCM 标题启动 Compare 时始终使用该 SCM 仓库。
- **US-002：** 作为提交历史用户，我希望按消息或 ref 名找到不在当前 HEAD 分页中的节点。
- **US-003：** 作为工作树审核者，我希望 Review 与 Commit Compare 使用同一原生多文件交互。
- **US-004：** 作为引用复制用户，我希望不打开菜单即可复制相对或绝对引用。

## 4. 验收合同

| ID     | 前置条件                                                         | 动作                                    | 可观察结果                                                                                   | 验证接缝                              |
| ------ | ---------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| AC-001 | 活动编辑器与 SCM 命令属于不同仓库                                | 从 SCM/Git Graph 启动比较               | 只查询命令上下文对应仓库                                                                     | 解析器单元、命令注册集成              |
| AC-002 | 提交位于未加载页、非 HEAD 本地分支、远端分支或标签               | 输入消息、SHA 前缀或 ref 名             | 防抖后出现对应提交，可作为 base/target 选择                                                  | Core/Adapter/QuickPick 单元           |
| AC-003 | 连续快速输入、关闭或重开 QuickPick                               | 观察搜索结果                            | 旧代请求被取消，迟到结果不能覆盖新结果，无遗留 Timer/Promise                                 | QuickPick 单元                        |
| AC-004 | 工作树含 staged、unstaged、untracked、deleted、renamed、conflict | 启动 Git Review                         | 使用与 Compare 相同的原生 Changes 布局，标题按 layer/path 区分，内容对应 HEAD/index/worktree | Presentation、Extension Host、真实 UI |
| AC-005 | Review 刷新或执行写操作                                          | 观察原生 Changes                        | 新库存只打开一次，旧 token 失效；队列导航和会话状态继续可用                                  | Controller/Provider 单元              |
| AC-006 | 编辑器有可复制的已保存资源                                       | 按 `Ctrl/Cmd+Alt+C` 或 `Ctrl/Cmd+Alt+V` | 分别复制相对与绝对引用；untitled 不触发                                                      | Manifest 单元、Extension Host         |
| AC-007 | 所有实现完成                                                     | 执行完整门禁与打包                      | 类型、lint、依赖、单测、集成、构建与 VSIX 均有真实证据                                       | `pnpm check:ci`、打包                 |

## 5. 范围

### IN

- 通用 Git 仓库解析器与 SCM 参数转发。
- 全 refs 有界搜索、typed Gateway 合同、防抖取消和代际保护。
- 共享原生 Changes presenter、Review token URI 与懒读取。
- 删除 Review React 主呈现及专用消息链路。
- C/V 快捷键、国际化、文档、ADR、测试与 VSIX。

### REUSE

- typed `ToolboxGateway`、参数数组 Git runner、Review session state、Compare 原生 Changes 资源格式和 VS Code 公共命令。

### OUT

- 修改 Git 数据模型、引入 Git 写入兼容层、私有 VS Code 命令、Webview 内复刻 VS Code diff UI。

## 6. 已锁定实现约束

- Core、Extension 与 Webview 的运行边界保持不变；所有业务操作经过 typed Gateway。
- 用户已批准彻底重构且无需兼容旧 Review Webview；本变更不授权 commit、push 或 release。
- foundation 快捷键合同以本次明确决定为准，只允许 Copy Reference C/V 与 Git Blame B。

## 7. 数据、接口与兼容

- **公共接口：** 新增 `gitCompare.searchCommits` 与 Review 条目 mutation 命令，版本化 Extension API 结构不变。
- **持久化：** 不新增持久化数据或迁移；Review 写操作只响应用户显式队列命令。
- **兼容：** 删除旧 Review Webview bootstrap/message/patch 链路、专用依赖和构建资产，不保留兼容层。

## 8. 非功能要求

- 搜索查询长度和结果数有界；Git 输出经过现有边界验证。
- URI 不暴露 repositoryRoot、ref 或未经验证的路径。
- Provider、搜索、Timer、监听器和 inflight 请求必须可取消并释放。
- 新增或修改的说明、注释与 ADR 使用中文；用户文案通过 l10n。

## 9. 验证策略

- 仓库解析、全 refs 搜索、QuickPick 取消与迟到结果使用相邻单元测试和真实侧分支 Extension Host 集成验证。
- Review 原生 Changes 使用资源映射、Provider、Controller 单元测试和真实 VS Code Tab API 集成验证。
- 快捷键使用 Manifest 精确合同、foundation 和 Extension Host 复制行为验证。
- 完成前运行 `pnpm check:ci`、SpecDev validator、VSIX 清单与 SHA-256 核验。

## 10. 风险、假设与未决问题

- `vscode.changes` 的内部资源列表不在稳定 Tab API 中暴露，因此 `layer/path` 由单元测试精确覆盖，真实宿主验证标题、唯一标签页和非 Webview 输入。
- 搜索使用 `git log --all` 与 `for-each-ref`，大仓库通过查询长度、结果数、输出上限、取消和防抖控制风险。
- 无未决问题；无数据迁移，出现回归时可整体恢复旧版本源码。
