use chrono::{DateTime, Datelike, Local, TimeZone, Utc};
use hmac::{Hmac, Mac};
use reqwest::blocking::Client;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const VERSION: &str = "2024-01-01";
const HOST: &str = "open.volcengineapi.com";
const SERVICE: &str = "ark";

type HmacSha256 = Hmac<Sha256>;
type Result<T> = std::result::Result<T, String>;

pub fn discover(
    client: &Client,
    access_key: &str,
    secret_key: &str,
    region: &str,
    project: &str,
) -> Result<(Vec<Value>, Vec<String>)> {
    let mut products = Vec::new();
    let mut warnings = Vec::new();

    match discover_agent(client, access_key, secret_key, region) {
        Ok(Some(product)) => products.push(product),
        Ok(None) => warnings.push("Agent Plan：当前账户未开通。".into()),
        Err(error) => warnings.push(format!("Agent Plan：{error}")),
    }
    match discover_coding(client, access_key, secret_key, region, project) {
        Ok(Some(product)) => products.push(product),
        Ok(None) => warnings.push("Coding Plan：账户未返回个人配额或企业席位。".into()),
        Err(error) => warnings.push(format!("Coding Plan：{error}")),
    }
    match discover_payg(client, access_key, secret_key, region, project) {
        Ok(Some(product)) => products.push(product),
        Ok(None) => warnings.push("按量 API：未返回推理用量或接入点。".into()),
        Err(error) => warnings.push(format!("按量 API：{error}")),
    }

    if products.is_empty() {
        return Err(format!(
            "未能读取任何火山方舟产品。请检查 AK/SK、项目和 Ark/费用中心只读权限。{}",
            warnings.first().map(|value| format!("\n{value}")).unwrap_or_default()
        ));
    }
    Ok((products, warnings))
}

fn discover_agent(client: &Client, ak: &str, sk: &str, region: &str) -> Result<Option<Value>> {
    let root = call(client, "GetAFPUsage", ak, sk, region, &json!({}), Utc::now())?;
    let result = result(&root);
    let keys = ["AFPFiveHour", "AFPDaily", "AFPWeekly", "AFPMonthly"];
    let labels = ["5 小时窗口", "每日窗口", "每周窗口", "每月窗口"];
    let plan_type = text(result, "PlanType");
    let has_quota = keys.iter().any(|key| number(child(result, key), "Quota") > 0.0);
    if plan_type.is_empty() && !has_quota { return Ok(None); }
    let plan_type = if plan_type.is_empty() { "已开通".to_string() } else { plan_type };

    let mut rows = Vec::new();
    let mut summaries = vec![metric("套餐类型", &plan_type, "官方")];
    let mut monthly_remaining = None;
    for (index, key) in keys.iter().enumerate() {
        let window = child(result, key);
        if window.as_object().is_none_or(|value| value.is_empty()) { continue; }
        let quota = number(window, "Quota");
        let used = number(window, "Used");
        let remaining = (quota - used).max(0.0);
        if *key == "AFPMonthly" { monthly_remaining = Some(remaining); }
        let badge = ["5H", "日", "周", "月"][index];
        summaries.push(metric(&labels[index], &format!("{} / {} AFP", format_number(used), format_number(quota)), "已用 / 额度"));
        rows.push(json!({
            "name": labels[index], "type": "Agent Plan AFP",
            "badge": badge,
            "metrics": [
                platform_value(&format_number(quota), "额度 AFP"),
                platform_value(&format_number(used), "已用 AFP"),
                platform_value(&format_number(remaining), "剩余 AFP"),
                platform_value(&unix_millis(window, "ResetTime"), "本地时间")
            ]
        }));
    }
    summaries.truncate(4);
    Ok(Some(json!({
        "id": "agent", "name": format!("Agent Plan {plan_type}"), "kind": "AFP 套餐",
        "usage": monthly_remaining.map(|value| format!("{} AFP", format_number(value))).unwrap_or_else(|| plan_type.clone()),
        "usageLabel": if monthly_remaining.is_some() { "本月剩余" } else { "套餐状态" },
        "status": "official", "summaries": summaries,
        "columns": ["额度", "已用", "剩余", "重置时间"], "rows": rows
    })))
}

