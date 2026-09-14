import { defineStore } from "pinia";
import { computed, reactive } from "vue";
import { apiKey } from "../apikey";
import { progressPanel, type CharacterSnap } from "../float";
import {
  fetchCharacter,
  readProgress,
  recordProgress,
  REFRESH_MS,
  type CharacterInfo,
  type Progress,
} from "../character";

/**
 * 兩隻要互相比較的角色。
 *
 * ★這裡是 store 而不是主頁裡的區域狀態：浮動視窗跟主頁要資料，如果供給端綁在
 * 「主頁被顯示過」這件事上，使用者停在別頁時面板就永遠是空的。
 */
export const SLOTS = [
  { id: "main", label: "主角色" },
  { id: "rival", label: "對照角色" },
] as const;

export type SlotId = (typeof SLOTS)[number]["id"];

const NAMES_KEY = "kz-maplestory:character-names";

interface SlotState {
  name: string;
  info: CharacterInfo | null;
  growth: Progress | null;
  loading: boolean;
  error: string;
}

function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export const useRosterStore = defineStore("roster", () => {
  const saved = loadNames();

  const slots = reactive(
    Object.fromEntries(
      SLOTS.map((s) => [
        s.id,
        { name: saved[s.id] ?? "", info: null, growth: null, loading: false, error: "" } as SlotState,
      ]),
    ),
  ) as Record<SlotId, SlotState>;

  function persistNames() {
    try {
      localStorage.setItem(
        NAMES_KEY,
        JSON.stringify(Object.fromEntries(SLOTS.map((s) => [s.id, slots[s.id].name]))),
      );
    } catch {
      /* 存不了就只在這次執行有效 */
    }
  }

  /** 面板要的東西。整份重送，兩隻角色的資料量小，不必算差異 */
  function snapshot(): CharacterSnap[] {
    return SLOTS.map((s) => ({
      slot: s.id,
      label: s.label,
      name: slots[s.id].name,
      level: slots[s.id].info?.level ?? null,
      expPercent: slots[s.id].info?.expPercent ?? null,
      today: slots[s.id].growth?.today ?? null,
      imageUrl: slots[s.id].info?.imageUrl,
    }));
  }

  function publish() {
    progressPanel.push(snapshot());
  }

  async function refresh(id: SlotId) {
    const t = slots[id];
    if (!t.name) {
      t.error = "";
      return;
    }
    if (!apiKey.value) {
      t.error = "設定頁還沒填 API 金鑰";
      return;
    }
    t.loading = true;
    try {
      // 抓失敗時刻意不清掉舊的 info：暫時斷網不該讓畫面變空白
      t.info = await fetchCharacter(t.name, apiKey.value);
      t.growth = await recordProgress(id, t.info.level, t.info.expPercent);
      t.error = "";
    } catch (e) {
      t.error = String(e instanceof Error ? e.message : e);
    } finally {
      t.loading = false;
      publish();
    }
  }

  function refreshAll() {
    for (const s of SLOTS) void refresh(s.id);
  }

  /** 改名字＝換一隻角色：舊的數字與成長量都不再屬於它 */
  async function setName(id: SlotId, value: string) {
    const next = value.trim();
    if (next === slots[id].name) return;
    slots[id].name = next;
    slots[id].info = null;
    slots[id].growth = null;
    persistNames();
    publish();
    await refresh(id);
  }

  const anyNamed = computed(() => SLOTS.some((s) => slots[s.id].name !== ""));

  let wired = false;
  /** 由 App 啟動時呼叫一次：接面板、把上次的成長量讀回來、開始定時更新 */
  async function init() {
    if (wired) return;
    wired = true;

    await progressPanel.onHello(() => {
      publish();
      progressPanel.pushOpacity();
    });

    for (const s of SLOTS) {
      if (slots[s.id].name) slots[s.id].growth = await readProgress(s.id).catch(() => null);
    }
    publish();
    progressPanel.pushOpacity();

    refreshAll();
    setInterval(refreshAll, REFRESH_MS);
  }

  return { slots, anyNamed, refresh, refreshAll, setName, init };
});

/** 給 HomePage 用的常數，不必再 import 一次 SLOTS */
export const slotList = SLOTS;
