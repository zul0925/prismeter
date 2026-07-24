use reqwest::blocking::Client;
use serde::Deserialize;

const OPENROUTER_KEY_URL: &str = "https://openrouter.ai/api/v1/key";

// OpenRouter reports credit amounts in cents of a US dollar: 100 credits = $1.
// The conversion is centralized here so the assumption is easy to verify against
// a live key and, if necessary, correct in a single place.
fn credits_to_usd(credits: f64) -> String {
    format!("{:.2}", credits / 100.0)
}

#[derive(Deserialize)]
struct KeyResponse {
    #[serde(default)]
    data: KeyData,
}

#[derive(Default, Deserialize)]
pub struct KeyData {
    #[serde(default)]
    pub limit: Option<f64>,
    #[serde(default)]
    pub limit_remaining: Option<f64>,
    #[serde(default)]
    pub usage: f64,
    #[serde(default)]
    pub usage_daily: f64,
    #[serde(default)]
    pub usage_weekly: f64,
    #[serde(default)]
    pub usage_monthly: f64,
}

/// Reads the official API-key status exposed by OpenRouter. `limit_remaining`
/// is the live remaining balance that alerts and trends watch; `usage` is the
/// all-time spend. Unlimited keys report `null` for the limit fields.
pub fn key_info(http: &Client, api_key: &str) -> Result<KeyData, String> {
    let response = http
        .get(OPENROUTER_KEY_URL)
        .bearer_auth(api_key)
        .send()
        .map_err(|error| format!("Unable to connect to OpenRouter: {error}"))?;
    let status = response.status();
    if status.as_u16() == 401 {
        return Err("OpenRouter API key is invalid or revoked.".into());
    }
    if status.as_u16() == 429 {
        return Err("OpenRouter request rate is limited. Please try again shortly.".into());
    }
    if !status.is_success() {
        return Err(format!("OpenRouter returned HTTP {}.", status.as_u16()));
    }
    let payload: KeyResponse = response
        .json()
        .map_err(|error| format!("OpenRouter returned an unrecognized key response: {error}"))?;
    Ok(payload.data)
}

/// Maps the verified key data to the three balance fields used across the app.
/// `total` is the remaining credits (the value low-balance alerts and depletion
/// trends watch). Unlimited keys have no remaining balance and report "-", which
/// the alert and snapshot parsers treat as a non-numeric gap rather than zero.
pub fn balance_fields(data: &KeyData) -> (String, String, String) {
    let total = data.limit_remaining.map(credits_to_usd).unwrap_or_else(|| "-".into());
    let granted = data.limit.map(credits_to_usd).unwrap_or_else(|| "-".into());
    let topped_up = credits_to_usd(data.usage);
    (total, granted, topped_up)
}

/// Returns (daily, weekly, monthly) usage in USD. These are the cumulative
/// spend windows for the current UTC day/week/month, straight from /key.
pub fn periodic_usage_usd(data: &KeyData) -> (String, String, String) {
    (
        credits_to_usd(data.usage_daily),
        credits_to_usd(data.usage_weekly),
        credits_to_usd(data.usage_monthly),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credits_convert_to_usd_at_one_hundred_to_one() {
        assert_eq!(credits_to_usd(100.0), "1.00");
        assert_eq!(credits_to_usd(0.0), "0.00");
        assert_eq!(credits_to_usd(3250.0), "32.50");
    }

    #[test]
    fn unlimited_keys_report_no_remaining_balance() {
        let data = KeyData { limit: None, limit_remaining: None, usage: 1234.0, ..Default::default() };
        let (total, granted, topped_up) = balance_fields(&data);
        assert_eq!(total, "-"); // unlimited -> nothing to alert on
        assert_eq!(granted, "-"); // unlimited -> no cap
        assert_eq!(topped_up, "12.34"); // all-time usage is still reported
    }

    #[test]
    fn limited_keys_report_remaining_and_cap_in_usd() {
        let data = KeyData { limit: Some(5000.0), limit_remaining: Some(3250.0), usage: 1750.0, ..Default::default() };
        let (total, granted, topped_up) = balance_fields(&data);
        assert_eq!(total, "32.50"); // $32.50 remaining
        assert_eq!(granted, "50.00"); // $50.00 cap
        assert_eq!(topped_up, "17.50"); // $17.50 used
    }

    #[test]
    fn key_response_parses_official_shape_and_ignores_extra_fields() {
        // Mirrors the documented /key response: a `data` object whose extra
        // fields (label, periodic usage, is_free_tier) must not break parsing.
        let payload = r#"{"data":{"label":"work","limit":5000.0,"limit_remaining":3250.0,"usage":1750.0,"usage_daily":50.0,"usage_weekly":300.0,"usage_monthly":1000.0,"is_free_tier":false}}"#;
        let response: KeyResponse = serde_json::from_str(payload).unwrap();
        let data = response.data;
        assert_eq!(data.limit, Some(5000.0));
        assert_eq!(data.limit_remaining, Some(3250.0));
        assert_eq!(data.usage, 1750.0);
        assert_eq!(data.usage_daily, 50.0);
        assert_eq!(data.usage_weekly, 300.0);
        assert_eq!(data.usage_monthly, 1000.0);
        let (total, granted, topped_up) = balance_fields(&data);
        assert_eq!(total, "32.50");
        assert_eq!(granted, "50.00");
        assert_eq!(topped_up, "17.50");
    }

    #[test]
    fn periodic_usage_converts_each_window_to_usd() {
        let data = KeyData { usage_daily: 50.0, usage_weekly: 300.0, usage_monthly: 1000.0, ..Default::default() };
        let (daily, weekly, monthly) = periodic_usage_usd(&data);
        assert_eq!(daily, "0.50");
        assert_eq!(weekly, "3.00");
        assert_eq!(monthly, "10.00");
    }
}
