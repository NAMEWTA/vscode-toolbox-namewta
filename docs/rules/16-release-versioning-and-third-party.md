# 发布、版本与第三方代码规范

## 版本

- 使用语义化版本。
- 所有用户可见变化更新 `CHANGELOG.md` 的“未发布”段。
- 公共 Extension API 的不兼容变更必须提高 `apiVersion` 并提供迁移说明。
- `engines.vscode` 必须与 `@types/vscode` 和实际使用 API 一致。

## 打包

发布候选必须通过 `pnpm check:ci`。使用 `pnpm package:list` 审核 VSIX 文件，禁止打入源码、测试、凭据、日志、coverage、环境文件和开发缓存。

## 第三方实现

- 引入代码前必须检查许可证、版权、NOTICE、维护状态、安全和包体积。
- 复制或修改 MIT 等代码时保留原版权与许可证声明。
- 第三方归属集中记录在 `THIRD_PARTY_NOTICES.md`。
- 禁止复制许可证不兼容、来源不明或缺少版权信息的实现。
- 当前基座未融合正式第三方业务实现；接入 Git Blame 与 Copy 功能时必须更新第三方声明。

## 发布工作流

推送与 `package.json` 版本严格一致的 `v<version>` 标签时，GitHub Actions 必须先通过 `pnpm check:ci`，再以最小 `contents: write` 权限使用临时 `GITHUB_TOKEN` 与 `gh` 创建 GitHub Release、上传 VSIX，并保留同一文件作为 Actions Artifact。标签与清单版本不一致时必须失败且不得创建 Release。

当前不自动发布 VS Code Marketplace。若未来启用 Marketplace，必须先新增 ADR，配置受保护环境、短期凭据和最小权限；不得在仓库、工作流或日志中保存 PAT。

## 许可证语言

- 法律许可证文件保留官方英文原文，禁止以翻译文本替换。
- 可额外提供中文参考译文，但必须明确声明英文原文具有法律效力。
- README、第三方声明和发布说明使用中文。
