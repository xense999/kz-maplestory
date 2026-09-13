import { defineStore } from "pinia";
import { computed, ref } from "vue";

/**
 * 輪燒場次。
 * 時間一律存「絕對時刻」（epoch ms）而不是「還剩幾秒」：睡眠喚醒、視窗被最小化、
 * setInterval 漂移都不會讓倒數失準。暫停時把剩餘量收進 leftMs，恢復時再換算回 endAt。
 */
export interface Session {
  id: number;
  name: string;
  /** 購買時長，只用來畫進度條的分母 */
  totalMs: number;
  startedAt: number;
  /** 執行中＝到期時刻；暫停中＝null */
  endAt: number | null;
  /** 暫停中＝剩餘毫秒；執行中＝null */
  leftMs: number | null;
}

let seq = 0;

export const useBurnStore = defineStore("burn", () => {
  const sessions = ref<Session[]>([]);
  const now = ref(Date.now());
  setInterval(() => (now.value = Date.now()), 250);

  /** 執行中回實際剩餘（可為負＝超時），暫停中回凍住的剩餘 */
  function remaining(s: Session) {
    return s.endAt === null ? (s.leftMs ?? 0) : s.endAt - now.value;
  }

  /** 快到期的排前面；暫停的沉底 */
  const ordered = computed(() =>
    [...sessions.value].sort((a, b) => {
      if ((a.endAt === null) !== (b.endAt === null)) return a.endAt === null ? 1 : -1;
      return remaining(a) - remaining(b);
    }),
  );

  const expiredCount = computed(
    () => sessions.value.filter((s) => s.endAt !== null && remaining(s) <= 0).length,
  );

  function add(name: string, minutes: number) {
    const totalMs = minutes * 60_000;
    const t = Date.now();
    sessions.value.push({
      id: ++seq,
      name: name.trim() || `客戶 ${seq}`,
      totalMs,
      startedAt: t,
      endAt: t + totalMs,
      leftMs: null,
    });
  }

  function togglePause(s: Session) {
    if (s.endAt === null) {
      s.endAt = Date.now() + (s.leftMs ?? 0);
      s.leftMs = null;
    } else {
      s.leftMs = s.endAt - Date.now();
      s.endAt = null;
    }
  }

  /** 加時：連同分母一起加，進度條才不會爆表 */
  function extend(s: Session, minutes: number) {
    const ms = minutes * 60_000;
    s.totalMs += ms;
    if (s.endAt === null) s.leftMs = (s.leftMs ?? 0) + ms;
    else s.endAt += ms;
  }

  function remove(s: Session) {
    sessions.value = sessions.value.filter((x) => x.id !== s.id);
  }

  return { sessions, now, ordered, expiredCount, remaining, add, togglePause, extend, remove };
});
