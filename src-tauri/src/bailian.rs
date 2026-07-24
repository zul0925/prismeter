use reqwest::blocking::Client;
use serde::Deserialize;
use serde_json::{json, Value};

const MODELS_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1/models";

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

/// Verifies a DashScope key by reading the model list exposed by the official
/// OpenAI-compatible endpoint. Billing and Token Plan consumption are only
/// available in the Model Studio console, so they are deliberately not inferred.
pub fn discover(client: &Client, api_key: &str) -> Result<Vec<Value>, String> {
    let response = client
        .get(MODELS_URL)
        .bearer_auth(api_key)
        .send()
        .map_err(|error| format!("Unable to connect to Alibaba Cloud Model Studio: {error}"))?;
    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err("Alibaba Cloud Model Studio API key is invalid, expired, or lacks access to the Beijing region.".into());
    }
    if status.as_u16() == 429 {
        return Err("Alibaba Cloud Model Studio request rate is limited. Please try again shortly.".into());
    }
    if !status.is_success() {
        return Err(format!("Alibaba Cloud Model Studio returned HTTP {}.", status.as_u16()));
    }
    let list: ModelList = response
        .json()
        .map_err(|error| format!("Alibaba Cloud Model Studio returned an unrecognized model list: {error}"))?;
    if list.data.is_empty() {
        return Err("Alibaba Cloud Model Studio returned no available models. Check API key permissions and workspace access.".into());
    }
    Ok(vec![build_product(&list.data)])
}

fn build_product(models: &[Model]) -> Value {
    json!({
        "id": "bailian-models",
        "name": "Alibaba Cloud Model Studio models",
        "kind": "API key capability",
        "usage": format!("{} models", models.len()),
        "usageLabel": "Remote available models",
        "status": "Running",
        "summaries": [
            { "label": "API key", "value": "Verified", "note": "Official DashScope endpoint" },
            { "label": "Remote models", "value": format!("{} models", models.len()), "note": "Official /models" },
            { "label": "Usage statistics", "value": "Console only", "note": "No public reporting API" },
            { "label": "Base URL", "value": "dashscope.aliyuncs.com", "note": "Alibaba Cloud Model Studio" }
        ],
        "columns": ["Owner", "Call status", "Usage data", "Protocol"],
        "rows": models.iter().map(|model| json!({
            "name": model.id,
            "type": model_type(&model.id),
            "badge": "QW",
            "metrics": [
                { "value": if model.owned_by.is_empty() { "alibaba" } else { &model.owned_by }, "unit": "Owner" },
                { "value": "Available", "unit": "Key verified" },
                { "value": "—", "unit": "Reporting API unavailable" },
                { "value": "OpenAI", "unit": "Compatible protocol" }
            ]
        })).collect::<Vec<_>>()
    })
}

fn model_type(id: &str) -> &'static str {
    if id.contains("qwen") { "Qwen model" } else { "Model Studio model" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discovered_models_are_shown_without_usage_estimates() {
        let product = build_product(&[Model { id: "qwen-plus".into(), owned_by: "system".into() }]);
        assert_eq!(product["usage"], "1 models");
        assert_eq!(product["rows"][0]["metrics"][2]["value"], "—");
    }
}
