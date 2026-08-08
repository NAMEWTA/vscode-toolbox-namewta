# ADR 0002：类型化 Tool Gateway

- 状态：已接受
- 日期：2026-08-03

## 背景

命令、Webview 和其他扩展都可能调用同一业务能力。直接暴露大量 Service 方法会形成巨型接口，并让 VS Code 对象渗入领域。

## 决定

使用 `ToolCommandMap`、`ToolHandler`、`ToolRegistry` 和 `ToolboxGateway.execute(command, input)`。命令输入输出和错误必须可序列化；Extension API 版本固定为 1。

## 后果

调用入口统一，内部仍按领域隔离。新增命令需要显式扩展契约和验证，这是有意的编译期治理成本。
