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
 * 面板多半只是主視窗的鏡子，但也有可以打字的（幣值換算）：那種面板把使用者的修改
 * 送回主視窗，由主視窗改狀態、再廣播回來——狀態只有一份，兩邊才不會各自漂走。
 *
 * 面板都在 tauri.conf.json 宣告好、開機建起來但 visible:false，這裡只切換顯示。
 * ★不在執行期 new WebviewWindow：那樣建出來的子視窗有過空白不 render 的前例。
 * 關閉一律用 hide 不用 close——close 掉的視窗叫不回來，就沒得再開了。
 */

/** 預設半透明——疊在遊戲上，一開始就實心會擋掉太多畫面 */
const DEFAULT_OPACITY = 0.5;

export interface FloatPanel<T, I = never> {
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
  /**
   * 面板：接主視窗的快照。
   *
   * 兩個 webview 是同時載入的，面板的第一聲招呼可能比主視窗的監聽器還早到，
   * 所以這裡會一直問到有人回應為止——這是面板的不變量，不該由各個面板自己重寫。
   * 回傳的函式把監聽與招呼一起收掉。
   */
  connect(cb: (data: T) => void): Promise<() => void>;
  /** 面板：收透明度 */
  onOpacity(cb: (v: number) => void): Promise<UnlistenFn>;
  /** 面板：把使用者在面板上改的東西送回主視窗（只有可以打字的面板用得到） */
  sendInput(data: I): void;
  /** 主視窗：收面板送回來的修改 */
  onInput(cb: (data: I) => void): Promise<UnlistenFn>;
}

/** 開關按鈕用得到的那幾支。型別的 owner 在這裡，按鈕不自己抄一份 */
export type FloatPanelControls = Pick<
  FloatPanel<unknown>,
  "open" | "opacity" | "toggle" | "setOpacity"
>;

export function createFloatPanel<T, I = never>(label: string): FloatPanel<T, I> {
  const DATA = `${label}:data`;
  const HELLO = `${label}:hello`;
  const OPACITY = `${label}:opacity`;
  const INPUT = `${label}:input`;
  const OPACITY_KEY = `kz-maplestory:float-opacity:${label}`;

  function loadOpacity() {
    try {
      // ★先看有沒有存過再轉數字：Number(null) 是 0，而 0 在合法範圍內，
      // 於是「沒設定過」會被當成「設定為全透明」，預設值永遠用不到。
      const raw = localStorage.getItem(OPACITY_KEY);
      if (raw === null) return DEFAULT_OPACITY;
      const v = Number(raw);
      return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_OPACITY;
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
     * ★392／16 這組數字要跟面板自己的字級基準一致，不然算出來的高度會差一截。
     */
    async fitRows(rows: number, rowEm = 3.25) {
      const win = await WebviewWindow.getByLabel(label);
      if (!win) return;
      const scale = await win.scaleFactor();
      const size = await win.innerSize();
      const w = size.width / scale;
      const rowPx = (w / 392) * 16 * rowEm;
      const height = Math.round(Math.max(1, rows) * rowPx + 14);
      await win.setSize(new LogicalSize(Math.round(w), height));
    },
    pushOpacity,
    onHello: (cb) => listen(HELLO, cb),
    async connect(cb) {
      // ★判斷「有人回應」而不是「有資料」：內容本來就可能是空的，
      // 拿內容當條件會變成永遠問下去。
      let answered = false;
      const stop = await listen<T>(DATA, (e) => {
        answered = true;
        cb(e.payload);
      });

      void emit(HELLO);
      const asking = window.setInterval(() => {
        if (answered) {
          clearInterval(asking);
          return;
        }
        void emit(HELLO);
      }, 1000);

      return () => {
        void stop();
        clearInterval(asking);
      };
    },
    onOpacity: (cb) => listen<number>(OPACITY, (e) => cb(e.payload)),
    sendInput(data: I) {
      void emit(INPUT, data);
    },
    onInput: (cb) => listen<I>(INPUT, (e) => cb(e.payload)),
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

/** 幣值換算面板送的東西：三個欄位的文字，外加算的方向與算不算得出來 */
export interface MoneySnap {
  ntd: string;
  meso: string;
  rate: string;
  /** 買幣還是賣幣。面板右邊那條窄欄就是在切這個 */
  mode: "buy" | "sell";
  /** 目前是從哪一欄算的 */
  anchor: "ntd" | "meso";
  /** 算得出來沒有——算不出來時箭頭不點亮 */
  ok: boolean;
}

/** 幣值換算面板送回來的東西：使用者改了哪一欄、改成什麼。
    切買／賣也走這條——它一樣是「使用者動了某個東西」，不值得另開一條通道。 */
export interface MoneyInput {
  field: "ntd" | "meso" | "rate" | "mode";
  value: string;
}

export const moneyPanel = createFloatPanel<MoneySnap, MoneyInput>("float-money");
