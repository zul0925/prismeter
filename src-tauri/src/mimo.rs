use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use url::Url;

type Result<T> = std::result::Result<T, String>;

#[derive(Debug)]
pub struct MimoDiscovery {
    pub base_url: String,
    pub plan_type: String,
    pub products: Vec<Value>,
    pub warnings: Vec<String>,
}

#[derive(Deserialize)]
struct ModelList {
    #[serde(default)]
    data: Vec<Model>,
}

#[derive(Deserialize)]
struct Model {
    id: String,
    #[serde(default)]
    owned_by: String,
}

pub fn discover(client: &Client, api_key: &str, requested_base_url: &str) -> Result<MimoDiscovery> {
    let base_url = normalize_base_url(requested_base_url, api_key)?;
    let response = client
        .get(format!("{base_url}/models"))
        .header("api-key", api_key)
        .send()
        .map_err(|error| format!("无法连接 Xiaomi MiMo：{error}"))?;
    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err("Xiaomi MiMo API Key 无效、已过期，或与所选 Base URL 不匹配。".into());
    }
    if status.as_u16() == 404 {
        return Err("Xiaomi MiMo Base URL 不支持模型列表接口，请核对控制台提供的地址。".into());
    }
    if status.as_u16() == 429 {
        return Err("Xiaomi MiMo 请求过于频繁，请稍后重试。".into());
    }
    if !status.is_success() {
        return Err(format!("Xiaomi MiMo 返回 HTTP {}。", status.as_u16()));
    }
    let list: ModelList = response
        .json()
        .map_err(|error| format!("Xiaomi MiMo 返回了无法识别的模型列表：{error}"))?;
    if list.data.is_empty() {
        return Err("Xiaomi MiMo 未返回任何可用模型，请核对 API Key 权限。".into());
    }
    let plan_type = if api_key.trim_start().starts_with("tp-") {
        "token_plan"
    } else {
        "pay_as_you_go"
    }
    .to_string();
    Ok(MimoDiscovery {
        base_url: base_url.clone(),
        plan_type: plan_type.clone(),
        products: vec![build_product(&list.data, &plan_type, &base_url)],
        warnings: vec!["小米官方目前仅在控制台提供余额、Credits 与历史用量查看，未开放第三方统计 API；Prismeter 只展示官方模型列表，不进行本地估算。".into()],
    })
}

fn normalize_base_url(requested: &str, api_key: &str) -> Result<String> {
    let default = if api_key.trim_start().starts_with("tp-") {
        "https://token-plan-cn.xiaomimimo.com/v1"
    } else {
        "https://api.xiaomimimo.com/v1"
    };
    let candidate = if requested.trim().is_empty() {
        default
    } else {
        requested.trim()
    };
    let url = Url::parse(candidate).map_err(|_| "Xiaomi MiMo Base URL 格式无效。".to_string())?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let token_plan_host = host.starts_with("token-plan-") && host.ends_with(".xiaomimimo.com");
    let official_host = host == "api.xiaomimimo.com" || token_plan_host;
    if url.scheme() != "https"
        || !official_host
        || url.port().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("仅支持 Xiaomi MiMo 官方 HTTPS Base URL。".into());
    }
    let path = url.path().trim_end_matches('/');
    if !path.is_empty() && path != "/v1" {
        return Err("Xiaomi MiMo Base URL 应以 /v1 结尾。".into());
    }
    let key = api_key.trim_start();
    if key.starts_with("tp-") && !token_plan_host {
        return Err("tp- Key 必须使用小米控制台提供的 Token Plan Base URL。".into());
    }
    if key.starts_with("sk-") && token_plan_host {
        return Err("sk- Key 应使用 Xiaomi MiMo 按量 API Base URL。".into());
    }
    Ok(format!("https://{host}/v1"))
}

