import { ref } from "vue";
import { emit, listen } from "@tauri-apps/api/event";

/**
 * 外觀：淺色 / 深色。
 * CSS 只認 <html data-theme="light|dark">，所以深色 token 只要寫一份。
 * 沒有「跟隨系統」這個檔位——第一次啟動一律深色，之後就聽使用者的。
 */
export type ThemePref = "light" | "dark";

const THEME_KEY = "kz-maplestory:theme";
const THEME_EVENT = "theme:changed";

function initial(): ThemePref {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* 私密模式等情境讀不到就走預設 */
  }
  return "dark";
}

export const themePref = ref<ThemePref>(initial());

function applyTheme() {
  document.documentElement.dataset.theme = themePref.value;
}

export function setTheme(t: ThemePref) {
  themePref.value = t;
  // 浮動視窗是另一個 webview，載入後不會再讀 localStorage，得主動通知
  void emit(THEME_EVENT, t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* 存不了就只在這次執行有效 */
  }
  applyTheme();
}

export function initTheme() {
  applyTheme();
  void listen<ThemePref>(THEME_EVENT, (e) => {
    themePref.value = e.payload;
    applyTheme();
  });
}
