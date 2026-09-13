import { defineStore } from "pinia";
import { computed, reactive, ref, watch } from "vue";
import { startAlarm, stopAlarm } from "../alarm";
import { onHotkey, unwatchKey, watchKey, type Hotkey } from "../hotkey";
import { broadcastTimers, onFloatHello, pushFloatOpacity } from "../float";

/**
 * 輪燒計時器：輪迴、燃燒、出租輪迴各一組。
 *
 * 時間存「到期時刻」（epoch ms）而不是「還剩幾秒」：睡眠喚醒、視窗最小化、
 * setInterval 漂移都不會讓倒數失準——差幾秒在這裡就是差一次技能。
 */

export type TimerId = "reincarnation" | "burning" | "rental";

interface Spec {
  id: TimerId;
  label: string;
  hint: string;
  /** 預設時長；沒有 presets 的卡片＝固定時長 */
  durationMs: number;
  /** 有值＝時長可選，這幾檔會出現在卡片上 */
  presets?: number[];
  /**
   * 這張卡有沒有自己的按鍵。
   * 出租沒有：它跟著下面兩張技能卡的第一次觸發起算，不必另外綁一顆鍵。
   */
  hotkeyable: boolean;
}

const MIN = 60_000;
/** 出租是按時段賣的，時長一律對齊 15 分鐘——存檔裡的舊值讀進來時也一起對齊 */
const STEP = 15 * MIN;

function snapDuration(ms: number) {
  return Math.max(STEP, Math.round(ms / STEP) * STEP);
}

// 順序＝畫面上的順序（浮動視窗也吃這張表），出租在最上面
export const SPECS: Spec[] = [
  {
    id: "rental",
    label: "出租計時",
    hint: "",
    durationMs: 30 * MIN,
    hotkeyable: false,
    presets: [30 * MIN, 60 * MIN, 90 * MIN, 120 * MIN, 180 * MIN],
  },
  {
    id: "reincarnation",
    label: "輪迴計時器",
    hint: "起算後 9 分 50 秒提醒，每按一次重算",
    durationMs: 9 * MIN + 50_000,
    hotkeyable: true,
  },
  {
    id: "burning",
    label: "燃燒計時器",
    hint: "起算後 14 分 50 秒提醒，每按一次重算",
    durationMs: 14 * MIN + 50_000,
    hotkeyable: true,
  },
];

interface TimerState {
  /** 到期時刻；null＝還沒起算 */
  endAt: number | null;
  /** 這一輪的時長（進度條的分母）——設定改了不影響正在跑的這一輪 */
  runMs: number;
  /** 下次起算要用的時長 */
  durationMs: number;
  /** 這一輪的提醒音放過了沒（避免每個 tick 重放） */
  fired: boolean;
  hotkey: Hotkey | null;
  hotkeyOn: boolean;
  error: string;
}

const SETTINGS_KEY = "kz-maplestory:burn";

interface Saved {
  hotkey?: Hotkey | null;
  hotkeyOn?: boolean;
  durationMs?: number;
}

