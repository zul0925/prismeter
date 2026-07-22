# Prismeter

[English](README.md) | [简体中文](README.zh-CN.md)

> A privacy-conscious Windows app for monitoring AI plans, account balances, remote usage, and synchronization status across multiple platforms.

[![Platform](https://img.shields.io/badge/platform-Windows-3578e5)](https://github.com/zul0925/prismeter)
[![Tauri](https://img.shields.io/badge/Tauri-2-24c8db)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/backend-Rust-b7410e)](https://www.rust-lang.org/)
[![Version](https://img.shields.io/badge/version-0.20.7-7458d6)](https://github.com/zul0925/prismeter/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-3da639)](LICENSE)

Prismeter brings usage data returned by different AI platforms into one desktop app and presents it by platform, account, plan, and model capability. It only displays metrics actually provided by remote services. It does not read local conversation logs or fill unavailable fields with simulated data.

## Features

- Manage multiple platforms and multiple accounts, including several accounts from the same platform.
- Display plan quotas, balances, billing windows, tokens, seats, endpoints, and other metrics supported by each provider.
- Manual sync, scheduled sync, sync at startup, per-account retry, four-account parallel batches, and bounded 2/5/15-minute retry backoff for transient failures.
- Sync health, failure reasons, request duration, and recent synchronization history.
- Configurable 30/90/180/365-day local history retention, with an isolated history-clear action that preserves accounts and credentials.
- Numeric remote metrics from OpenAI/Codex, Volcengine Ark, and DeepSeek are sampled locally for 24-hour, 7-day, 30-day, and 90-day trend views.
- Automatic recovery from the latest valid encrypted local-state backup when the primary state file is damaged.
- Alerts for balances, quotas, synchronization failures, and stale data, with per-alert 24-hour snooze and resume controls.
- Per-account alert rules can override global balance, quota, and stale-data thresholds or disable alerts for one account.
- Configurable stale-data detection that can follow the synchronization schedule or use an explicit threshold from one hour to seven days.
- Model and product analysis based only on real remote fields.
- Drag-and-drop ordering for accounts and platform cards.
- Light, dark, and Windows system theme modes.
- Windows tray support, close-to-tray behavior, and background launch at startup.
- Signed in-app updates from GitHub Releases, with manual or startup checks and per-version skipping.
- Export remote product data as CSV, account data as JSON, and redacted diagnostics.

## Platform support

| Platform | Available data | Connection | Limitations |
| --- | --- | --- | --- |
| OpenAI / Codex | ChatGPT plan identity, Codex quota windows, daily usage, and token statistics | Reuses the official Codex sign-in state of the current Windows user | Personal ChatGPT conversation usage is unavailable; one connection is sufficient per Windows user |
| Volcengine Ark | Agent Plan / AFP, Coding Plan quotas and seats, pay-as-you-go inference tokens, request counts, and endpoints | Access Key / Secret Key | Available fields depend on enabled products and permissions for Ark and the billing center |
| DeepSeek | API availability, total balance, granted balance, and topped-up balance | API Key | The official API currently provides no model-level token history or detailed historical usage |
| Xiaomi MiMo | Existing connections can validate a key and retrieve the official model list | New connections are currently disabled | No official third-party API is currently available for balances, credits, or historical usage |

Data that a platform does not provide is shown as “—” or explicitly marked as unavailable. It is never counted as `0` or inferred from unrelated fields.

## Privacy and data security

- API keys, access keys, and secret keys are encrypted locally with Windows DPAPI.
- The recovery backup contains the same DPAPI-encrypted credentials; account removal and history deletion are immediately reflected in both copies.
- Credentials are never returned through frontend state APIs or included in JSON exports and diagnostics.
- Prismeter does not read conversation history, local Codex session logs, or other model-client history.
- Balance snapshots, normalized remote metric snapshots, and sync records stay on the local machine for trends, status, and troubleshooting.
- All usage metrics come from remote APIs or official sign-in services for connected platforms.

Default data directory:

```text
%LOCALAPPDATA%\Prismeter\Data
```

## Installation

Download and run the latest Windows installer from [Releases](https://github.com/zul0925/prismeter/releases).

Prismeter is built with Tauri 2 and uses Microsoft Edge WebView2 Runtime on Windows. Windows 10 and Windows 11 usually include this runtime. If it is missing, install WebView2 Runtime before launching Prismeter.

## Local development

### Requirements

- Windows 10 or Windows 11 (x64)
- Node.js 20 or later
- Rust stable with the MSVC toolchain
- Microsoft Edge WebView2 Runtime
- Visual Studio Build Tools with Desktop development with C++

### Get the source

```powershell
git clone https://github.com/zul0925/prismeter.git
cd prismeter
npm install
```

### Checks and tests

```powershell
npm run check
npm run test:backend
```

`npm run check` validates:

- Frontend JavaScript syntax
- Duplicate HTML IDs and missing element references
- Accidental inclusion of demo usage data in production code
- Volcengine request signing
- Rust compilation for all targets

Three tests depend on the current user's sign-in state, Windows DPAPI fixtures, or a live network connection and are ignored by default.

### Build the installer

```powershell
npm run build
```

The NSIS installer is generated under:

```text
src-tauri\target\release\bundle\nsis
```

Maintainers can generate the signed installer, updater signature, and `latest.json` together with `npm run build:release`. The updater key and password under `.tauri-keys/` must be backed up securely and never committed.

## Technology

- [Tauri 2](https://tauri.app/) for the Windows desktop shell, native window, and tray
- Rust for local services, credential protection, platform adapters, sync, and notifications
- HTML, CSS, and JavaScript for the liquid-glass-inspired interface
- Windows DPAPI for local credential encryption
- Windows Toast for system notifications

## Project structure

```text
prismeter/
├─ frontend/                 # Frontend pages, styles, and interactions
├─ src-tauri/
│  ├─ src/backend.rs        # Local state, sync, APIs, and capability matrix
│  ├─ src/codex.rs          # OpenAI / Codex adapter
│  ├─ src/volcengine.rs     # Volcengine Ark adapter
│  ├─ src/mimo.rs           # Xiaomi MiMo model-discovery adapter
│  ├─ src/credential.rs     # Windows DPAPI credential protection
│  └─ src/notifications.rs  # Native Windows notifications
├─ BuildFrontend.js         # Frontend integrity checks
└─ VerifyVolcengineSignature.js
```

## Name

“Prismeter” combines **Prism** and **Meter**: it gathers and separates data from different platforms like a prism, then presents the result through a unified meter.

## Project status

Prismeter is still in an early stage of development. Platform APIs and returned fields may change, so verify provider permissions and the data sources shown in the app before relying on the results.

Issues about platform compatibility, data fields, and interface behavior are welcome.

## License

Prismeter source code and original documentation are licensed under the [Apache License 2.0](LICENSE). You may use, modify, and distribute the project in accordance with its terms.

Third-party platform names, trademarks, logos, APIs, and services are not covered by Prismeter's Apache-2.0 license and remain subject to their respective owners' terms. Prismeter is not affiliated with, endorsed by, or sponsored by OpenAI, Volcengine, DeepSeek, Xiaomi, or any other compatible platform. See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
