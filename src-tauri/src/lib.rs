#[cfg(windows)]
mod keyhook;

#[cfg(windows)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(windows)]
    let builder = builder
        .invoke_handler(tauri::generate_handler![keyhook::watch_key, keyhook::unwatch_key])
        .setup(|app| {
            // 監聽式熱鍵：不搶鍵，玩家按放技能的那顆鍵時我們順便起算
            keyhook::start(app.handle().clone());
            Ok(())
        })
        // 浮動視窗是「隱藏」不是「關閉」，所以關掉主視窗時它還算一個活著的視窗，
        // 程式會留在背景、又沒有任何看得到的視窗可以叫回來。關主視窗＝整個結束。
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    window.app_handle().exit(0);
                }
            }
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
