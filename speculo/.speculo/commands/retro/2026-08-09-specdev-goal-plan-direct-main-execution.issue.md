# 问题

普通 Goal Plan 在 DAG 串行、写路径按 Ticket 有序交接且没有用户隔离要求时，仍可能把 worktree、Ticket 分支和逐 Ticket 合并写成默认执行安排。

## 影响

这会把可选的隔离机制误写为默认工作方式，增加基线同步、状态同步和合并负担；同时与路径所有权规则中“顺序执行默认共用当前工作区”的约定不一致。

## 复现与证据

在 `specdev/goal-plan` 的一次普通 Goal Plan 运行中，用户已选择普通计划，且 T-01 至 T-04 之间没有可安全并行的关系。初版 Goal Plan 仍包含隔离 worktree、Ticket 分支和逐 Ticket 合并。用户随后指出：

> 我选择了普通计划，为什么还需要里面写入 worktree？应该也不做规定，可直接在当前分支上进行开发

修订记录位于 `speculo/.speculo/specdev/changes/2026-08-09-review-all-git-changes/LOG.md` 的 `LOG-015`。该记录将计划改为在当前 `main` 串行执行，不再创建隔离工作区、Ticket 分支或逐 Ticket 合并规则。

相关规则已经说明：`speculo/workflows/specdev/common/rules/path-ownership.md` 将 worktree 的使用条件限定为并行或临时隔离项目写入，并规定顺序执行默认共用当前工作区。

## 根因

`P-goal-plan.md` 和 `planning-modes.md` 对普通计划只明确排除了委派角色、派单和交付协议；它们没有把“串行执行默认当前工作区”提升为普通 Goal Plan 的规划约束。`goal-plan-template.md` 与对应检查项也没有要求 worktree、分支和合并步骤具备明确触发条件。

结果是规划者可能将隔离和合并误当作通用安全步骤，而不是只在并行写入、用户明确要求隔离或有具体临时隔离理由时使用的机制。

## 建议修复

1. 在 `P-goal-plan.md` 和 `planning-modes.md` 中明确：普通且顺序执行的 Goal Plan 默认在当前工作区推进。
2. 规定计划必须在写入 worktree、Ticket 分支或合并流程前记录触发条件；没有触发条件时不得写入这些安排。
3. 调整 `goal-plan-template.md`，让普通计划默认不包含隔离、分支或合并占位，需要时按触发条件加入。
4. 新增 fixture、验证规则或等效可重复检查，拦截没有隔离理由的普通串行计划中的 worktree、Ticket 分支和逐 Ticket 合并安排。

## 验收标准

- 普通、串行的 Goal Plan 明确使用当前工作区作为默认执行位置。
- 无隔离触发条件时，普通计划和模板不包含 worktree、Ticket 分支或逐 Ticket 合并安排。
- 并行写入、用户明确隔离或有具体临时隔离需求时，仍可规划 worktree，并记录理由。
- 该规则有可重复的验证覆盖。
