#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // 全域快捷鍵：使用者按鍵時遊戲在前景，網頁的 keydown 收不到，只能走系統層註冊
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
