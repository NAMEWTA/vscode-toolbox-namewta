---
schema_version: 3
artifact: spec
change: 2026-08-10-copy-ranges-and-aggregate-git-review
status: ready
ready_for_tickets: true
sources:
  - USER-DECISION:2026-08-10-copy-ranges
  - USER-DECISION:2026-08-10-aggregate-review
  - USER-DECISION:2026-08-10-blame-fixed-column
  - ADR-001
  - ADR-002
---

# Spec: 精确代码引用与聚合 Git Review

## 1. 问题与目标

编辑器右键复制会丢失选择区，字符末端也存在排他坐标误差；Git Review 只能逐文件打开原生 diff，无法连续扫描全部变更，也不支持与 SCM 一致的文件级 Git 操作。

成功结果是：用户能复制精确行或字符范围；SCM 小图标打开一个聚合审核页；全部 staged、unstaged、conflict、binary 和 submodule 项均有可见投影；文件级写操作安全、可取消、可验证；Git Blame 在继续编辑和新增行时保持固定左侧列。

## 2. 解决方案与外部行为

- 空选择输出 `path:line`，单行选择输出 `path:line(start-end)`，多行选择输出 `path:start-end`。
- SCM 标题以 `$(diff-multiple)` 图标呈现，命令可访问标题继续以 `toolbox-` 开头。
- 聚合页按 Merge Changes、Staged Changes、Changes 分组并使用 Unified diff。
- Changes 支持 Stage 和确认后 Discard；Staged Changes 支持 Unstage；Merge Changes 支持打开、引用及 Stage Resolved。
- 所有文件支持复制相对引用、打开文件、打开原生 diff、标记已审核与跳过。
- Git Blame 为文档每一行投影等宽左侧列；新增未提交行保留空白单元，不显示伪造日期或作者。

## 3. 用户故事

- 作为阅读代码的开发者，我能复制精确到行或字符的引用。
- 作为提交前审核者，我能在一个长页面中检查并处理全部本地 Git 变更。

## 4. 验收合同

| ID     | 可观察结果                                                  | 验证接缝                                  |
| ------ | ----------------------------------------------------------- | ----------------------------------------- |
| AC-001 | 编辑器右键保留 primary selection 并正确输出行/字符闭区间    | Formatter、Source Adapter、Extension Host |
| AC-002 | Explorer 仍复制路径，URI 不匹配不回退                       | Adapter 单元与集成                        |
| AC-003 | SCM 标题只显示小图标且可打开或恢复单个聚合页                | Manifest、Controller 集成                 |
| AC-004 | 同一路径 staged/unstaged 分层，冲突进入 Merge Changes       | Git Adapter、Core Session                 |
| AC-005 | Unified patch 安全渲染并覆盖加载、摘要、错误和超大状态      | Patch Parser、React 测试                  |
| AC-006 | Stage、Unstage、Discard 只改变目标 Git 层，过期和取消不写入 | 临时 Git 仓库集成                         |
| AC-007 | 所有请求、Panel、监听器和子进程均可取消并释放               | 生命周期测试                              |
| AC-008 | 0.1.2 通过完整门禁并生成可审计 VSIX                         | `pnpm check:ci`                           |
| AC-009 | Blame 在继续输入和新增行后保持等宽左列，正文起点不漂移      | Formatter、Line Mapper、Decoration 测试   |

## 5. 范围

IN 包含 Copy Reference、Git Review Core/Adapter/Presentation/Webview、Git Blame 固定列、Gateway 契约、Manifest/i18n、文档、依赖和测试。复用现有 Registry、GitCommandRunner、Workspace Trust、Clipboard Port、Queue Tree、状态栏和原生 diff。OUT 包含逐 hunk Git 写入、三方合并编辑器、私有命令、proposed API、提交、推送和发布。

新增公开能力保持 Extension API `apiVersion: 1`，不重命名任何已有命令 ID。Discard 必须具备用户确认和预期内容身份；路径、消息和 Git 输出继续在运行边界验证。

## 6. 已锁定实现约束

只使用公开稳定 VS Code API；Core、Extension Host 与 Webview 依赖方向保持；第三方 patch 解析和虚拟化依赖固定版本并记录许可证。

## 7. 状态与失败模型

Review Session 保持 inactive、loading、active、stale、refreshing、completed 状态；写操作串行且使用内容身份乐观核验。取消、过期、超时、无权限和内容过大均产生稳定可观察结果。

## 8. 兼容与恢复

现有命令 ID、配置、Extension API v1 和原生 diff 继续可用。无数据迁移；代码回退即可恢复只读逐文件界面。

## 9. 验证策略

Formatter、Adapter、Core Session、React、Manifest、Blame Line Mapper 和 Decoration Renderer 使用共置单元测试；Git 写操作使用临时真实仓库；Extension Host 覆盖真实命令与剪贴板；最终运行 `pnpm check:ci`、主题视觉验收和 VSIX 内容审计。
