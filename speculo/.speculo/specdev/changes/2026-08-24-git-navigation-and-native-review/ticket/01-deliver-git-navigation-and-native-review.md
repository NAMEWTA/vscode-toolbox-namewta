---
schema_version: 3
artifact: ticket
change: 2026-08-24-git-navigation-and-native-review
id: T-01
title: 交付 Git 节点搜索与原生 Review
status: done
planning_depth: deep
planning_depth_reason: 该 Ticket 跨越 Git 仓库解析、全 refs 搜索、typed Gateway、Review 原生呈现、队列写操作、构建资产与真实 VS Code/VSIX 验证，但不涉及数据迁移。
ready: true
risk: high
blocked_by: []
contract_ids: [AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007]
owner: Codex
expected_changes:
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/core/domains/git-compare/**</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
  - '<Path>src/extension/adapters/**</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/extension/commands/**</Path>'
  - '<Path>src/extension/presentation/**</Path>'
  - '<Path>src/webview/git-review/**</Path>'
  - '<Path>src/webview/platform/read-git-review-bootstrap.ts</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>build/build-webview.mjs</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>pnpm-lock.yaml</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>scripts/verify-foundation.mjs</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
writable_paths:
  - '<Path>src/core/contracts/**</Path>'
  - '<Path>src/core/domains/git-compare/**</Path>'
  - '<Path>src/core/domains/git-review/**</Path>'
  - '<Path>src/extension/adapters/**</Path>'
  - '<Path>src/extension/bootstrap/**</Path>'
  - '<Path>src/extension/commands/**</Path>'
  - '<Path>src/extension/presentation/**</Path>'
  - '<Path>src/webview/git-review/**</Path>'
  - '<Path>src/webview/platform/read-git-review-bootstrap.ts</Path>'
  - '<Path>tests/integration/**</Path>'
  - '<Path>build/build-webview.mjs</Path>'
  - '<Path>package.json</Path>'
  - '<Path>package.nls*.json</Path>'
  - '<Path>pnpm-lock.yaml</Path>'
  - '<Path>l10n/bundle.l10n*.json</Path>'
  - '<Path>scripts/verify-foundation.mjs</Path>'
  - '<Path>README.md</Path>'
  - '<Path>CHANGELOG.md</Path>'
read_only_paths:
  - '<Path>src/core/domains/system-info/**</Path>'
  - '<Path>src/webview/git-blame-reader/**</Path>'
shared_paths: []
shared_path_owners: []
---

# T-01: 交付 Git 节点搜索与原生 Review

## 1. 战略与来源

- **目标：** 修复指定 SCM 仓库与全 refs 节点搜索，并彻底统一 Compare/Review 呈现。
- **可观察产出：** 侧分支节点可搜、Review 使用唯一原生 Changes 页、C/V 可直接复制引用。
- **来源：** `AC-001..AC-007`、`ADR-001`、用户截图和实施批准。
- **Deep 批准点：** 用户明确要求按计划执行到完成，并明确无需兼容性。

## 2. 决策状态

- Compare/Review 共享 SCM 仓库解析与 `VscodeNativeChangesPresenter`。
- 搜索使用 `git log --all`、`for-each-ref`、有界结果与取消代际。
- Review Webview、结构化 patch 命令和专用依赖直接删除。
- Review 写操作只从队列条目触发，并在 Controller/Core/Adapter 三层复验。
- 未决问题：无。

## 3. 范围边界

| IN                                                      | REUSE                                                 | OUT                                               |
| ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| 仓库解析、搜索、原生 Review、队列动作、快捷键与制品清理 | Gateway、Git runner、Review session、公开 VS Code API | 私有命令、数据迁移、Webview 复刻 diff、兼容旧呈现 |

## 4. 要构建什么

SCM 启动参数必须决定仓库；Revisions 输入必须搜索所有 refs 可达提交；Review 必须将当前 staged/unstaged/conflict 资源投影到原生多文件 Changes，并通过队列维护审核与显式写操作；引用复制提供 C/V 键位。

## 5. 实现契约

- **Interface：** typed Gateway 搜索与 mutation 命令、token 文档 URI、公共 `vscode.changes`。
- **不变量：** 不把自由 ref 传给 SHA 解析；旧请求不能覆盖新代；文档 URI 不暴露根路径或 identity；写操作复验当前条目。
- **错误行为：** 不可信、无仓库、过期条目、取消、超时与 Git 输出异常保持结构化失败。
- **生命周期：** QuickPick Timer、AbortController、Provider inflight、Tree/Status/Watcher 与文档 token 可清理。
- **兼容：** 按用户决定不保留旧 Review Webview、patch 或单文件打开兼容路径。

## 6. 执行路线

1. 先补仓库上下文、全 refs 搜索和搜索代际回归测试。
2. 抽取原生 Changes presenter，迁移 Review 内容资源并删除专用 Webview。
3. 增加快捷键、清理依赖和文档。
4. 运行单元、集成、真实 UI、完整门禁与 VSIX 验证，回写 Evidence。

## 7. 路径访问契约

- **预计修改点与可写范围：** 见 frontmatter；由单一 owner 顺序写入。
- **只读上下文：** System Info 与 Git Blame Reader 业务域。
- **共享路径：** 无并发 owner。
- **保留不动：** 版本化 Extension API 结构、发布版本号、远程状态。

## 8. 验证矩阵

| 行为或风险  | 验证接缝                                  | 命令或步骤                             | 预期结果                       | Evidence                                                               |
| ----------- | ----------------------------------------- | -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| AC-001      | Resolver 单元 + SCM Extension Host        | 定向 Vitest 与 `pnpm test:integration` | 只使用指定 SCM 仓库            | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-002..003 | Adapter/QuickPick 单元 + 真实侧分支集成   | 定向 Vitest 与 Extension Host          | 节点可搜且旧请求不可覆盖       | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-004..005 | Native resources/Provider/Controller/Host | 定向 Vitest 与真实 VS Code Tab API     | 唯一原生页、分层正确、资源释放 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-006      | Manifest/foundation/Extension Host        | 清单单元与复制集成                     | C/V 映射与边界正确             | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |
| AC-007      | 发布候选完整门禁                          | `pnpm check:ci`、包清单与 VSIX         | 全部通过且无旧 Review 资产     | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-01.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移：** 不适用；旧 Review Webview 与依赖一次性删除。
- **监控：** 结构化日志、单元/Extension Host、包清单和完整门禁。
- **回滚：** 不新增业务持久化，可整体恢复上一版本源码；Discard 已有逐文件确认。
- **不可逆操作：** 未执行 commit、push、release；用户工作树写入只由运行时显式命令触发。

## 10. 验收标准

- [x] AC-001..AC-007 全部映射到 Evidence。
- [x] 79 个单元测试文件、21 项 Extension Host 集成与完整门禁通过。
- [x] VSIX 不含 `git-review.js/css`，且记录路径、大小和 SHA-256。
- [x] 不存在未释放资源、英文新增注释、私有命令或旧 Review Webview 入口。
- [x] Ticket、Map、Evidence 与 change 状态一致。
