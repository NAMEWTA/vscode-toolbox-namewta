---
schema_version: 3
artifact: tickets-map
change: 2026-08-10-copy-ranges-and-aggregate-git-review
status: done
---

# Tickets Map: 精确引用与聚合 Git Review

## 1. 目标与拆分策略

一个 Deep Ticket 串行拥有公共契约、Git 适配、Webview 和共享清单，保证每次落点均可构建。

## 2. 执行清单

| ID   | Ticket                                                                                                                                             | 产出                                           | Ready | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----- | ------ |
| T-01 | `<Path>{roots.state}/specdev/changes/2026-08-10-copy-ranges-and-aggregate-git-review/ticket/01-deliver-copy-ranges-and-aggregate-review.md</Path>` | 精确引用、聚合页、文件级 Git 操作和 0.1.2 VSIX | yes   | done   |

## 3. 依赖 DAG

```text
T-01
```

## 4. 合同覆盖矩阵

| Contract         | Ticket | 验证接缝                                                   | 状态     |
| ---------------- | ------ | ---------------------------------------------------------- | -------- |
| AC-001 至 AC-009 | T-01   | Formatter、Adapter、Core、React、Blame、Extension Host、CI | verified |

## 5. 并行与路径所有权

单 Ticket 串行执行，不创建 worktree；T-01 唯一拥有全部共享契约、Manifest 和锁文件。AC-001 至 AC-009 全部由 T-01 覆盖，Evidence 写入 `<Path>{roots.state}/specdev/changes/2026-08-10-copy-ranges-and-aggregate-git-review/evidence/T-01.md</Path>`。

## 6. Gate、Wave 与集成点

只有一个执行 Wave；红绿测试、双轴审查、完整门禁、视觉验收和 VSIX 审计全部通过后关闭。

## 7. 横切契约与风险

Workspace Trust、命令兼容、消息验证、Git 路径安全、取消和资源释放跨越全部实现层。

## 8. 同步规则

Ticket frontmatter 是状态权威；实现完成后同步 Map、Evidence、change status 和全局 status。
