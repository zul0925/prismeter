use std::{
    env,
    io::{BufRead, BufReader, Read, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};

use chrono::{Local, TimeZone, Utc};
use serde_json::{json, Value};

type Result<T> = std::result::Result<T, String>;

pub struct CodexUsage {
    pub email: String,
    pub plan_type: String,
    pub products: Vec<Value>,
    pub warnings: Vec<String>,
}

pub fn read_usage() -> Result<CodexUsage> {
    let executable = find_executable().ok_or_else(|| {
        "未找到 Codex 官方客户端。请先安装并登录 Codex，然后重试。".to_string()
    })?;
    let mut command = Command::new(executable);
    command.arg("app-server")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let mut child = command.spawn().map_err(|error| format!("Codex app-server 无法启动：{error}"))?;
    let result = communicate(&mut child);
    let _ = child.kill();
    let _ = child.wait();
    result
}

fn communicate(child: &mut Child) -> Result<CodexUsage> {
    let stdout = child.stdout.take().ok_or("无法读取 Codex app-server 输出。")?;
    let stderr = child.stderr.take().ok_or("无法读取 Codex app-server 错误输出。")?;
    let mut stdin = child.stdin.take().ok_or("无法写入 Codex app-server。")?;
    let (sender, receiver) = mpsc::channel::<Value>();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(|line| line.ok()) {
            if let Ok(message) = serde_json::from_str::<Value>(&line) {
                if message.get("id").is_some() { let _ = sender.send(message); }
            }
        }
    });
    let errors = Arc::new(Mutex::new(String::new()));
    let error_output = Arc::clone(&errors);
    thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        *error_output.lock().unwrap() = text;
    });

    send(&mut stdin, json!({
        "method": "initialize", "id": 0,
        "params": { "clientInfo": { "name": "prismeter", "title": "Prismeter", "version": env!("CARGO_PKG_VERSION") } }
    }))?;
    let initialized = receive_id(&receiver, 0, Duration::from_secs(12), &errors)?;
    reply_result(&initialized)?;
    send(&mut stdin, json!({ "method": "initialized", "params": {} }))?;
    send(&mut stdin, json!({ "method": "account/read", "id": 1, "params": { "refreshToken": true } }))?;
    send(&mut stdin, json!({ "method": "account/rateLimits/read", "id": 2, "params": null }))?;
    send(&mut stdin, json!({ "method": "account/usage/read", "id": 3, "params": null }))?;

    let mut replies = std::collections::HashMap::new();
    while replies.len() < 3 {
        let message = receiver.recv_timeout(Duration::from_secs(30)).map_err(|_| {
            let detail = errors.lock().unwrap().trim().to_string();
            if detail.is_empty() {
                "Codex 远端用量读取超时，请确认网络和登录状态。".to_string()
            } else {
                format!("Codex 远端用量读取失败：{detail}")
            }
        })?;
        if let Some(id) = message.get("id").and_then(Value::as_i64) {
            if (1..=3).contains(&id) { replies.insert(id, message); }
        }
    }

    let account_result = reply_result(replies.get(&1).unwrap())?;
    let account = account_result.get("account").filter(|value| !value.is_null())
        .ok_or("Codex 当前没有已登录账户。")?;
    if text(account, "type") != "chatgpt" {
        return Err("当前 Codex 未使用 ChatGPT 账户登录，无法读取订阅用量。".into());
    }
    let limits_result = reply_result(replies.get(&2).unwrap())?;
    let usage_result = reply_result(replies.get(&3).unwrap())?;
    let email = text(account, "email");
    let plan_type = first_non_empty(&[
        text(account, "planType"),
        limits_result.pointer("/rateLimits/planType").map(value_text).unwrap_or_default(),
        "未提供".into(),
    ]);
    Ok(CodexUsage {
        email: email.clone(),
        plan_type: plan_type.clone(),
        products: vec![build_codex_product(&plan_type, limits_result, usage_result), build_subscription_product(&email, &plan_type)],
        warnings: Vec::new(),
    })
}

