import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * 監聽式熱鍵（後端 src-tauri/src/keyhook.rs）。
 *
 * 不是 RegisterHotKey——那會把鍵從遊戲手上搶走。這裡是低階 hook 只看不攔，
 * 所以可以直接掛在放技能的那顆鍵上：按一次，技能照放、計時同時起算。
 */

/** 修飾鍵不能單獨當熱鍵 */
const MODS = new Set(["Control", "Shift", "Alt", "Meta"]);

export interface KeySpec {
  vk: number;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface Hotkey extends KeySpec {
  /** 給人看的寫法，例如 "Shift + F1" */
  label: string;
}

/** e.code → Windows virtual-key code。認不得的鍵回 null，錄製就繼續等。 */
function vkFromCode(code: string): { vk: number; name: string } | null {
  let m = /^F(\d{1,2})$/.exec(code);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 24) return { vk: 0x6f + n, name: code };
  }
  m = /^Key([A-Z])$/.exec(code);
  if (m) return { vk: m[1].charCodeAt(0), name: m[1] };
  m = /^Digit(\d)$/.exec(code);
  if (m) return { vk: 0x30 + Number(m[1]), name: m[1] };
  m = /^Numpad(\d)$/.exec(code);
  if (m) return { vk: 0x60 + Number(m[1]), name: `數字鍵盤 ${m[1]}` };

  const table: Record<string, { vk: number; name: string }> = {
    Space: { vk: 0x20, name: "Space" },
    Insert: { vk: 0x2d, name: "Insert" },
    Delete: { vk: 0x2e, name: "Delete" },
    Home: { vk: 0x24, name: "Home" },
    End: { vk: 0x23, name: "End" },
    PageUp: { vk: 0x21, name: "PageUp" },
    PageDown: { vk: 0x22, name: "PageDown" },
    Backquote: { vk: 0xc0, name: "`" },
    Minus: { vk: 0xbd, name: "-" },
    Equal: { vk: 0xbb, name: "=" },
    BracketLeft: { vk: 0xdb, name: "[" },
    BracketRight: { vk: 0xdd, name: "]" },
    Semicolon: { vk: 0xba, name: ";" },
    Quote: { vk: 0xde, name: "'" },
    Comma: { vk: 0xbc, name: "," },
    Period: { vk: 0xbe, name: "." },
    Slash: { vk: 0xbf, name: "/" },
    Backslash: { vk: 0xdc, name: "\\" },
    NumpadAdd: { vk: 0x6b, name: "數字鍵盤 +" },
    NumpadSubtract: { vk: 0x6d, name: "數字鍵盤 -" },
    NumpadMultiply: { vk: 0x6a, name: "數字鍵盤 *" },
    NumpadDivide: { vk: 0x6f, name: "數字鍵盤 /" },
    ArrowUp: { vk: 0x26, name: "↑" },
    ArrowDown: { vk: 0x28, name: "↓" },
    ArrowLeft: { vk: 0x25, name: "←" },
    ArrowRight: { vk: 0x27, name: "→" },
  };
  return table[code] ?? null;
}

/** 一次 keydown → 一組熱鍵定義；按到修飾鍵本身或認不得的鍵回 null */
export function hotkeyFromEvent(e: KeyboardEvent): Hotkey | null {
  if (MODS.has(e.key)) return null;
  const k = vkFromCode(e.code);
  if (!k) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(k.name);

  return {
    vk: k.vk,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    label: parts.join(" + "),
  };
}

export function watchKey(id: string, hk: Hotkey) {
  const { vk, ctrl, shift, alt } = hk;
  return invoke("watch_key", { id, spec: { vk, ctrl, shift, alt } });
}

export function unwatchKey(id: string) {
  return invoke("unwatch_key", { id });
}

/** 後端命中登記的鍵時送 "hotkey" 事件，payload 是登記時給的 id */
export function onHotkey(cb: (id: string) => void) {
  return listen<string>("hotkey", (e) => cb(e.payload));
}
