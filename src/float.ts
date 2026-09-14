import { ref, type Ref } from "vue";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/**
 * 浮動視窗：永遠置頂的小面板，讓人不用切回主視窗就看得到數字。
 *
 * 每個面板都是另一個 webview，記憶體不共用，所以資料靠事件同步：主視窗廣播一份快照，
 * 面板自己畫。事件名以視窗代號開頭，多個面板才不會收到彼此的資料。
 *
 * 面板都在 tauri.conf.json 宣告好、開機建起來但 visible:false，這裡只切換顯示。
 * ★不在執行期 new WebviewWindow：那樣建出來的子視窗有過空白不 render 的前例。
 * 關閉一律用 hide 不用 close——close 掉的視窗叫不回來，就沒得再開了。
 */

/** 預設半透明——疊在遊戲上，一開始就實心會擋掉太多畫面 */
const DEFAULT_OPACITY = 0.5;

export interface FloatPanel<T> {
  label: string;
  /** 目前開著沒有（主視窗的按鈕靠它標狀態） */
  open: Ref<boolean>;
  /** 底色濃度 0~0.5 */
  opacity: Ref<number>;
  toggle(): Promise<void>;
  setOpacity(v: number): void;
  /** 依列數調整視窗高度（寬度不動，內容是等比縮放的） */
  fitRows(rows: number, rowEm?: number): Promise<void>;
  /** 主視窗：廣播目前狀態 */
  push(data: T): void;
  /** 主視窗：把目前透明度送過去（改動時、以及面板剛開起來時） */
  pushOpacity(): void;
  /** 主視窗：面板開起來時會喊一聲，收到就補送一份 */
  onHello(cb: () => void): Promise<UnlistenFn>;
  /** 面板：收主視窗的快照 */
  onData(cb: (data: T) => void): Promise<UnlistenFn>;
  /** 面板：收透明度 */
  onOpacity(cb: (v: number) => void): Promise<UnlistenFn>;
  /** 面板：跟主視窗要一份現況 */
  sayHello(): void;
}

export function createFloatPanel<T>(label: string): FloatPanel<T> {
  const DATA = `${label}:data`;
  const HELLO = `${label}:hello`;
  const OPACITY = `${label}:opacity`;
  const OPACITY_KEY = `kz-maplestory:float-opacity:${label}`;

  function loadOpacity() {
    try {
      const v = Number(localStorage.getItem(OPACITY_KEY));
      return v >= 0 && v <= 1 ? v : DEFAULT_OPACITY;
    } catch {
      return DEFAULT_OPACITY;
    }
  }

  const open = ref(false);
  const opacity = ref(loadOpacity());

  function pushOpacity() {
    void emit(OPACITY, opacity.value);
  }

  return {
    label,
    open,
    opacity,
    async toggle() {
      const win = await WebviewWindow.getByLabel(label);
      if (!win) return;
      if (await win.isVisible()) {
        await win.hide();
        open.value = false;
      } else {
        // 第一次開啟時落在主視窗框內：面板預設位置是螢幕左上角，
        // 使用者會以為按了沒反應。之後他自己拖到哪就是哪，不再干涉。
        await placeInsideMainOnce(win);
        await win.show();
        await win.setFocus();
        open.value = true;
      }
    },
    setOpacity(v: number) {
      opacity.value = Math.min(1, Math.max(0, v));
      try {
        localStorage.setItem(OPACITY_KEY, String(opacity.value));
      } catch {
        /* 存不了就只在這次執行有效 */
      }
      pushOpacity();
    },
    push(data: T) {
      void emit(DATA, data);
    },
    /**
     * 高度跟著列數走。列高按目前的視窗寬度換算——面板的內容是等比縮放的，
     * 所以拉寬之後每一列也會變高。
     */
    async fitRows(rows: number, rowEm = 3.25) {
      const win = await WebviewWindow.getByLabel(label);
      if (!win) return;
      const scale = await win.scaleFactor();
      const size = await win.innerSize();
      const w = size.width / scale;
      const rowPx = (w / 360) * 16 * rowEm;
      const height = Math.round(Math.max(1, rows) * rowPx + 14);
      await win.setSize(new LogicalSize(Math.round(w), height));
    },
    pushOpacity,
    onHello: (cb) => listen(HELLO, cb),
    onData: (cb) => listen<T>(DATA, (e) => cb(e.payload)),
    onOpacity: (cb) => listen<number>(OPACITY, (e) => cb(e.payload)),
    sayHello() {
      void emit(HELLO);
    },
  };
}

/**
 * 把面板挪進主視窗的範圍內，只做一次。
 *
 * 面板是在設定檔裡宣告的，Windows 給它的預設位置在主視窗外面（多半是螢幕左上角）；
 * 第一次開啟時如果出現在那裡，使用者會以為按鈕壞了。
 */
async function placeInsideMainOnce(win: WebviewWindow) {
  const key = `kz-maplestory:float-placed:${win.label}`;
  try {
    if (localStorage.getItem(key)) return;
  } catch {
    /* 讀不到就當作沒放過，最多是多挪一次 */
  }

  const main = await WebviewWindow.getByLabel("main");
  if (!main) return;

  const scale = await main.scaleFactor();
  const mPos = (await main.outerPosition()).toLogical(scale);
  const mSize = (await main.outerSize()).toLogical(scale);
  const pSize = (await win.outerSize()).toLogical(scale);

  // 貼在主視窗內側的右下角，留一點邊距
  const margin = 24;
  await win.setPosition(
    new LogicalPosition(
      Math.round(mPos.x + mSize.width - pSize.width - margin),
      Math.round(mPos.y + mSize.height - pSize.height - margin),
    ),
  );

  try {
    localStorage.setItem(key, "1");
  } catch {
    /* 存不了就下次再挪一次，無害 */
  }
}

/** 輪燒面板送的東西：每個計時器叫什麼、什麼時候到期 */
export interface TimerSnap {
  id: string;
  label: string;
  endAt: number | null;
  durationMs: number;
}

export const burnPanel = createFloatPanel<TimerSnap[]>("float");

/** 角色進度面板送的東西：每隻角色的現況與今天的成長量 */
export interface CharacterSnap {
  slot: string;
  label: string;
  name: string;
  level: number | null;
  expPercent: number | null;
  today: number | null;
  imageUrl?: string;
}

export const progressPanel = createFloatPanel<CharacterSnap[]>("float-progress");