fn send(stdin: &mut impl Write, message: Value) -> Result<()> {
    serde_json::to_writer(&mut *stdin, &message).map_err(|error| format!("Codex 请求序列化失败：{error}"))?;
    stdin.write_all(b"\n").and_then(|_| stdin.flush()).map_err(|error| format!("Codex 请求发送失败：{error}"))
}

fn receive_id(receiver: &mpsc::Receiver<Value>, id: i64, timeout: Duration, errors: &Arc<Mutex<String>>) -> Result<Value> {
    loop {
        let message = receiver.recv_timeout(timeout).map_err(|_| {
            let detail = errors.lock().unwrap().trim().to_string();
            if detail.is_empty() { "Codex app-server 初始化超时。".into() } else { format!("Codex app-server 初始化失败：{detail}") }
        })?;
        if message.get("id").and_then(Value::as_i64) == Some(id) { return Ok(message); }
    }
}

fn reply_result(reply: &Value) -> Result<&Value> {
    if let Some(error) = reply.get("error") {
        return Err(error.get("message").map(value_text).filter(|text| !text.is_empty()).unwrap_or_else(|| "Codex 返回错误。".into()));
    }
    reply.get("result").ok_or_else(|| "Codex app-server 未返回结果。".to_string())
}

fn find_executable() -> Option<PathBuf> {
    if let Some(path) = env::var_os("PRISMETER_CODEX_EXECUTABLE").map(PathBuf::from).filter(|path| path.is_file()) {
        return Some(path);
    }
    let home = env::var_os("USERPROFILE").map(PathBuf::from)?;
    for path in [
        home.join(".codex").join("plugins").join(".plugin-appserver").join("codex.exe"),
        home.join(".codex").join(".sandbox-bin").join("codex.exe"),
    ] {
        if path.is_file() { return Some(path); }
    }
    env::var_os("PATH").and_then(|value| env::split_paths(&value).map(|directory| directory.join("codex.exe")).find(|path| path.is_file()))
}

fn build_subscription_product(email: &str, plan: &str) -> Value {
    let name = plan_name(plan);
    json!({
        "id": "chatgpt", "name": format!("ChatGPT {name}"), "kind": "账户订阅",
        "usage": name, "usageLabel": "当前订阅", "status": "Running",
        "i18n": {
            "summaryKeys": [
                { "labelKey":"codex.subscription.plan", "noteKey":"codex.subscription.remoteAccount" },
                { "labelKey":"codex.subscription.identity", "noteKey":"codex.subscription.officialSignIn" },
                { "labelKey":"codex.subscription.usage", "valueKey":"codex.subscription.separateProduct", "noteKey":"codex.subscription.switchToCodex" },
                { "labelKey":"codex.subscription.chatUsage", "valueKey":"codex.subscription.unavailable", "noteKey":"codex.subscription.noPublicUsageApi" }
            ]
        },
        "summaries": [
            metric("订阅套餐", name, "OpenAI 远端账户"),
            metric("账户身份", if email.is_empty() { "已登录" } else { email }, "Codex 官方登录态"),
            metric("Codex 用量", "独立产品", "请切换到 Codex 标签"),
            metric("ChatGPT 对话用量", "—", "个人账户未提供对外统计接口")
        ],
        "columns": [], "rows": []
    })
}

