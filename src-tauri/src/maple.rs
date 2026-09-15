//! NEXON Open API（台版新楓之谷）的角色查詢。
//!
//! 為什麼走後端而不是在網頁層 fetch：這支 API 不會給跨來源的回應標頭，
//! webview 直接打會被擋掉；順便也讓金鑰完全不經過網頁層。
//!
//! 兩段式：角色名先換成 `ocid`（帳號內的角色識別碼），再拿 ocid 查資料。

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::http::header;

const BASE: &str = "https://open.api.nexon.com/maplestorytw/v1";
const KEY_HEADER: &str = "x-nxopen-api-key";

/// 內建的 API 金鑰：build 時由環境變數 `MAPLE_API_KEY` 編進執行檔（CI 從 repo secret 帶進來），
/// 使用者不必自己申請，設定頁也沒有這個欄位了。
///
/// ★這不是「藏起來」：金鑰是二進位檔裡的明文字串，`strings` 就撈得出來。要的是省掉使用者
/// 申請的步驟，不是保密。也因此所有使用者共用官方的同一份請求額度。
///
/// 沒帶環境變數就 build（例如本機跑 dev）會編得起來但查不到資料，錯誤訊息會說清楚是這個原因——
/// 編不過比較安全，但那樣任何人 clone 下來都動不了。
fn api_key() -> Result<&'static str, String> {
    match option_env!("MAPLE_API_KEY") {
        Some(k) if !k.trim().is_empty() => Ok(k.trim()),
        _ => Err("這份程式沒有內建 API 金鑰（build 時少了 MAPLE_API_KEY）".into()),
    }
}

#[derive(Debug, Serialize)]
pub struct CharacterInfo {
    pub name: String,
    pub job: Option<String>,
    pub world: Option<String>,
    pub level: i64,
    /// 這一級已經賺到的比例，0~100
    pub exp_percent: f64,
    pub exp: Option<i64>,
    pub image_url: Option<String>,
    /// 官方標示的資料基準日（不是我們抓下來的時間）
    pub as_of: Option<String>,
    pub fetched_at: i64,
}

#[derive(Deserialize)]
struct OcidResp {
    ocid: String,
}

/// 官方回的欄位名沿用 NEXON 的命名。全部給預設值：少一個欄位不該讓整張卡失敗。
#[derive(Deserialize, Default)]
#[serde(default)]
struct BasicResp {
    date: Option<String>,
    character_name: String,
    world_name: Option<String>,
    character_class: Option<String>,
    character_level: i64,
    character_exp: Option<i64>,
    /// 官方給的是字串，例如 "63.156"
    character_exp_rate: Option<String>,
    character_image: Option<String>,
}

#[derive(Deserialize)]
struct ApiError {
    error: ApiErrorBody,
}

#[derive(Deserialize)]
struct ApiErrorBody {
    message: String,
}

/// 官方的錯誤是 200 以外的狀態＋一段 JSON；把那段訊息原樣帶給使用者，
/// 比「請求失敗」有用得多（金鑰錯、角色不存在都靠它分辨）。
async fn get(url: &str, api_key: &str) -> Result<String, String> {
    let resp = reqwest::Client::new()
        .get(url)
        .header(KEY_HEADER, api_key)
        .header(header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| format!("連不上官方 API：{e}"))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| format!("讀取回應失敗：{e}"))?;

    if status.is_success() {
        return Ok(body);
    }
    match serde_json::from_str::<ApiError>(&body) {
        Ok(e) => Err(e.error.message),
        Err(_) => Err(format!("官方 API 回應 {status}")),
    }
}

/// 某一天的角色狀態。官方的 `date` 參數查得到過去的快照，所以「這幾天練了多少」
/// 可以直接跟官方要，不必靠程式當時有沒有開著。
#[derive(Debug, Clone, Serialize)]
pub struct DaySample {
    pub date: String,
    pub level: i64,
    pub exp_percent: f64,
}

/// 角色名 → ocid 的快取。
///
/// ocid 不會變，而官方對請求數有限制（連打會回 "Please try again later"）。
/// 每隻角色只查一次，之後每次更新就少一個請求。
static OCID_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

