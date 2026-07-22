use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

use chrono::{DateTime, Duration as ChronoDuration, Utc};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};
use uuid::Uuid;

use crate::{codex, credential, mimo, notifications, volcengine};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const DEEPSEEK_BALANCE_URL: &str = "https://api.deepseek.com/user/balance";
const REMOTE_TIMEOUT_SECONDS: u64 = 18;
const MAX_CONCURRENT_SYNCS: usize = 4;
const BALANCE_HISTORY_LIMIT: usize = 1000;
const SYNC_EVENT_STORAGE_LIMIT: usize = 500;
const METRIC_HISTORY_LIMIT: usize = 50_000;
const METRIC_SAMPLE_INTERVAL_MINUTES: i64 = 55;
const PUBLIC_HISTORY_LIMIT: usize = 120;
const AUTO_SYNC_CHECK_INTERVAL: Duration = Duration::from_secs(15);
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
    #[serde(default = "default_update_check_mode")]
    update_check_mode: String,
    #[serde(default)]
    skipped_update_version: String,
    #[serde(default = "default_history_retention_days")]
    history_retention_days: i32,
    #[serde(default)]
    stale_after_minutes: i32,
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
            update_check_mode: default_update_check_mode(),
            skipped_update_version: String::new(),
            history_retention_days: default_history_retention_days(),
            stale_after_minutes: 0,
        }
    }
}

fn default_appearance_mode() -> String { "system".into() }
fn default_auto_sync() -> i32 { 30 }
fn default_low_balance() -> f64 { 10.0 }
fn default_usage_threshold() -> f64 { 80.0 }
fn default_notifications() -> bool { true }
fn default_close_to_tray() -> bool { true }
fn default_update_check_mode() -> String { "startup".into() }
fn default_history_retention_days() -> i32 { 90 }

fn automatic_sync_due(last_sync: Instant, minutes: i32) -> bool {
    minutes > 0 && last_sync.elapsed() >= Duration::from_secs(minutes as u64 * 60)
}

