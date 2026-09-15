import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { moneyPanel, type MoneySnap } from "../float";
import {
  ntdToText,
  fromNtd,
  fromWanted,
  mesoToText,
  parseAmount,
  rateToText,
  W_PER_YI,
  sellDeal,
  sellMeso,
  sellNtd,
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
const MODE_KEY = "kz-maplestory:money:mode";

export const useMoneyStore = defineStore("money", () => {
  const rateText = ref(load(RATE_KEY));
  /** 同一個幣值的另一種講法：商城報價是每台幣多少億 */
  const shopRateText = ref("");
  const rateAnchor = ref<"rate" | "shop">("rate");
  const ntdText = ref("");
  /** 楓幣欄位填的是楓幣本身，旁邊另外顯示換算後的級距 */
  const mesoText = ref("");
  const vip = ref(load(VIP_KEY) === "1");

  /**
   * 賣幣那張卡：轉出去的楓幣與拿得到的台幣。跟買幣共用幣值，但其餘完全獨立——
   * 兩邊的欄位意思不一樣（買是「我要收到多少」，賣是「我要轉出去多少」），
   * 共用欄位只會讓人算錯。
   */
  const sellMesoText = ref("");
  const sellNtdText = ref("");
  const sellAnchor = ref<"ntd" | "meso">("meso");

  /** 浮動面板現在在算哪一種。面板只有三列，一次只顯示一邊 */
  const mode = ref<"buy" | "sell">(load(MODE_KEY) === "sell" ? "sell" : "buy");

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

  // 賣幣：算出來的那一欄跟著走，來源欄不動
  watch(
    [sellMesoText, sellNtdText, rate, sellAnchor],
    () => {
      if (sellAnchor.value === "meso") {
        const v = sellNtd(parseAmount(sellMesoText.value), rate.value);
        sellNtdText.value = v === null ? "" : ntdToText(v);
      } else {
        const v = sellMeso(parseAmount(sellNtdText.value), rate.value);
        sellMesoText.value = v === null ? "" : mesoToText(v);
      }
    },
    { immediate: true },
  );

  function setSellMeso(value: string) {
    sellAnchor.value = "meso";
    sellMesoText.value = value;
  }

  function setSellNtd(value: string) {
    sellAnchor.value = "ntd";
    sellNtdText.value = value;
  }

  // 兩個幣值欄位是同一個數字的兩種單位，改哪一個另一個就跟著換算
  watch(
    [rateText, shopRateText, rateAnchor],
    () => {
      if (rateAnchor.value === "rate") {
        shopRateText.value = rateToText(parseAmount(rateText.value) / W_PER_YI);
      } else {
        rateText.value = rateToText(parseAmount(shopRateText.value) * W_PER_YI);
      }
    },
    { immediate: true },
  );

  function setShopRate(value: string) {
    rateAnchor.value = "shop";
    shopRateText.value = value;
  }

  watch(rateText, (v) => save(RATE_KEY, v));
  watch(vip, (v) => save(VIP_KEY, v ? "1" : "0"));
  watch(mode, (v) => save(MODE_KEY, v));

  /** 賣幣實際成交的樣子：整數現金，以及為此要轉出去的楓幣 */
  const sellResult = computed(() => sellDeal(parseAmount(sellMesoText.value), rate.value));

  /** 賣幣算得出來沒有：幣值合法，而且兩欄至少填了一欄 */
  const sellOk = computed(
    () =>
      sellNtd(parseAmount(sellMesoText.value), rate.value) !== null ||
      sellMeso(parseAmount(sellNtdText.value), rate.value) !== null,
  );

  /** 面板一次只顯示一邊，所以送過去的是「現在這個模式的那三個數字」 */
  function snapshot(): MoneySnap {
    const selling = mode.value === "sell";
    return {
      ntd: selling ? sellNtdText.value : ntdText.value,
      meso: selling ? sellMesoText.value : mesoText.value,
      rate: rateText.value,
      mode: mode.value,
      anchor: selling ? sellAnchor.value : anchor.value,
      ok: selling ? sellOk.value : deal.value !== null,
    };
  }

  function publish() {
    moneyPanel.push(snapshot());
  }

  watch(
    [ntdText, mesoText, sellNtdText, sellMesoText, rateText, vip, mode, anchor, sellAnchor],
    publish,
  );

  function setNtd(value: string) {
    anchor.value = "ntd";
    ntdText.value = value;
  }

  function setMeso(value: string) {
    anchor.value = "meso";
    mesoText.value = value;
  }

  /**
   * 改幣值不換來源欄：你最後打的那一欄還是那一欄，另一欄跟著重算。
   * ★以前這裡會硬切回台幣，結果是打了楓幣再調一次幣值，畫面上「算出來的」
   * 標記就跑到你自己打的那一欄上，等於在說謊。
   */
  function setRate(value: string) {
    rateAnchor.value = "rate";
    rateText.value = value;
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
      if (field === "mode") mode.value = value === "sell" ? "sell" : "buy";
      else if (field === "rate") setRate(value);
      else if (mode.value === "sell") {
        if (field === "ntd") setSellNtd(value);
        else setSellMeso(value);
      } else if (field === "ntd") setNtd(value);
      else setMeso(value);
    });
    publish();
    moneyPanel.pushOpacity();
  }

  return {
    init,
    rateText,
    shopRateText,
    rateAnchor,
    ntdText,
    mesoText,
    vip,
    mode,
    rate,
    deal,
    anchor,
    sellMesoText,
    sellNtdText,
    sellAnchor,
    sellResult,
    setNtd,
    setMeso,
    setRate,
    setShopRate,
    setSellMeso,
    setSellNtd,
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
