use axum::{
    extract::DefaultBodyLimit,
    http::{header, StatusCode},
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{net::SocketAddr, time::Duration};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

const LAYOUT: &str = include_str!("../../../layout/form-2307.2018-01-ENCS-v3.json");
const INDEX: &str = include_str!("index.html");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Party { tin: String, name: String, registered_address: String, zip_code: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Row { income_payment_description: String, atc: String, first_month_amount: String, second_month_amount: String, third_month_amount: String, tax_withheld_for_quarter: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Input { period: Period, payee: Party, payor: Party, expanded_withholding: Vec<Row>, #[serde(default)] business_tax_withholding: Vec<Row> }

#[derive(Debug, Deserialize)]
struct Period { from: String, to: String }

#[derive(Debug, Serialize)]
struct Issue { path: String, message: String }

fn validate(input: &Input) -> Vec<Issue> {
    let mut issues = Vec::new();
    let mut add = |path: &str, message: &str| issues.push(Issue { path: path.into(), message: message.into() });
    for (path, value) in [("period.from", &input.period.from), ("period.to", &input.period.to)] {
        if value.len() != 10 || value.as_bytes().get(2) != Some(&b'/') || value.as_bytes().get(5) != Some(&b'/') { add(path, "Use MM/DD/YYYY."); }
    }
    for (name, party) in [("payee", &input.payee), ("payor", &input.payor)] {
        if party.tin.chars().filter(char::is_ascii_digit).count() != 14 { add(&format!("{name}.tin"), "TIN must contain 14 digits."); }
        if party.name.trim().is_empty() { add(&format!("{name}.name"), "Name is required."); }
        if party.registered_address.trim().is_empty() { add(&format!("{name}.registeredAddress"), "Registered address is required."); }
        if party.zip_code.len() != 4 || !party.zip_code.chars().all(|c| c.is_ascii_digit()) { add(&format!("{name}.zipCode"), "ZIP code must contain four digits."); }
    }
    for (path, rows) in [("expandedWithholding", &input.expanded_withholding), ("businessTaxWithholding", &input.business_tax_withholding)] {
        if rows.len() > 10 { add(path, "The official page has at most 10 rows."); }
        for (index, row) in rows.iter().enumerate() {
            if row.income_payment_description.trim().is_empty() { add(&format!("{path}.{index}.incomePaymentDescription"), "Description is required."); }
            if row.atc.trim().is_empty() { add(&format!("{path}.{index}.atc"), "ATC is required."); }
            for (field, value) in [("firstMonthAmount", &row.first_month_amount), ("secondMonthAmount", &row.second_month_amount), ("thirdMonthAmount", &row.third_month_amount), ("taxWithheldForQuarter", &row.tax_withheld_for_quarter)] {
                if value.parse::<f64>().is_err() { add(&format!("{path}.{index}.{field}"), "Use a decimal string."); }
            }
        }
    }
    issues
}

async fn health() -> Json<Value> { Json(json!({"status":"ok","service":"form-2307-web","version":env!("CARGO_PKG_VERSION")})) }
async fn layout() -> impl IntoResponse { ([(header::CONTENT_TYPE, "application/json")], LAYOUT) }
async fn validate_route(Json(input): Json<Input>) -> impl IntoResponse {
    let issues = validate(&input); let valid = issues.is_empty();
    (StatusCode::OK, Json(json!({"valid": valid, "issues": issues})))
}
async fn render_not_implemented() -> impl IntoResponse {
    (StatusCode::NOT_IMPLEMENTED, Json(json!({"error":"server_render_not_enabled","message":"Use the TypeScript SDK renderForm2307() with official template bytes. Server-side rendering is a planned production hardening step."})))
}

fn app() -> Router {
    Router::new()
        .route("/", get(|| async { Html(INDEX) }))
        .route("/health", get(health))
        .route("/v1/forms/2307/layout", get(layout))
        .route("/v1/forms/2307/validate", post(validate_route))
        .route("/v1/forms/2307/render", post(render_not_implemented))
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter(tracing_subscriber::EnvFilter::from_default_env()).init();
    let address: SocketAddr = std::env::var("FORM_2307_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".into()).parse().expect("valid FORM_2307_ADDR");
    let listener = tokio::net::TcpListener::bind(address).await.expect("bind server");
    tracing::info!(%address, "Form 2307 prototype listening");
    axum::serve(listener, app()).with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; tokio::time::sleep(Duration::from_millis(25)).await; }).await.expect("serve");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_and_layout_are_served() {
        let response = app().oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let response = app().oneshot(Request::builder().uri("/v1/forms/2307/layout").body(Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        assert!(String::from_utf8_lossy(&bytes).contains("eca9476c5f6346939b973e693d35d635f6dd82519b87092c717c21965b0b90f9"));
    }
}
