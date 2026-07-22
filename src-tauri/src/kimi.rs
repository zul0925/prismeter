use reqwest::blocking::Client;
use serde::Deserialize;

const KIMI_BALANCE_URL: &str = "https://api.moonshot.cn/v1/users/me/balance";

#[derive(Deserialize)]
pub struct KimiResponse {
    #[serde(default)] pub status: bool,
    #[serde(default)] pub data: KimiBalance,
}

#[derive(Default, Deserialize)]
pub struct KimiBalance {
    #[serde(default)] pub available_balance: f64,
    #[serde(default)] pub voucher_balance: f64,
    #[serde(default)] pub cash_balance: f64,
}

pub fn balance(http: &Client, api_key: &str) -> Result<KimiResponse, String> {
    let response = http.get(KIMI_BALANCE_URL).bearer_auth(api_key).send()
        .map_err(|error| format!("无法连接 Kimi：{error}"))?;
    let status = response.status();
    if status.as_u16() == 401 { return Err("Kimi API Key 无效或已失效。".into()); }
    if status.as_u16() == 429 { return Err("Kimi 请求过于频繁，请稍后重试。".into()); }
    if !status.is_success() { return Err(format!("Kimi 返回 HTTP {}。", status.as_u16())); }
    let payload: KimiResponse = response.json().map_err(|error| format!("Kimi 返回了无法识别的数据：{error}"))?;
    if !payload.status { return Err("Kimi 未确认余额查询成功，请检查 API Key 权限。".into()); }
    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn balance_response_keeps_all_official_balance_parts() {
        let value: KimiResponse = serde_json::from_str(r#"{"status":true,"data":{"available_balance":49.58894,"voucher_balance":46.58893,"cash_balance":3.00001}}"#).unwrap();
        assert!(value.status);
        assert_eq!(value.data.available_balance, 49.58894);
        assert_eq!(value.data.voucher_balance, 46.58893);
        assert_eq!(value.data.cash_balance, 3.00001);
    }
}
