//! 從官方的每日快照算「練了多少」。
//!
//! 官方 API 的 `date` 參數查得到過去的狀態，所以歷史由官方提供，程式不必自己記帳——
//! 記帳版本只在程式開著時才有資料，換角色又會把兩隻的數字混在一起算。
//!
//! 這裡只有算術，沒有網路與檔案，所以升級、缺資料這些邊界可以直接測。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::maple::DaySample;

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Growth {
    /// 今天練了多少（等值百分比：一級算 100）。
    /// ★沒有可比的基準時是 None 而不是 0——官方偶爾會回限流錯誤，
    /// 那時候要讓畫面顯示「沒有資料」，不能靜默變成「今天練了 0」。
    pub today: Option<f64>,
    /// 這批日期涵蓋的範圍內總共練了多少
    pub span: Option<f64>,
    /// 今天的基準是哪一天
    pub today_base: Option<String>,
}

/// 幾級又幾 % 壓成一個可以相減的數字。一級當 100 算——不是真實經驗值
/// （每級所需經驗不同，API 也沒給那張表），但要比的是「誰練得快」，這樣就夠，
/// 而且升級時不會變成負數。
fn equivalent(level: i64, exp_percent: f64) -> f64 {
    level as f64 * 100.0 + exp_percent
}

/// `days` 是官方回的每日快照（日期字串可排序，YYYY-MM-DD），`latest_*` 是現在的值。
///
/// 「今天練了」＝現在減掉最近一筆**早於今天**的快照。用昨天當基準而不是「今天那筆」，
/// 是因為今天那筆本身就是今天某個時間點的狀態，拿它當基準會把今天已經練的那段吃掉。
pub fn growth(days: &[DaySample], today: &str, latest_level: i64, latest_exp: f64) -> Growth {
    let now = equivalent(latest_level, latest_exp);

    let mut sorted: Vec<&DaySample> = days.iter().collect();
    sorted.sort_by(|a, b| a.date.cmp(&b.date));

    let before_today = sorted.iter().rev().find(|d| d.date.as_str() < today);
    let oldest = sorted.first();

    Growth {
        today: before_today.map(|d| now - equivalent(d.level, d.exp_percent)),
        span: oldest.map(|d| now - equivalent(d.level, d.exp_percent)),
        today_base: before_today.map(|d| d.date.clone()),
    }
}

// ─── 每日快照的本機快取 ───────────────────────────────────────────────────────
//
// 過去某一天的數字不會再變，所以查過就不必再問。這不是「自己記帳」——記的是官方
// 給過的答案。理由是官方對請求數有限制：一被擋掉，基準就消失，畫面上的成長量會在
// 真實數字與「沒有資料」之間跳。

/// 角色名 → 日期 → 那天的狀態
type Cache = HashMap<String, HashMap<String, CachedDay>>;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CachedDay {
    pub level: i64,
    pub exp_percent: f64,
}

fn cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("找不到資料夾：{e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("建立資料夾失敗：{e}"))?;
    Ok(dir.join("daily.json"))
}

/// 讀不出來就當成空的：快取壞掉最多是多打幾次 API，不該讓功能停擺
fn load_cache(app: &tauri::AppHandle) -> Cache {
    cache_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// 這隻角色已經知道的日期
pub fn cached_days(app: &tauri::AppHandle, name: &str) -> HashMap<String, CachedDay> {
    load_cache(app).remove(name).unwrap_or_default()
}

/// 讀改寫整段的鎖。
///
/// ★重新整理會同時對每隻角色發請求，兩邊幾乎同時寫這個檔：沒有鎖的話後寫的那份
/// 是以「它讀檔當下的內容」為基礎，會把另一隻剛存進去的日期整段蓋掉——結果就是
/// 快取要避免的那件事（基準日再次被重新查詢，然後撞上限流）。
static CACHE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

/// 記下剛查到的日期。只留最近 `keep` 個日期字串（日期是可排序的，直接比字串）。
pub fn remember_days(app: &tauri::AppHandle, name: &str, days: &[DaySample], keep: usize) {
    let lock = CACHE_LOCK.get_or_init(|| Mutex::new(()));
    let _guard = lock.lock();

    let mut cache = load_cache(app);
    let entry = cache.entry(name.to_string()).or_default();
    for d in days {
        entry.insert(
            d.date.clone(),
            CachedDay {
                level: d.level,
                exp_percent: d.exp_percent,
            },
        );
    }
    if entry.len() > keep {
        let mut dates: Vec<String> = entry.keys().cloned().collect();
        dates.sort();
        for old in dates.iter().take(entry.len() - keep) {
            entry.remove(old);
        }
    }
    if let Ok(path) = cache_path(app) {
        if let Ok(text) = serde_json::to_string(&cache) {
            let _ = std::fs::write(path, text);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(date: &str, level: i64, exp_percent: f64) -> DaySample {
        DaySample {
            date: date.to_string(),
            level,
            exp_percent,
        }
    }

    #[test]
    fn no_history_means_no_number_yet() {
        assert_eq!(growth(&[], "2026-09-14", 290, 50.0), Growth::default());
    }

    #[test]
    fn today_is_measured_against_yesterday() {
        let days = [d("2026-09-13", 290, 20.0), d("2026-09-14", 290, 30.0)];
        assert_eq!(growth(&days, "2026-09-14", 290, 45.0).today, Some(25.0));
    }

    #[test]
    fn a_missing_baseline_is_not_a_zero() {
        // 官方回限流錯誤那天會落到這裡：要說「不知道」，不能說「練了 0」
        assert_eq!(growth(&[], "2026-09-14", 290, 50.0).today, None);
    }

    #[test]
    fn todays_own_snapshot_is_not_the_baseline() {
        // 今天那筆是今天某個時間點的狀態；拿它當基準會少算今天已經練的部分
        let days = [d("2026-09-14", 290, 40.0)];
        assert_eq!(growth(&days, "2026-09-14", 290, 60.0).today, None);
    }

    #[test]
    fn a_gap_falls_back_to_the_most_recent_earlier_day() {
        // 前天有資料、昨天沒有
        let days = [d("2026-09-12", 290, 10.0)];
        let g = growth(&days, "2026-09-14", 290, 35.0);
        assert_eq!(g.today, Some(25.0));
        assert_eq!(g.today_base.as_deref(), Some("2026-09-12"));
    }

    #[test]
    fn levelling_up_does_not_read_as_a_loss() {
        let days = [d("2026-09-13", 290, 98.0)];
        assert_eq!(growth(&days, "2026-09-14", 291, 3.0).today, Some(5.0));
    }

    #[test]
    fn span_covers_the_whole_batch() {
        let days = [
            d("2026-09-08", 288, 0.0),
            d("2026-09-13", 290, 50.0),
        ];
        let g = growth(&days, "2026-09-14", 290, 70.0);
        assert_eq!(g.span, Some(270.0));
        assert_eq!(g.today, Some(20.0));
    }

    #[test]
    fn days_need_not_arrive_in_order() {
        let days = [d("2026-09-13", 290, 20.0), d("2026-09-11", 289, 0.0)];
        let g = growth(&days, "2026-09-14", 290, 25.0);
        assert_eq!(g.today, Some(5.0));
        assert_eq!(g.span, Some(125.0));
    }
}
