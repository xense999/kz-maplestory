import { defineStore } from "pinia";
import { computed, reactive, ref, watch } from "vue";
import { ringing, startAlarm, stopAlarm } from "../alarm";
import { onHotkey, unwatchKey, watchKey, type Hotkey } from "../hotkey";
import { burnPanel } from "../float";

/**
 * 計時器：出租、加持、輪迴、燃燒各一組。
 *
 * 時間存「到期時刻」（epoch ms）而不是「還剩幾秒」：睡眠喚醒、視窗最小化、
 * setInterval 漂移都不會讓倒數失準——差幾秒在這裡就是差一次技能。
 */

/** 固定三張卡的代號是寫死的；加持是動態的，代號在新增時才生出來 */
export type TimerId = string;

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
   * 出租沒有：它跟著輪迴／燃燒的第一次觸發起算，不必另外綁一顆鍵。
   */
  hotkeyable: boolean;
  /**
   * 按這張卡的鍵時，要不要順便把出租的計時起算掉。
   * 只有出租賣的那兩顆技能算數；加持是自己在用的，不該動到客戶的時段。
   */
  startsRental?: boolean;
  /** 使用者自己加的卡片：可以改名、可以刪掉 */
  removable?: boolean;
}

const MIN = 60_000;
/** 出租是按時段賣的，時長一律對齊 15 分鐘——存檔裡的舊值讀進來時也一起對齊 */
const STEP = 15 * MIN;

function snapDuration(ms: number) {
  return Math.max(STEP, Math.round(ms / STEP) * STEP);
}