fn next_automatic_sync_at(minutes: i32) -> Option<String> {
    (minutes > 0).then(|| (Utc::now() + ChronoDuration::minutes(i64::from(minutes))).to_rfc3339())
}

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
struct MetricSnapshot {
    #[serde(default)] account_id: String,
    #[serde(default)] timestamp: String,
    #[serde(default)] product_id: String,
    #[serde(default)] product_name: String,
    #[serde(default)] metric_id: String,
    #[serde(default)] label: String,
    #[serde(default)] value: f64,
    #[serde(default)] unit: String,
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
struct SnoozedAlert {
    #[serde(default)] key: String,
    #[serde(default)] until: String,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountAlertSettings {
    #[serde(default)] enabled: Option<bool>,
    #[serde(default)] low_balance_threshold: Option<f64>,
    #[serde(default)] usage_threshold: Option<f64>,
    #[serde(default)] stale_after_minutes: Option<i32>,
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
    #[serde(default)] alert_settings: AccountAlertSettings,
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
    #[serde(default)] metric_history: Vec<MetricSnapshot>,
    #[serde(default)] sync_events: Vec<SyncEvent>,
    #[serde(default)] settings: Settings,
    #[serde(default)] notified_alert_keys: Vec<String>,
    #[serde(default)] snoozed_alerts: Vec<SnoozedAlert>,
}

impl Default for PersistedState {
    fn default() -> Self {
        Self {
            accounts: Vec::new(),
            provider_order: Vec::new(),
            history: Vec::new(),
            metric_history: Vec::new(),
            sync_events: Vec::new(),
            settings: Settings::default(),
            notified_alert_keys: Vec::new(),
            snoozed_alerts: Vec::new(),
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

type UpdateAccountAlertsRequest = AccountAlertSettings;

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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnoozeAlertRequest {
    alert_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MetricHistoryRequest {
    account_id: String,
    #[serde(default)] product_id: String,
    #[serde(default = "default_metric_range_days")]
    range_days: i32,
}

fn default_metric_range_days() -> i32 { 7 }

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

fn read_persisted_state(path: &Path) -> AppResult<PersistedState> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("无法读取 {}：{error}", path.display()))?;
    serde_json::from_str(text.trim_start_matches('\u{feff}'))
        .map_err(|error| format!("{} 格式无效：{error}", path.display()))
}

struct Store {
    state: Mutex<PersistedState>,
    syncing_accounts: Mutex<HashSet<String>>,
    next_automatic_sync_at: Mutex<Option<String>>,
    state_path: PathBuf,
    backup_path: PathBuf,
    startup_notice: Option<String>,
    http: Client,
}

impl Store {
    fn open(data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(data_dir).map_err(|e| format!("无法创建数据目录：{e}"))?;
        let state_path = data_dir.join("accounts.json");
        let backup_path = data_dir.join("accounts.backup.json");
        let mut startup_notice = None;
        let mut state = if state_path.exists() {
            match read_persisted_state(&state_path) {
                Ok(state) => state,
                Err(primary_error) if backup_path.exists() => {
                    let recovered = read_persisted_state(&backup_path).map_err(|backup_error| {
                        format!("账户数据和自动备份均无法读取。主文件：{primary_error}；备份：{backup_error}")
                    })?;
                    fs::copy(&backup_path, &state_path)
                        .map_err(|error| format!("已找到有效备份，但无法恢复账户数据：{error}"))?;
                    startup_notice = Some("检测到本地状态文件异常，已从最近一次有效备份恢复。".into());
                    recovered
                }
                Err(error) => return Err(error),
            }
        } else {
            PersistedState::default()
        };
        if !matches!(state.settings.history_retention_days, 30 | 90 | 180 | 365) {
            state.settings.history_retention_days = default_history_retention_days();
        }
        let pruned_on_open = prune_history(&mut state, Utc::now());
        let backup = data_dir.join("accounts.pre-rust-0.8.1.json");
        if state_path.exists() && !backup.exists() {
            fs::copy(&state_path, &backup).map_err(|e| format!("无法备份旧账户数据：{e}"))?;
        }
        let http = Client::builder()
            .timeout(Duration::from_secs(REMOTE_TIMEOUT_SECONDS))
            .user_agent(format!("Prismeter/{VERSION}"))
            .build()
            .map_err(|e| format!("无法初始化网络客户端：{e}"))?;
        let store = Self {
            next_automatic_sync_at: Mutex::new(next_automatic_sync_at(state.settings.auto_sync_minutes)),
            state: Mutex::new(state),
            syncing_accounts: Mutex::new(HashSet::new()),
            state_path,
            backup_path,
            startup_notice,
            http,
        };
        if pruned_on_open.0 > 0 || pruned_on_open.1 > 0 || pruned_on_open.2 > 0 {
            let state = store.state.lock().unwrap();
            store.save_locked(&state)?;
            store.refresh_backup()?;
        }
        Ok(store)
    }

    fn save_locked(&self, state: &PersistedState) -> AppResult<()> {
        let temp = self.state_path.with_extension("json.tmp");
        let data = serde_json::to_vec(state).map_err(|e| format!("无法序列化账户数据：{e}"))?;
        if self.state_path.exists() && read_persisted_state(&self.state_path).is_ok() {
            let _ = fs::copy(&self.state_path, &self.backup_path);
        }
        fs::write(&temp, data).map_err(|e| format!("无法写入账户数据：{e}"))?;
        fs::rename(&temp, &self.state_path).or_else(|_| {
            fs::copy(&temp, &self.state_path).map(|_| ()).and_then(|_| fs::remove_file(&temp))
        }).map_err(|e| format!("无法保存账户数据：{e}"))?;
        if !self.backup_path.exists() {
            let _ = fs::copy(&self.state_path, &self.backup_path);
        }
        Ok(())
    }

    fn refresh_backup(&self) -> AppResult<()> {
        fs::copy(&self.state_path, &self.backup_path)
            .map(|_| ())
            .map_err(|error| format!("无法更新本地状态备份：{error}"))
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
        add_metric_snapshots(&mut state, &account);
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
                add_metric_snapshots(&mut state, &updated);
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
        add_metric_snapshots(&mut state, &updated);
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
        let results = self.sync_account_ids(ids);
        json!({ "ok": results.iter().all(|v| v["ok"] == true), "results": results })
    }

    fn sync_account_result(&self, id: String) -> Value {
        match self.sync_account(&id) {
            Ok(value) => json!({ "id": id, "ok": true, "account": value.get("account").cloned().unwrap_or(Value::Null) }),
            Err(error) if error.contains("正在同步") => json!({ "id": id, "ok": true, "skipped": true, "message": error }),
            Err(error) => json!({ "id": id, "ok": false, "error": error }),
        }
    }

    fn sync_account_ids(&self, ids: Vec<String>) -> Vec<Value> {
        let mut results = Vec::with_capacity(ids.len());
        for batch in ids.chunks(MAX_CONCURRENT_SYNCS) {
            let batch_results = thread::scope(|scope| {
                let handles = batch.iter().cloned().map(|id| {
                    let task_id = id.clone();
                    (id, scope.spawn(move || self.sync_account_result(task_id)))
                }).collect::<Vec<_>>();
                handles.into_iter().map(|(id, handle)| match handle.join() {
                    Ok(result) => result,
                    Err(_) => json!({ "id": id, "ok": false, "error": "同步任务异常终止。" }),
                }).collect::<Vec<_>>()
            });
            results.extend(batch_results);
        }
        results
    }

    fn retry_failed_accounts(&self) -> usize {
        let current_time = Utc::now();
        let ids = self.state.lock().unwrap().accounts.iter()
            .filter(|account| auto_retry_due(account, current_time))
            .map(|account| account.id.clone())
            .collect::<Vec<_>>();
        self.sync_account_ids(ids).iter()
            .filter(|result| result.get("skipped") != Some(&Value::Bool(true)))
            .count()
    }

    fn dispatch_notifications(&self) -> Value {
        let (enabled, current_alerts, previous_keys, snoozed_keys) = {
            let state = self.state.lock().unwrap();
            let current_time = Utc::now();
            (
                state.settings.notifications_enabled,
                alerts(&state),
                state.notified_alert_keys.iter().cloned().collect::<HashSet<_>>(),
                state.snoozed_alerts.iter()
                    .filter(|item| snooze_is_active(item, current_time))
                    .map(|item| item.key.clone())
                    .collect::<HashSet<_>>(),
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

        let current_alerts = current_alerts.into_iter()
            .filter(|alert| !snoozed_keys.contains(&notification_key(alert)))
            .collect::<Vec<_>>();
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
        let current_time = Utc::now();
        state.snoozed_alerts.retain(|item| snooze_is_active(item, current_time));
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
            "startupNotice": self.startup_notice,
            "nextAutomaticSyncAt": self.next_automatic_sync_at.lock().unwrap().clone(),
            "settings": state.settings,
            "providerOrder": ordered_providers(&state.accounts, &state.provider_order),
            "alerts": public_alerts(&state),
            "accounts": state.accounts.iter().map(public_account).collect::<Vec<_>>(),
            "history": history,
            "syncEvents": sync_events,
            "historyStorage": {
                "balanceSnapshots": state.history.len(),
                "metricSnapshots": state.metric_history.len(),
                "syncEvents": state.sync_events.len(),
                "retentionDays": state.settings.history_retention_days
            },
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
        let mut scheduled_minutes = sync_store.state.lock().unwrap().settings.auto_sync_minutes;
        loop {
            // Keep the scheduler responsive when the interval is changed in Settings.
            // The timestamp is recorded before work begins so a slow remote provider
            // does not silently extend every subsequent schedule.
            thread::sleep(AUTO_SYNC_CHECK_INTERVAL);
            let minutes = sync_store.state.lock().unwrap().settings.auto_sync_minutes;
            if minutes != scheduled_minutes {
                scheduled_minutes = minutes;
                last_sync = Instant::now();
                *sync_store.next_automatic_sync_at.lock().unwrap() = next_automatic_sync_at(minutes);
            }
            if automatic_sync_due(last_sync, minutes) {
                last_sync = Instant::now();
                *sync_store.next_automatic_sync_at.lock().unwrap() = next_automatic_sync_at(minutes);
                sync_store.sync_all();
                sync_store.dispatch_notifications();
            }
            if minutes > 0 && sync_store.retry_failed_accounts() > 0 {
                sync_store.dispatch_notifications();
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
        if !matches!(input.update_check_mode.as_str(), "startup" | "manual") {
            return Err("更新检查策略无效。".into());
        }
        if input.skipped_update_version.len() > 32 {
            return Err("跳过的版本号无效。".into());
        }
        if input.auto_sync_minutes != 0 && !(5..=1440).contains(&input.auto_sync_minutes) {
            return Err("自动同步间隔应在 5 分钟到 24 小时之间。".into());
        }
        if !matches!(input.history_retention_days, 30 | 90 | 180 | 365) {
            return Err("历史记录保留时间无效。".into());
        }
        if !matches!(input.stale_after_minutes, 0 | 60 | 180 | 360 | 720 | 1440 | 10080) {
            return Err("数据过期提醒时间无效。".into());
        }
        if !(0.0..=10_000_000.0).contains(&input.low_balance_threshold) { return Err("余额提醒阈值无效。".into()); }
        if input.usage_threshold <= 0.0 { input.usage_threshold = 80.0; }
        if !(50.0..=100.0).contains(&input.usage_threshold) { return Err("额度提醒阈值应在 50% 到 100% 之间。".into()); }
        let mut state = store.state.lock().unwrap();
        state.settings = input.clone();
        let pruned = prune_history(&mut state, Utc::now());
        if !input.notifications_enabled { state.notified_alert_keys.clear(); }
        store.save_locked(&state)?;
        if pruned.0 > 0 || pruned.1 > 0 || pruned.2 > 0 { store.refresh_backup()?; }
        return Ok((200, json!({ "ok": true, "settings": input })));
    }
    if method == &Method::Post && path == "/api/metric-history" {
        let input: MetricHistoryRequest = serde_json::from_str(body)
            .map_err(|_| "趋势查询数据无效。")?;
        if !matches!(input.range_days, 1 | 7 | 30 | 90 | 180 | 365) {
            return Err("趋势查询范围无效。".into());
        }
        let state = store.state.lock().unwrap();
        if !state.accounts.iter().any(|account| account.id == input.account_id) {
            return Err("账户不存在。".into());
        }
        let cutoff = Utc::now() - ChronoDuration::days(i64::from(input.range_days));
        let mut snapshots = state.metric_history.iter()
            .filter(|item| item.account_id == input.account_id)
            .filter(|item| input.product_id.is_empty() || item.product_id == input.product_id)
            .filter(|item| timestamp_is_retained(&item.timestamp, cutoff))
            .cloned()
            .collect::<Vec<_>>();
        snapshots.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        return Ok((200, json!({
            "ok": true, "accountId": input.account_id, "productId": input.product_id,
            "rangeDays": input.range_days, "snapshots": snapshots
        })));
    }
    if method == &Method::Delete && path == "/api/history" {
        let mut state = store.state.lock().unwrap();
        let balance_snapshots = state.history.len();
        let metric_snapshots = state.metric_history.len();
        let sync_events = state.sync_events.len();
        state.history.clear();
        state.metric_history.clear();
        state.sync_events.clear();
        store.save_locked(&state)?;
        store.refresh_backup()?;
        return Ok((200, json!({
            "ok": true,
            "removed": { "balanceSnapshots": balance_snapshots, "metricSnapshots": metric_snapshots, "syncEvents": sync_events }
        })));
    }
    if path == "/api/alerts/snooze" && (method == &Method::Post || method == &Method::Delete) {
        let input: SnoozeAlertRequest = serde_json::from_str(body)
            .map_err(|_| "提醒暂缓数据无效。")?;
        let mut state = store.state.lock().unwrap();
        let alert_exists = alerts(&state).iter().any(|alert| notification_key(alert) == input.alert_key);
        if !alert_exists { return Err("提醒不存在或已经恢复正常。".into()); }
        state.snoozed_alerts.retain(|item| item.key != input.alert_key);
        let snoozed_until = if method == &Method::Post {
            let until = (Utc::now() + ChronoDuration::hours(24)).to_rfc3339();
            state.snoozed_alerts.push(SnoozedAlert { key:input.alert_key.clone(), until:until.clone() });
            state.notified_alert_keys.retain(|key| key != &input.alert_key);
            Some(until)
        } else {
            None
        };
        store.save_locked(&state)?;
        return Ok((200, json!({ "ok": true, "snoozedUntil": snoozed_until })));
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
        if method == &Method::Put && rest.ends_with("/alerts") {
            let id = rest.trim_end_matches("/alerts").trim_end_matches('/');
            let input: UpdateAccountAlertsRequest = serde_json::from_str(body)
                .map_err(|_| "账户提醒设置数据无效。")?;
            if input.low_balance_threshold.is_some_and(|value| !(0.0..=10_000_000.0).contains(&value)) {
                return Err("账户余额提醒阈值无效。".into());
            }
            if input.usage_threshold.is_some_and(|value| !(50.0..=100.0).contains(&value)) {
                return Err("账户额度提醒阈值应在 50% 到 100% 之间。".into());
            }
            if input.stale_after_minutes.is_some_and(|value| !matches!(value, 60 | 180 | 360 | 720 | 1440 | 10080)) {
                return Err("账户数据过期提醒时间无效。".into());
            }
            let mut state = store.state.lock().unwrap();
            let account = state.accounts.iter_mut().find(|account| account.id == id).ok_or("账户不存在。")?;
            if account.provider == "mimo" {
                return Err("Xiaomi MiMo 不纳入账户提醒规则。".into());
            }
            account.alert_settings = input;
            let public = public_account(account);
            let alert_prefix = format!("{id}|");
            state.notified_alert_keys.retain(|key| !key.starts_with(&alert_prefix));
            state.snoozed_alerts.retain(|item| !item.key.starts_with(&alert_prefix));
            store.save_locked(&state)?;
            return Ok((200, json!({ "ok": true, "account": public })));
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
            state.metric_history.retain(|item| item.account_id != id);
            state.sync_events.retain(|event| event.account_id != id);
            let alert_prefix = format!("{id}|");
            state.snoozed_alerts.retain(|item| !item.key.starts_with(&alert_prefix));
            state.notified_alert_keys.retain(|key| !key.starts_with(&alert_prefix));
            store.save_locked(&state)?;
            store.refresh_backup()?;
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
    prune_history(state, Utc::now());
}

fn add_metric_snapshots(state: &mut PersistedState, account: &Account) {
    // MiMo is intentionally excluded from new analytics. Existing account data remains readable.
    if account.provider == "mimo" { return; }
    for candidate in collect_metric_snapshots(account) {
        let previous = state.metric_history.iter().rev().find(|item| {
            item.account_id == candidate.account_id && item.metric_id == candidate.metric_id
        });
        let should_record = previous.is_none_or(|item| {
            let elapsed = DateTime::parse_from_rfc3339(&item.timestamp).ok()
                .and_then(|timestamp| DateTime::parse_from_rfc3339(&candidate.timestamp).ok()
                    .map(|current| current.signed_duration_since(timestamp).num_minutes()))
                .unwrap_or(METRIC_SAMPLE_INTERVAL_MINUTES);
            elapsed >= METRIC_SAMPLE_INTERVAL_MINUTES
                || (candidate.unit == "%" && candidate.value + 5.0 < item.value)
        });
        if should_record { state.metric_history.push(candidate); }
    }
    if state.metric_history.len() > METRIC_HISTORY_LIMIT {
        state.metric_history.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        let excess = state.metric_history.len() - METRIC_HISTORY_LIMIT;
        state.metric_history.drain(0..excess);
    }
    prune_history(state, Utc::now());
}

fn collect_metric_snapshots(account: &Account) -> Vec<MetricSnapshot> {
    if account.provider == "mimo" { return Vec::new(); }
    let mut result = Vec::new();
    for balance in &account.balances {
        for (field, label, text) in [
            ("total", "当前总余额", balance.total.as_str()),
            ("granted", "赠送余额", balance.granted.as_str()),
            ("topped-up", "充值余额", balance.topped_up.as_str()),
        ] {
            if let Some(value) = parse_plain_number(text) {
                result.push(MetricSnapshot {
                    account_id: account.id.clone(), timestamp: account.last_sync.clone(),
                    product_id: "api".into(), product_name: "DeepSeek API".into(),
                    metric_id: format!("balance:{}:{field}", balance.currency), label: label.into(),
                    value, unit: balance.currency.clone(),
                });
            }
        }
    }
    for product in &account.products {
        let product_id = string_field(product, "id");
        let product_name = string_field(product, "name");
        let usage_label = string_field(product, "usageLabel");
        if let Some((value, unit)) = parse_remote_number(&string_field(product, "usage"), &usage_label) {
            result.push(MetricSnapshot {
                account_id: account.id.clone(), timestamp: account.last_sync.clone(),
                product_id: product_id.clone(), product_name: product_name.clone(),
                metric_id: format!("product:{product_id}:usage"),
                label: if usage_label.is_empty() { "主要指标".into() } else { usage_label.clone() },
                value, unit,
            });
        }
        for summary in product.get("summaries").and_then(Value::as_array).into_iter().flatten() {
            let label = string_field(summary, "label");
            if label.is_empty() || label == usage_label { continue; }
            if let Some((value, unit)) = parse_remote_number(&string_field(summary, "value"), &label) {
                result.push(MetricSnapshot {
                    account_id: account.id.clone(), timestamp: account.last_sync.clone(),
                    product_id: product_id.clone(), product_name: product_name.clone(),
                    metric_id: format!("product:{product_id}:summary:{label}"),
                    label, value, unit,
                });
            }
        }
    }
    result
}

fn parse_plain_number(value: &str) -> Option<f64> {
    value.trim().replace(',', "").parse::<f64>().ok().filter(|number| number.is_finite())
}

fn parse_remote_number(value: &str, label: &str) -> Option<(f64, String)> {
    let normalized = value.trim().trim_start_matches(|character| character == '¥' || character == '$').trim().replace(',', "");
    if normalized.is_empty() || normalized == "—" { return None; }
    let mut end = 0;
    let mut has_digit = false;
    for (index, character) in normalized.char_indices() {
        let accepted = character.is_ascii_digit() || character == '.' || ((character == '-' || character == '+') && index == 0);
        if !accepted { break; }
        if character.is_ascii_digit() { has_digit = true; }
        end = index + character.len_utf8();
    }
    if !has_digit || end == 0 { return None; }
    let number = normalized[..end].parse::<f64>().ok().filter(|number| number.is_finite())?;
    let suffix = normalized[end..].trim();
    if suffix.len() > 32 || suffix.contains('/') || suffix.contains(':') || suffix.chars().any(|character| character.is_ascii_digit()) {
        return None;
    }
    let unit = if !suffix.is_empty() {
        suffix.to_string()
    } else if label.to_ascii_lowercase().contains("token") {
        "Token".into()
    } else if label.contains("请求") {
        "次".into()
    } else if label.contains("席位") || label.contains("模型") {
        "个".into()
    } else if label.contains("天") {
        "天".into()
    } else {
        String::new()
    };
    Some((number, unit))
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
    prune_history(state, Utc::now());
}

fn public_account(account: &Account) -> Value {
    json!({
        "id": account.id,
        "provider": if account.provider.is_empty() { "deepseek" } else { &account.provider },
        "name": account.name, "keyHint": account.key_hint, "email": account.email,
        "planType": account.plan_type, "createdAt": account.created_at,
        "enabled": account.enabled != Some(false), "lastAttemptAt": account.last_attempt_at,
        "alertSettings": account.alert_settings,
        "lastSyncDurationMs": account.last_sync_duration_ms,
        "consecutiveFailures": account.consecutive_failures, "nextRetryAt": next_retry_at(account), "lastSync": account.last_sync,
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
        || error.contains("不纳入")
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
    let current_time = Utc::now();
    for account in state.accounts.iter().filter(|account| {
        account.enabled != Some(false)
            && account.provider != "mimo"
            && account.alert_settings.enabled != Some(false)
    }) {
        let balance_threshold = account.alert_settings.low_balance_threshold.unwrap_or(state.settings.low_balance_threshold);
        let usage_threshold = account.alert_settings.usage_threshold.unwrap_or(state.settings.usage_threshold);
        let stale_minutes = account.alert_settings.stale_after_minutes
            .map(i64::from)
            .unwrap_or_else(|| stale_after_minutes(&state.settings));
        for balance in &account.balances {
            if balance.total.parse::<f64>().ok().is_some_and(|v| v < balance_threshold) {
                result.push(json!({
                    "accountId": account.id, "accountName": account.name, "provider": account.provider,
                    "kind": "balance", "title": format!("{} 余额偏低", account.name),
                    "message": format!("当前 {} {}，低于阈值 {}", balance.currency, balance.total, balance_threshold),
                    "currency": balance.currency, "total": balance.total
                }));
            }
        }
        for product in &account.products {
            let usage = string_field(product, "usage");
            if let Some(percent) = usage_percent(&usage) {
                if percent >= usage_threshold {
                    result.push(json!({
                        "accountId": account.id, "accountName": account.name, "provider": account.provider,
                        "productId": string_field(product, "id"), "kind": "quota",
                        "title": format!("{} · {} 额度告警", account.name, string_field(product, "name")),
                        "message": format!("远端周期用量已达 {:.1}%，阈值为 {:.1}%", percent, usage_threshold),
                        "currentPercent": format!("{percent:.1}"), "threshold": format!("{:.1}", usage_threshold)
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
        let freshness_message = if account.last_sync.trim().is_empty() {
            Some("此账户尚未完成首次远端同步。".to_string())
        } else {
            DateTime::parse_from_rfc3339(&account.last_sync).ok().and_then(|timestamp| {
                let elapsed = current_time.signed_duration_since(timestamp.with_timezone(&Utc)).num_minutes();
                (elapsed >= stale_minutes).then(|| format!(
                    "最近一次成功同步已超过 {} 分钟，当前数据可能已过期。",
                    elapsed.max(stale_minutes)
                ))
            })
        };
        if let Some(message) = freshness_message {
            result.push(json!({
                "accountId": account.id, "accountName": account.name, "provider": account.provider,
                "kind": "freshness", "title": format!("{} 数据需要刷新", account.name), "message": message
            }));
        }
    }
    result
}

fn stale_after_minutes(settings: &Settings) -> i64 {
    if settings.stale_after_minutes > 0 {
        i64::from(settings.stale_after_minutes)
    } else if settings.auto_sync_minutes > 0 {
        i64::from((settings.auto_sync_minutes * 3).max(60))
    } else {
        360
    }
}

fn usage_percent(value: &str) -> Option<f64> {
    let before = value.split('%').next()?;
    let number = before.split_whitespace().last().unwrap_or(before);
    number.trim_matches(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-')).parse().ok()
}

fn retry_delay_minutes(consecutive_failures: u32) -> Option<i64> {
    match consecutive_failures {
        1 => Some(2),
        2 => Some(5),
        3 => Some(15),
        _ => None,
    }
}

fn prune_history(state: &mut PersistedState, current_time: DateTime<Utc>) -> (usize, usize, usize) {
    let cutoff = current_time - ChronoDuration::days(i64::from(state.settings.history_retention_days));
    let balance_before = state.history.len();
    let sync_before = state.sync_events.len();
    let metric_before = state.metric_history.len();
    state.history.retain(|item| timestamp_is_retained(&item.timestamp, cutoff));
    state.sync_events.retain(|item| timestamp_is_retained(&item.timestamp, cutoff));
    state.metric_history.retain(|item| timestamp_is_retained(&item.timestamp, cutoff));
    (
        balance_before - state.history.len(),
        sync_before - state.sync_events.len(),
        metric_before - state.metric_history.len(),
    )
}

fn timestamp_is_retained(value: &str, cutoff: DateTime<Utc>) -> bool {
    DateTime::parse_from_rfc3339(value)
        .map(|timestamp| timestamp.with_timezone(&Utc) >= cutoff)
        .unwrap_or(true)
}

fn next_retry_at(account: &Account) -> Option<String> {
    if account.enabled == Some(false) || account.last_error.as_deref().is_none_or(str::is_empty) {
        return None;
    }
    let delay = retry_delay_minutes(account.consecutive_failures)?;
    let attempted_at = DateTime::parse_from_rfc3339(&account.last_attempt_at).ok()?;
    Some((attempted_at.with_timezone(&Utc) + ChronoDuration::minutes(delay)).to_rfc3339())
}

fn auto_retry_due(account: &Account, current_time: DateTime<Utc>) -> bool {
    next_retry_at(account)
        .and_then(|value| DateTime::parse_from_rfc3339(&value).ok())
        .is_some_and(|retry_at| retry_at <= current_time)
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

fn snooze_is_active(item: &SnoozedAlert, current_time: DateTime<Utc>) -> bool {
    DateTime::parse_from_rfc3339(&item.until)
        .map(|until| until > current_time)
        .unwrap_or(false)
}

fn public_alerts(state: &PersistedState) -> Vec<Value> {
    let current_time = Utc::now();
    alerts(state).into_iter().map(|mut alert| {
        let key = notification_key(&alert);
        let snoozed_until = state.snoozed_alerts.iter()
            .find(|item| item.key == key && snooze_is_active(item, current_time))
            .map(|item| item.until.clone());
        if let Some(object) = alert.as_object_mut() {
            object.insert("alertKey".into(), Value::String(key));
            object.insert("snoozedUntil".into(), snoozed_until.map(Value::String).unwrap_or(Value::Null));
        }
        alert
    }).collect()
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn automatic_sync_due_respects_interval_and_disabled_setting() {
        let recent = Instant::now();
        assert!(!automatic_sync_due(recent, 30));
        assert!(!automatic_sync_due(Instant::now() - Duration::from_secs(60 * 30), 0));
        assert!(automatic_sync_due(Instant::now() - Duration::from_secs(60 * 30 + 1), 30));
    }

    #[test]
    fn automatic_sync_schedule_is_only_published_when_enabled() {
        assert!(next_automatic_sync_at(0).is_none());
        assert!(next_automatic_sync_at(30).is_some_and(|value| DateTime::parse_from_rfc3339(&value).is_ok()));
    }

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
        assert!(public.contains("\"updateCheckMode\":\"startup\""));
        assert!(public.contains("\"staleAfterMinutes\":0"));
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
    fn remote_metric_parser_accepts_stable_numbers_and_rejects_ambiguous_text() {
        assert_eq!(parse_remote_number("86.5%", "本周期用量"), Some((86.5, "%".into())));
        assert_eq!(parse_remote_number("1,500,000", "累计 Token"), Some((1_500_000.0, "Token".into())));
        assert_eq!(parse_remote_number("6 个", "模型数量"), Some((6.0, "个".into())));
        assert_eq!(parse_remote_number("100 / 200 AFP", "已用 / 额度"), None);
        assert_eq!(parse_remote_number("2026-07-22", "重置日期"), None);
        assert_eq!(parse_remote_number("Running", "状态"), None);
    }

    #[test]
    fn metric_history_is_hourly_sampled_but_records_quota_resets() {
        let product = |usage: &str| json!({
            "id":"coding", "name":"Coding Plan", "usage":usage, "usageLabel":"月度用量",
            "summaries":[{"label":"累计 Token", "value":"1,500", "note":"官方"}]
        });
        let mut state = PersistedState::default();
        let mut account = Account {
            id:"metric-account".into(), provider:"volcengine".into(),
            last_sync:"2026-07-22T00:00:00Z".into(), products:vec![product("25%")],
            ..Account::default()
        };
        add_metric_snapshots(&mut state, &account);
        assert_eq!(state.metric_history.len(), 2);

        account.last_sync = "2026-07-22T00:30:00Z".into();
        account.products = vec![product("30%")];
        add_metric_snapshots(&mut state, &account);
        assert_eq!(state.metric_history.len(), 2);

        account.last_sync = "2026-07-22T00:31:00Z".into();
        account.products = vec![product("10%")];
        add_metric_snapshots(&mut state, &account);
        assert_eq!(state.metric_history.len(), 3);
        assert_eq!(state.metric_history.last().unwrap().value, 10.0);

        let mimo = Account { provider:"mimo".into(), ..account };
        add_metric_snapshots(&mut state, &mimo);
        assert_eq!(state.metric_history.len(), 3);
    }

    #[test]
    fn metric_history_api_filters_account_product_and_range() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Arc::new(Store::open(&directory).unwrap());
        {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account { id:"history-account".into(), ..Account::default() });
            state.metric_history = vec![
                MetricSnapshot {
                    account_id:"history-account".into(), product_id:"codex".into(),
                    timestamp:(Utc::now() - ChronoDuration::hours(2)).to_rfc3339(), value:25.0,
                    ..MetricSnapshot::default()
                },
                MetricSnapshot {
                    account_id:"history-account".into(), product_id:"chatgpt".into(),
                    timestamp:(Utc::now() - ChronoDuration::hours(1)).to_rfc3339(), value:1.0,
                    ..MetricSnapshot::default()
                },
                MetricSnapshot {
                    account_id:"history-account".into(), product_id:"codex".into(),
                    timestamp:(Utc::now() - ChronoDuration::days(8)).to_rfc3339(), value:10.0,
                    ..MetricSnapshot::default()
                },
            ];
        }
        let body = json!({ "accountId":"history-account", "productId":"codex", "rangeDays":7 }).to_string();
        let (_, response) = route_api(&Method::Post, "/api/metric-history", &body, &store).unwrap();
        assert_eq!(response["snapshots"].as_array().unwrap().len(), 1);
        assert_eq!(response["snapshots"][0]["value"], 25.0);
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn failed_syncs_use_bounded_automatic_retry_schedule() {
        assert_eq!(retry_delay_minutes(0), None);
        assert_eq!(retry_delay_minutes(1), Some(2));
        assert_eq!(retry_delay_minutes(2), Some(5));
        assert_eq!(retry_delay_minutes(3), Some(15));
        assert_eq!(retry_delay_minutes(4), None);

        let account = Account {
            enabled: Some(true),
            last_attempt_at: "2026-07-22T01:00:00Z".into(),
            last_error: Some("temporary network failure".into()),
            consecutive_failures: 2,
            ..Account::default()
        };
        assert_eq!(next_retry_at(&account).as_deref(), Some("2026-07-22T01:05:00+00:00"));
        assert!(!auto_retry_due(&account, "2026-07-22T01:04:59Z".parse().unwrap()));
        assert!(auto_retry_due(&account, "2026-07-22T01:05:00Z".parse().unwrap()));

        let paused = Account { enabled: Some(false), ..account };
        assert_eq!(next_retry_at(&paused), None);
    }

    #[test]
    fn history_retention_prunes_only_expired_valid_records() {
        let mut state = PersistedState::default();
        state.settings.history_retention_days = 30;
        state.history = vec![
            BalanceSnapshot { timestamp:"2026-06-01T00:00:00Z".into(), ..BalanceSnapshot::default() },
            BalanceSnapshot { timestamp:"2026-07-15T00:00:00Z".into(), ..BalanceSnapshot::default() },
            BalanceSnapshot { timestamp:"legacy-invalid-time".into(), ..BalanceSnapshot::default() },
        ];
        state.sync_events = vec![
            SyncEvent { timestamp:"2026-06-20T00:00:00Z".into(), ..SyncEvent::default() },
            SyncEvent { timestamp:"2026-07-21T00:00:00Z".into(), ..SyncEvent::default() },
        ];
        state.metric_history = vec![
            MetricSnapshot { timestamp:"2026-06-01T00:00:00Z".into(), ..MetricSnapshot::default() },
            MetricSnapshot { timestamp:"2026-07-21T00:00:00Z".into(), ..MetricSnapshot::default() },
        ];
        let removed = prune_history(&mut state, "2026-07-22T00:00:00Z".parse().unwrap());
        assert_eq!(removed, (1, 1, 1));
        assert_eq!(state.history.len(), 2);
        assert_eq!(state.sync_events.len(), 1);
        assert_eq!(state.metric_history.len(), 1);
    }

    #[test]
    fn clearing_history_preserves_accounts_and_settings() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Arc::new(Store::open(&directory).unwrap());
        {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account { id:"kept-account".into(), name:"保留账户".into(), ..Account::default() });
            state.history.push(BalanceSnapshot { timestamp:now(), ..BalanceSnapshot::default() });
            state.metric_history.push(MetricSnapshot { timestamp:now(), ..MetricSnapshot::default() });
            state.sync_events.push(SyncEvent { timestamp:now(), ..SyncEvent::default() });
            state.settings.history_retention_days = 180;
            store.save_locked(&state).unwrap();
        }

        let (_, response) = route_api(&Method::Delete, "/api/history", "", &store).unwrap();
        assert_eq!(response["removed"]["balanceSnapshots"], 1);
        assert_eq!(response["removed"]["metricSnapshots"], 1);
        assert_eq!(response["removed"]["syncEvents"], 1);
        let state = store.state.lock().unwrap();
        assert!(state.history.is_empty());
        assert!(state.metric_history.is_empty());
        assert!(state.sync_events.is_empty());
        assert_eq!(state.accounts.len(), 1);
        assert_eq!(state.accounts[0].id, "kept-account");
        assert_eq!(state.settings.history_retention_days, 180);
        drop(state);
        let backup = read_persisted_state(&directory.join("accounts.backup.json")).unwrap();
        assert!(backup.history.is_empty());
        assert!(backup.metric_history.is_empty());
        assert!(backup.sync_events.is_empty());
        assert_eq!(backup.accounts[0].id, "kept-account");
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn removing_an_account_also_removes_it_from_the_recovery_backup() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Arc::new(Store::open(&directory).unwrap());
        {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account { id:"delete-account".into(), encrypted_key:"encrypted-secret".into(), ..Account::default() });
            store.save_locked(&state).unwrap();
        }
        route_api(&Method::Delete, "/api/accounts/delete-account", "", &store).unwrap();
        let backup = read_persisted_state(&directory.join("accounts.backup.json")).unwrap();
        assert!(backup.accounts.is_empty());
        assert!(!fs::read_to_string(directory.join("accounts.backup.json")).unwrap().contains("encrypted-secret"));
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn saving_state_keeps_the_previous_valid_backup() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Store::open(&directory).unwrap();
        {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account { id:"backup-account".into(), name:"第一版".into(), ..Account::default() });
            store.save_locked(&state).unwrap();
            state.accounts[0].name = "第二版".into();
            store.save_locked(&state).unwrap();
        }
        let backup = read_persisted_state(&directory.join("accounts.backup.json")).unwrap();
        assert_eq!(backup.accounts[0].name, "第一版");
        let current = read_persisted_state(&directory.join("accounts.json")).unwrap();
        assert_eq!(current.accounts[0].name, "第二版");
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn corrupted_primary_state_recovers_from_the_valid_backup() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Store::open(&directory).unwrap();
        {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account { id:"recovered-account".into(), name:"可恢复账户".into(), ..Account::default() });
            store.save_locked(&state).unwrap();
        }
        drop(store);
        fs::write(directory.join("accounts.json"), b"{broken-json").unwrap();

        let recovered = Store::open(&directory).unwrap();
        assert_eq!(recovered.state.lock().unwrap().accounts[0].id, "recovered-account");
        assert!(recovered.startup_notice.as_deref().unwrap().contains("已从最近一次有效备份恢复"));
        assert_eq!(read_persisted_state(&directory.join("accounts.json")).unwrap().accounts.len(), 1);
        drop(recovered);
        fs::remove_dir_all(directory).unwrap();
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
    fn alert_snooze_can_be_enabled_and_resumed_without_hiding_the_alert() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Arc::new(Store::open(&directory).unwrap());
        let alert_key = {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account {
                id:"alert-account".into(),
                provider:"deepseek".into(),
                name:"提醒账户".into(),
                enabled:Some(true),
                balances:vec![BalanceInfo { currency:"CNY".into(), total:"1.00".into(), ..BalanceInfo::default() }],
                ..Account::default()
            });
            let key = notification_key(&alerts(&state)[0]);
            state.notified_alert_keys.push(key.clone());
            store.save_locked(&state).unwrap();
            key
        };

        let body = json!({ "alertKey": alert_key.clone() }).to_string();
        let (_, snoozed) = route_api(&Method::Post, "/api/alerts/snooze", &body, &store).unwrap();
        assert!(snoozed["snoozedUntil"].as_str().is_some());
        let state = store.state.lock().unwrap();
        assert_eq!(state.snoozed_alerts.len(), 1);
        assert!(!state.notified_alert_keys.contains(&alert_key));
        drop(state);
        let visible = store.public_state();
        let target = visible["alerts"].as_array().unwrap().iter()
            .find(|alert| alert["alertKey"] == alert_key).unwrap();
        assert!(target["snoozedUntil"].as_str().is_some());

        let (_, resumed) = route_api(&Method::Delete, "/api/alerts/snooze", &body, &store).unwrap();
        assert!(resumed["snoozedUntil"].is_null());
        assert!(store.state.lock().unwrap().snoozed_alerts.is_empty());
        let visible = store.public_state();
        let target = visible["alerts"].as_array().unwrap().iter()
            .find(|alert| alert["alertKey"] == alert_key).unwrap();
        assert!(target["snoozedUntil"].is_null());
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn stale_remote_data_is_a_backend_alert_that_can_reach_notifications() {
        let mut state = PersistedState::default();
        state.settings.auto_sync_minutes = 0;
        state.accounts.push(Account {
            id:"stale-account".into(),
            name:"过期账户".into(),
            provider:"deepseek".into(),
            enabled:Some(true),
            last_sync:(Utc::now() - ChronoDuration::hours(7)).to_rfc3339(),
            ..Account::default()
        });
        let generated = alerts(&state);
        let freshness = generated.iter().find(|alert| alert["kind"] == "freshness").unwrap();
        assert_eq!(freshness["accountId"], "stale-account");
        assert!(freshness["message"].as_str().unwrap().contains("数据可能已过期"));
        assert!(notification_key(freshness).contains("|freshness|"));
    }

    #[test]
    fn account_alert_rules_override_global_thresholds_and_can_disable_alerts() {
        let mut state = PersistedState::default();
        state.settings.low_balance_threshold = 10.0;
        state.settings.usage_threshold = 80.0;
        state.accounts.push(Account {
            id: "balance-account".into(),
            name: "余额账户".into(),
            provider: "deepseek".into(),
            enabled: Some(true),
            last_sync: now(),
            balances: vec![BalanceInfo {
                currency: "CNY".into(),
                total: "5.00".into(),
                ..BalanceInfo::default()
            }],
            alert_settings: AccountAlertSettings {
                low_balance_threshold: Some(1.0),
                ..AccountAlertSettings::default()
            },
            ..Account::default()
        });
        state.accounts.push(Account {
            id: "quota-account".into(),
            name: "额度账户".into(),
            provider: "openai".into(),
            enabled: Some(true),
            last_sync: now(),
            products: vec![json!({ "id":"codex", "name":"Codex", "usage":"92%" })],
            alert_settings: AccountAlertSettings {
                usage_threshold: Some(95.0),
                ..AccountAlertSettings::default()
            },
            ..Account::default()
        });
        assert!(alerts(&state).is_empty());

        state.accounts[0].alert_settings.low_balance_threshold = Some(6.0);
        state.accounts[1].alert_settings.usage_threshold = Some(90.0);
        assert_eq!(alerts(&state).len(), 2);
        state.accounts[0].alert_settings.enabled = Some(false);
        assert_eq!(alerts(&state).len(), 1);
    }

    #[test]
    fn account_alert_settings_are_saved_and_mimo_is_excluded() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Arc::new(Store::open(&directory).unwrap());
        {
            let mut state = store.state.lock().unwrap();
            state.accounts.push(Account {
                id: "deepseek-alerts".into(),
                provider: "deepseek".into(),
                ..Account::default()
            });
            state.accounts.push(Account {
                id: "mimo-alerts".into(),
                provider: "mimo".into(),
                ..Account::default()
            });
            state.notified_alert_keys.push("deepseek-alerts|balance||CNY".into());
            store.save_locked(&state).unwrap();
        }
        let body = json!({
            "enabled": true,
            "lowBalanceThreshold": 25.5,
            "usageThreshold": null,
            "staleAfterMinutes": 180
        }).to_string();
        let (_, response) = route_api(
            &Method::Put,
            "/api/accounts/deepseek-alerts/alerts",
            &body,
            &store,
        ).unwrap();
        assert_eq!(response["account"]["alertSettings"]["lowBalanceThreshold"], 25.5);
        assert_eq!(response["account"]["alertSettings"]["staleAfterMinutes"], 180);
        assert!(store.state.lock().unwrap().notified_alert_keys.is_empty());

        let error = route_api(
            &Method::Put,
            "/api/accounts/mimo-alerts/alerts",
            &body,
            &store,
        ).unwrap_err();
        assert!(error.contains("不纳入"));
        drop(store);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn stale_alert_threshold_can_follow_sync_or_use_an_explicit_value() {
        let mut settings = Settings::default();
        settings.auto_sync_minutes = 15;
        assert_eq!(stale_after_minutes(&settings), 60);
        settings.auto_sync_minutes = 180;
        assert_eq!(stale_after_minutes(&settings), 540);
        settings.stale_after_minutes = 1440;
        assert_eq!(stale_after_minutes(&settings), 1440);
        settings.auto_sync_minutes = 0;
        assert_eq!(stale_after_minutes(&settings), 1440);
        settings.stale_after_minutes = 0;
        assert_eq!(stale_after_minutes(&settings), 360);
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
    fn concurrent_sync_batches_preserve_account_order_and_failure_history() {
        let directory = std::env::temp_dir().join(format!("prismeter-test-{}", new_id()));
        let store = Store::open(&directory).unwrap();
        let ids = (0..(MAX_CONCURRENT_SYNCS + 2))
            .map(|index| format!("parallel-account-{index}"))
            .collect::<Vec<_>>();
        store.state.lock().unwrap().accounts.extend(ids.iter().map(|id| Account {
            id: id.clone(),
            provider: "unsupported-test-provider".into(),
            enabled: Some(true),
            ..Account::default()
        }));

        let results = store.sync_account_ids(ids.clone());
        assert_eq!(
            results.iter().map(|result| result["id"].as_str().unwrap()).collect::<Vec<_>>(),
            ids.iter().map(String::as_str).collect::<Vec<_>>()
        );
        assert!(results.iter().all(|result| result["ok"] == false));
        assert_eq!(store.state.lock().unwrap().sync_events.len(), ids.len());
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