fn discover_coding(client: &Client, ak: &str, sk: &str, region: &str, project: &str) -> Result<Option<Value>> {
    let quota = call(client, "GetCodingPlanUsage", ak, sk, region, &json!({}), Utc::now());
    if let Ok(root) = &quota {
        let result = result(root);
        let windows = array(result, "QuotaUsage");
        if !windows.is_empty() {
            let mut rows = Vec::new();
            let mut summaries = Vec::new();
            let mut primary_usage: Option<(String, f64)> = None;
            for window in windows {
                let level = text(window, "Level");
                let percent = number(window, "Percent");
                let label = match level.to_ascii_lowercase().as_str() {
                    "session" => "当前周期",
                    "weekly" => "本周",
                    "monthly" => "本月",
                    _ => level.as_str(),
                };
                if primary_usage.is_none() || level.eq_ignore_ascii_case("monthly") {
                    primary_usage = Some((label.to_string(), percent));
                }
                let reset = unix_seconds(window, "ResetTimestamp");
                summaries.push(metric(&format!("{label}用量"), &percent_text(percent), if reset == "—" { "动态周期" } else { "到期后重置" }));
                rows.push(json!({
                    "name": label, "type": "Coding Plan 配额窗口",
                    "badge": match level.as_str() { "session" => "时", "weekly" => "周", _ => "月" },
                    "metrics": [
                        platform_value(&percent_text(percent), "已用"),
                        platform_value(&percent_text((100.0 - percent).max(0.0)), "剩余"),
                        platform_value(&reset, "本地时间"),
                        platform_value(&first_non_empty(&[text(result, "Status"), "—".into()]), "官方状态")
                    ]
                }));
            }
            let status = text(result, "Status");
            if !status.is_empty() && summaries.len() < 4 {
                summaries.push(metric("套餐状态", &status, "官方"));
            }
            summaries.truncate(4);
            let (usage_label, usage) = primary_usage
                .map(|(label, percent)| (format!("{label}用量"), percent_text(percent)))
                .unwrap_or_else(|| ("套餐用量".into(), "—".into()));
            return Ok(Some(json!({
                "id": "coding", "name": "Coding Plan", "kind": "编程套餐",
                "usage": usage, "usageLabel": usage_label, "status": "official",
                "summaries": summaries, "columns": ["使用比例", "剩余比例", "重置时间", "状态"], "rows": rows
            })));
        }
    }

    let seats_root = call(client, "ListSeatInfos", ak, sk, region, &json!({
        "Filter": {}, "PageSize": 100, "PageNum": 1, "ProjectName": project
    }), Utc::now()).map_err(|seat_error| {
        quota.err().unwrap_or(seat_error)
    })?;
    let seat_data = array(result(&seats_root), "Data");
    let ids: Vec<String> = seat_data.iter().map(|item| text(item, "SeatID")).filter(|id| !id.is_empty()).collect();
    if ids.is_empty() { return Ok(None); }
    let usage_root = call(client, "ListSeatInfoUsages", ak, sk, region, &json!({
        "ProjectName": project, "SeatIDs": ids
    }), Utc::now());
    let usages = usage_root.as_ref().map(|root| array(result(root), "Data")).unwrap_or_default();
    let average_monthly = average(&usages, "MonthlyUsage");
    let average_weekly_text = if usages.is_empty() { "—".into() } else { percent_text(average(&usages, "WeeklyUsage")) };
    let average_monthly_text = if usages.is_empty() { "—".into() } else { percent_text(average_monthly) };
    let rows: Vec<Value> = usages.iter().map(|item| json!({
        "name": first_non_empty(&[text(item, "UserName"), text(item, "SeatID"), "Coding 席位".into()]),
        "type": "Coding Plan 企业席位", "badge": "CP",
        "metrics": [
            platform_value(&percent_text(number(item, "ShortTermUsage")), "官方"),
            platform_value(&percent_text(number(item, "WeeklyUsage")), "官方"),
            platform_value(&percent_text(number(item, "MonthlyUsage")), "官方"),
            platform_value(&reset_time(item), "本地时间")
        ]
    })).collect();
    Ok(Some(json!({
        "id": "coding", "name": "Coding Plan", "kind": "企业编程套餐",
        "usage": if usages.is_empty() { format!("{} 席位", ids.len()) } else { percent_text(average_monthly) },
        "usageLabel": if usages.is_empty() { "已发现席位" } else { "平均月度使用" }, "status": "official",
        "summaries": [
            metric("席位总数", &ids.len().to_string(), "官方"),
            metric("有用量数据", &usages.len().to_string(), "席位"),
            metric("平均本周用量", &average_weekly_text, if usages.is_empty() { "接口未返回" } else { "官方" }),
            metric("平均本月用量", &average_monthly_text, if usages.is_empty() { "接口未返回" } else { "官方" })
        ],
        "columns": ["短周期", "本周", "本月", "重置时间"], "rows": rows
    })))
}