fn build_codex_product(plan: &str, limits_result: &Value, usage_result: &Value) -> Value {
    let limits = limits_result.get("rateLimits").unwrap_or(&Value::Null);
    let primary = limits.get("primary").unwrap_or(&Value::Null);
    let secondary = limits.get("secondary").unwrap_or(&Value::Null);
    let summary = usage_result.get("summary").unwrap_or(&Value::Null);
    let used = integer(primary, "usedPercent");
    let duration = integer(primary, "windowDurationMins");
    let reset_timestamp = integer(primary, "resetsAt");
    let reset = unix_seconds(reset_timestamp);
    let lifetime = integer(summary, "lifetimeTokens");
    let peak = integer(summary, "peakDailyTokens");
    let streak = integer(summary, "currentStreakDays");
    let reset_credits = limits_result.pointer("/rateLimitResetCredits/availableCount").and_then(Value::as_i64).unwrap_or(0);
    let mut buckets: Vec<&Value> = usage_result.get("dailyUsageBuckets").and_then(Value::as_array)
        .map(|values| values.iter().collect()).unwrap_or_default();
    buckets.sort_by_key(|value| std::cmp::Reverse(text(value, "startDate")));
    let rows: Vec<Value> = buckets.into_iter().take(30).map(|bucket| {
        let tokens = integer(bucket, "tokens");
        let date = text(bucket, "startDate");
        let token_value = compact(tokens);
        let peak_ratio = if peak > 0 { format!("{:.1}%", tokens as f64 * 100.0 / peak as f64) } else { "—".into() };
        json!({
            "name": date, "type": "每日远端统计", "badge": "日",
            "i18n": { "typeKey":"codex.row.dailyUsage", "metricUnitKeys": ["codex.column.date", "codex.column.tokens", "codex.column.peakRatio", "codex.note.openaiRemote"] },
            "metrics": [
                platform_value(&date, "日期"),
                platform_value(&token_value, "Token"),
                platform_value(&peak_ratio, "峰值占比"),
                platform_value("OpenAI", "远端官方")
            ]
        })
    }).collect();
    let primary_value = if primary.is_null() { "—".into() } else { format!("{used}%") };
    let secondary_value = if secondary.is_null() { "—".into() } else { format!("{}%", integer(secondary, "usedPercent")) };
    let secondary_note = if secondary.is_null() { format!("重置时间 {reset}") } else { format!("{} · {} 重置", window_label(integer(secondary, "windowDurationMins")), unix_seconds(integer(secondary, "resetsAt"))) };
    let lifetime_value = if lifetime > 0 { compact(lifetime) } else { "—".into() };
    let streak_value = if streak > 0 { format!("{streak} 天") } else { "—".into() };
    let streak_note = if reset_credits > 0 { format!("{reset_credits} 次可用重置") } else { "远端统计".into() };
    json!({
        "id": "codex", "name": format!("Codex · {}", plan_name(plan)), "kind": "Codex 用量",
        "usage": primary_value, "usageLabel": format!("{}已用", window_label(duration)),
        "usageLabelKey": "codex.usage.windowUsed",
        "usageLabelParams": { "minutes": duration },
        "resetAt": unix_seconds_iso(reset_timestamp),
        "status": first_non_empty(&[text(limits, "rateLimitReachedType"), "Running".into()]),
        "i18n": {
            "summaryKeys": [
                { "labelKey":"codex.summary.currentWindow", "noteKey":"codex.note.windowReset", "noteParams": { "minutes": duration, "reset": reset } },
                { "labelKey":"codex.summary.secondaryWindow", "noteKey":"codex.note.resetAt", "noteParams": { "reset": unix_seconds(integer(secondary, "resetsAt")) } },
                { "labelKey":"codex.summary.lifetimeTokens", "noteKey":"codex.note.openaiRemote" },
                { "labelKey":"codex.summary.activeStreak", "valueKey":"codex.value.streakDays", "valueParams": { "count": streak }, "noteKey": if reset_credits > 0 { "codex.note.resetCredits" } else { "codex.note.openaiRemote" }, "noteParams": { "count": reset_credits } }
            ],
            "columnKeys": ["codex.column.date", "codex.column.tokens", "codex.column.peakRatio", "codex.column.source"]
        },
        "summaries": [
            metric("当前周期", &primary_value, &format!("{} · {} 重置", window_label(duration), reset)),
            metric("次级周期", &secondary_value, &secondary_note),
            metric("累计 Token", &lifetime_value, "OpenAI 远端"),
            metric("连续使用", &streak_value, &streak_note)
        ],
        "columns": ["日期", "Token", "峰值占比", "来源"], "rows": rows
    })
}