// 固定的三張。加持是動態的，接在這串後面（見 specs）
const FIXED: Spec[] = [
  {
    id: "rental",
    label: "出租計時",
    hint: "",
    durationMs: 30 * MIN,
    hotkeyable: false,
    presets: [30 * MIN, 60 * MIN, 90 * MIN, 120 * MIN],
  },
  {
    id: "reincarnation",
    label: "輪迴計時器",
    hint: "起算後 9 分 50 秒提醒，每按一次重算",
    durationMs: 9 * MIN + 50_000,
    hotkeyable: true,
    startsRental: true,
  },
  {
    id: "burning",
    label: "燃燒計時器",
    hint: "起算後 14 分 50 秒提醒，每按一次重算",
    durationMs: 14 * MIN + 50_000,
    hotkeyable: true,
    startsRental: true,
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
const BLESSING_KEY = "kz-maplestory:burn:blessings";

/** 加持計時器的預設時長（新增一張時用的） */
const BLESSING_MS = 30 * MIN;

/** 使用者自己加的加持卡：只有「叫什麼」要存在自己這份，其餘跟固定卡走同一套 */
interface Blessing {
  id: TimerId;
  label: string;
}

function loadBlessings(): Blessing[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BLESSING_KEY) ?? "null");
    if (!Array.isArray(raw)) return [{ id: "blessing", label: "加持計時器" }];
    return raw.filter((b) => b && typeof b.id === "string" && typeof b.label === "string");
  } catch {
    return [{ id: "blessing", label: "加持計時器" }];
  }
}

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
   * 存檔裡有就用存檔的。出租的時長對齊 15 分鐘（它是按時段賣的）；
   * 技能的時長是使用者自己量出來的秒數，不做任何對齊。
   */
  function initialDuration(s: Spec) {
    const stored = saved[s.id]?.durationMs;
    if (stored === undefined) return s.durationMs;
    return s.presets ? snapDuration(stored) : Math.max(1000, Math.round(stored));
  }

  const blessings = ref<Blessing[]>(loadBlessings());

  /**
   * 畫面上的卡片 ＝ 固定三張 ＋ 使用者自己加的加持卡。
   * 加持卡都是同一個模板生出來的，差別只有代號與名字。
   */
  const specs = computed<Spec[]>(() => [
    ...FIXED,
    ...blessings.value.map((b) => ({
      id: b.id,
      label: b.label,
      hint: "每按一次重算；基本時間在設定裡改",
      durationMs: BLESSING_MS,
      hotkeyable: true,
      removable: true,
    })),
  ]);

  const timers = reactive({}) as Record<TimerId, TimerState>;

  function makeTimer(s: Spec): TimerState {
    return {
      endAt: null,
      runMs: initialDuration(s),
      durationMs: initialDuration(s),
      fired: false,
      hotkey: saved[s.id]?.hotkey ?? null,
      hotkeyOn: false,
      error: "",
    };
  }

  /** 卡片增減時補上／收掉對應的計時狀態。刪掉的那張要一起把按鍵登記解除 */
  watch(
    specs,
    (list) => {
      const live = new Set(list.map((s) => s.id));
      for (const s of list) {
        if (!timers[s.id]) timers[s.id] = makeTimer(s);
      }
      for (const id of Object.keys(timers)) {
        if (live.has(id)) continue;
        if (timers[id].hotkeyOn) void unwatchKey(id);
        delete timers[id];
      }
    },
    { immediate: true },
  );

  /**
   * 目前正在為「哪幾張卡」響鈴。
   *
   * 鈴聲只有一組，但誰引發的必須記著：出租到期時按技能鍵重新計時，不可以把
   * 出租的提醒一起收掉——那是客戶的時間到了，得由人去處理。反過來，技能自己
   * 到期時重按那顆鍵，鈴就該停，不必再多按一次停止。
   */
  const ringingFor = new Set<TimerId>();

  watch(ringing, (on) => {
    if (!on) ringingFor.clear();
  });

  /** 收掉這張卡的鈴；還有別張卡在響就繼續響 */
  function clearAlarmFor(id: TimerId) {
    ringingFor.delete(id);
    if (ringingFor.size === 0) stopAlarm();
  }

  const now = ref(Date.now());
  setInterval(() => {
    now.value = Date.now();
    for (const s of specs.value) {
      const t = timers[s.id];
      if (t.endAt !== null && !t.fired && now.value >= t.endAt) {
        t.fired = true;
        ringingFor.add(s.id);
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
            specs.value.map((s) => [
              s.id,
              {
                hotkey: timers[s.id].hotkey,
                hotkeyOn: timers[s.id].hotkeyOn,
                // 跟規格一樣就不寫回去：沒改過的人日後才吃得到新的預設值
                durationMs:
                  timers[s.id].durationMs === s.durationMs ? undefined : timers[s.id].durationMs,
              },
            ]),
          ),
        ),
      );
      localStorage.setItem(
        BLESSING_KEY,
        JSON.stringify(blessings.value.map(({ id, label }) => ({ id, label }))),
      );
    } catch {
      /* 存不了就只在這次執行有效 */
    }
  }

  function addBlessing() {
    const id = `blessing-${Date.now().toString(36)}`;
    blessings.value.push({ id, label: "加持計時器" });
    persist();
  }

  function removeBlessing(id: TimerId) {
    blessings.value = blessings.value.filter((b) => b.id !== id);
    persist();
  }

  /** 雙擊標題改名。空白名字沒有意義，留著原本的 */
  function renameBlessing(id: TimerId, label: string) {
    const b = blessings.value.find((x) => x.id === id);
    if (!b) return;
    const next = label.trim();
    if (next) b.label = next;
    persist();
  }

  /**
   * 會出現在浮動面板上的卡片：有開關的就看開關（沒開＝那顆鍵根本不會起算，
   * 列出來只是佔位），沒有開關的（出租）一律顯示。
   */
  const onPanel = computed(() =>
    specs.value.filter((s) => !s.hotkeyable || timers[s.id]?.hotkeyOn),
  );

  function spec(id: TimerId) {
    return specs.value.find((s) => s.id === id)!;
  }

  /** 執行中回剩餘毫秒（可為負＝已超時）；沒起算回 null */
  function remaining(id: TimerId) {
    const t = timers[id];
    return t.endAt === null ? null : t.endAt - now.value;
  }

  /** 從現在重新起算＝「我知道了」，所以順手收掉這張卡的鈴 */
  function start(id: TimerId) {
    const t = timers[id];
    t.runMs = t.durationMs;
    t.endAt = Date.now() + t.durationMs;
    t.fired = false;
    clearAlarmFor(id);
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
    if (spec(id).startsRental && timers.rental.endAt === null) start("rental");
  }

  function reset(id: TimerId) {
    const t = timers[id];
    t.endAt = null;
    t.fired = false;
    clearAlarmFor(id);
  }

  /**
   * 把「基本時間可以在設定裡改」的那些計時器歸零：時長換了，正在跑的那一輪就不算數了。
   *
   * ★出租不在內：它的時長是用膠囊選的、設定模式根本沒有它的欄位，而那一格是客戶
   * 付過錢的時間——為了調技能秒數就把它清掉，是這個程式最不該犯的錯。
   */
  function resetEditable() {
    for (const s of specs.value) {
      if (!s.presets) reset(s.id);
    }
  }

  /**
   * 全部歸零。
   *
   * ★這一支連出租也清——它是使用者按下按鈕明確要求的，跟 `resetEditable`
   * 那種「因為別的操作順便發生」的清除不一樣。
   */
  function resetAll() {
    for (const s of specs.value) reset(s.id);
  }

  /**
   * 「停止提醒」按下去＝這一輪處理完了，所以除了收鈴，也把已經到期的計時器歸零。
   * 對出租來說這一步是必要的：不歸零的話它的 endAt 還在，下一次按技能鍵不會
   * 跟著開新的一輪，等於下一位客戶要自己再按一次卡片上的按鈕。
   */
  function acknowledge() {
    for (const s of specs.value) {
      const t = timers[s.id];
      if (t.endAt !== null && t.endAt <= Date.now()) {
        t.endAt = null;
        t.fired = false;
      }
    }
    ringingFor.clear();
    stopAlarm();
  }

  /** 改時長：正在跑的那一輪不動，避免手滑點到就把客戶的時間洗掉 */
  function setDuration(id: TimerId, ms: number) {
    const t = timers[id];
    // 出租是按時段賣的所以對齊 15 分鐘；技能是量出來的秒數，照原值收下
    t.durationMs = spec(id).presets ? snapDuration(ms) : Math.max(1000, Math.round(ms));
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
      // 關掉監聽＝這張卡不再運作，還在跑的那一輪也就不算數了。
      // 留著倒數的話它會繼續響，但那顆鍵已經不會再起算，人只能手動去收。
      if (!on) reset(id);
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
    return onPanel.value.map((s) => ({
      id: s.id,
      label: s.label,
      endAt: timers[s.id].endAt,
      durationMs: timers[s.id].durationMs,
    }));
  }
  // 每 250ms 的 tick 不會動 endAt，所以這裡只在真的起算／歸零／改時長時送
  watch(
    () =>
      onPanel.value
        .map((s) => `${s.id}:${timers[s.id].endAt}:${timers[s.id].durationMs}`)
        .join(","),
    () => pushPanel(),
  );

  /** 面板的高度跟著列數走：開幾張就多高 */
  function pushPanel() {
    const rows = snapshot();
    burnPanel.push(rows);
    void burnPanel.fitRows(Math.max(1, rows.length)).catch(() => {});
  }

  let wired = false;
  /** 接後端事件、把上次開著的監聽接回去。整個 app 只做一次 */
  async function init() {
    if (wired) return;
    wired = true;
    await onHotkey((id) => {
      if (specs.value.some((s) => s.id === id)) pressKey(id);
    });
    // 浮動視窗開起來時會喊一聲，補一份現況給它
    await burnPanel.onHello(() => {
      pushPanel();
      burnPanel.pushOpacity();
    });
    // 也主動送一次：浮動視窗可能在監聽器掛好之前就喊過了
    pushPanel();
    burnPanel.pushOpacity();
    for (const s of specs.value) {
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

  const anyRunning = computed(() => specs.value.some((s) => timers[s.id].endAt !== null));

  return {
    timers,
    now,
    anyRunning,
    spec,
    remaining,
    start,
    specs,
    blessings,
    addBlessing,
    removeBlessing,
    renameBlessing,
    pressKey,
    reset,
    resetEditable,
    resetAll,
    acknowledge,
    setDuration,
    setHotkey,
    clearHotkey,
    setHotkeyEnabled,
    init,
  };
});
