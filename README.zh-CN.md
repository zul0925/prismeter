# Prismeter

[English](README.md) | [简体中文](README.zh-CN.md)

> 一款注重隐私的 Windows AI 用量管理工具，集中查看多个平台的套餐额度、账户余额、远端用量与同步状态。

[![平台](https://img.shields.io/badge/platform-Windows-3578e5)](https://github.com/zul0925/prismeter)
[![Tauri](https://img.shields.io/badge/Tauri-2-24c8db)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/backend-Rust-b7410e)](https://www.rust-lang.org/)
[![版本](https://img.shields.io/badge/version-0.20.3-7458d6)](https://github.com/zul0925/prismeter/releases)
[![许可证](https://img.shields.io/badge/license-Apache--2.0-3da639)](LICENSE)

Prismeter（棱镜计量）将不同 AI 平台返回的数据汇聚到一个桌面应用中，再按平台、账户、套餐和模型能力分别展示。它只呈现平台实际提供的远端指标，不读取本地会话日志，也不会用模拟数据补齐平台未开放的字段。

## 主要功能

- 多平台、多账户统一管理，同一平台可以连接多个账户。
- 展示套餐额度、余额、周期窗口、Token、席位和接入点等平台实际支持的指标。
- 手动同步、定时同步、启动时同步、单账户重试、每批最多 4 个账户并发，以及失败后的 2/5/15 分钟分级重试。
- 同步状态、失败原因、请求耗时和最近同步历史。
- 可设置本地历史保留 30/90/180/365 天，并可单独清除历史而不影响账户和凭据。
- 对 OpenAI/Codex、火山方舟和 DeepSeek 的远端数值指标进行本机采样，可查看 24 小时、7 天、30 天和 90 天趋势。
- 主状态文件损坏时，可从最近一次有效且仍保持加密的本地备份自动恢复。
- 余额、额度、同步失败和数据过期提醒，并支持单条暂缓 24 小时或恢复通知。
- 可为单个账户覆盖全局余额、额度和数据过期阈值，也可仅关闭该账户的提醒。
- 数据过期判断可跟随同步计划，也可独立设置为 1 小时至 7 天。
- 按真实远端字段进行模型与产品分析。
- 账户和平台卡片支持拖拽排序。
- 浅色、深色和跟随 Windows 系统主题。
- Windows 托盘、关闭到托盘、开机后台启动。
- 支持来自 GitHub Release 的签名应用内更新，可手动或启动时检查，并可跳过指定版本。
- 导出远端产品 CSV、账户数据 JSON 和脱敏诊断信息。

## 平台支持情况

| 平台 | 当前可展示内容 | 连接方式 | 限制 |
| --- | --- | --- | --- |
| OpenAI / Codex | ChatGPT 套餐身份、Codex 周期额度、日用量和 Token 统计 | 复用当前 Windows 用户的 Codex 官方登录状态 | 不提供个人 ChatGPT 对话用量；同一 Windows 用户只需连接一次 |
| 火山引擎方舟 | Agent Plan / AFP、Coding Plan 配额与席位、按量推理 Token、请求数和接入点 | Access Key / Secret Key | 实际字段取决于账户已开通产品及 Ark、费用中心权限 |
| DeepSeek | API 可用状态、总余额、赠送余额和充值余额 | API Key | 官方接口暂不提供模型级 Token 与历史用量明细 |
| Xiaomi MiMo | 已有连接可验证 Key 并读取官方模型列表 | 暂不开放新连接 | 官方尚未开放第三方余额、Credits 或历史用量统计 API |

平台未提供的数据会显示为“—”或明确标注“接口未提供”，不会按 `0` 计算，也不会通过其他数据推算。

## 隐私与数据安全

- API Key、Access Key 和 Secret Key 使用 Windows DPAPI 在本机加密。
- 恢复备份中的凭据同样保持 DPAPI 加密；移除账户和清除历史会同时更新主文件与备份。
- 凭据不会通过前端状态接口返回，也不会出现在 JSON 导出和诊断信息中。
- 不读取聊天记录、Codex 本地会话日志或其他模型客户端历史。
- 余额快照、规范化远端指标快照和同步记录仅保存在本机，用于趋势、状态和故障诊断。
- 所有用量指标均来自已连接平台的远端接口或官方登录服务。

默认数据目录：

```text
%LOCALAPPDATA%\Prismeter\Data
```

## 安装

从 [Releases](https://github.com/zul0925/prismeter/releases) 下载最新的 Windows 安装包并运行。

Prismeter 基于 Tauri 2，在 Windows 上使用 Microsoft Edge WebView2 Runtime。Windows 10 和 Windows 11 通常已经包含该运行环境；如果系统缺少它，需要先安装 WebView2 Runtime。

## 本地开发

### 环境要求

- Windows 10 或 Windows 11（x64）
- Node.js 20 或更高版本
- Rust stable MSVC 工具链
- Microsoft Edge WebView2 Runtime
- Visual Studio Build Tools（Desktop development with C++）

### 获取代码

```powershell
git clone https://github.com/zul0925/prismeter.git
cd prismeter
npm install
```

### 检查与测试

```powershell
npm run check
npm run test:backend
```

`npm run check` 会检查：

- 前端 JavaScript 语法
- HTML 重复 ID 和缺失元素引用
- 演示用量数据是否意外混入生产代码
- 火山引擎请求签名
- Rust 全目标编译

其中有三项测试依赖当前用户登录状态、Windows DPAPI 测试夹具或真实网络，默认会被忽略。

### 构建安装包

```powershell
npm run build
```

NSIS 安装包会生成在：

```text
src-tauri\target\release\bundle\nsis
```

维护者可运行 `npm run build:release`，一次生成带更新签名的安装包、`.sig` 和 `latest.json`。`.tauri-keys/` 下的更新密钥与密码必须另行安全备份，且绝不能提交到仓库。

## 技术栈

- [Tauri 2](https://tauri.app/)：Windows 桌面容器、原生窗口和托盘
- Rust：本地服务、凭据保护、平台适配器、同步与通知
- HTML / CSS / JavaScript：液态玻璃风格界面
- Windows DPAPI：本机凭据加密
- Windows Toast：系统通知

## 项目结构

```text
prismeter/
├─ frontend/                 # 前端页面、样式和交互
├─ src-tauri/
│  ├─ src/backend.rs        # 本地状态、同步、API 与能力矩阵
│  ├─ src/codex.rs          # OpenAI / Codex 适配器
│  ├─ src/volcengine.rs     # 火山引擎方舟适配器
│  ├─ src/mimo.rs           # Xiaomi MiMo 模型发现适配器
│  ├─ src/credential.rs     # Windows DPAPI 凭据保护
│  └─ src/notifications.rs  # Windows 原生通知
├─ BuildFrontend.js         # 前端完整性检查
└─ VerifyVolcengineSignature.js
```

## 项目名称

“Prismeter”由 **Prism**（棱镜）和 **Meter**（计量器）组合而来：像棱镜一样汇聚并拆分不同平台的数据，再通过统一仪表进行查看。

## 当前状态

项目仍处于早期开发阶段。不同平台接口和返回字段可能发生变化，使用前建议核对平台权限与应用中标注的数据来源。

欢迎提交 Issue 反馈平台兼容性、数据字段或界面问题。

## 许可证

Prismeter 的项目代码和原创文档采用 [Apache License 2.0](LICENSE) 授权。你可以在遵守许可证条款的前提下使用、修改和分发本项目。

第三方平台名称、商标、Logo、API 和服务不包含在本项目的 Apache-2.0 授权范围内，仍受各自权利人条款约束。Prismeter 与 OpenAI、火山引擎、DeepSeek、小米及其他兼容平台不存在官方隶属、认可或背书关系。详情参见 [NOTICE](NOTICE) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