fn build_product(models: &[Model], plan_type: &str, base_url: &str) -> Value {
    let billing = if plan_type == "token_plan" {
        "Token Plan"
    } else {
        "按量 API"
    };
    let mut rows: Vec<Value> = models.iter().map(|model| json!({
        "name": model.id,
        "type": model_type(&model.id),
        "badge": "Mi",
        "metrics": [
            { "value": if model.owned_by.is_empty() { "xiaomi" } else { &model.owned_by }, "unit": "所有者" },
            { "value": "可调用", "unit": "Key 已验证" },
            { "value": "—", "unit": "统计 API 未开放" },
            { "value": "OpenAI", "unit": "兼容协议" }
        ]
    })).collect();
    for row in &mut rows {
        if let Some(object) = row.as_object_mut() {
            object.insert("i18n".into(), json!({
                "typeKey":"mimo.row.model",
                "metricUnitKeys":["mimo.column.owner", "mimo.row.keyVerified", "mimo.row.usageUnavailable", "mimo.column.protocol"]
            }));
        }
    }
    json!({
        "id": "mimo-models",
        "name": "MiMo 官方模型",
        "kind": "API Key 能力",
        "usage": format!("{} 个", models.len()),
        "usageLabel": "远端可用模型",
        "status": "Running",
        "i18n": {
            "summaryKeys": [
                { "labelKey":"mimo.summary.apiKey", "valueKey":"mimo.value.verified" },
                { "labelKey":"mimo.summary.remoteModels", "valueKey":"mimo.value.modelCount", "valueParams": { "count": models.len() }, "noteKey":"mimo.note.modelsEndpoint" },
                { "labelKey":"mimo.summary.usage", "valueKey":"mimo.value.consoleOnly", "noteKey":"mimo.note.noThirdPartyUsageApi" },
                { "labelKey":"mimo.summary.baseUrl", "noteKey":"mimo.note.official" }
            ],
            "columnKeys": ["mimo.column.owner", "mimo.column.callStatus", "mimo.column.usageData", "mimo.column.protocol"]
        },
        "summaries": [
            { "label": "API Key", "value": "已验证", "note": billing },
            { "label": "远端模型", "value": format!("{} 个", models.len()), "note": "官方 /v1/models" },
            { "label": "用量统计", "value": "控制台可见", "note": "官方未开放第三方统计 API" },
            { "label": "Base URL", "value": base_url, "note": "Xiaomi MiMo 官方" }
        ],
        "columns": ["所有者", "调用状态", "用量数据", "协议"],
        "rows": rows
    })
}

fn model_type(id: &str) -> &'static str {
    if id.contains("tts") {
        "语音合成模型"
    } else if id.contains("asr") {
        "语音识别模型"
    } else if id.contains("pro") {
        "旗舰推理模型"
    } else {
        "多模态模型"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_url_defaults_follow_key_type_and_reject_non_official_hosts() {
        assert_eq!(
            normalize_base_url("", "sk-test").unwrap(),
            "https://api.xiaomimimo.com/v1"
        );
        assert_eq!(
            normalize_base_url("", "tp-test").unwrap(),
            "https://token-plan-cn.xiaomimimo.com/v1"
        );
        assert!(normalize_base_url("https://example.com/v1", "sk-test").is_err());
        assert!(normalize_base_url("http://api.xiaomimimo.com/v1", "sk-test").is_err());
        assert!(normalize_base_url("https://api.xiaomimimo.com/v1", "tp-test").is_err());
        assert!(normalize_base_url("https://token-plan-sgp.xiaomimimo.com/v1", "sk-test").is_err());
        assert_eq!(
            normalize_base_url("https://token-plan-sgp.xiaomimimo.com/v1/", "tp-test").unwrap(),
            "https://token-plan-sgp.xiaomimimo.com/v1"
        );
    }

    #[test]
    fn model_product_explicitly_marks_usage_as_unavailable() {
        let product = build_product(
            &[Model {
                id: "mimo-v2.5-pro".into(),
                owned_by: "xiaomi".into(),
            }],
            "token_plan",
            "https://token-plan-cn.xiaomimimo.com/v1",
        );
        assert_eq!(product["usage"], "1 个");
        assert_eq!(product["rows"][0]["metrics"][2]["value"], "—");
        assert!(product["summaries"][2]["note"]
            .as_str()
            .unwrap()
            .contains("未开放"));
    }

    #[test]
    #[ignore = "requires network access to the official Xiaomi MiMo endpoint"]
    fn official_endpoint_rejects_an_invalid_key() {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap();
        let error = discover(&client, "sk-prismeter-invalid-key", "").unwrap_err();
        assert!(
            error.contains("API Key 无效")
                || error.contains("HTTP 401")
                || error.contains("HTTP 403")
        );
    }
}
