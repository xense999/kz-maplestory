//! 低階鍵盤監聽（WH_KEYBOARD_LL）。
//!
//! 和全域快捷鍵（RegisterHotKey）的差別是這裡**只看不攔**：命中登記的鍵時通知前端，
//! 事件照樣 `CallNextHookEx` 放行給遊戲。所以可以直接掛在放技能的那顆鍵上，
//! 玩家按一次＝技能放出去、計時同時起算。
//!
//! 兩個要小心的地方：
//! - hook callback 由系統在安裝它的執行緒上呼叫，超過 LowLevelHooksTimeout（預設 300ms）
//!   沒回應，Windows 會**靜默**把 hook 拆掉。所以 callback 裡只做「比對＋丟進 channel」，
//!   emit 交給另一條執行緒；hook 也自己跑一條有訊息迴圈的執行緒，不跟 webview 搶。
//! - 鍵按著不放會一直送 keydown，所以同一顆鍵有 300ms 的去抖。

use std::collections::HashMap;
use std::sync::mpsc::{channel, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_CONTROL, VK_MENU, VK_SHIFT};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, KBDLLHOOKSTRUCT, MSG,
    WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

/// 一組要監聽的按鍵。修飾鍵是「必須完全相符」，避免 Shift+F1 也觸發 F1 的計時。
#[derive(Clone, Copy, Deserialize)]
pub struct KeySpec {
    pub vk: u32,
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
}

const DEBOUNCE: Duration = Duration::from_millis(300);

static WATCHED: OnceLock<Mutex<HashMap<String, KeySpec>>> = OnceLock::new();
static TX: OnceLock<Sender<String>> = OnceLock::new();
static LAST_FIRE: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();

fn watched() -> &'static Mutex<HashMap<String, KeySpec>> {
    WATCHED.get_or_init(|| Mutex::new(HashMap::new()))
}

fn last_fire() -> &'static Mutex<HashMap<String, Instant>> {
    LAST_FIRE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn modifier_down(vk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY) -> bool {
    // GetAsyncKeyState 的最高位＝目前是否按著
    unsafe { (GetAsyncKeyState(vk.0 as i32) as u16 & 0x8000) != 0 }
}

unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let msg = wparam.0 as u32;
        if msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN {
            let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            let ctrl = modifier_down(VK_CONTROL);
            let shift = modifier_down(VK_SHIFT);
            let alt = modifier_down(VK_MENU);

            // 同一顆鍵可以登記在好幾張卡上（例如放輪迴那顆鍵同時餵「出租」與「輪迴」），
            // 所以要收齊全部命中，不能只取第一個
            let hits: Vec<String> = watched()
                .lock()
                .map(|w| {
                    w.iter()
                        .filter(|(_, s)| {
                            s.vk == kb.vkCode && s.ctrl == ctrl && s.shift == shift && s.alt == alt
                        })
                        .map(|(id, _)| id.clone())
                        .collect()
                })
                .unwrap_or_default();

            for id in hits {
                let now = Instant::now();
                let fresh = last_fire()
                    .lock()
                    .map(|mut m| match m.get(&id) {
                        Some(t) if now.duration_since(*t) < DEBOUNCE => false,
                        _ => {
                            m.insert(id.clone(), now);
                            true
                        }
                    })
                    .unwrap_or(false);
                if fresh {
                    if let Some(tx) = TX.get() {
                        let _ = tx.send(id);
                    }
                }
            }
        }
    }
    // 一律放行：這支 hook 只看不攔，遊戲照收
    CallNextHookEx(None, code, wparam, lparam)
}

/// 啟動 hook 執行緒與轉送執行緒。整個程式生命週期只需要呼叫一次。
pub fn start(app: AppHandle) {
    let (tx, rx) = channel::<String>();
    if TX.set(tx).is_err() {
        return; // 已經啟動過
    }

    // 轉送：hook callback 不能在自己那條執行緒上做 emit（會吃掉 300ms 預算）
    std::thread::spawn(move || {
        while let Ok(id) = rx.recv() {
            let _ = app.emit("hotkey", id);
        }
    });

    std::thread::spawn(|| unsafe {
        let hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("鍵盤 hook 安裝失敗：{e}");
                return;
            }
        };

        // 低階 hook 的 callback 靠這條執行緒的訊息迴圈送達，沒有迴圈就永遠不會被呼叫
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = DispatchMessageW(&msg);
        }

        let _ = windows::Win32::UI::WindowsAndMessaging::UnhookWindowsHookEx(hook);
    });
}

#[tauri::command]
pub fn watch_key(id: String, spec: KeySpec) {
    if let Ok(mut w) = watched().lock() {
        w.insert(id, spec);
    }
}

#[tauri::command]
pub fn unwatch_key(id: String) {
    if let Ok(mut w) = watched().lock() {
        w.remove(&id);
    }
}
