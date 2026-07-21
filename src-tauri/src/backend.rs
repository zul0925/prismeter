use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use chrono::Utc;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
use uuid::Uuid;

use crate::{codex, credential, mimo, notifications, volcengine};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const DEEPSEEK_BALANCE_URL: &str = "https://api.deepseek.com/user/balance";
const REMOTE_TIMEOUT_SECONDS: u64 = 18;
const BALANCE_HISTORY_LIMIT: usize = 1000;
const SYNC_EVENT_STORAGE_LIMIT: usize = 500;
const PUBLIC_HISTORY_LIMIT: usize = 120;
const INDEX_HTML: &[u8] = include_bytes!("../../frontend/index.html");
const STYLES_CSS: &[u8] = include_bytes!("../../frontend/styles.css");
const APP_JS: &[u8] = include_bytes!("../../frontend/app.js");

type AppResult<T> = Result<T, String>;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    #[serde(default = "default_appearance_mode")]
    appearance_mode: String,
    #[serde(default = "default_auto_sync")]
    auto_sync_minutes: i32,
    #[serde(default = "default_low_balance")]
    low_balance_threshold: f64,
    #[serde(default = "default_usage_threshold")]
    usage_threshold: f64,
    #[serde(default = "default_notifications")]
    notifications_enabled: bool,
    #[serde(default)]
    sync_on_startup: bool,
    #[serde(default = "default_close_to_tray")]
    close_to_tray: bool,
    #[serde(default)]
    launch_at_startup: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            appearance_mode: default_appearance_mode(),
            auto_sync_minutes: default_auto_sync(),
            low_balance_threshold: default_low_balance(),
            usage_threshold: default_usage_threshold(),
            notifications_enabled: default_notifications(),
            sync_on_startup: false,
            close_to_tray: default_close_to_tray(),
            launch_at_startup: false,
        }
    }
}

fn default_appearance_mode() -> String { "system".into() }
fn default_auto_sync() -> i32 { 30 }
fn default_low_balance() -> f64 { 10.0 }
fn default_usage_threshold() -> f64 { 80.0 }
fn default_notifications() -> bool { true }
fn default_close_to_tray() -> bool { true }

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BalanceInfo {
    #[serde(default)] currency: String,
    #[serde(default)] total: String,
    #[serde(default)] granted: String,
    #[serde(default)] topped_up: String,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BalanceSnapshot {
    #[serde(default)] account_id: String,
    #[serde(default)] timestamp: String,
    #[serde(default)] currency: String,
    #[serde(default)] total: String,
    #[serde(default)] granted: String,
    #[serde(default)] topped_up: String,
    #[serde(default)] is_available: bool,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncEvent {
    #[serde(default)] id: String,
    #[serde(default)] account_id: String,
    #[serde(default)] timestamp: String,
    #[serde(default)] success: bool,
    #[serde(default)] duration_ms: u64,
    #[serde(default)] product_count: usize,
    #[serde(default)] message: String,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Account {
    #[serde(default)] id: String,
    #[serde(default)] provider: String,
    #[serde(default)] name: String,
    #[serde(default)] encrypted_key: String,
    #[serde(default)] encrypted_secret_key: String,
    #[serde(default)] region: String,
    #[serde(default)] project_name: String,
    #[serde(default)] base_url: String,
    #[serde(default)] key_hint: String,
    #[serde(default)] email: String,
    #[serde(default)] plan_type: String,
    #[serde(default)] created_at: String,
    #[serde(default)] enabled: Option<bool>,
    #[serde(default)] last_attempt_at: String,
    #[serde(default)] last_sync_duration_ms: u64,
    #[serde(default)] consecutive_failures: u32,
    #[serde(default)] last_sync: String,
    #[serde(default)] last_error: Option<String>,
    #[serde(default)] is_available: bool,
    #[serde(default)] balances: Vec<BalanceInfo>,
    #[serde(default)] products: Vec<Value>,
    #[serde(default)] product_errors: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedState {
    #[serde(default)] accounts: Vec<Account>,
    #[serde(default)] provider_order: Vec<String>,
    #[serde(default)] history: Vec<BalanceSnapshot>,
    #[serde(default)] sync_events: Vec<SyncEvent>,
    #[serde(default)] settings: Settings,
    #[serde(default)] notified_alert_keys: Vec<String>,
}

