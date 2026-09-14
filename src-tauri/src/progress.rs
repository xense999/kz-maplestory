//! 角色數值的歷史與成長量。
//!
//! 官方 API 只給「現在幾級、這一級跑了幾 %」，沒有「今天賺了多少」。要回答那個問題
//! 就得自己記帳：每抓到一次就存一筆，跟基準點相減。
//!
//! 檔案讀寫與計算刻意分開：[`summarize`] 是純函式，跨日、升級、第一筆這些邊界
//! 全部在它身上，測試不必碰檔案也不必連網。
//!
//! ★「今天從幾點開始」由前端算好傳進來。日界是本機時區的事，而 std 沒有時區——
//! 與其為了這件事拉一個時間函式庫進來，不如讓知道答案的那一層直接給答案。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::Manager;

/// 只留最近七天。再舊的對「誰練得快」沒有用，檔案也不該無限長大。
const KEEP_MS: i64 = 7 * 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Sample {
    /// epoch 毫秒
    pub at: i64,
    pub level: i64,
    /// 這一級已經跑掉的百分比，0~100
    pub exp_percent: f64,
}

impl Sample {
    /// 把「幾級又幾 %」壓成一個可以相減的數字。
    ///
    /// 一級當 100 來算。這不是真實經驗值——每一級需要的經驗不同，而 API 也沒給那張表——
    /// 但要回答的是「誰練得比較快」，等值百分比就夠了，而且升級時不會變成負數。
    fn equivalent(&self) -> f64 {
        self.level as f64 * 100.0 + self.exp_percent
    }
}

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Progress {
    /// 今天漲了多少（等值百分比）
    pub today: f64,
    /// 這次程式開著以來漲了多少
    pub session: f64,
    /// 今天的基準點是哪一筆（沒有基準就是 None）
    pub today_base_at: Option<i64>,
    pub session_base_at: Option<i64>,
}

/// 從一串樣本算出成長量。
///
/// `day_start` 是本機時區今天 00:00 的 epoch 毫秒，`session_start` 是本次程式啟動的時刻。
/// 樣本不必先排序。
pub fn summarize(samples: &[Sample], day_start: i64, session_start: i64) -> Progress {
    let Some(latest) = samples.iter().max_by_key(|s| s.at) else {
        return Progress::default();
    };

    // 基準＝該區間內最早的一筆。只有一筆樣本時基準就是它自己，所以成長量是 0——
    // 這是對的：我們知道現在的值，但不知道它從哪裡來。
    let base_in = |from: i64| samples.iter().filter(|s| s.at >= from).min_by_key(|s| s.at);

    let today_base = base_in(day_start);
    let session_base = base_in(session_start);

    Progress {
        today: today_base.map_or(0.0, |b| latest.equivalent() - b.equivalent()),
        session: session_base.map_or(0.0, |b| latest.equivalent() - b.equivalent()),
        today_base_at: today_base.map(|b| b.at),
        session_base_at: session_base.map(|b| b.at),
    }
}

/// 丟掉七天前的樣本。寫入時做，讀取端就不必每次過濾。
pub fn prune(samples: &mut Vec<Sample>, now: i64) {
    samples.retain(|s| now - s.at <= KEEP_MS);
}

/// 數值沒變就不記。
///
/// 兩個理由：畫面重載會在同一秒抓兩次；而如果官方給的是每日快照，一天下來會堆出
/// 上百筆一模一樣的數字。基準點取的是「區間內最早的一筆」，所以丟掉後面的重複值
/// 不影響任何計算——最新值本來就跟它們相等。
pub fn push_sample(samples: &mut Vec<Sample>, next: Sample) {
    let unchanged = samples
        .iter()
        .max_by_key(|s| s.at)
        .is_some_and(|last| last.level == next.level && last.exp_percent == next.exp_percent);
    if unchanged {
        return;
    }
    samples.push(next);
}

// ─── 檔案 ─────────────────────────────────────────────────────────────────────

type Store = HashMap<String, Vec<Sample>>;

/// 本次程式啟動的時刻。「本次漲多少」的基準。
static SESSION_START: OnceLock<i64> = OnceLock::new();

