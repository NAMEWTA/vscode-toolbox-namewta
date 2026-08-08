# ADR 0004：通过 GitHub Release 发布 VSIX

- 状态：已接受
- 日期：2026-08-09

## 背景

项目需要向公开 GitHub 仓库提供可安装的 VS Code 扩展包。原有工作流只上传 Actions Artifact，用户无法通过稳定的 Release 页面下载特定版本；同时项目明确不配置 VS Code Marketplace 凭据。

## 决定

仓库发布到公开的 `NAMEWTA/vscode-toolbox-namewta`。当推送与 `package.json` 版本完全一致的 `v<version>` 标签时，GitHub Actions 在 Ubuntu runner 重新运行 `pnpm check:ci`，上传 VSIX Artifact，并以最小 `contents: write` 权限将临时 `GITHUB_TOKEN` 传给 `gh release create`。Release 使用同名标签、自动生成说明并附加唯一 VSIX 文件。

工作流不向 VS Code Marketplace 或 npm 发布，也不保存任何发布 PAT。

## 后果

发布过程可由标签、工作流记录和 Release 附件追溯；失败的质量门禁或标签版本校验不会创建 Release。用户需从 GitHub Release 下载 VSIX 并在 VS Code 中手动安装。若未来要发布 Marketplace，必须增加独立 ADR 和受保护环境设计。
