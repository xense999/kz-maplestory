import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { startAlarm, stopAlarm } from "../alarm";
import { onHotkey, unwatchKey, watchKey, type Hotkey } from "../hotkey";

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
}

const MIN = 60_000;

export const SPECS: Spec[] = [
  {
    id: "reincarnation",
    label: "輪迴計時器",
    hint: "起算後 9 分 50 秒提醒",
    durationMs: 9 * MIN + 50_000,
  },
  {
    id: "burning",
    label: "燃燒計時器",
    hint: "起算後 15 分提醒",
    durationMs: 15 * MIN,
  },
  {
    id: "rental",
    label: "出租輪迴",
    hint: "客戶買的時長，到期提醒收工",
    durationMs: 30 * MIN,
    presets: [30 * MIN, 60 * MIN, 90 * MIN, 120 * MIN, 150 * MIN, 180 * MIN],
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

  const timers = reactive(
    Object.fromEntries(
      SPECS.map((s) => [
        s.id,
        {
          endAt: null,
          runMs: saved[s.id]?.durationMs ?? s.durationMs,
          durationMs: saved[s.id]?.durationMs ?? s.durationMs,
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
                durationMs: timers[s.id].durationMs,
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

  /** 熱鍵與按鈕共用的入口：從現在重新起算，並收掉正在響的提醒 */
  function start(id: TimerId) {
    const t = timers[id];
    t.runMs = t.durationMs;
    t.endAt = Date.now() + t.durationMs;
    t.fired = false;
    stopAlarm();
  }

  function reset(id: TimerId) {
    const t = timers[id];
    t.endAt = null;
    t.fired = false;
  }

  /** 改時長：正在跑的那一輪不動，避免手滑點到就把客戶的時間洗掉 */
  function setDuration(id: TimerId, ms: number) {
    const t = timers[id];
    t.durationMs = Math.max(MIN, Math.round(ms));
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

  let wired = false;
  /** 接後端事件、把上次開著的監聽接回去。整個 app 只做一次 */
  async function init() {
    if (wired) return;
    wired = true;
    await onHotkey((id) => {
      if (SPECS.some((s) => s.id === id)) start(id as TimerId);
    });
    for (const s of SPECS) {
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
    reset,
    setDuration,
    setHotkey,
    clearHotkey,
    setHotkeyEnabled,
    init,
  };
});
