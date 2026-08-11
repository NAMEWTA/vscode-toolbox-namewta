---
schema_version: 1
artifact: source
change: 2026-08-10-fix-toolbox-command-context-and-blame-layout
source_type: conversation
canonical_locator: null
captured_at: 2026-08-10T08:50:28+08:00
content_sha256: 5bdf637438a3658ee28050b57bb0d088aad340c2eff4d108a257acde39f42c6b
remote_state: not-applicable
close_capability: not-applicable
---

# Source: 修复 Toolbox 实际使用问题

## Capture Metadata

- **Capture method:** conversation
- **Author:** wta
- **Created / updated:** 2026-08-10
- **Labels or classification supplied by source:** bug、视觉改进、命名一致性
- **Attachments:** 两张 Git Blame 编辑器截图
- **Redactions:** 错误堆栈中的本机用户目录不在本工件重复保存

## Original Content

用户反馈四项实际使用问题：从 Source Control 标题入口启动 Git Review 时记录 `Git Review command input is invalid.`；Git Blame 日期/作者列存在大量固定空白，要求按内容自适应，并参照示例让提交颜色覆盖完整注解列范围；全部可见命令和右键菜单标题必须以 `toolbox-` 开头；从编辑器行号右键执行查看行历史时记录 `View Line History input is invalid.`。

用户随后确认：只修改可见标题，保持现有命令 ID；Blame 使用整列淡色块与连续实色色条，不覆盖代码正文；版本升级到 `0.1.2` 并生成本地 VSIX，不执行远程发布。

## Source Comments

无。
