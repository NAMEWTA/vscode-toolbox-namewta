---
schema_version: 3
artifact: ticket
change: 2026-08-10-copy-ranges-and-aggregate-git-review
id: T-01
title: 交付精确引用与聚合 Git Review
status: done
planning_depth: deep
planning_depth_reason: 增加公共 Gateway 契约、Webview wire format、第三方依赖和可破坏工作树的受控 Git 写操作
ready: true
risk: high
blocked_by: []
contract_ids: [AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009]
owner: codex-local
expected_changes:
  - '<Path>src/core/**</Path>'
  - '<Path>src/extension/**</Path>'
  - '<Path>src/webview/**</Path>'
  - '<Path>tests/**</Path>'
  - '<Path>package*.json</Path>'
  - '<Path>pnpm-lock.yaml</Path>'
  - '<Path>pnpm-workspace.yaml</Path>'
writable_paths:
  - '<Path>src/core/**</Path>'
  - '<Path>src/extension/**</Path>'
  - '<Path>src/webview/**</Path>'
  - '<Path>tests/**</Path>'
  - '<Path>build/**</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls.json</Path>'
  - '<Path>package.nls.zh-cn.json</Path>'
  - '<Path>pnpm-lock.yaml</Path>'
  - '<Path>pnpm-workspace.yaml</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
  - '<Path>THIRD_PARTY_NOTICES.md</Path>'
read_only_paths:
  - '<Path>.github/**</Path>'
shared_paths:
  - '<Path>package.json</Path>'
  - '<Path>pnpm-lock.yaml</Path>'
shared_path_owners:
  - '<Path>package.json</Path> => T-01'
  - '<Path>pnpm-lock.yaml</Path> => T-01'
---

# Ticket T-01: 交付精确引用与聚合 Git Review

## 1. 战略与来源

目标是把用户确认的精确引用与聚合 Git Review 作为一个可安装的 0.1.2 垂直切片交付。来源为本 change Spec、ADR-001、ADR-002 和用户批准计划。

## 2. 决策状态

布局、Git 分层、文件级操作、冲突范围、版本和发布边界均已锁定；无未决高影响问题。

## 3. 范围边界

IN 为 Copy Reference、Git Review、Webview、Gateway、Manifest、依赖、测试和中文文档；REUSE 为现有 Registry、Runner、Clipboard、Queue、状态栏和原生 diff；OUT 为逐 hunk 写入、三方合并、私有 API 和远程发布。

## 4. 要构建什么

构建两个相互连接的用户行为：真实编辑器选择生成精确引用；SCM 图标打开可恢复的聚合审核页，并通过受控 Gateway 执行文件级 Git 操作。

## 5. 实现契约

- **Module 与 Interface：** Copy Reference Formatter 隐藏坐标换算；GitReviewSession/GitReviewPort 隐藏分层状态和写入核验；Git Review Panel 只消费可序列化 view model。
- **不变量：** Core 不导入 VS Code/Node/DOM；Webview 不导入 VS Code/Node/Extension；业务操作全部经过 Gateway；现有命令 ID 和 Extension API v1 保持。
- **错误：** 畸形输入为 invalid-input，过期内容为 stale/capability-unavailable，取消为 cancelled，超大 patch 为可见摘要。
- **安全：** Git 参数数组执行；写入前 Trust、仓库根、itemId、内容身份和路径均重新验证；Discard 先确认。
- **性能：** patch 单项 8 MiB，Webview 最多两个加载请求，长列表虚拟化，Panel 销毁取消全部请求。

## 6. 执行路线

1. 以 Formatter、Source Adapter 和 Extension Host 测试修复精确引用。
2. 以 Core/Adapter 测试建立分层 item、结构化 patch 与 Git 写入。
3. 以 React/Controller 测试建立聚合页、图标入口、导航和资源清理。
4. 以 Blame Formatter、Line Mapper 和 Decoration 测试建立固定宽度左列与新增行占位。
5. 更新 Manifest、国际化、依赖、文档和 Speculo Evidence。
6. 完成定向回归、双轴审查、`pnpm check:ci`、主题视觉检查和 VSIX 审计。

## 7. 路径访问契约

可写范围、只读范围和共享 owner 以 frontmatter 为权威；当前串行执行无并发冲突。任何越界修改必须先登记偏差。

## 8. 验证矩阵

| 行为或风险 | 验证接缝                           | 命令或步骤                 | 预期结果               | Evidence      |
| ---------- | ---------------------------------- | -------------------------- | ---------------------- | ------------- |
| 精确引用   | Formatter、Adapter、Extension Host | 定向 Vitest 与 integration | AC-001、AC-002         | T-01 Evidence |
| 分层与写入 | Core、临时真实 Git 仓库            | 定向 Vitest 与 integration | AC-004、AC-006         | T-01 Evidence |
| 聚合页面   | React、Controller、Manifest        | Webview 测试与主题检查     | AC-003、AC-005、AC-007 | T-01 Evidence |
| Blame 左列 | Formatter、Line Mapper、Decoration | 共置 Vitest                | AC-009                 | T-01 Evidence |
| 发布候选   | 全项目                             | `pnpm check:ci`            | AC-008                 | T-01 Evidence |

## 9. 发布、迁移与恢复

新增字段和命令为 additive；已有命令输入输出保持可调用。功能可通过代码回退恢复 0.1.1 的只读逐文件界面，不存在数据迁移。不可逆操作仅为用户在产品中逐次确认的 Discard；本次开发验证只在临时仓库执行。用户未授权提交、推送、标签或发布。监控信号是结构化错误、stale banner 和输出日志；无需兼容收缩窗口。

## 10. 验收标准

- [x] AC-001 至 AC-009 均有 Evidence。
- [x] `pnpm check:ci` 和 Speculo implement 校验通过。
- [x] 浅色、深色和高对比度下聚合页无重叠或溢出。
- [x] 无未批准偏差或未释放资源。