fn discover_payg(client: &Client, ak: &str, sk: &str, region: &str, project: &str) -> Result<Option<Value>> {
    let now = Utc::now();
    let start = format!("{:04}-{:02}-01", now.year(), now.month());
    let end = (now + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let usage = call(client, "GetInferenceUsage", ak, sk, region, &json!({
        "QueryInterval": "Day", "StartTime": start, "EndTime": end, "ShowWindowDetail": false
    }), now);
    let endpoints = call(client, "ListEndpoints", ak, sk, region, &json!({
        "PageNumber": 1, "PageSize": 1, "ProjectName": project
    }), Utc::now());
    if usage.is_err() && endpoints.is_err() {
        return Err(usage.err().unwrap_or_else(|| "推理用量接口不可用。".into()));
    }
    let usage_result = usage.as_ref().map(result);
    let input_tokens = usage_result.map(|v| table_sum(v, "InputTokens")).unwrap_or(0.0);
    let cache_tokens = usage_result.map(|v| table_sum(v, "CacheTokensHit")).unwrap_or(0.0);
    let output_tokens = usage_result.map(|v| table_sum(v, "OutputTokens")).unwrap_or(0.0);
    let total_tokens = usage_result.map(|v| table_sum(v, "TotalTokens")).unwrap_or(0.0);
    let requests = usage_result.map(|v| table_sum(v, "ReqCnt")).unwrap_or(0.0);
    let endpoint_count = endpoints.as_ref().map(|v| number(result(v), "TotalCount") as i64).unwrap_or(0);
    let (usage_text, usage_label, summaries) = if usage.is_ok() {
        (compact_number(total_tokens), "本月总 Token", vec![
            metric("输入 Token", &compact_number(input_tokens), "远端官方"),
            metric("缓存命中", &compact_number(cache_tokens), "远端官方"),
            metric("输出 Token", &compact_number(output_tokens), "远端官方"),
            metric("请求次数", &compact_number(requests), "本月"),
        ])
    } else {
        (endpoint_count.to_string(), "推理接入点", vec![
            metric("推理接入点", &endpoint_count.to_string(), "远端官方"),
            metric("Token 用量", "—", "远端接口暂不可用"),
            metric("项目", project, "远端官方"),
            metric("统计周期", &now.format("%Y-%m").to_string(), "本月"),
        ])
    };
    Ok(Some(json!({
        "id": "payg", "name": "按量 API", "kind": "在线推理",
        "usage": usage_text, "usageLabel": usage_label, "status": "official",
        "summaries": summaries, "columns": [], "rows": []
    })))
}

fn call(client: &Client, action: &str, ak: &str, sk: &str, region: &str, body: &Value, time: DateTime<Utc>) -> Result<Value> {
    let payload = serde_json::to_vec(body).map_err(|error| format!("请求序列化失败：{error}"))?;
    let signed = sign(action, ak, sk, region, &payload, time);
    let url = format!("https://{HOST}/?{}", signed.query);
    let response = client.post(url)
        .header("Content-Type", "application/json; charset=UTF-8")
        .header("Accept", "application/json")
        .header("X-Date", &signed.x_date)
        .header("X-Content-Sha256", &signed.payload_hash)
        .header("Authorization", &signed.authorization)
        .body(payload).send().map_err(|error| format!("火山接口请求失败：{error}"))?;
    let status = response.status();
    let text = response.text().map_err(|error| format!("火山接口响应读取失败：{error}"))?;
    if !status.is_success() { return Err(map_remote_error(&text, status.as_u16())); }
    let root: Value = serde_json::from_str(&text).map_err(|error| format!("火山接口返回无效数据：{error}"))?;
    if let Some(error) = root.pointer("/ResponseMetadata/Error") {
        let message = text_field(error, "Message");
        let code = text_field(error, "Code");
        return Err(if !message.is_empty() { message } else if !code.is_empty() { code } else { "火山接口返回错误。".into() });
    }
    Ok(root)
}

struct SignedRequest {
    query: String,
    x_date: String,
    payload_hash: String,
    authorization: String,
}

fn sign(action: &str, ak: &str, sk: &str, region: &str, payload: &[u8], time: DateTime<Utc>) -> SignedRequest {
    let payload_hash = sha256_hex(payload);
    let x_date = time.format("%Y%m%dT%H%M%SZ").to_string();
    let short_date = time.format("%Y%m%d").to_string();
    let query = format!("Action={action}&Version={VERSION}");
    let signed_headers = "host;x-content-sha256;x-date";
    let canonical_headers = format!("host:{HOST}\nx-content-sha256:{payload_hash}\nx-date:{x_date}\n");
    let canonical_request = format!("POST\n/\n{query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}");
    let scope = format!("{short_date}/{region}/{SERVICE}/request");
    let string_to_sign = format!("HMAC-SHA256\n{x_date}\n{scope}\n{}", sha256_hex(canonical_request.as_bytes()));
    let k_date = hmac(sk.as_bytes(), short_date.as_bytes());
    let k_region = hmac(&k_date, region.as_bytes());
    let k_service = hmac(&k_region, SERVICE.as_bytes());
    let k_signing = hmac(&k_service, b"request");
    let signature = hex::encode(hmac(&k_signing, string_to_sign.as_bytes()));
    let authorization = format!("HMAC-SHA256 Credential={ak}/{scope}, SignedHeaders={signed_headers}, Signature={signature}");
    SignedRequest { query, x_date, payload_hash, authorization }
}

fn hmac(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut value = HmacSha256::new_from_slice(key).expect("HMAC accepts arbitrary key sizes");
    value.update(data);
    value.finalize().into_bytes().to_vec()
}
fn sha256_hex(data: &[u8]) -> String { hex::encode(Sha256::digest(data)) }
fn map_remote_error(body: &str, status: u16) -> String {
    if body.contains("InvalidAccessKey") { "Access Key 无效。".into() }
    else if body.contains("Signature") { "Secret Key 或签名无效。".into() }
    else if body.contains("AccessDenied") { "当前 AK/SK 缺少该产品的只读权限。".into() }
    else { format!("火山接口请求失败（HTTP {status}）。") }
}
fn result(root: &Value) -> &Value { root.get("Result").unwrap_or(&Value::Null) }
fn child<'a>(source: &'a Value, key: &str) -> &'a Value { source.get(key).unwrap_or(&Value::Null) }
fn array<'a>(source: &'a Value, key: &str) -> Vec<&'a Value> { source.get(key).and_then(Value::as_array).map(|v| v.iter().collect()).unwrap_or_default() }
fn text(source: &Value, key: &str) -> String { source.get(key).map(value_text).unwrap_or_default() }
fn text_field(source: &Value, key: &str) -> String { text(source, key) }
fn value_text(value: &Value) -> String {
    value.as_str().map(str::to_owned).unwrap_or_else(|| match value {
        Value::Number(number) => number.to_string(), Value::Bool(value) => value.to_string(), _ => String::new()
    })
}
fn number(source: &Value, key: &str) -> f64 {
    source.get(key).and_then(|value| value.as_f64().or_else(|| value.as_str()?.parse().ok())).unwrap_or(0.0)
}
fn metric(label: &str, value: &str, note: &str) -> Value { json!({ "label": label, "value": value, "note": note }) }
fn platform_value(value: &str, unit: &str) -> Value { json!({ "value": value, "unit": unit }) }
fn format_number(value: f64) -> String {
    if value.fract().abs() < 0.000_001 { format!("{value:.0}") } else { format!("{value:.2}").trim_end_matches('0').trim_end_matches('.').to_string() }
}
fn percent_text(value: f64) -> String { format!("{}%", format_number(value)) }
fn compact_number(value: f64) -> String {
    if value >= 1_000_000_000.0 { format!("{}B", format_number(value / 1_000_000_000.0)) }
    else if value >= 1_000_000.0 { format!("{}M", format_number(value / 1_000_000.0)) }
    else if value >= 1_000.0 { format!("{}K", format_number(value / 1_000.0)) }
    else { format!("{value:.0}") }
}
fn local_time(timestamp: i64, millis: bool) -> String {
    let value = if millis { Local.timestamp_millis_opt(timestamp).single() } else { Local.timestamp_opt(timestamp, 0).single() };
    value.map(|time| time.format("%m-%d %H:%M").to_string()).unwrap_or_else(|| "—".into())
}
fn unix_seconds(source: &Value, key: &str) -> String { let value = number(source, key) as i64; if value <= 0 { "—".into() } else { local_time(value, false) } }
fn unix_millis(source: &Value, key: &str) -> String { let value = number(source, key) as i64; if value < 1_000_000_000 { "—".into() } else { local_time(value, true) } }
fn reset_time(source: &Value) -> String { unix_millis(source, "MonthlyResetMilestone") }
fn first_non_empty(values: &[String]) -> String { values.iter().find(|value| !value.trim().is_empty()).cloned().unwrap_or_default() }
fn average(values: &[&Value], key: &str) -> f64 { if values.is_empty() { 0.0 } else { values.iter().map(|value| number(value, key)).sum::<f64>() / values.len() as f64 } }
fn table_sum(result: &Value, column: &str) -> f64 {
    let fields = array(result, "Fields");
    let Some(index) = fields.iter().position(|field| text(field, "Name").eq_ignore_ascii_case(column)) else { return 0.0; };
    result.get("Data").and_then(Value::as_array).map(|rows| rows.iter().map(|row| {
        row.as_array().and_then(|cells| cells.get(index)).and_then(|cell| cell.as_f64().or_else(|| cell.as_str()?.parse().ok())).unwrap_or(0.0)
    }).sum()).unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signing_is_stable_for_known_input() {
        let time = DateTime::parse_from_rfc3339("2026-07-20T01:02:03Z").unwrap().with_timezone(&Utc);
        let signed = sign("GetAFPUsage", "AKTEST", "SKTEST", "cn-beijing", b"{}", time);
        assert_eq!(signed.query, "Action=GetAFPUsage&Version=2024-01-01");
        assert_eq!(signed.payload_hash, "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a");
        assert!(signed.authorization.starts_with("HMAC-SHA256 Credential=AKTEST/20260720/cn-beijing/ark/request"));
        assert!(signed.authorization.ends_with("Signature=7bca7e62e11094d3ccf8fa257d83b9db6a1fd265fad4d8b2096a7054af780b51"));
    }

    #[test]
    fn inference_table_columns_are_summed_by_name() {
        let result = json!({
            "Fields": [{"Name":"InputTokens"},{"Name":"TotalTokens"}],
            "Data": [[10,15],[20,30]]
        });
        assert_eq!(table_sum(&result, "TotalTokens"), 45.0);
    }
}
