#[cfg(windows)]
mod keyhook;

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
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
