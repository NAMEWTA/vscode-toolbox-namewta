---
schema_version: 1
artifact: source
change: 2026-08-10-copy-ranges-and-aggregate-git-review
source_type: conversation
canonical_locator: null
captured_at: 2026-08-10T10:45:13+08:00
content_sha256: 0e60d45e9718b4a720aac79f131095663ab809bda9d754d3eca620960c02b5ce
remote_state: not-applicable
close_capability: not-applicable
---

# Source: 精确代码引用与聚合 Git Review

## Capture Metadata

- **Capture method:** conversation
- **Author:** wta
- **Created / updated:** 2026-08-10
- **Labels or classification supplied by source:** feature、Git Review、Copy Reference、Webview
- **Attachments:** SCM 标题与变更树截图
- **Redactions:** 不持久化截图中的本机路径和工作区内容

## Original Content

用户要求支持 `xxx.ts:1-10` 行范围和 `xxx.ts:2(5-9)` 字符范围引用，并要求 SCM 标题入口使用小图标。点击入口后，全部 staged、unstaged 与冲突变更必须在一个编辑器标签页中按单栏 Unified diff 从上到下展示，同时提供文件级 Stage、Unstage、确认后 Discard、复制引用、打开文件和审核操作。

用户决定 staged 与 unstaged 按 Git 两层拆分，同一路径允许出现两次；合并冲突纳入独立 Merge Changes 分组，但插件不实现三方合并编辑器。版本继续并入当前未发布的 0.1.2，不授权提交、推送、标签或发布。

用户随后补充：Git Blame 开启后继续写入新行时，标签不得漂移到正文位置；作者和日期应形成紧贴行号的固定左侧列，编辑正文必须保持统一起始位置。

## Source Comments

无。