async fn resolve_ocid(name: &str, api_key: &str) -> Result<String, String> {
    let cache = OCID_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(hit) = cache.lock().ok().and_then(|c| c.get(name).cloned()) {
        return Ok(hit);
    }

    let url = format!("{BASE}/id?character_name={}", urlencoding(name));
    let resp: OcidResp =
        serde_json::from_str(&get(&url, api_key).await?).map_err(|e| format!("查角色失敗：{e}"))?;

    if let Ok(mut c) = cache.lock() {
        c.insert(name.to_string(), resp.ocid.clone());
    }
    Ok(resp.ocid)
}

/// 查這幾天的狀態。日期字串由前端算好（本機時區的事），格式 YYYY-MM-DD。
///
/// 查不到的日期直接略過而不是整批失敗：角色那天可能還沒建立，或官方就是沒有那天的資料。
/// 一批日期查回來的東西，外加算好的成長量。
#[derive(Debug, Serialize)]
pub struct History {
    pub days: Vec<DaySample>,
    pub growth: crate::progress::Growth,
}

#[tauri::command]
pub async fn fetch_history(
    app: tauri::AppHandle,
    name: String,
    dates: Vec<String>,
    today: String,
    latest_level: i64,
    latest_exp: f64,
) -> Result<History, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("角色名稱是空的".into());
    }
    let api_key = api_key()?;

    // 已經知道的日期不再問。過去某天的數字不會變，而官方對請求數有限制——
    // 被擋掉的那次會讓基準消失，畫面上的成長量就會忽有忽無。
    let known = crate::progress::cached_days(&app, name);
    let mut out: Vec<DaySample> = Vec::new();
    let mut fresh: Vec<DaySample> = Vec::new();

    let mut ocid: Option<String> = None;
    for date in dates {
        // 今天的數字還會變，所以今天那筆不吃快取
        if date != today {
            if let Some(hit) = known.get(&date) {
                out.push(DaySample {
                    date,
                    level: hit.level,
                    exp_percent: hit.exp_percent,
                });
                continue;
            }
        }

        let id = match &ocid {
            Some(v) => v.clone(),
            None => {
                let v = resolve_ocid(name, api_key).await?;
                ocid = Some(v.clone());
                v
            }
        };

        let url = format!(
            "{BASE}/character/basic?ocid={}&date={}",
            urlencoding(&id),
            urlencoding(&date)
        );
        let Ok(body) = get(&url, api_key).await else {
            continue;
        };
        let Ok(basic) = serde_json::from_str::<BasicResp>(&body) else {
            continue;
        };
        let sample = DaySample {
            date,
            level: basic.character_level,
            exp_percent: basic
                .character_exp_rate
                .as_deref()
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0),
        };
        // ★等級 0 代表回應缺了欄位（容錯的 default 值），不是真實資料。
        // 讓它進快取的話，過去的日期永遠不會再查一次，這隻角色的基準就永久壞掉。
        if sample.level <= 0 {
            continue;
        }
        // 今天的還會變，不進快取
        if sample.date != today {
            fresh.push(sample.clone());
        }
        out.push(sample);
    }

    if !fresh.is_empty() {
        crate::progress::remember_days(&app, name, &fresh, 14);
    }

    let growth = crate::progress::growth(&out, &today, latest_level, latest_exp);
    Ok(History { days: out, growth })
}

#[tauri::command]
pub async fn fetch_character(name: String) -> Result<CharacterInfo, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("角色名稱是空的".into());
    }
    let api_key = api_key()?;

    let ocid = resolve_ocid(name, api_key).await?;

    let basic_url = format!("{BASE}/character/basic?ocid={}", urlencoding(&ocid));
    let basic: BasicResp = serde_json::from_str(&get(&basic_url, api_key).await?)
        .map_err(|e| format!("讀角色資料失敗：{e}"))?;

    Ok(CharacterInfo {
        name: if basic.character_name.is_empty() {
            name.to_string()
        } else {
            basic.character_name
        },
        job: basic.character_class,
        world: basic.world_name,
        level: basic.character_level,
        exp_percent: basic
            .character_exp_rate
            .as_deref()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0),
        exp: basic.character_exp,
        image_url: basic.character_image,
        as_of: basic.date,
        fetched_at: chrono_now_ms(),
    })
}

/// query string 用的最小百分比編碼：角色名多半是中文，一定要編。
fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
