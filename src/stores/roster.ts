import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { progressPanel, type CharacterSnap } from "../float";
import {
  fetchCharacter,
  fetchHistory,
  REFRESH_MS,
  type CharacterInfo,
  type Growth,
} from "../character";

/**
 * 要互相比較的角色清單。
 *
 * ★這裡是 store 而不是主頁裡的區域狀態：浮動視窗跟主頁要資料，如果供給端綁在
 * 「主頁被顯示過」這件事上，使用者停在別頁時面板就永遠是空的。
 */
export interface Slot {
  id: string;
  name: string;
  /** 要不要出現在浮動視窗 */
  shown: boolean;
  info: CharacterInfo | null;
  growth: Growth | null;
  loading: boolean;
  error: string;
}

/** 存檔只留使用者設定的部分，抓回來的資料每次重來 */
interface SavedSlot {
  id: string;
  name: string;
  shown: boolean;
}

const SLOTS_KEY = "kz-maplestory:roster";
/** 舊版是固定兩格、分開存名字與顯示開關；改成清單之後要把舊設定接過來 */
const LEGACY_NAMES_KEY = "kz-maplestory:character-names";
const LEGACY_SHOWN_KEY = "kz-maplestory:character-shown";

function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function blank(saved?: SavedSlot): Slot {
  return {
    id: saved?.id ?? newId(),
    name: saved?.name ?? "",
    shown: saved?.shown ?? false,
    info: null,
    growth: null,
    loading: false,
    error: "",
  };
}

function load(): Slot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? "null");
    if (Array.isArray(raw) && raw.length) return raw.map((r: SavedSlot) => blank(r));
  } catch {
    /* 壞掉就往下走，看看有沒有舊格式可以接 */
  }
  const migrated = migrateLegacy();
  return migrated.length ? migrated : [blank()];
}

/** 把舊版的「主角色／對照角色」兩格接成清單。接完就把舊鍵刪掉，只做一次。 */
function migrateLegacy(): Slot[] {
  try {
    const names = JSON.parse(localStorage.getItem(LEGACY_NAMES_KEY) ?? "null") as Record<
      string,
      string
    > | null;
    if (!names) return [];
    const shown = (JSON.parse(localStorage.getItem(LEGACY_SHOWN_KEY) ?? "null") ??
      {}) as Record<string, boolean>;
    const out = ["main", "rival"]
      .filter((k) => (names[k] ?? "").trim() !== "")
      .map((k) => blank({ id: newId(), name: names[k], shown: shown[k] ?? false }));
    localStorage.removeItem(LEGACY_NAMES_KEY);
    localStorage.removeItem(LEGACY_SHOWN_KEY);
    return out;
  } catch {
    return [];
  }
}

export const useRosterStore = defineStore("roster", () => {
  const slots = ref<Slot[]>(load());

  function persist() {
    try {
      const data: SavedSlot[] = slots.value.map((s) => ({
        id: s.id,
        name: s.name,
        shown: s.shown,
      }));
      localStorage.setItem(SLOTS_KEY, JSON.stringify(data));
    } catch {
      /* 存不了就只在這次執行有效 */
    }
  }

  // ★開檔就立刻寫回一次。舊格式遷移完會把舊鍵刪掉，如果不在這裡存新的，
  // 使用者的角色名會在「舊的已刪、新的還沒寫」之間整個消失。
  persist();

  function find(id: string) {
    return slots.value.find((s) => s.id === id);
  }

  /** 面板要的東西：只有被打開、而且有名字的那幾張 */
  function snapshot(): CharacterSnap[] {
    return slots.value
      .filter((s) => s.shown && s.name)
      .map((s) => ({
        slot: s.id,
        label: s.name,
        name: s.name,
        level: s.info?.level ?? null,
        expPercent: s.info?.expPercent ?? null,
        today: s.growth?.today ?? null,
        imageUrl: s.info?.imageUrl,
      }));
  }

  /**
   * 送資料給面板，順便讓它的高度跟著顯示中的張數走。
   *
   * ★下面另外掛一個 deep watch：只要有任何一條路徑改了狀態卻忘了呼叫這裡，
   * 面板就會停在舊畫面（關掉開關那一列不會消失，就是這樣來的）。
   * 內容沒變就不送，所以重複呼叫是安全的。
   */
  let lastSent = "";
  function publish(force = false) {
    const rows = snapshot();
    const json = JSON.stringify(rows);
    if (!force && json === lastSent) return;
    lastSent = json;
    progressPanel.push(rows);
    // 4.1em：頭像、名字、等級那行、經驗長條，外加上下的呼吸空間
    void progressPanel.fitRows(rows.length, 4.1).catch(() => {});
  }

  watch(slots, () => publish(), { deep: true });

  async function refresh(id: string) {
    const t = find(id);
    if (!t) return;
    if (!t.name) {
      t.error = "";
      return;
    }
    t.loading = true;
    try {
      // 抓失敗時刻意不清掉舊的 info：暫時斷網不該讓畫面變空白
      t.info = await fetchCharacter(t.name);
      const hist = await fetchHistory(t.name, t.info.level, t.info.expPercent);
      t.growth = hist.growth;
      t.error = "";
    } catch (e) {
      t.error = String(e instanceof Error ? e.message : e);
    } finally {
      t.loading = false;
      publish();
    }
  }

  function refreshAll() {
    for (const s of slots.value) void refresh(s.id);
  }

  /** 改名字＝換一隻角色：舊的數字不再屬於它 */
  async function setName(id: string, value: string) {
    const t = find(id);
    if (!t) return;
    const next = value.trim();
    if (next === t.name) return;
    t.name = next;
    t.info = null;
    t.growth = null;
    persist();
    publish();
    await refresh(id);
  }

  function setShown(id: string, on: boolean) {
    const t = find(id);
    if (!t) return;
    t.shown = on;
    persist();
    publish();
  }

  function addSlot() {
    slots.value = [...slots.value, blank()];
    persist();
  }

  /** 把一張卡搬到另一張卡的位置（拖曳排序用）。順序本身也要存。 */
  function moveSlot(id: string, beforeId: string) {
    if (id === beforeId) return;
    const list = [...slots.value];
    const from = list.findIndex((s) => s.id === id);
    const to = list.findIndex((s) => s.id === beforeId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    // 往下拖時，上面那一步已經把後面的索引整個往前推了一格
    list.splice(from < to ? to - 1 : to, 0, moved);
    slots.value = list;
    persist();
  }

  function removeSlot(id: string) {
    slots.value = slots.value.filter((s) => s.id !== id);
    // 一張都不留的話這一頁就沒有東西可以操作了
    if (!slots.value.length) slots.value = [blank()];
    persist();
    publish();
  }

  const anyNamed = computed(() => slots.value.some((s) => s.name !== ""));

  let wired = false;
  /** 由 App 啟動時呼叫一次：接面板、開始定時更新 */
  async function init() {
    if (wired) return;
    wired = true;

    // ★面板問「有人在嗎」時一定要回，即使內容跟上次送的一樣：
    // 它就是因為可能沒收到第一筆才在問，被去重擋掉的話會永遠問下去。
    await progressPanel.onHello(() => {
      publish(true);
      progressPanel.pushLook();
    });
    publish(true);
    progressPanel.pushLook();

    refreshAll();
    setInterval(refreshAll, REFRESH_MS);
  }

  return {
    slots,
    anyNamed,
    refresh,
    refreshAll,
    setName,
    setShown,
    addSlot,
    moveSlot,
    removeSlot,
    init,
  };
});
