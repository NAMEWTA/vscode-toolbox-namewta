---
schema_version: 3
artifact: tickets-map
change: 2026-08-24-git-navigation-and-native-review
status: completed
---

# Tickets Map: Git 节点搜索与原生 Review

## 1. 拆分策略

仓库解析、Gateway 合同、原生 Changes、组合根、Manifest 和发布制品互相耦合，采用一个 Deep 纵向 Ticket 顺序交付，避免共享配置和国际化出现并发 owner。

## 2. 执行清单

| ID   | Ticket                                                                                                      | 可观察产出                              | Blocked By | Depth | Risk | Ready | Owner | Contract IDs   | Status |
| ---- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------- | ----- | ---- | ----- | ----- | -------------- | ------ |
| T-01 | `<Path>{roots.state}/specdev/changes/{change}/ticket/01-deliver-git-navigation-and-native-review.md</Path>` | 全 refs 搜索、原生 Review 与 C/V 快捷键 | —          | deep  | high | yes   | Codex | AC-001..AC-007 | done   |

## 3. 依赖 DAG

```text
T-01 [DONE]: repository/search red-green -> native Changes migration -> queue actions/shortcuts -> Extension Host -> full gates/evidence
```

单 Ticket 顺序执行，避免 composition root、命令清单、国际化和包配置产生共享 owner 竞争。

## 4. 合同覆盖矩阵

| Contract ID | 覆盖 Ticket | 验证接缝                                     | 状态    |
| ----------- | ----------- | -------------------------------------------- | ------- |
| AC-001      | T-01        | 仓库解析器单元与 SCM Extension Host          | covered |
| AC-002      | T-01        | Adapter/QuickPick 单元与真实侧分支集成       | covered |
| AC-003      | T-01        | QuickPick 搜索取消与代际单元                 | covered |
| AC-004      | T-01        | 原生资源映射、Presentation 与 Extension Host | covered |
| AC-005      | T-01        | Provider/Controller/Queue 单元               | covered |
| AC-006      | T-01        | Manifest/foundation 与复制集成               | covered |
| AC-007      | T-01        | 完整门禁、包清单与 VSIX                      | covered |

## 5. 并行与路径所有权

不并行、不创建额外 worktree；根配置、国际化、组合根、测试和文档由 Codex 单一 owner 顺序修改，`shared_paths` 为空。

## 6. Gate、Wave 与集成点

G1 仓库与搜索红绿、G2 原生 Review 与队列动作、G3 快捷键/文档/依赖清理、G4 Extension Host、G5 完整门禁/干净 VSIX/Evidence 均已完成。

## 7. 横切契约与风险

typed Gateway、Git 参数数组、外部输入验证、取消与代际、资源释放、公共 VS Code 命令和中文文档规则适用于全部 Gate。

## 8. 同步规则

Ticket frontmatter 是状态权威；状态变化同步 Map、Evidence 与 change status，并运行 SpecDev validator。