/** 熱鍵與時長是設定所以存；正在跑的倒數刻意不存，關掉就沒了 */
function loadSaved(): Record<string, Saved> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export const useBurnStore = defineStore("burn", () => {
  const saved = loadSaved();

  /**
   * 只有時長可調的卡片（有 presets）才吃存檔的時長。
   * 技能卡的時長是寫死的規格——存了會變成「改了程式碼但舊使用者永遠停在舊秒數」。
   */
  function initialDuration(s: Spec) {
    const stored = s.presets ? saved[s.id]?.durationMs : undefined;
    return stored === undefined ? s.durationMs : snapDuration(stored);
  }

  const timers = reactive(
    Object.fromEntries(
      SPECS.map((s) => [
        s.id,
        {
          endAt: null,
          runMs: initialDuration(s),
          durationMs: initialDuration(s),
          fired: false,
          hotkey: saved[s.id]?.hotkey ?? null,
          hotkeyOn: false,
          error: "",
        } as TimerState,
      ]),
    ),
  ) as Record<TimerId, TimerState>;

  const now = ref(Date.now());
  setInterval(() => {
    now.value = Date.now();
    for (const s of SPECS) {
      const t = timers[s.id];
      if (t.endAt !== null && !t.fired && now.value >= t.endAt) {
        t.fired = true;
        startAlarm();
      }
    }
  }, 250);

  function persist() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(
          Object.fromEntries(
            SPECS.map((s) => [
              s.id,
              {
                hotkey: timers[s.id].hotkey,
                hotkeyOn: timers[s.id].hotkeyOn,
                // 固定時長的卡片不寫回去，免得下次改規格時被舊值蓋掉
                durationMs: s.presets ? timers[s.id].durationMs : undefined,
              },
            ]),
          ),
        ),
      );
    } catch {
      /* 存不了就只在這次執行有效 */
    }
  }

  function spec(id: TimerId) {
    return SPECS.find((s) => s.id === id)!;
  }

  /** 執行中回剩餘毫秒（可為負＝已超時）；沒起算回 null */
  function remaining(id: TimerId) {
    const t = timers[id];
    return t.endAt === null ? null : t.endAt - now.value;
  }

  /**
   * 從現在重新起算，並且一定收掉正在響的提醒。
   *
   * ★這裡刻意不去分辨「在響的是不是自己這一輪」：實際用起來，
   * 時間到、重按技能、鈴還在叫、還要再手動按一次停止——多這一步就是錯的。
   * 重新起算本身就是「我知道了」，鈴一律停。到期的卡片還留著紅框，不會漏看。
   */
  function start(id: TimerId) {
    const t = timers[id];
    t.runMs = t.durationMs;
    t.endAt = Date.now() + t.durationMs;
    t.fired = false;
    stopAlarm();
  }

  /**
   * 技能卡的按鍵按下時走這裡。
   * 技能本身每按一次就重算；出租則搭這班車——還沒起算就跟著開始，
   * 已經在跑（或已到期還沒收）就不動它，客戶那段時間要一路跑到結束。
   */
  function pressKey(id: TimerId) {
    // 出租沒有自己的鍵。舊設定檔可能還留著一組（UI 拿掉了、後端仍在監聽），
    // 那種事件一律不理，否則每按一次技能鍵都會把客戶的時間打掉重算。
    if (!spec(id).hotkeyable) return;
    start(id);
    if (timers.rental.endAt === null) start("rental");
  }

  function reset(id: TimerId) {
    const t = timers[id];
    t.endAt = null;
    t.fired = false;
    stopAlarm();
  }

  /** 改時長：正在跑的那一輪不動，避免手滑點到就把客戶的時間洗掉 */
  function setDuration(id: TimerId, ms: number) {
    const t = timers[id];
    t.durationMs = snapDuration(ms);
    if (t.endAt === null) t.runMs = t.durationMs;
    persist();
  }

  async function setHotkeyEnabled(id: TimerId, on: boolean) {
    const t = timers[id];
    t.error = "";
    if (on && !t.hotkey) {
      t.error = "還沒設定按鍵";
      return;
    }
    try {
      if (on) await watchKey(id, t.hotkey!);
      else await unwatchKey(id);
      t.hotkeyOn = on;
    } catch (e) {
      t.hotkeyOn = false;
      t.error = "監聽啟用失敗";
      console.error(e);
    }
    persist();
  }

  /** 換鍵：本來開著就換過去 */
  async function setHotkey(id: TimerId, hk: Hotkey) {
    const t = timers[id];
    const wasOn = t.hotkeyOn;
    if (wasOn) await unwatchKey(id).catch(() => {});
    t.hotkey = hk;
    t.hotkeyOn = false;
    persist();
    if (wasOn) await setHotkeyEnabled(id, true);
  }

  async function clearHotkey(id: TimerId) {
    const t = timers[id];
    if (t.hotkeyOn) await unwatchKey(id).catch(() => {});
    t.hotkey = null;
    t.hotkeyOn = false;
    persist();
  }

  /** 浮動視窗只需要「叫什麼、什麼時候到期」，其他狀態不必過去 */
  function snapshot() {
    return SPECS.map((s) => ({
      id: s.id,
      label: s.label,
      endAt: timers[s.id].endAt,
      durationMs: timers[s.id].durationMs,
    }));
  }
  // 每 250ms 的 tick 不會動 endAt，所以這裡只在真的起算／歸零／改時長時送
  watch(
    () => SPECS.map((s) => `${timers[s.id].endAt}:${timers[s.id].durationMs}`).join(","),
    () => broadcastTimers(snapshot()),
  );

  let wired = false;
  /** 接後端事件、把上次開著的監聽接回去。整個 app 只做一次 */
  async function init() {
    if (wired) return;
    wired = true;
    await onHotkey((id) => {
      if (SPECS.some((s) => s.id === id)) pressKey(id as TimerId);
    });
    // 浮動視窗開起來時會喊一聲，補一份現況給它
    await onFloatHello(() => {
      broadcastTimers(snapshot());
      pushFloatOpacity();
    });
    // 也主動送一次：浮動視窗可能在監聽器掛好之前就喊過了
    broadcastTimers(snapshot());
    pushFloatOpacity();
    for (const s of SPECS) {
      if (!s.hotkeyable) {
        // 這張卡以前可能綁過鍵，把後端的登記與存檔一起清乾淨
        await unwatchKey(s.id).catch(() => {});
        if (timers[s.id].hotkey) {
          timers[s.id].hotkey = null;
          timers[s.id].hotkeyOn = false;
          persist();
        }
        continue;
      }
      if (saved[s.id]?.hotkeyOn && timers[s.id].hotkey) await setHotkeyEnabled(s.id, true);
    }
  }

  const anyRunning = computed(() => SPECS.some((s) => timers[s.id].endAt !== null));

  return {
    timers,
    now,
    anyRunning,
    spec,
    remaining,
    start,
    pressKey,
    reset,
    setDuration,
    setHotkey,
    clearHotkey,
    setHotkeyEnabled,
    init,
  };
});
