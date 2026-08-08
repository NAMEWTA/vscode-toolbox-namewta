# 业务域模块开发规范

## 新领域模板

小型领域应在 `src/core/domains/<domain>/` 局部平铺：

```text
<domain>-command.ts
<domain>-model.ts
<domain>-handler.ts
<domain>-handler.test.ts
public-api.ts
```

只有形成稳定子领域、独立生命周期、独立资源组或明显浏览负担时才增加子目录。

## 接入步骤

1. 在领域模型中定义运行时无关数据和 Port。
2. 在 `tool-command-contract.ts` 扩展 `<domain>.<action>` 命令映射。
3. 编写类型化 Handler 与单元测试。
4. 在 Extension Host Adapter 中实现 Port。
5. 在 `register-domain-modules.ts` 注册 Handler。
6. 在命令或 Webview Adapter 中接入 Gateway，不绕过统一入口。
7. 更新能力、文档、国际化、测试与安全说明。

## 边界

- 领域禁止依赖 `vscode`、React、Node、DOM 或其他领域内部文件。
- 跨域流程放入编排层的具体 Workflow，不让领域相互调用。
- `public-api.ts` 是领域唯一公共入口；禁止机械创建更多 Barrel。
- 领域错误必须使用结构化 code，不匹配错误字符串。
- 进入共享层前必须有两个真实调用方和稳定 API。

## 未来首批领域

Copy Reference 与 Git Blame 必须各自独立。复制与 blame 的组合功能属于编排 Workflow，不进入任一领域内部。
