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

/**
 * 浮動視窗在 tauri.conf.json 就宣告好、開機建起來但 visible:false，這裡只負責顯示。
 * ★不在執行期 new WebviewWindow：那樣建出來的子視窗有過空白不 render 的前例，
 * 宣告式的視窗沒有這個問題。關閉鈕也是 hide 不是 close，關掉才還能再開。
 */
export async function openFloatWindow() {
  const win = await WebviewWindow.getByLabel(FLOAT_LABEL);
  if (!win) return;
  await win.show();
  await win.setFocus();
}
