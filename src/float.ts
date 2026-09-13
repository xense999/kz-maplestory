import { ref } from "vue";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * 浮動視窗：一個永遠置頂的小面板，讓人不用切回主視窗就看得到倒數。
 *
 * 它是另一個 webview，記憶體不共用，所以計時狀態靠事件同步：
 * 主視窗在狀態變動時廣播一份快照，浮動視窗自己按快照的到期時刻倒數
 * （只送「到期時刻」不送「剩幾秒」，兩邊就不需要對時）。
 */

export const FLOAT_LABEL = "float";

export interface TimerSnap {
  id: string;
  label: string;
  endAt: number | null;
  durationMs: number;
}

const SYNC = "timers:sync";
const HELLO = "timers:hello";
const OPACITY = "float:opacity";

const OPACITY_KEY = "kz-maplestory:float-opacity";

/** 浮動視窗透明度（1＝不透明）。壓在 0.25 以上，再淡就看不到數字了 */
export const floatOpacity = ref(loadOpacity());

function loadOpacity() {
  try {
    const v = Number(localStorage.getItem(OPACITY_KEY));
    return v >= 0.25 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export function setFloatOpacity(v: number) {
  floatOpacity.value = Math.min(1, Math.max(0.25, v));
  try {
    localStorage.setItem(OPACITY_KEY, String(floatOpacity.value));
  } catch {
    /* 存不了就只在這次執行有效 */
  }
  pushFloatOpacity();
}

/** 主視窗：把目前透明度送過去（改動時、以及浮動視窗剛開起來時） */
export function pushFloatOpacity() {
  void emit(OPACITY, floatOpacity.value);
}

/** 浮動視窗：收透明度 */
export function onFloatOpacity(cb: (v: number) => void) {
  return listen<number>(OPACITY, (e) => cb(e.payload));
}

/** 主視窗：廣播目前狀態 */
export function broadcastTimers(snap: TimerSnap[]) {
  void emit(SYNC, snap);
}

/** 主視窗：浮動視窗開起來時會喊一聲，收到就補送一份 */
export function onFloatHello(cb: () => void) {
  return listen(HELLO, cb);
}

/** 浮動視窗：收主視窗的快照 */
export function onTimersSync(cb: (snap: TimerSnap[]) => void) {
  return listen<TimerSnap[]>(SYNC, (e) => cb(e.payload));
}

/** 浮動視窗：跟主視窗要一份現況 */
export function sayHello() {
  void emit(HELLO);
}

/** 浮動視窗現在開著沒有（給主視窗的按鈕標狀態用） */
export const floatOpen = ref(false);

/**
 * 浮動視窗在 tauri.conf.json 就宣告好、開機建起來但 visible:false，這裡只切換顯示。
 * ★不在執行期 new WebviewWindow：那樣建出來的子視窗有過空白不 render 的前例。
 * 而且一律 hide 不 close——close 掉的視窗叫不回來，就沒得再開了。
 */
export async function toggleFloatWindow() {
  const win = await WebviewWindow.getByLabel(FLOAT_LABEL);
  if (!win) return;
  if (await win.isVisible()) {
    await win.hide();
    floatOpen.value = false;
  } else {
    await win.show();
    await win.setFocus();
    floatOpen.value = true;
  }
}
