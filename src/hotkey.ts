import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";

/**
 * 全域快捷鍵。
 *
 * ★注意這是「系統層註冊」：一旦註冊成功，那顆鍵就從遊戲手上被拿走，遊戲收不到。
 * 所以不要綁在放技能的那顆鍵上——要綁一顆遊戲用不到的鍵（F9、F10 之類），
 * 放完技能後順手按一下。預設不啟用也是為了這件事。
 */

/** 修飾鍵不能單獨當快捷鍵 */
const MODS = new Set(["Control", "Shift", "Alt", "Meta"]);

/**
 * 把一次 keydown 轉成 Tauri 的 accelerator 字串（如 "F9"、"Alt+Shift+R"）。
 * 認不出來就回 null，讓錄製維持在等待狀態。
 */
export function accelFromEvent(e: KeyboardEvent): string | null {
  if (MODS.has(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  if (e.metaKey) parts.push("Super");

  const c = e.code;
  let key: string | null = null;
  if (/^F\d{1,2}$/.test(c)) key = c;
  else if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
  else if (/^Digit\d$/.test(c)) key = c.slice(5);
  else if (/^Numpad\d$/.test(c)) key = c;
  else if (c === "Space") key = "Space";
  else if (c === "Backquote") key = "`";
  else if (c === "Minus") key = "-";
  else if (c === "Equal") key = "=";
  else if (c === "Insert" || c === "Home" || c === "End" || c === "PageUp" || c === "PageDown")
    key = c;
  if (!key) return null;

  parts.push(key);
  return parts.join("+");
}

/** 給人看的寫法：Control→Ctrl，加號改成細一點的分隔 */
export function accelLabel(accel: string) {
  return accel.replace("Control", "Ctrl").replace("Super", "Win").split("+").join(" + ");
}

export async function bind(accel: string, onPressed: () => void) {
  if (await isRegistered(accel)) await unregister(accel);
  // Tauri v2 的 handler 按下與放開各叫一次，只認按下那一次
  await register(accel, (e) => {
    if (e.state === "Pressed") onPressed();
  });
}

export async function unbind(accel: string) {
  if (await isRegistered(accel)) await unregister(accel);
}
