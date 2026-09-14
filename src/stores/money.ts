import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { moneyPanel, type MoneySnap } from "../float";
import {
  ntdToText,
  fromNtd,
  fromWanted,
  mesoToText,
  parseAmount,
  type Deal,
} from "../money";

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

export const useMoneyStore = defineStore("money", () => {
  const rateText = ref(load(RATE_KEY));
  const ntdText = ref("");
  /** 楓幣欄位填的是楓幣本身，旁邊另外顯示換算後的級距 */
  const mesoText = ref("");
  const vip = ref(load(VIP_KEY) === "1");

  /** 最後被使用者動過的金額欄位，另一欄由它算出來 */
  const anchor = ref<"ntd" | "meso">("ntd");

  const rate = computed(() => parseAmount(rateText.value));

  const deal = computed<Deal | null>(() =>
    anchor.value === "ntd"
      ? fromNtd(parseAmount(ntdText.value), rate.value, vip.value)
      : fromWanted(parseAmount(mesoText.value), rate.value, vip.value),
  );

  // 算出來的那一欄跟著走。來源欄不動——使用者正在上面打字。
  watch(
    deal,
    (d) => {
      if (anchor.value === "ntd") {
        mesoText.value = d ? mesoToText(d.net) : "";
      } else {
        ntdText.value = d ? ntdToText(d.ntd) : "";
      }
    },
    { immediate: true },
  );

  watch(rateText, (v) => save(RATE_KEY, v));
  watch(vip, (v) => save(VIP_KEY, v ? "1" : "0"));

  function snapshot(): MoneySnap {
    return {
      ntd: ntdText.value,
      meso: mesoText.value,
      rate: rateText.value,
      anchor: anchor.value,
      ok: deal.value !== null,
    };
  }

  function publish() {
    moneyPanel.push(snapshot());
  }

  watch([ntdText, mesoText, rateText, vip, anchor], publish);

  function setNtd(value: string) {
    anchor.value = "ntd";
    ntdText.value = value;
  }

  function setMeso(value: string) {
    anchor.value = "meso";
    mesoText.value = value;
  }

  /**
   * 改匯率時維持台幣不變、重算楓幣：改匯率通常是在跟著行情調價，手上的預算沒有變。
   * 台幣還沒填的話就維持原本的來源欄，不然會把使用者剛打的楓幣清掉。
   */
  function setRate(value: string) {
    rateText.value = value;
    if (ntdText.value) anchor.value = "ntd";
  }

  let wired = false;
  /** 由 App 啟動時呼叫一次：接上浮動面板 */
  async function init() {
    if (wired) return;
    wired = true;

    await moneyPanel.onHello(() => {
      publish();
      moneyPanel.pushOpacity();
    });

    // 面板上的欄位也能打字。改的是這一份狀態，不是面板自己的副本——
    // 兩邊各存一份的話，先後順序一顛倒就會互相蓋掉。
    await moneyPanel.onInput(({ field, value }) => {
      if (field === "ntd") setNtd(value);
      else if (field === "meso") setMeso(value);
      else setRate(value);
    });
    publish();
    moneyPanel.pushOpacity();
  }

  return {
    init,
    rateText,
    ntdText,
    mesoText,
    vip,
    rate,
    deal,
    setNtd,
    setMeso,
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
