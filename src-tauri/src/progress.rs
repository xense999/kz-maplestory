//! 從官方的每日快照算「練了多少」。
//!
//! 官方 API 的 `date` 參數查得到過去的狀態，所以歷史由官方提供，程式不必自己記帳——
//! 記帳版本只在程式開著時才有資料，換角色又會把兩隻的數字混在一起算。
//!
//! 這裡只有算術，沒有網路與檔案，所以升級、缺資料這些邊界可以直接測。

use serde::Serialize;

use crate::maple::DaySample;

#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Growth {
    /// 今天練了多少（等值百分比：一級算 100）
    pub today: f64,
    /// 這批日期涵蓋的範圍內總共練了多少
    pub span: f64,
    /// 今天的基準是哪一天（沒有可比的前一天就是 None）
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
        today: before_today.map_or(0.0, |d| now - equivalent(d.level, d.exp_percent)),
        span: oldest.map_or(0.0, |d| now - equivalent(d.level, d.exp_percent)),
        today_base: before_today.map(|d| d.date.clone()),
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
        assert_eq!(growth(&days, "2026-09-14", 290, 45.0).today, 25.0);
    }

    #[test]
    fn todays_own_snapshot_is_not_the_baseline() {
        // 今天那筆是今天某個時間點的狀態；拿它當基準會少算今天已經練的部分
        let days = [d("2026-09-14", 290, 40.0)];
        assert_eq!(growth(&days, "2026-09-14", 290, 60.0).today, 0.0);
    }

    #[test]
    fn a_gap_falls_back_to_the_most_recent_earlier_day() {
        // 前天有資料、昨天沒有
        let days = [d("2026-09-12", 290, 10.0)];
        let g = growth(&days, "2026-09-14", 290, 35.0);
        assert_eq!(g.today, 25.0);
        assert_eq!(g.today_base.as_deref(), Some("2026-09-12"));
    }

    #[test]
    fn levelling_up_does_not_read_as_a_loss() {
        let days = [d("2026-09-13", 290, 98.0)];
        assert_eq!(growth(&days, "2026-09-14", 291, 3.0).today, 5.0);
    }

    #[test]
    fn span_covers_the_whole_batch() {
        let days = [
            d("2026-09-08", 288, 0.0),
            d("2026-09-13", 290, 50.0),
        ];
        let g = growth(&days, "2026-09-14", 290, 70.0);
        assert_eq!(g.span, 270.0);
        assert_eq!(g.today, 20.0);
    }

    #[test]
    fn days_need_not_arrive_in_order() {
        let days = [d("2026-09-13", 290, 20.0), d("2026-09-11", 289, 0.0)];
        let g = growth(&days, "2026-09-14", 290, 25.0);
        assert_eq!(g.today, 5.0);
        assert_eq!(g.span, 125.0);
    }
}