fn session_start() -> i64 {
    *SESSION_START.get_or_init(now_ms)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("找不到資料夾：{e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("建立資料夾失敗：{e}"))?;
    Ok(dir.join("progress.json"))
}

/// 讀不出來就當成空的：歷史壞掉不該讓整個功能停擺，最多是今天的成長量從頭算起。
fn load(app: &tauri::AppHandle) -> Store {
    store_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(app: &tauri::AppHandle, store: &Store) -> Result<(), String> {
    let path = store_path(app)?;
    let text = serde_json::to_string(store).map_err(|e| format!("序列化失敗：{e}"))?;
    std::fs::write(path, text).map_err(|e| format!("寫入歷史失敗：{e}"))
}

#[tauri::command]
pub fn record_progress(
    app: tauri::AppHandle,
    slot: String,
    level: i64,
    exp_percent: f64,
    day_start: i64,
) -> Result<Progress, String> {
    let now = now_ms();
    let session = session_start();

    let mut store = load(&app);
    let samples = store.entry(slot).or_default();
    push_sample(
        samples,
        Sample {
            at: now,
            level,
            exp_percent,
        },
    );
    prune(samples, now);

    let progress = summarize(samples, day_start, session);
    save(&app, &store)?;
    Ok(progress)
}

#[tauri::command]
pub fn progress_summary(
    app: tauri::AppHandle,
    slot: String,
    day_start: i64,
) -> Result<Progress, String> {
    let store = load(&app);
    let samples = store.get(&slot).map(Vec::as_slice).unwrap_or(&[]);
    Ok(summarize(samples, day_start, session_start()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 24 * 60 * 60 * 1000;
    /// 今天 00:00
    const T0: i64 = 1_700_000_000_000;

    fn s(at: i64, level: i64, exp_percent: f64) -> Sample {
        Sample {
            at,
            level,
            exp_percent,
        }
    }

    #[test]
    fn no_samples_is_zero_not_missing() {
        let p = summarize(&[], T0, T0);
        assert_eq!(p, Progress::default());
    }

    #[test]
    fn a_single_sample_has_no_growth_yet() {
        let p = summarize(&[s(T0 + 60_000, 200, 40.0)], T0, T0);
        assert_eq!(p.today, 0.0);
        assert_eq!(p.session, 0.0);
    }

    #[test]
    fn growth_is_measured_from_the_first_sample_of_the_day() {
        let samples = [
            s(T0 + 1_000, 200, 10.0),
            s(T0 + 2_000, 200, 25.0),
            s(T0 + 3_000, 200, 31.5),
        ];
        assert_eq!(summarize(&samples, T0, T0).today, 21.5);
    }

    #[test]
    fn yesterday_does_not_count_towards_today() {
        let samples = [
            s(T0 - DAY + 1_000, 200, 5.0), // 昨天
            s(T0 + 1_000, 200, 60.0),      // 今天第一筆
            s(T0 + 2_000, 200, 70.0),
        ];
        assert_eq!(summarize(&samples, T0, T0).today, 10.0);
    }

    #[test]
    fn levelling_up_does_not_read_as_a_loss() {
        // 98% → 升級 → 3%：實際是漲了 5，不是掉了 95
        let samples = [s(T0 + 1_000, 200, 98.0), s(T0 + 2_000, 201, 3.0)];
        assert_eq!(summarize(&samples, T0, T0).today, 5.0);
    }

    #[test]
    fn two_levels_in_one_day_add_up() {
        let samples = [s(T0 + 1_000, 200, 50.0), s(T0 + 2_000, 202, 50.0)];
        assert_eq!(summarize(&samples, T0, T0).today, 200.0);
    }

    #[test]
    fn session_starts_later_than_the_day() {
        let session = T0 + 5_000;
        let samples = [
            s(T0 + 1_000, 200, 10.0), // 今天、但這次啟動之前
            s(session + 1_000, 200, 40.0),
            s(session + 2_000, 200, 45.0),
        ];
        let p = summarize(&samples, T0, session);
        assert_eq!(p.today, 35.0);
        assert_eq!(p.session, 5.0);
    }

    #[test]
    fn samples_need_not_be_in_order() {
        let samples = [s(T0 + 3_000, 200, 30.0), s(T0 + 1_000, 200, 10.0)];
        assert_eq!(summarize(&samples, T0, T0).today, 20.0);
    }

    #[test]
    fn an_unchanged_reading_is_not_recorded_again() {
        let mut samples = vec![s(T0 + 1_000, 200, 40.0)];
        push_sample(&mut samples, s(T0 + 2_000, 200, 40.0));
        assert_eq!(samples.len(), 1);

        push_sample(&mut samples, s(T0 + 3_000, 200, 40.5));
        assert_eq!(samples.len(), 2);
    }

    #[test]
    fn skipping_duplicates_keeps_the_growth_correct() {
        let mut samples = vec![];
        for (at, pct) in [(1_000, 10.0), (2_000, 10.0), (3_000, 10.0), (4_000, 25.0)] {
            push_sample(&mut samples, s(T0 + at, 200, pct));
        }
        assert_eq!(samples.len(), 2);
        assert_eq!(summarize(&samples, T0, T0).today, 15.0);
    }

    #[test]
    fn prune_drops_anything_older_than_a_week() {
        let now = T0 + 7 * DAY;
        let mut samples = vec![
            s(T0 - 1, 200, 1.0),     // 剛好超過七天
            s(T0, 200, 2.0),         // 剛好七天，留著
            s(now, 200, 3.0),
        ];
        prune(&mut samples, now);
        assert_eq!(samples.len(), 2);
        assert_eq!(samples[0].exp_percent, 2.0);
    }

    #[test]
    fn pruning_does_not_change_the_numbers() {
        let now = T0 + 7 * DAY;
        let mut samples = vec![s(T0 - DAY, 199, 0.0), s(now - 1_000, 200, 10.0), s(now, 200, 30.0)];
        let before = summarize(&samples, now - 2_000, now - 2_000);
        prune(&mut samples, now);
        assert_eq!(summarize(&samples, now - 2_000, now - 2_000), before);
    }
}