impl Default for PersistedState {
    fn default() -> Self {
        Self {
            accounts: Vec::new(),
            provider_order: Vec::new(),
            history: Vec::new(),
            sync_events: Vec::new(),
            settings: Settings::default(),
            notified_alert_keys: Vec::new(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddAccountRequest {
    #[serde(default)] provider: String,
    #[serde(default)] name: String,
    #[serde(default)] api_key: String,
    #[serde(default)] access_key: String,
    #[serde(default)] secret_key: String,
    #[serde(default)] region: String,
    #[serde(default)] project_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateAccountRequest {
    name: Option<String>,
    enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReorderAccountsRequest {
    account_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReorderProvidersRequest {
    provider_ids: Vec<String>,
}

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateConnectionRequest {
    #[serde(default)] api_key: String,
    #[serde(default)] access_key: String,
    #[serde(default)] secret_key: String,
    #[serde(default)] region: String,
    #[serde(default)] project_name: String,
    #[serde(default)] base_url: String,
}

#[derive(Deserialize)]
struct DeepSeekResponse {
    is_available: bool,
    #[serde(default)] balance_infos: Vec<DeepSeekBalance>,
}

#[derive(Deserialize)]
struct DeepSeekBalance {
    #[serde(default)] currency: String,
    #[serde(default)] total_balance: String,
    #[serde(default)] granted_balance: String,
    #[serde(default)] topped_up_balance: String,
}

struct Store {
    state: Mutex<PersistedState>,
    syncing_accounts: Mutex<HashSet<String>>,
    state_path: PathBuf,
    http: Client,
}

impl Store {
    fn open(data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(data_dir).map_err(|e| format!("无法创建数据目录：{e}"))?;
        let state_path = data_dir.join("accounts.json");
        let state = if state_path.exists() {
            let text = fs::read_to_string(&state_path).map_err(|e| format!("无法读取账户数据：{e}"))?;
            serde_json::from_str(text.trim_start_matches('\u{feff}'))
                .map_err(|e| format!("账户数据格式无效：{e}"))?
        } else {
            PersistedState::default()
        };
        let backup = data_dir.join("accounts.pre-rust-0.8.1.json");
        if state_path.exists() && !backup.exists() {
            fs::copy(&state_path, &backup).map_err(|e| format!("无法备份旧账户数据：{e}"))?;
        }
        let http = Client::builder()
            .timeout(Duration::from_secs(REMOTE_TIMEOUT_SECONDS))
            .user_agent(format!("Prismeter/{VERSION}"))
            .build()
            .map_err(|e| format!("无法初始化网络客户端：{e}"))?;
        Ok(Self {
            state: Mutex::new(state),
            syncing_accounts: Mutex::new(HashSet::new()),
            state_path,
            http,
        })
    }

    fn save_locked(&self, state: &PersistedState) -> AppResult<()> {
        let temp = self.state_path.with_extension("json.tmp");
        let data = serde_json::to_vec(state).map_err(|e| format!("无法序列化账户数据：{e}"))?;
        fs::write(&temp, data).map_err(|e| format!("无法写入账户数据：{e}"))?;
        fs::rename(&temp, &self.state_path).or_else(|_| {
            fs::copy(&temp, &self.state_path).map(|_| ()).and_then(|_| fs::remove_file(&temp))
        }).map_err(|e| format!("无法保存账户数据：{e}"))
    }

    fn protect(&self, value: &str) -> AppResult<String> {
        credential::protect(value)
    }

    fn unprotect(&self, value: &str) -> AppResult<String> {
        credential::unprotect(value)
    }

    fn deepseek(&self, api_key: &str) -> AppResult<DeepSeekResponse> {
        let response = self.http.get(DEEPSEEK_BALANCE_URL)
            .bearer_auth(api_key).send().map_err(|e| format!("无法连接 DeepSeek：{e}"))?;
        let status = response.status();
        if status.as_u16() == 401 { return Err("API Key 无效或已失效。".to_string()); }
        if status.as_u16() == 429 { return Err("DeepSeek 请求过于频繁，请稍后重试。".to_string()); }
        if !status.is_success() { return Err(format!("DeepSeek 返回 HTTP {}。", status.as_u16())); }
        response.json().map_err(|e| format!("DeepSeek 返回了无法识别的数据：{e}"))
    }

    fn codex(&self) -> AppResult<codex::CodexUsage> {
        codex::read_usage()
    }

    fn mimo(&self, api_key: &str, base_url: &str) -> AppResult<mimo::MimoDiscovery> {
        mimo::discover(&self.http, api_key, base_url)
    }

    fn volcengine(
        &self,
        access_key: &str,
        secret_key: &str,
        region: &str,
        project: &str,
    ) -> AppResult<(Vec<Value>, Vec<String>)> {
        volcengine::discover(&self.http, access_key, secret_key, region, project)
    }

    fn add_account(&self, input: AddAccountRequest) -> AppResult<Value> {
        let provider = if input.provider.trim().is_empty() { "deepseek" } else { input.provider.trim() };
        let now = now();
        let account = match provider {
            "openai" => {
                if self.state.lock().unwrap().accounts.iter().any(|a| a.provider == "openai") {
                    return Err("当前 Windows 用户的 OpenAI 登录账户已经连接。".to_string());
                }
                let usage = self.codex()?;
                let email = usage.email;
                Account {
                    id: new_id(), provider: "openai".into(),
                    name: default_name(&input.name, "OpenAI 本机账户"),
                    key_hint: if email.is_empty() { "Codex 官方登录态".into() } else { email.clone() },
                    email, plan_type: usage.plan_type,
                    products: usage.products,
                    product_errors: usage.warnings,
                    is_available: true, created_at: now.clone(), last_sync: now,
                    enabled: Some(true), ..Account::default()
                }
            }
            "volcengine" => {
                if input.access_key.trim().is_empty() || input.secret_key.trim().is_empty() {
                    return Err("请输入火山方舟 Access Key 和 Secret Key。".to_string());
                }
                let region = if input.region.trim().is_empty() { "cn-beijing" } else { input.region.trim() };
                let project = if input.project_name.trim().is_empty() { "default" } else { input.project_name.trim() };
                let (products, warnings) = self.volcengine(
                    input.access_key.trim(), input.secret_key.trim(), region, project
                )?;
                Account {
                    id: new_id(), provider: "volcengine".into(),
                    name: default_name(&input.name, "火山方舟主账户"),
                    encrypted_key: self.protect(input.access_key.trim())?,
                    encrypted_secret_key: self.protect(input.secret_key.trim())?,
                    key_hint: key_hint("AK ", input.access_key.trim()),
                    region: region.into(), project_name: project.into(),
                    products,
                    product_errors: warnings,
                    is_available: true, created_at: now.clone(), last_sync: now,
                    enabled: Some(true), ..Account::default()
                }
            }
            "mimo" => {
                return Err("Xiaomi MiMo 暂不可添加：官方尚未开放第三方用量统计接口，当前只能验证 Key 和读取模型列表。".to_string());
            }
            "deepseek" => {
                if input.api_key.trim().is_empty() { return Err("请输入 DeepSeek API Key。".to_string()); }
                let remote = self.deepseek(input.api_key.trim())?;
                let mut account = Account {
                    id: new_id(), provider: "deepseek".into(),
                    name: default_name(&input.name, "DeepSeek 主账户"),
                    encrypted_key: self.protect(input.api_key.trim())?,
                    key_hint: key_hint("", input.api_key.trim()),
                    created_at: now, enabled: Some(true), ..Account::default()
                };
                apply_deepseek(&mut account, remote);
                account
            }
            _ => return Err("暂不支持该平台。".to_string()),
        };

        let public = public_account(&account);
        let mut state = self.state.lock().unwrap();
        if account.provider == "openai" && state.accounts.iter().any(|item| item.provider == "openai") {
            return Err("当前 Windows 用户的 OpenAI 登录账户已经连接。".to_string());
        }
        if account.provider == "deepseek" { add_snapshots(&mut state, &account); }
        if !state.provider_order.iter().any(|provider| provider == &account.provider) {
            state.provider_order.push(account.provider.clone());
        }
        state.accounts.push(account);
        self.save_locked(&state)?;
        Ok(json!({ "ok": true, "account": public }))
    }

    fn sync_account(&self, id: &str) -> AppResult<Value> {
        {
            let mut syncing = self.syncing_accounts.lock().unwrap();
            if !syncing.insert(id.to_string()) {
                return Err("该账户正在同步，请稍候。".into());
            }
        }
        let result = self.sync_account_inner(id);
        self.syncing_accounts.lock().unwrap().remove(id);
        result
    }

    fn sync_account_inner(&self, id: &str) -> AppResult<Value> {
        let account = {
            let mut state = self.state.lock().unwrap();
            let account = state.accounts.iter_mut().find(|a| a.id == id).ok_or("账户不存在。")?;
            account.last_attempt_at = now();
            let clone = account.clone();
            self.save_locked(&state)?;
            clone
        };
        let started = Instant::now();
        let result = self.fetch_account(&account);
        let mut state = self.state.lock().unwrap();
        let index = state.accounts.iter().position(|a| a.id == id).ok_or("账户不存在。")?;
        match result {
            Ok(update) => {
                let mut updated = state.accounts[index].clone();
                updated.email = update.email;
                updated.plan_type = update.plan_type;
                if !update.base_url.is_empty() { updated.base_url = update.base_url; }
                if !update.key_hint.is_empty() { updated.key_hint = update.key_hint; }
                updated.is_available = update.is_available;
                updated.balances = update.balances;
                updated.products = update.products;
                updated.product_errors = update.product_errors;
                updated.last_sync = now();
                updated.last_error = None;
                updated.consecutive_failures = 0;
                updated.last_sync_duration_ms = started.elapsed().as_millis() as u64;
                state.accounts[index] = updated.clone();
                if updated.provider == "deepseek" { add_snapshots(&mut state, &updated); }
                add_sync_event(&mut state, &updated, true, "同步成功".into());
                self.save_locked(&state)?;
                Ok(json!({ "ok": true, "account": public_account(&updated) }))
            }
            Err(error) => {
                state.accounts[index].last_error = Some(error.clone());
                state.accounts[index].consecutive_failures += 1;
                state.accounts[index].last_sync_duration_ms = started.elapsed().as_millis() as u64;
                let failed = state.accounts[index].clone();
                add_sync_event(&mut state, &failed, false, error.clone());
                self.save_locked(&state)?;
                Err(error)
            }
        }
    }

    fn update_connection(&self, id: &str, input: UpdateConnectionRequest) -> AppResult<Value> {
        {
            let mut syncing = self.syncing_accounts.lock().unwrap();
            if !syncing.insert(id.to_string()) {
                return Err("该账户正在同步，请稍候。".into());
            }
        }
        let started = Instant::now();
        let result = self.update_connection_inner(id, input);
        if let Err(error) = &result {
            let mut state = self.state.lock().unwrap();
            if let Some(index) = state.accounts.iter().position(|account| account.id == id) {
                state.accounts[index].last_attempt_at = now();
                state.accounts[index].last_error = Some(error.clone());
                state.accounts[index].consecutive_failures = state.accounts[index]
                    .consecutive_failures
                    .saturating_add(1);
                state.accounts[index].last_sync_duration_ms = started.elapsed().as_millis() as u64;
                let failed = state.accounts[index].clone();
                add_sync_event(&mut state, &failed, false, error.clone());
                if let Err(save_error) = self.save_locked(&state) {
                    self.syncing_accounts.lock().unwrap().remove(id);
                    return Err(save_error);
                }
            }
        }
        self.syncing_accounts.lock().unwrap().remove(id);
        result
    }

    fn update_connection_inner(&self, id: &str, input: UpdateConnectionRequest) -> AppResult<Value> {
        let original = self.state.lock().unwrap().accounts.iter()
            .find(|account| account.id == id).cloned().ok_or("账户不存在。")?;
        if original.provider == "openai" {
            return Err("OpenAI 使用当前 Windows 用户的官方登录状态，无需修改凭据。".into());
        }

        let started = Instant::now();
        let mut updated = original.clone();
        match original.provider.as_str() {
            "deepseek" => {
                let api_key = if input.api_key.trim().is_empty() {
                    self.unprotect(&original.encrypted_key)?
                } else {
                    input.api_key.trim().to_string()
                };
                let remote = self.deepseek(&api_key)?;
                apply_deepseek(&mut updated, remote);
                if !input.api_key.trim().is_empty() {
                    updated.encrypted_key = self.protect(&api_key)?;
                    updated.key_hint = key_hint("", &api_key);
                }
            }
            "volcengine" => {
                let access_key = if input.access_key.trim().is_empty() {
                    self.unprotect(&original.encrypted_key)?
                } else {
                    input.access_key.trim().to_string()
                };
                let secret_key = if input.secret_key.trim().is_empty() {
                    self.unprotect(&original.encrypted_secret_key)?
                } else {
                    input.secret_key.trim().to_string()
                };
                let region = if input.region.trim().is_empty() {
                    original.region.clone()
                } else {
                    input.region.trim().to_string()
                };
                let project = if input.project_name.trim().is_empty() {
                    original.project_name.clone()
                } else {
                    input.project_name.trim().to_string()
                };
                let (products, warnings) = self.volcengine(
                    &access_key, &secret_key, &region, &project
                )?;
                if !input.access_key.trim().is_empty() {
                    updated.encrypted_key = self.protect(&access_key)?;
                    updated.key_hint = key_hint("AK ", &access_key);
                }
                if !input.secret_key.trim().is_empty() {
                    updated.encrypted_secret_key = self.protect(&secret_key)?;
                }
                updated.region = region;
                updated.project_name = project;
                updated.products = products;
                updated.product_errors = warnings;
                updated.is_available = true;
            }
            "mimo" => {
                let api_key = if input.api_key.trim().is_empty() {
                    self.unprotect(&original.encrypted_key)?
                } else {
                    input.api_key.trim().to_string()
                };
                let base_url = if input.base_url.trim().is_empty() {
                    original.base_url.clone()
                } else {
                    input.base_url.trim().to_string()
                };
                let discovery = self.mimo(&api_key, &base_url)?;
                if !input.api_key.trim().is_empty() {
                    updated.encrypted_key = self.protect(&api_key)?;
                    updated.key_hint = key_hint("MiMo ", &api_key);
                }
                updated.base_url = discovery.base_url;
                updated.plan_type = discovery.plan_type;
                updated.products = discovery.products;
                updated.product_errors = discovery.warnings;
                updated.is_available = true;
            }
            _ => return Err("暂不支持该平台。".into()),
        }

        updated.last_attempt_at = now();
        updated.last_sync = now();
        updated.last_error = None;
        updated.consecutive_failures = 0;
        updated.last_sync_duration_ms = started.elapsed().as_millis() as u64;

        let mut state = self.state.lock().unwrap();
        let index = state.accounts.iter().position(|account| account.id == id)
            .ok_or("账户不存在。")?;
        state.accounts[index] = updated.clone();
        if updated.provider == "deepseek" { add_snapshots(&mut state, &updated); }
        add_sync_event(&mut state, &updated, true, "连接设置验证成功".into());
        self.save_locked(&state)?;
        Ok(json!({ "ok": true, "account": public_account(&updated) }))
    }

    fn fetch_account(&self, account: &Account) -> AppResult<Account> {
        let mut update = Account::default();
        match account.provider.as_str() {
            "openai" => {
                let usage = self.codex()?;
                update.email = usage.email;
                update.plan_type = usage.plan_type;
                update.key_hint = if update.email.is_empty() { "Codex 官方登录态".into() } else { update.email.clone() };
                update.products = usage.products;
                update.product_errors = usage.warnings;
                update.is_available = true;
            }
            "volcengine" => {
                let access_key = self.unprotect(&account.encrypted_key)?;
                let secret_key = self.unprotect(&account.encrypted_secret_key)?;
                let (products, warnings) = self.volcengine(
                    &access_key, &secret_key, &account.region, &account.project_name
                )?;
                update.products = products;
                update.product_errors = warnings;
                update.is_available = true;
            }
            "mimo" => {
                let api_key = self.unprotect(&account.encrypted_key)?;
                let discovery = self.mimo(&api_key, &account.base_url)?;
                update.base_url = discovery.base_url;
                update.plan_type = discovery.plan_type;
                update.products = discovery.products;
                update.product_errors = discovery.warnings;
                update.is_available = true;
            }
            "deepseek" => {
                let api_key = self.unprotect(&account.encrypted_key)?;
                apply_deepseek(&mut update, self.deepseek(&api_key)?);
            }
            _ => return Err("暂不支持该平台。".to_string()),
        }
        Ok(update)
    }

    fn sync_all(&self) -> Value {
        let ids: Vec<String> = self.state.lock().unwrap().accounts.iter()
            .filter(|a| a.enabled != Some(false)).map(|a| a.id.clone()).collect();
        let results: Vec<Value> = ids.into_iter().map(|id| match self.sync_account(&id) {
            Ok(value) => json!({ "id": id, "ok": true, "account": value.get("account").cloned().unwrap_or(Value::Null) }),
            Err(error) if error.contains("正在同步") => json!({ "id": id, "ok": true, "skipped": true, "message": error }),
            Err(error) => json!({ "id": id, "ok": false, "error": error }),
        }).collect();
        json!({ "ok": results.iter().all(|v| v["ok"] == true), "results": results })
    }

    fn dispatch_notifications(&self) -> Value {
        let (enabled, current_alerts, previous_keys) = {
            let state = self.state.lock().unwrap();
            (
                state.settings.notifications_enabled,
                alerts(&state),
                state.notified_alert_keys.iter().cloned().collect::<HashSet<_>>(),
            )
        };

        if !enabled {
            let mut state = self.state.lock().unwrap();
            if !state.notified_alert_keys.is_empty() {
                state.notified_alert_keys.clear();
                if let Err(error) = self.save_locked(&state) {
                    return json!({ "ok": false, "enabled": false, "delivered": 0, "errors": [error] });
                }
            }
            return json!({ "ok": true, "enabled": false, "delivered": 0 });
        }

        let active_keys: HashSet<String> = current_alerts.iter().map(notification_key).collect();
        let mut acknowledged: HashSet<String> = previous_keys
            .intersection(&active_keys)
            .cloned()
            .collect();
        let mut delivered = 0;
        let mut errors = Vec::new();

        for alert in current_alerts {
            let key = notification_key(&alert);
            if acknowledged.contains(&key) {
                continue;
            }
            let title = string_field(&alert, "title");
            let message = string_field(&alert, "message");
            match notifications::show(&title, &message) {
                Ok(()) => {
                    acknowledged.insert(key);
                    delivered += 1;
                }
                Err(error) => errors.push(error),
            }
        }

        let mut state = self.state.lock().unwrap();
        state.notified_alert_keys = acknowledged.into_iter().collect();
        state.notified_alert_keys.sort();
        if let Err(error) = self.save_locked(&state) {
            errors.push(error);
        }
        json!({ "ok": errors.is_empty(), "enabled": true, "delivered": delivered, "errors": errors })
    }

    fn public_state(&self) -> Value {
        let syncing_account_ids = self.syncing_accounts.lock().unwrap().iter().cloned().collect::<Vec<_>>();
        let state = self.state.lock().unwrap();
        let mut history = state.history.clone();
        history.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        history.truncate(PUBLIC_HISTORY_LIMIT);
        let mut sync_events = state.sync_events.clone();
        sync_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        sync_events.truncate(PUBLIC_HISTORY_LIMIT);
        json!({
            "ok": true,
            "version": VERSION,
            "settings": state.settings,
            "providerOrder": ordered_providers(&state.accounts, &state.provider_order),
            "alerts": alerts(&state),
            "accounts": state.accounts.iter().map(public_account).collect::<Vec<_>>(),
            "history": history,
            "syncEvents": sync_events,
            "sync": sync_summary(&state.accounts, &syncing_account_ids),
            "capabilities": {
                "deepseek": ["is_available", "currency", "total_balance", "granted_balance", "topped_up_balance"],
                "volcengine": ["agent_plan_afp", "coding_plan_quota_usage", "coding_plan_seat_usage", "inference_usage", "endpoint_count"],
                "openai": ["chatgpt_account_plan", "codex_rate_limits", "codex_daily_token_usage", "codex_lifetime_tokens", "codex_streak"],
                "mimo": ["api_key_validation", "available_models", "billing_mode", "official_usage_console_only"],
                "historySource": "Prismeter 远端同步快照",
                "credentialProtection": "rust-native-windows-dpapi",
                "volcengineAdapter": "rust-native",
                "openaiAdapter": "rust-native",
                "notificationBackend": "windows-native-toast",
                "matrix": capability_matrix(&state.accounts)
            }
        })
    }
}

pub fn start(data_dir: PathBuf) -> AppResult<String> {
    let store = Arc::new(Store::open(&data_dir)?);
    let server = Server::http("127.0.0.1:0").map_err(|e| format!("无法启动本地服务：{e}"))?;
    let address = server.server_addr().to_ip().ok_or("无法获取本地服务地址。")?;
    let base_url = format!("http://127.0.0.1:{}/", address.port());
    let server_url = base_url.clone();
    let request_store = Arc::clone(&store);
    thread::Builder::new().name("prismeter-api".into()).spawn(move || {
        for request in server.incoming_requests() {
            let store = Arc::clone(&request_store);
            let request_url = server_url.clone();
            thread::spawn(move || handle_request(request, &store, &request_url));
        }
    }).map_err(|e| format!("无法启动本地服务线程：{e}"))?;

    if store.state.lock().unwrap().settings.sync_on_startup {
        let startup_store = Arc::clone(&store);
        thread::Builder::new().name("prismeter-startup-sync".into()).spawn(move || {
            startup_store.sync_all();
            startup_store.dispatch_notifications();
        }).map_err(|e| format!("无法启动首次同步线程：{e}"))?;
    }

    let sync_store = Arc::clone(&store);
    thread::Builder::new().name("prismeter-sync".into()).spawn(move || {
        let mut last_sync = Instant::now();
        loop {
            thread::sleep(Duration::from_secs(60));
            let minutes = sync_store.state.lock().unwrap().settings.auto_sync_minutes;
            if minutes > 0 && last_sync.elapsed() >= Duration::from_secs(minutes as u64 * 60) {
                sync_store.sync_all();
                sync_store.dispatch_notifications();
                last_sync = Instant::now();
            }
        }
    }).map_err(|e| format!("无法启动自动同步线程：{e}"))?;
    Ok(base_url)
}

fn handle_request(mut request: Request, store: &Arc<Store>, base_url: &str) {
    let origin_ok = request.headers().iter().find(|h| h.field.equiv("Origin"))
        .map(|h| format!("{}/", h.value.as_str().trim_end_matches('/')) == base_url)
        .unwrap_or(true);
    if !origin_ok {
        respond_json(request, 403, json!({ "ok": false, "error": "已拒绝非 Prismeter 页面发起的本地请求。" }));
        return;
    }
    let path = request.url().split('?').next().unwrap_or("/").to_string();
    if !path.starts_with("/api/") {
        let (content_type, bytes) = match path.as_str() {
            "/" | "/index.html" => ("text/html; charset=utf-8", INDEX_HTML),
            "/styles.css" => ("text/css; charset=utf-8", STYLES_CSS),
            "/app.js" => ("application/javascript; charset=utf-8", APP_JS),
            _ => { respond_text(request, 404, "text/plain; charset=utf-8", b"Not found"); return; }
        };
        respond_text(request, 200, content_type, bytes);
        return;
    }

    let mut body = String::new();
    if let Err(error) = request.as_reader().read_to_string(&mut body) {
        respond_json(request, 400, json!({ "ok": false, "error": format!("无法读取请求：{error}") }));
        return;
    }
    let result = route_api(request.method(), &path, &body, store);
    match result {
        Ok((status, value)) => respond_json(request, status, value),
        Err(error) => respond_json(request, error_status(&error), json!({ "ok": false, "error": error })),
    }
}

fn route_api(method: &Method, path: &str, body: &str, store: &Arc<Store>) -> AppResult<(u16, Value)> {
    if method == &Method::Get && path == "/api/state" { return Ok((200, store.public_state())); }
    if method == &Method::Put && path == "/api/settings" {
        let mut input: Settings = serde_json::from_str(body).map_err(|_| "设置数据无效。")?;
        if !matches!(input.appearance_mode.as_str(), "system" | "light" | "dark") {
            return Err("外观模式无效。".into());
        }
        if input.auto_sync_minutes != 0 && !(5..=1440).contains(&input.auto_sync_minutes) {
            return Err("自动同步间隔应在 5 分钟到 24 小时之间。".into());
        }
        if !(0.0..=10_000_000.0).contains(&input.low_balance_threshold) { return Err("余额提醒阈值无效。".into()); }
        if input.usage_threshold <= 0.0 { input.usage_threshold = 80.0; }
        if !(50.0..=100.0).contains(&input.usage_threshold) { return Err("额度提醒阈值应在 50% 到 100% 之间。".into()); }
        let mut state = store.state.lock().unwrap();
        state.settings = input.clone();
        if !input.notifications_enabled { state.notified_alert_keys.clear(); }
        store.save_locked(&state)?;
        return Ok((200, json!({ "ok": true, "settings": input })));
    }
    if method == &Method::Post && path == "/api/accounts" {
        let input = serde_json::from_str(body).map_err(|_| "账户数据无效。")?;
        return Ok((201, store.add_account(input)?));
    }
    if method == &Method::Post && path == "/api/accounts/reorder" {
        let input: ReorderAccountsRequest = serde_json::from_str(body).map_err(|_| "账户排序数据无效。")?;
        let mut state = store.state.lock().unwrap();
        reorder_accounts(&mut state.accounts, input.account_ids)?;
        store.save_locked(&state)?;
        return Ok((200, json!({ "ok": true })));
    }
    if method == &Method::Post && path == "/api/providers/reorder" {
        let input: ReorderProvidersRequest = serde_json::from_str(body).map_err(|_| "平台排序数据无效。")?;
        let mut state = store.state.lock().unwrap();
        state.provider_order = validate_provider_order(&state.accounts, input.provider_ids)?;
        store.save_locked(&state)?;
        return Ok((200, json!({ "ok": true, "providerOrder": state.provider_order })));
    }
    if method == &Method::Post && path == "/api/sync" {
        let result = store.sync_all();
        let notification = store.dispatch_notifications();
        return Ok((200, json!({
            "ok": result["ok"], "results": result["results"], "notification": notification
        })));
    }
    if method == &Method::Post && path == "/api/notifications/test" {
        notifications::show(
            "Prismeter 通知测试",
            "Windows 通知已连接。后续自动同步发现余额、额度或连接异常时会在这里提醒。",
        )?;
        return Ok((200, json!({ "ok": true })));
    }
    if let Some(rest) = path.strip_prefix("/api/accounts/") {
        if method == &Method::Post && rest.ends_with("/sync") {
            let id = rest.trim_end_matches("/sync").trim_end_matches('/');
            let result = store.sync_account(id);
            store.dispatch_notifications();
            return Ok((200, result?));
        }
        if method == &Method::Put && rest.ends_with("/connection") {
            let id = rest.trim_end_matches("/connection").trim_end_matches('/');
            let input = serde_json::from_str(body)
                .map_err(|_| "连接设置数据无效。")?;
            return Ok((200, store.update_connection(id, input)?));
        }
        let id = rest.trim_matches('/');
        if method == &Method::Patch {
            let input: UpdateAccountRequest = serde_json::from_str(body).map_err(|_| "账户更新数据无效。")?;
            let mut state = store.state.lock().unwrap();
            let account = state.accounts.iter_mut().find(|a| a.id == id).ok_or("账户不存在。")?;
            if let Some(name) = input.name {
                let name = name.trim();
                if name.is_empty() || name.chars().count() > 50 { return Err("账户名称应为 1 到 50 个字符。".into()); }
                account.name = name.into();
            }
            if input.enabled.is_some() { account.enabled = input.enabled; }
            let public = public_account(account);
            store.save_locked(&state)?;
            return Ok((200, json!({ "ok": true, "account": public })));
        }
        if method == &Method::Delete {
            let syncing = store.syncing_accounts.lock().unwrap();
            if syncing.contains(id) {
                return Err("该账户正在同步，请等待完成后再移除。".into());
            }
            let mut state = store.state.lock().unwrap();
            let original = state.accounts.len();
            state.accounts.retain(|a| a.id != id);
            if state.accounts.len() == original { return Err("账户不存在。".into()); }
            let connected = state.accounts.iter().map(|account| account.provider.clone()).collect::<HashSet<_>>();
            state.provider_order.retain(|provider| connected.contains(provider));
            state.history.retain(|h| h.account_id != id);
            state.sync_events.retain(|event| event.account_id != id);
            store.save_locked(&state)?;
            return Ok((200, json!({ "ok": true })));
        }
    }
    Ok((404, json!({ "ok": false, "error": "接口不存在。" })))
}

fn apply_deepseek(account: &mut Account, remote: DeepSeekResponse) {
    account.is_available = remote.is_available;
    account.balances = remote.balance_infos.into_iter().map(|b| BalanceInfo {
        currency: b.currency, total: b.total_balance, granted: b.granted_balance, topped_up: b.topped_up_balance,
    }).collect();
    account.last_sync = now();
    account.last_error = None;
}

fn add_snapshots(state: &mut PersistedState, account: &Account) {
    for balance in &account.balances {
        state.history.push(BalanceSnapshot {
            account_id: account.id.clone(), timestamp: account.last_sync.clone(),
            currency: balance.currency.clone(), total: balance.total.clone(),
            granted: balance.granted.clone(), topped_up: balance.topped_up.clone(),
            is_available: account.is_available,
        });
    }
    if state.history.len() > BALANCE_HISTORY_LIMIT {
        state.history.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        state.history.truncate(BALANCE_HISTORY_LIMIT);
    }
}

fn add_sync_event(state: &mut PersistedState, account: &Account, success: bool, message: String) {
    state.sync_events.push(SyncEvent {
        id: new_id(),
        account_id: account.id.clone(),
        timestamp: now(),
        success,
        duration_ms: account.last_sync_duration_ms,
        product_count: account.products.len() + usize::from(!account.balances.is_empty()),
        message,
    });
    if state.sync_events.len() > SYNC_EVENT_STORAGE_LIMIT {
        let excess = state.sync_events.len() - SYNC_EVENT_STORAGE_LIMIT;
        state.sync_events.drain(0..excess);
    }
}

fn public_account(account: &Account) -> Value {
    json!({
        "id": account.id,
        "provider": if account.provider.is_empty() { "deepseek" } else { &account.provider },
        "name": account.name, "keyHint": account.key_hint, "email": account.email,
        "planType": account.plan_type, "createdAt": account.created_at,
        "enabled": account.enabled != Some(false), "lastAttemptAt": account.last_attempt_at,
        "lastSyncDurationMs": account.last_sync_duration_ms,
        "consecutiveFailures": account.consecutive_failures, "lastSync": account.last_sync,
        "lastError": account.last_error, "isAvailable": account.is_available,
        "region": account.region, "projectName": account.project_name, "baseUrl": account.base_url,
        "balances": account.balances, "products": account.products, "productErrors": account.product_errors
    })
}

fn sync_summary(accounts: &[Account], syncing_account_ids: &[String]) -> Value {
    let monitored = accounts.iter().filter(|account| account.enabled != Some(false)).count();
    let failed = accounts.iter().filter(|account| {
        account.enabled != Some(false) && account.last_error.as_deref().is_some_and(|error| !error.trim().is_empty())
    }).count();
    let last_attempt_at = accounts.iter().map(|account| account.last_attempt_at.as_str()).filter(|value| !value.is_empty()).max().unwrap_or("");
    let last_success_at = accounts.iter().map(|account| account.last_sync.as_str()).filter(|value| !value.is_empty()).max().unwrap_or("");
    json!({
        "activeAccountIds": syncing_account_ids,
        "activeCount": syncing_account_ids.len(),
        "monitoredCount": monitored,
        "pausedCount": accounts.len().saturating_sub(monitored),
        "failedCount": failed,
        "lastAttemptAt": last_attempt_at,
        "lastSuccessAt": last_success_at
    })
}

fn reorder_accounts(accounts: &mut Vec<Account>, account_ids: Vec<String>) -> AppResult<()> {
    if account_ids.len() != accounts.len() {
        return Err("账户排序列表不完整。".into());
    }
    let unique = account_ids.iter().collect::<HashSet<_>>();
    if unique.len() != account_ids.len() {
        return Err("账户排序列表包含重复项。".into());
    }
    let mut reordered = Vec::with_capacity(accounts.len());
    for id in account_ids {
        let account = accounts.iter().find(|account| account.id == id)
            .ok_or("账户排序列表包含未知账户。")?;
        reordered.push(account.clone());
    }
    *accounts = reordered;
    Ok(())
}

fn ordered_providers(accounts: &[Account], preferred: &[String]) -> Vec<String> {
    let mut available = Vec::new();
    for account in accounts {
        if !available.iter().any(|provider| provider == &account.provider) {
            available.push(account.provider.clone());
        }
    }
    let mut result = Vec::new();
    for provider in preferred.iter().chain(available.iter()) {
        if available.contains(provider) && !result.contains(provider) {
            result.push(provider.clone());
        }
    }
    result
}

fn validate_provider_order(accounts: &[Account], provider_ids: Vec<String>) -> AppResult<Vec<String>> {
    let available = ordered_providers(accounts, &[]);
    if provider_ids.len() != available.len() {
        return Err("平台排序列表不完整。".into());
    }
    let unique = provider_ids.iter().collect::<HashSet<_>>();
    if unique.len() != provider_ids.len() {
        return Err("平台排序列表包含重复项。".into());
    }
    if provider_ids.iter().any(|provider| !available.contains(provider)) {
        return Err("平台排序列表包含未知平台。".into());
    }
    Ok(provider_ids)
}

fn capability_matrix(accounts: &[Account]) -> Vec<Value> {
    let provider = |id: &str, label: &str, items: Vec<Value>| {
        let connected: Vec<&Account> = accounts.iter().filter(|account| account.provider == id).collect();
        let observed_products: HashSet<String> = connected.iter().flat_map(|account| account.products.iter())
            .filter_map(|product| product.get("id").and_then(Value::as_str).map(str::to_string))
            .collect();
        json!({
            "provider": id,
            "label": label,
            "accountCount": connected.len(),
            "connected": !connected.is_empty(),
            "observedProductIds": observed_products,
            "items": items
        })
    };

    vec![
        provider("openai", "OpenAI / Codex", vec![
            json!({ "id":"chatgpt", "label":"ChatGPT 套餐身份", "support":"supported", "source":"Codex 官方登录服务" }),
            json!({ "id":"codex", "label":"Codex 周期额度与 Token", "support":"supported", "source":"Codex 官方登录服务" }),
            json!({ "id":"api-billing", "label":"OpenAI API 账单与余额", "support":"unavailable", "source":"当前登录态不提供" }),
        ]),
        provider("volcengine", "火山引擎方舟", vec![
            json!({ "id":"agent", "label":"Agent Plan / AFP", "support":"supported", "source":"火山方舟远端接口" }),
            json!({ "id":"coding", "label":"Coding Plan 额度与席位", "support":"supported", "source":"火山方舟远端接口" }),
            json!({ "id":"payg", "label":"按量推理与接入点", "support":"supported", "source":"火山方舟远端接口" }),
        ]),
        provider("mimo", "Xiaomi MiMo", vec![
            json!({ "id":"mimo-models", "label":"新建账户连接", "support":"disabled", "source":"官方未开放第三方用量统计接口" }),
            json!({ "id":"mimo-usage", "label":"Token Plan / API 用量", "support":"console_only", "source":"仅小米官方控制台提供" }),
        ]),
        provider("deepseek", "DeepSeek 官方", vec![
            json!({ "id":"balance", "label":"可用状态与账户余额", "support":"supported", "source":"DeepSeek 官方余额接口" }),
            json!({ "id":"usage", "label":"模型与 Token 用量明细", "support":"unavailable", "source":"官方接口暂未提供" }),
        ]),
    ]
}

fn error_status(error: &str) -> u16 {
    if error.contains("不存在") {
        404
    } else if error.contains("正在同步") {
        409
    } else if error.contains("无效")
        || error.contains("请输入")
        || error.contains("应为")
        || error.contains("之间")
        || error.contains("暂不支持")
        || error.contains("暂不可添加")
        || error.contains("排序")
        || error.contains("已经连接")
    {
        400
    } else {
        500
    }
}

fn alerts(state: &PersistedState) -> Vec<Value> {
    let mut result = Vec::new();
    for account in state.accounts.iter().filter(|a| a.enabled != Some(false)) {
        for balance in &account.balances {
            if balance.total.parse::<f64>().ok().is_some_and(|v| v < state.settings.low_balance_threshold) {
                result.push(json!({
                    "accountId": account.id, "accountName": account.name, "provider": account.provider,
                    "kind": "balance", "title": format!("{} 余额偏低", account.name),
                    "message": format!("当前 {} {}，低于阈值 {}", balance.currency, balance.total, state.settings.low_balance_threshold),
                    "currency": balance.currency, "total": balance.total
                }));
            }
        }
        for product in &account.products {
            let usage = string_field(product, "usage");
            if let Some(percent) = usage_percent(&usage) {
                if percent >= state.settings.usage_threshold {
                    result.push(json!({
                        "accountId": account.id, "accountName": account.name, "provider": account.provider,
                        "productId": string_field(product, "id"), "kind": "quota",
                        "title": format!("{} · {} 额度告警", account.name, string_field(product, "name")),
                        "message": format!("远端周期用量已达 {:.1}%，阈值为 {:.1}%", percent, state.settings.usage_threshold),
                        "currentPercent": format!("{percent:.1}"), "threshold": format!("{:.1}", state.settings.usage_threshold)
                    }));
                }
            }
        }
        if let Some(error) = &account.last_error {
            if !error.trim().is_empty() {
                result.push(json!({
                    "accountId": account.id, "accountName": account.name, "provider": account.provider,
                    "kind": "sync", "title": format!("{} 同步失败", account.name), "message": error
                }));
            }
        }
    }
    result
}

fn usage_percent(value: &str) -> Option<f64> {
    let before = value.split('%').next()?;
    let number = before.split_whitespace().last().unwrap_or(before);
    number.trim_matches(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-')).parse().ok()
}

fn respond_json(request: Request, status: u16, value: Value) {
    let data = serde_json::to_vec(&value).unwrap_or_else(|_| b"{\"ok\":false}".to_vec());
    respond(request, status, "application/json; charset=utf-8", data);
}

fn respond_text(request: Request, status: u16, content_type: &str, bytes: &[u8]) {
    respond(request, status, content_type, bytes.to_vec());
}

fn respond(request: Request, status: u16, content_type: &str, data: Vec<u8>) {
    let response = Response::from_data(data)
        .with_status_code(StatusCode(status))
        .with_header(Header::from_bytes("Content-Type", content_type).unwrap())
        .with_header(Header::from_bytes("Cache-Control", "no-store").unwrap())
        .with_header(Header::from_bytes("X-Content-Type-Options", "nosniff").unwrap());
    let _ = request.respond(response);
}

fn now() -> String { Utc::now().to_rfc3339() }
fn new_id() -> String { Uuid::new_v4().simple().to_string() }
fn default_name(value: &str, fallback: &str) -> String {
    if value.trim().is_empty() { fallback.into() } else { value.trim().into() }
}
fn key_hint(prefix: &str, value: &str) -> String {
    let suffix: String = value.chars().rev().take(4).collect::<String>().chars().rev().collect();
    format!("{prefix}••••{suffix}")
}
fn string_field(value: &Value, key: &str) -> String {
    value.get(key).and_then(Value::as_str).unwrap_or("").to_string()
}
fn notification_key(alert: &Value) -> String {
    format!(
        "{}|{}|{}|{}",
        string_field(alert, "accountId"),
        string_field(alert, "kind"),
        string_field(alert, "productId"),
        string_field(alert, "currency")
    )
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_state_is_loaded_and_secrets_stay_private() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("accounts.json"), r#"{
            "accounts":[{
                "id":"legacy-account","provider":"deepseek","name":"旧账户",
                "encryptedKey":"secret-ciphertext","keyHint":"••••1234",
                "createdAt":"2026-01-01T00:00:00Z","isAvailable":true,
                "balances":[{"currency":"CNY","total":"12.50","granted":"2.50","toppedUp":"10.00"}]
            }],
            "history":[],
            "settings":{"autoSyncMinutes":15,"lowBalanceThreshold":12.5,"notificationsEnabled":true}
        }"#).unwrap();

        let store = Store::open(&directory).unwrap();
        let public = store.public_state().to_string();
        assert!(public.contains("legacy-account"));
        assert!(public.contains("\"appearanceMode\":\"system\""));
        assert!(public.contains("\"usageThreshold\":80.0"));
        assert!(public.contains("\"closeToTray\":true"));
        assert!(public.contains("\"launchAtStartup\":false"));
        assert!(!public.contains("secret-ciphertext"));
        assert!(directory.join("accounts.pre-rust-0.8.1.json").exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn percent_parser_handles_remote_usage_labels() {
        assert_eq!(usage_percent("本周期已用 86.5%"), Some(86.5));
        assert_eq!(usage_percent("86%"), Some(86.0));
        assert_eq!(usage_percent("无远端比例"), None);
    }

    #[test]
    fn sync_event_history_is_bounded() {
        let mut state = PersistedState::default();
        let account = Account { id:"account-1".into(), last_sync_duration_ms:125, ..Account::default() };
        for index in 0..510 {
            add_sync_event(&mut state, &account, index % 2 == 0, format!("event-{index}"));
        }
        assert_eq!(state.sync_events.len(), SYNC_EVENT_STORAGE_LIMIT);
        assert_eq!(state.sync_events.first().unwrap().message, "event-10");
        assert_eq!(state.sync_events.last().unwrap().message, "event-509");
    }

    #[test]
    fn notification_key_is_stable_while_the_same_alert_remains_active() {
        let first = json!({
            "accountId": "account-1", "kind": "quota", "productId": "coding",
            "message": "已用 80%"
        });
        let later = json!({
            "accountId": "account-1", "kind": "quota", "productId": "coding",
            "message": "已用 92%"
        });
        assert_eq!(notification_key(&first), notification_key(&later));
        assert_ne!(
            notification_key(&first),
            notification_key(&json!({
                "accountId": "account-1", "kind": "quota", "productId": "agent"
            }))
        );
    }

    #[test]
    fn sync_summary_reports_active_paused_and_failed_accounts() {
        let accounts = vec![
            Account {
                id: "active".into(),
                enabled: Some(true),
                last_attempt_at: "2026-07-20T08:00:00Z".into(),
                last_sync: "2026-07-20T07:59:00Z".into(),
                ..Account::default()
            },
            Account {
                id: "failed".into(),
                enabled: Some(true),
                last_attempt_at: "2026-07-20T09:00:00Z".into(),
                last_error: Some("timeout".into()),
                ..Account::default()
            },
            Account { id: "paused".into(), enabled: Some(false), ..Account::default() },
        ];
        let summary = sync_summary(&accounts, &["active".into()]);
        assert_eq!(summary["activeCount"], 1);
        assert_eq!(summary["monitoredCount"], 2);
        assert_eq!(summary["pausedCount"], 1);
        assert_eq!(summary["failedCount"], 1);
        assert_eq!(summary["lastAttemptAt"], "2026-07-20T09:00:00Z");
    }

    #[test]
    fn capability_matrix_reflects_connected_accounts_and_observed_products() {
        let accounts = vec![Account {
            provider: "volcengine".into(),
            products: vec![json!({ "id": "coding" })],
            ..Account::default()
        }];
        let matrix = capability_matrix(&accounts);
        let volcengine = matrix.iter().find(|item| item["provider"] == "volcengine").unwrap();
        assert_eq!(volcengine["connected"], true);
        assert_eq!(volcengine["accountCount"], 1);
        assert!(volcengine["observedProductIds"].as_array().unwrap().iter().any(|id| id == "coding"));
    }

    #[test]
    fn api_errors_use_actionable_http_statuses() {
        assert_eq!(error_status("账户不存在。"), 404);
        assert_eq!(error_status("该账户正在同步，请稍候。"), 409);
        assert_eq!(error_status("请输入 API Key。"), 400);
        assert_eq!(error_status("远端网络异常"), 500);
    }

    #[test]
    fn account_order_is_validated_and_reordered() {
        let mut accounts = vec![
            Account { id: "first".into(), ..Account::default() },
            Account { id: "second".into(), ..Account::default() },
            Account { id: "third".into(), ..Account::default() },
        ];
        reorder_accounts(&mut accounts, vec!["third".into(), "first".into(), "second".into()]).unwrap();
        assert_eq!(accounts.iter().map(|account| account.id.as_str()).collect::<Vec<_>>(), vec!["third", "first", "second"]);
        assert!(reorder_accounts(&mut accounts, vec!["third".into(), "third".into(), "second".into()]).is_err());
    }

    #[test]
    fn provider_order_is_independent_from_account_order() {
        let accounts = vec![
            Account { id: "openai-1".into(), provider: "openai".into(), ..Account::default() },
            Account { id: "volc-1".into(), provider: "volcengine".into(), ..Account::default() },
            Account { id: "deepseek-1".into(), provider: "deepseek".into(), ..Account::default() },
            Account { id: "volc-2".into(), provider: "volcengine".into(), ..Account::default() },
        ];
        let account_ids = accounts.iter().map(|account| account.id.clone()).collect::<Vec<_>>();
        let providers = validate_provider_order(
            &accounts,
            vec!["deepseek".into(), "openai".into(), "volcengine".into()],
        ).unwrap();
        assert_eq!(providers, vec!["deepseek", "openai", "volcengine"]);
        assert_eq!(accounts.iter().map(|account| account.id.clone()).collect::<Vec<_>>(), account_ids);
        assert!(validate_provider_order(
            &accounts,
            vec!["openai".into(), "openai".into(), "volcengine".into()],
        ).is_err());
    }

    #[test]
    fn legacy_provider_order_follows_first_account_appearance() {
        let accounts = vec![
            Account { provider: "volcengine".into(), ..Account::default() },
            Account { provider: "openai".into(), ..Account::default() },
            Account { provider: "volcengine".into(), ..Account::default() },
            Account { provider: "deepseek".into(), ..Account::default() },
        ];
        assert_eq!(ordered_providers(&accounts, &[]), vec!["volcengine", "openai", "deepseek"]);
        assert_eq!(
            ordered_providers(&accounts, &["deepseek".into(), "missing".into()]),
            vec!["deepseek", "volcengine", "openai"]
        );
    }

    #[test]
    fn sync_all_treats_an_already_running_account_as_covered() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Store::open(&directory).unwrap();
        store.state.lock().unwrap().accounts.push(Account {
            id: "running-account".into(),
            provider: "deepseek".into(),
            enabled: Some(true),
            ..Account::default()
        });
        store.syncing_accounts.lock().unwrap().insert("running-account".into());
        let result = store.sync_all();
        assert_eq!(result["ok"], true);
        assert_eq!(result["results"][0]["skipped"], true);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn failed_connection_update_preserves_existing_mimo_configuration() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Store::open(&directory).unwrap();
        let encrypted_key = store.protect("sk-existing-key").unwrap();
        store.state.lock().unwrap().accounts.push(Account {
            id: "mimo-account".into(),
            provider: "mimo".into(),
            name: "MiMo 主账户".into(),
            encrypted_key: encrypted_key.clone(),
            key_hint: "MiMo ••••-key".into(),
            base_url: "https://api.xiaomimimo.com/v1".into(),
            plan_type: "pay_as_you_go".into(),
            ..Account::default()
        });

        let error = store.update_connection("mimo-account", UpdateConnectionRequest {
            api_key: "tp-invalid-combination".into(),
            base_url: "https://api.xiaomimimo.com/v1".into(),
            ..UpdateConnectionRequest::default()
        }).unwrap_err();
        assert!(error.contains("tp- Key"));

        let state = store.state.lock().unwrap();
        let account = state.accounts.iter().find(|account| account.id == "mimo-account").unwrap();
        assert_eq!(account.encrypted_key, encrypted_key);
        assert_eq!(account.base_url, "https://api.xiaomimimo.com/v1");
        drop(state);
        fs::remove_dir_all(directory).unwrap();
    }
}
