import { ref } from "vue";
import { emit, listen } from "@tauri-apps/api/event";

/**
 * 外觀：淺色 / 深色 / 跟隨系統。
 * CSS 只認 <html data-theme="light|dark">，"system" 在這裡解析掉，
 * 這樣深色 token 只要寫一份，不必再複製一份給 prefers-color-scheme。
 */
export type ThemePref = "system" | "light" | "dark";

const THEME_KEY = "kz-maplestory:theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export const themePref = ref<ThemePref>("system");

try {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") themePref.value = saved;
} catch {
  /* 私密模式等情境讀不到就用預設 */
}

function applyTheme() {
  const resolved =
    themePref.value === "system" ? (darkQuery.matches ? "dark" : "light") : themePref.value;
  document.documentElement.dataset.theme = resolved;
}

const THEME_EVENT = "theme:changed";

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
  darkQuery.addEventListener("change", applyTheme);
  void listen<ThemePref>(THEME_EVENT, (e) => {
    themePref.value = e.payload;
    applyTheme();
  });
}
