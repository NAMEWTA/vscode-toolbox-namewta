# 安全策略

## 支持版本

在项目处于 1.0 之前，安全修复应用于最新发布的次版本线。

## 报告安全问题

发现疑似漏洞时，不要创建公开 Issue。请使用本仓库 Security 页面的 **Report a vulnerability** 提交 GitHub 私有安全公告；该报告只对报告者与仓库安全维护者可见。报告应包含复现步骤、影响范围、受影响版本和可选缓解建议。

## 基座安全规则

- Webview 必须使用严格 CSP、nonce 脚本和受限本地资源范围。
- 消息和未来所有外部输入必须从 `unknown` 开始进行运行时验证。
- 危险能力必须在代码中检查工作区信任，不能只依赖界面隐藏。
- Git 子进程只使用参数数组，具有取消、10 秒超时、64 MiB 输出上限和资源清理，禁止插值执行 Shell 字符串。
- 日志禁止包含凭据、秘密和非必要源码内容。
- 通过 `pnpm package:list` 审查 VSIX 内容。
- 路径、URI、配置、Webview 消息和 Git 输出都视为不可信边界输入。
- Git Blame 仅在受信任工作区中对可执行 Git 资源运行；Manifest 的 `when` 条件不能替代运行时权限检查。
- Hover 只信任明确注册的内部命令；remote 链接仅允许无凭据的 GitHub、GitLab、Bitbucket 和 Gitee HTTPS 地址。
- Historical Document URI 只包含随机仓库 token、ref 和仓库相对路径，不写临时文件或暴露绝对仓库根。
