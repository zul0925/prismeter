use reqwest::blocking::Client;
use serde_json::Value;

const SILICONFLOW_USER_INFO_URL: &str = "https://api.siliconflow.cn/v1/user/info";

/// Retrieves the balance fields exactly as returned by SiliconFlow's official
/// user-info endpoint.  The fields intentionally remain unclassified here:
/// their names are shown verbatim in the UI instead of guessing how a provider
/// allocates promotional and paid credits.
pub fn user_info(http: &Client, api_key: &str) -> Result<Value, String> {
    let response = http
        .get(SILICONFLOW_USER_INFO_URL)
        .bearer_auth(api_key)
        .send()
        .map_err(|error| format!("无法连接硅基流动：{error}"))?;
    let status = response.status();
    if status.as_u16() == 401 {
        return Err("硅基流动 API Key 无效或已失效。".into());
    }
    if status.as_u16() == 429 {
        return Err("硅基流动请求过于频繁，请稍后重试。".into());
    }
    if !status.is_success() {
        return Err(format!("硅基流动返回 HTTP {}。", status.as_u16()));
    }
    let payload: Value = response
        .json()
        .map_err(|error| format!("硅基流动返回了无法识别的数据：{error}"))?;
    if payload.get("status").and_then(Value::as_bool) != Some(true) {
        let message = payload
            .get("message")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("未确认余额查询成功，请检查 API Key 权限。");
        return Err(format!("硅基流动：{message}"));
    }
    let data = payload.get("data").cloned().unwrap_or(Value::Null);
    if !data.is_object() {
        return Err("硅基流动未返回账户余额数据。".into());
    }
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn official_balance_fields_are_preserved_without_reclassification() {
        let payload: Value = serde_json::from_str(r#"{"status":true,"code":20000,"data":{"balance":"0.88","chargeBalance":"88.00","totalBalance":"88.88"}}"#).unwrap();
        let data = payload.get("data").cloned().unwrap();
        assert_eq!(data["balance"], "0.88");
        assert_eq!(data["chargeBalance"], "88.00");
        assert_eq!(data["totalBalance"], "88.88");
    }
}
