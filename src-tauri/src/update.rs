//! 程式內自動更新（GitHub Releases）。
//!
//! 更新走「換掉 exe」而不是「跑安裝程式」：Tauri 的 NSIS 解除安裝腳本會把工作列
//! 釘選一起拔掉，而 Windows 沒有辦法把它釘回去。所以 Release 上除了安裝檔，還會
//! 附一顆裸 exe，更新就是把它換上去。
//!
//! ★這招成立的前提是「exe 自己帶著全部需要的東西」。任何檔案都不可以只放進
//! `bundle.resources`——那種檔案到不了用這條路更新的人手上。

use serde::Serialize;
use std::path::Path;
use tauri::Emitter;

/// 放 Release 的 repo。公開 repo，所以下面兩個請求都不需要憑證。
const GITHUB_REPO: &str = "xense999/kz-maplestory";

/// Release 上那顆裸 exe 的檔名，要跟安裝後的檔名一致，換檔才是單純的覆蓋。
const BARE_EXE_ASSET: &str = "kz-maplestory.exe";

#[derive(Debug, Serialize)]
pub struct AppUpdate {
    /// 目前跑的版本
    pub current: String,
    /// GitHub 上最新的版本（tag 去掉開頭的 v）
    pub latest: String,
    pub has_update: bool,
    /// 安裝檔網址，沒有裸 exe 時的退路
    pub url: String,
    /// 裸 exe 網址，就地更新用；沒附的話是空字串
    pub exe_url: String,
    /// Release 內文，更新前給使用者看
    pub notes: String,
}

/// 純數字逐段比較：1.10.0 要大於 1.9.0，字串比較會給出相反的答案。
fn version_newer(a: &str, b: &str) -> bool {
    let parse = |s: &str| {
        s.split('.')
            .map(|p| p.parse::<u32>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let (va, vb) = (parse(a), parse(b));
    for i in 0..va.len().max(vb.len()) {
        let (x, y) = (
            va.get(i).copied().unwrap_or(0),
            vb.get(i).copied().unwrap_or(0),
        );
        if x != y {
            return x > y;
        }
    }
    false
}

#[tauri::command]
pub async fn check_app_update(app: tauri::AppHandle) -> Result<AppUpdate, String> {
    let current = app.package_info().version.to_string();
    let api = format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest");
    let resp = reqwest::Client::new()
        .get(&api)
        // GitHub 會擋沒有 User-Agent 的請求
        .header(reqwest::header::USER_AGENT, "kz-maplestory-updater")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("連不上 GitHub：{e}"))?
        .text()
        .await
        .map_err(|e| format!("讀取回應失敗：{e}"))?;

    let v: serde_json::Value =
        serde_json::from_str(&resp).map_err(|e| format!("GitHub 回應非 JSON：{e}"))?;

    let latest = v
        .get("tag_name")
        .and_then(|x| x.as_str())
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();

    let assets = v.get("assets").and_then(|a| a.as_array());
    let pick = |want: &dyn Fn(&str) -> bool| -> String {
        assets
            .and_then(|arr| {
                arr.iter().find_map(|x| {
                    let name = x.get("name")?.as_str()?;
                    let u = x.get("browser_download_url")?.as_str()?;
                    want(name).then(|| u.to_string())
                })
            })
            .unwrap_or_default()
    };

    Ok(AppUpdate {
        has_update: !latest.is_empty() && version_newer(&latest, &current),
        current,
        latest,
        url: pick(&|n| n.ends_with("-setup.exe")),
        exe_url: pick(&|n| n == BARE_EXE_ASSET),
        notes: v
            .get("body")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
    })
}

/// 串流下載，邊寫邊回報 (已下載, 總量)。伺服器沒給 Content-Length 時總量是 0。
async fn download_to(
    url: &str,
    dest: &Path,
    mut on_progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("更新連結無效".into());
    }
    let mut resp = reqwest::Client::new()
        .get(url)
        .header(reqwest::header::USER_AGENT, "kz-maplestory-updater")
        .send()
        .await
        .map_err(|e| format!("下載失敗：{e}"))?
        .error_for_status()
        .map_err(|e| format!("下載失敗：{e}"))?;

    let total = resp.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(dest).map_err(|e| format!("建立更新檔失敗：{e}"))?;
    let mut done = 0u64;
    on_progress(0, total);
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("下載中斷：{e}"))? {
        std::io::Write::write_all(&mut file, &chunk).map_err(|e| format!("寫入更新檔失敗：{e}"))?;
        done += chunk.len() as u64;
        on_progress(done, total);
    }
    // 提早結束但收得乾淨的回應也會走到這裡——而呼叫端接下來要拿它覆蓋正在執行的程式
    if total > 0 && done != total {
        return Err(format!("更新檔下載不完整（{done}/{total} bytes）"));
    }
    Ok(())
}

/// 把正在跑的 exe 換成剛下載的那顆，然後重啟。
///
/// 下載落點刻意放在 exe 旁邊而不是 %TEMP%：最後那一步才會是同磁區的 rename
/// （原子操作），不會出現「換到一半的執行檔」。
#[cfg(windows)]
#[tauri::command]
pub async fn update_app_inplace(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let cur = std::env::current_exe().map_err(|e| format!("找不到程式路徑：{e}"))?;
    let staged = cur.with_extension("new.exe");
    let retired = cur.with_extension("old.exe");

    // 上一次更新留下的舊檔可能還在（開機清理沒清掉），不先移除下面的 rename 會失敗
    let _ = std::fs::remove_file(&retired);

    // 只在整數百分比變動時送事件：十幾 MB 的檔案會切成好幾千個 chunk，
    // 每個事件都是一次序列化過的 IPC 往返。
    let mut last_pct = u64::MAX;
    let r = download_to(&url, &staged, |done, total| {
        let pct = if total > 0 { done * 100 / total } else { 0 };
        if pct != last_pct {
            last_pct = pct;
            let _ = app.emit("update-progress", (done, total));
        }
    })
    .await;
    if let Err(e) = r {
        let _ = std::fs::remove_file(&staged);
        return Err(e);
    }

    std::fs::rename(&cur, &retired).map_err(|e| {
        let _ = std::fs::remove_file(&staged);
        format!("無法置換程式檔：{e}")
    })?;
    if let Err(e) = std::fs::rename(&staged, &cur) {
        // 把原本的執行檔放回去，否則整個安裝目錄會變成沒有主程式
        let _ = std::fs::rename(&retired, &cur);
        let _ = std::fs::remove_file(&staged);
        return Err(format!("無法寫入新版程式：{e}"));
    }

    std::process::Command::new(&cur)
        .spawn()
        .map_err(|e| format!("無法啟動新版本：{e}"))?;
    app.exit(0);
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn update_app_inplace(_app: tauri::AppHandle, _url: String) -> Result<(), String> {
    Err("就地更新僅支援 Windows".into())
}

/// 清掉上一次就地更新留下的舊執行檔。開機時呼叫——那時佔用它的程序已經結束了。
/// 失敗不必回報：留著也無害，下次啟動會再試一次。
#[cfg(windows)]
pub fn sweep_old_exe() {
    if let Ok(cur) = std::env::current_exe() {
        let _ = std::fs::remove_file(cur.with_extension("old.exe"));
    }
}
