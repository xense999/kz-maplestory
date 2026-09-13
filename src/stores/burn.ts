import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { startAlarm, stopAlarm } from "../alarm";
import { bind, unbind } from "../hotkey";

/**
 * 輪燒計時器：輪迴、燃燒各一組，時長固定。
 *
 * 時間存「到期時刻」（epoch ms）而不是「還剩幾秒」：睡眠喚醒、視窗最小化、
 * setInterval 漂移都不會讓倒數失準——差幾秒在這裡就是差一次技能。
 */

export type TimerId = "reincarnation" | "burning";

interface Spec {
  id: TimerId;
  label: string;
  hint: string;
  durationMs: number;
  defaultHotkey: string;
}

export const SPECS: Spec[] = [
  {
    id: "reincarnation",
    label: "輪迴計時器",
    hint: "按下快捷鍵起算，9 分 50 秒後提醒",
    durationMs: 9 * 60_000 + 50_000,
    defaultHotkey: "F9",
  },
  {
    id: "burning",
    label: "燃燒計時器",
    hint: "按下快捷鍵起算，15 分後提醒",
    durationMs: 15 * 60_000,
    defaultHotkey: "F10",
  },
];

interface TimerState {
  /** 到期時刻；null＝還沒起算 */
  endAt: number | null;
  /** 這一輪的提醒音放過了沒（避免每個 tick 重放） */
  fired: boolean;
  hotkey: string;
  hotkeyOn: boolean;
  /** 註冊失敗的原因（鍵被別的程式佔走時會有） */
  error: string;
}

const HOTKEY_KEY = "kz-maplestory:burn-hotkeys";

/** 快捷鍵是設定不是計時狀態，所以存；正在跑的倒數刻意不存，關掉就沒了 */
function loadHotkeys(): Record<string, { key: string; on: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(HOTKEY_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export const useBurnStore = defineStore("burn", () => {
  const saved = loadHotkeys();

  const timers = reactive(
    Object.fromEntries(
      SPECS.map((s) => [
        s.id,
        {
          endAt: null,
          fired: false,
          hotkey: saved[s.id]?.key ?? s.defaultHotkey,
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
        HOTKEY_KEY,
        JSON.stringify(
          Object.fromEntries(
            SPECS.map((s) => [s.id, { key: timers[s.id].hotkey, on: timers[s.id].hotkeyOn }]),
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

  /** 快捷鍵與按鈕共用的入口：從現在重新起算，並收掉正在響的提醒 */
  function start(id: TimerId) {
    const t = timers[id];
    t.endAt = Date.now() + spec(id).durationMs;
    t.fired = false;
    stopAlarm();
  }

  function reset(id: TimerId) {
    const t = timers[id];
    t.endAt = null;
    t.fired = false;
  }

  async function setHotkeyEnabled(id: TimerId, on: boolean) {
    const t = timers[id];
    t.error = "";
    try {
      if (on) await bind(t.hotkey, () => start(id));
      else await unbind(t.hotkey);
      t.hotkeyOn = on;
    } catch (e) {
      t.hotkeyOn = false;
      t.error = `${t.hotkey} 註冊失敗（可能被其他程式佔用）`;
      console.error(e);
    }
    persist();
  }

  /** 換鍵：本來開著就換過去，換失敗時把開關關掉並留下原因 */
  async function setHotkey(id: TimerId, accel: string) {
    const t = timers[id];
    const wasOn = t.hotkeyOn;
    if (wasOn) await unbind(t.hotkey).catch(() => {});
    t.hotkey = accel;
    t.hotkeyOn = false;
    persist();
    if (wasOn) await setHotkeyEnabled(id, true);
  }

  /** 上次關程式時開著的快捷鍵，開機時接回去（註冊是非同步的，所以不放在 setup 同步段） */
  async function initHotkeys() {
    for (const s of SPECS) {
      if (saved[s.id]?.on) await setHotkeyEnabled(s.id, true);
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
    setHotkey,
    setHotkeyEnabled,
    initHotkeys,
  };
});
