---
schema_version: 3
artifact: ticket
change: 2026-08-12-git-blame-v2-reader
id: T-07
title: 完成 Reader 搜索、虚拟化与可访问性收尾
status: done
planning_depth: standard
planning_depth_reason: 该 Ticket 收口 Webview 用户交互和性能风险，依赖 Reader 与复制/导航行为稳定后才能验证。
ready: true
risk: high
blocked_by: [T-04, T-05, T-06]
contract_ids: [AC-005, AC-007, AC-016, AC-017, AC-018, AC-019]
owner: unassigned
expected_changes:
  - '<Path>src/webview/git-blame-reader/reader-performance.tsx</Path>'
  - '<Path>src/webview/git-blame-reader/reader-search.tsx</Path>'
  - '<Path>src/webview/git-blame-reader/reader-accessibility.css</Path>'
writable_paths:
  - '<Path>src/webview/git-blame-reader/reader-performance.tsx</Path>'
  - '<Path>src/webview/git-blame-reader/reader-search.tsx</Path>'
  - '<Path>src/webview/git-blame-reader/reader-accessibility.css</Path>'
read_only_paths:
  - '<Path>src/core/</Path>'
  - '<Path>src/extension/</Path>'
  - '<Path>src/webview/git-blame-reader/reader-copy-actions.tsx</Path>'
shared_paths: []
shared_path_owners: []
---

# Ticket T-07: 完成 Reader 搜索、虚拟化与可访问性收尾

- **Ticket 文件：** `<Path>{roots.state}/specdev/changes/{change}/ticket/07-reader-performance-accessibility.md</Path>`
- **总体 Map：** `<Path>{roots.state}/specdev/changes/{change}/tickets-map.md</Path>`
- **上游 Spec：** `<Path>{roots.state}/specdev/changes/{change}/spec.md</Path>`
- **完成 Evidence：** `<Path>{roots.state}/specdev/changes/{change}/evidence/T-07.md</Path>`

## 1. 战略与来源

- **目标：** 让 Reader 在大文件、搜索、键盘、缩放和高对比主题下仍可用且不失去复制能力。
- **可观察产出：** 超过 5,000 logical lines 时按 logical line/block 虚拟化；Ctrl/Cmd+F 搜索源码；键盘和屏幕阅读器可完成阅读与导航。
- **来源：** `US-006`、`US-007`、`AC-005`、`AC-007`、`AC-016`、`AC-017`、`AC-018`、`AC-019`。
- **当前事实：** Webview 已有 React、Vitest DOM 测试和 Git Review VirtualList 先例。
- **Planning Depth 原因：** 用户可见且有大文件性能事故半径，但不新增公共数据契约。

## 2. 决策状态

### 已锁定决策

- 虚拟化单位是 logical line/block，不是 visual wrap row。
- Copy All 直接消费 Host model。
- V2.0 搜索只匹配源码文本。

### 已采用的低影响假设

- 初始虚拟化阈值为 5,000 logical lines；实际渲染窗口沿用现有 VirtualList 的可替换实现。

### 未决问题

无。

## 3. 范围边界

| IN                                                                                      | REUSE                                                                              | OUT                                            |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| 虚拟化、搜索、键盘、focus ring、screen reader labels、CSS variables、高对比和 zoom 修正 | Git Review VirtualList、VS Code Webview CSS variables、T-04/T-05/T-06 model/events | syntax highlight、复杂过滤语法、可配置 UI 主题 |

## 4. 要构建什么

用户打开大型 Reader 时只渲染当前 logical line/block 窗口，但滚动、当前行高亮和 Copy All 的完整性保持。用户按 Ctrl/Cmd+F 搜索源码，匹配行可定位。用户只用键盘可移动、聚焦、打开源文件和复制；日期、作者、SHA 文字本身承担语义，颜色只做增强。

## 5. 实现契约

- **入口或接缝：** React Reader view、DOM keyboard/search events、CSS accessibility surface。
- **输入与输出：** model、current line、search query、keyboard event；输出 visible logical rows、selection/focus/current match。
- **公共接口变化：** 无新的 Host 公共契约，消费 T-01 已锁定消息。
- **不变量：** virtualization 不改变 line/block 身份；搜索不改源码；文字可选；focus 不被滚动重置。
- **状态或数据流：** bootstrap model → view window/search index → typed navigation/copy events。
- **错误与失败行为：** 空搜索、无匹配、大文件异常显示稳定状态；不因搜索触发 Git blame。
- **兼容要求：** Reader 在已有 Webview build、Light/Dark/High Contrast 下构建。
- **安全与隐私要求：** 不把 source text 写入日志或 HTML attribute；继续使用 text node/CSP。

## 6. 执行路线

1. 为 keyboard/search/virtualization 和文本可选择写失败的 DOM 测试。
2. 接入 logical line/block virtualization，验证 Copy All 不依赖当前 DOM。
3. 加入搜索和当前匹配定位。
4. 补齐 ARIA、focus ring、zoom、高对比和主题 CSS。
5. 运行 Webview tests、build 和手动矩阵。

## 7. 路径访问契约

- **预计修改点：** `src/webview/git-blame-reader/reader-performance.tsx`、`reader-search.tsx`、`reader-accessibility.css`。
- **可写范围：** frontmatter `writable_paths`。
- **只读上下文：** Core、Extension Host、T-04/T-05/T-06 Evidence。
- **共享路径：** 无。
- **保留或不动：** Git Review VirtualList 只作为先例，不直接改变其行为。

## 8. 验证矩阵

| 行为或风险            | 验证接缝                 | 命令或步骤                                       | 预期结果                     | Evidence                                                               |
| --------------------- | ------------------------ | ------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------- |
| soft wrap/selection   | DOM test                 | `pnpm test:unit -- src/webview/git-blame-reader` | logical row 保持，文本可选择 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-07.md</Path>` |
| 大文件 virtualization | Webview performance test | fixture >5,000 lines                             | DOM 受控，Copy All 完整      | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-07.md</Path>` |
| search/keyboard/a11y  | DOM + manual             | 定向测试和 E2E/UI 矩阵                           | 键盘、焦点、搜索、高对比可用 | `<Path>{roots.state}/specdev/changes/{change}/evidence/T-07.md</Path>` |

## 9. 发布、迁移与恢复

- **迁移顺序：** T-04 MVP → T-05/T-06 行为稳定 → T-07 性能和可访问性收口。
- **兼容窗口：** Reader MVP 功能不删除；性能阈值可通过后续 Spec 调整。
- **监控信号：** 渲染行数、搜索耗时、虚拟化异常和无匹配状态摘要。
- **回滚或前向恢复：** 性能回归时临时回退 virtualization 实现但保留 model/Copy contract；不得恢复不可选择的 Canvas。
- **不可逆操作与批准点：** 无。
- **收缩条件：** 无旧协议收缩。

## 10. 验收标准

- [x] `AC-005`、`AC-007`、`AC-016`、`AC-017`、`AC-018`、`AC-019` 通过。
- [x] 手动 UI 矩阵和自动化结果分别记录，不把未运行项标为通过。