fn metric(label: &str, value: &str, note: &str) -> Value { json!({ "label": label, "value": value, "note": note }) }
fn platform_value(value: &str, unit: &str) -> Value { json!({ "value": value, "unit": unit }) }
fn text(source: &Value, key: &str) -> String { source.get(key).map(value_text).unwrap_or_default() }
fn value_text(value: &Value) -> String {
    value.as_str().map(str::to_owned).unwrap_or_else(|| match value { Value::Number(value) => value.to_string(), Value::Bool(value) => value.to_string(), _ => String::new() })
}
fn integer(source: &Value, key: &str) -> i64 { source.get(key).and_then(|value| value.as_i64().or_else(|| value.as_str()?.parse().ok())).unwrap_or(0) }
fn first_non_empty(values: &[String]) -> String { values.iter().find(|value| !value.trim().is_empty()).cloned().unwrap_or_default() }
fn unix_seconds(value: i64) -> String { if value <= 0 { "—".into() } else { Local.timestamp_opt(value, 0).single().map(|time| time.format("%m-%d %H:%M").to_string()).unwrap_or_else(|| "—".into()) } }
fn unix_seconds_iso(value: i64) -> String { if value <= 0 { String::new() } else { Utc.timestamp_opt(value, 0).single().map(|time| time.to_rfc3339()).unwrap_or_default() } }
fn window_label(minutes: i64) -> String {
    if minutes >= 1440 && minutes % 1440 == 0 { format!("{} 天周期", minutes / 1440) }
    else if minutes >= 60 && minutes % 60 == 0 { format!("{} 小时周期", minutes / 60) }
    else if minutes > 0 { format!("{minutes} 分钟周期") }
    else { "当前周期".into() }
}
fn plan_name(value: &str) -> &str {
    match value {
        "free" => "Free", "go" => "Go", "plus" => "Plus", "pro" => "Pro", "prolite" => "Pro Lite",
        "team" => "Team", "self_serve_business_usage_based" | "business" => "Business",
        "enterprise_cbp_usage_based" | "enterprise" => "Enterprise", "edu" => "Edu", _ => "ChatGPT",
    }
}
fn compact(value: i64) -> String {
    if value >= 1_000_000_000 { format!("{}B", compact_decimal(value as f64 / 1_000_000_000.0)) }
    else if value >= 1_000_000 { format!("{}M", compact_decimal(value as f64 / 1_000_000.0)) }
    else if value >= 1_000 { format!("{}K", compact_decimal(value as f64 / 1_000.0)) }
    else { value.to_string() }
}
fn compact_decimal(value: f64) -> String {
    format!("{value:.2}").trim_end_matches('0').trim_end_matches('.').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_product_includes_both_limit_windows() {
        let limits = json!({
            "rateLimits": {
                "planType":"plus", "primary":{"usedPercent":25,"windowDurationMins":300,"resetsAt":1800000000},
                "secondary":{"usedPercent":40,"windowDurationMins":10080,"resetsAt":1800500000}
            },
            "rateLimitResetCredits":{"availableCount":2}
        });
        let usage = json!({"summary":{"lifetimeTokens":1500000,"peakDailyTokens":1000,"currentStreakDays":3},"dailyUsageBuckets":[{"startDate":"2026-07-20","tokens":500}]});
        let product = build_codex_product("plus", &limits, &usage);
        assert_eq!(product["usage"], "25%");
        assert_eq!(product["resetAt"], "2027-01-15T08:00:00+00:00");
        assert_eq!(product["summaries"][1]["value"], "40%");
        assert_eq!(product["rows"][0]["metrics"][1]["value"], "500");
    }

    #[test]
    fn current_plan_variants_have_readable_names() {
        assert_eq!(plan_name("self_serve_business_usage_based"), "Business");
        assert_eq!(plan_name("enterprise_cbp_usage_based"), "Enterprise");
    }

    #[test]
    #[ignore = "requires the current user's Codex login and network"]
    fn live_app_server_returns_usage_without_reading_auth_files() {
        let usage = read_usage().unwrap();
        assert!(!usage.plan_type.is_empty());
        assert_eq!(usage.products.len(), 2);
    }
}
