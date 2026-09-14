import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { fromNet, fromNtd, W, type Deal } from "../money";

/**
 * 幣值換算的欄位狀態。
 *
 * 三個欄位（匯率、台幣、楓幣）都能填，但同一時間只有一個是「來源」，另一個由它算出來——
 * 兩邊互相反推會在浮點誤差上抖動，所以記住使用者最後動的是哪一欄。
 *
 * 值一律以字串保存：空字串跟 0 是不同的事（沒填 vs 填了零），數字型別表達不出來。
 */
const RATE_KEY = "kz-maplestory:money:rate";
const VIP_KEY = "kz-maplestory:money:vip";

/** 使用者可能連千分位一起貼進來 */
function toNumber(text: string): number {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

/** 算出來的數字填回欄位：小數最多兩位，尾巴的 0 不留 */
function toText(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}

export const useMoneyStore = defineStore("money", () => {
  const rateText = ref(load(RATE_KEY));
  const ntdText = ref("");
  /** 楓幣欄位的單位是 W，跟玩家談價的單位一致 */
  const mesoWText = ref("");
  const vip = ref(load(VIP_KEY) === "1");

  /** 最後被使用者動過的金額欄位，另一欄由它算出來 */
  const anchor = ref<"ntd" | "meso">("ntd");

  const rate = computed(() => toNumber(rateText.value));

  const deal = computed<Deal | null>(() =>
    anchor.value === "ntd"
      ? fromNtd(toNumber(ntdText.value), rate.value, vip.value)
      : fromNet(toNumber(mesoWText.value) * W, rate.value, vip.value),
  );

  // 算出來的那一欄跟著走。來源欄不動——使用者正在上面打字。
  watch(
    deal,
    (d) => {
      if (anchor.value === "ntd") {
        mesoWText.value = d ? toText(d.net / W) : "";
      } else {
        ntdText.value = d ? d.ntd.toFixed(2) : "";
      }
    },
    { immediate: true },
  );

  watch(rateText, (v) => save(RATE_KEY, v));
  watch(vip, (v) => save(VIP_KEY, v ? "1" : "0"));

  function setNtd(value: string) {
    anchor.value = "ntd";
    ntdText.value = value;
  }

  function setMesoW(value: string) {
    anchor.value = "meso";
    mesoWText.value = value;
  }

  /**
   * 改匯率時維持台幣不變、重算楓幣：改匯率通常是在跟著行情調價，手上的預算沒有變。
   * 台幣還沒填的話就維持原本的來源欄，不然會把使用者剛打的楓幣清掉。
   */
  function setRate(value: string) {
    rateText.value = value;
    if (ntdText.value) anchor.value = "ntd";
  }

  return {
    rateText,
    ntdText,
    mesoWText,
    vip,
    rate,
    deal,
    setNtd,
    setMesoW,
    setRate,
  };
});

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 存不了就只在這次執行有效 */
  }
}
