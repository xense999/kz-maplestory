<script setup lang="ts">
import { computed } from "vue";
import { moneyPanel } from "../float";
import FloatButton from "../components/FloatButton.vue";
import { formatMeso, formatNtd, formatRaw, roundUpSuggestion } from "../money";
import { useMoneyStore } from "../stores/money";

/**
 * 幣值換算：用台幣跟其他玩家買楓幣時，手續費會讓實際入手的比談好的少。
 * 算式與寫法都在 money 模組，這一頁只負責欄位與版面。
 */
const money = useMoneyStore();

function value(e: Event) {
  return (e.target as HTMLInputElement).value;
}

/** 算不出來的時候整塊顯示破折號，而不是 0 —— 0 會被當成「這筆交易真的是零」 */
const DASH = "—";

const rows = computed(() => {
  const d = money.deal;
  return [
    { key: "net", label: "實收楓幣", hint: "手續費扣完，實際入手", meso: d?.net },
    { key: "face", label: "帳面楓幣", hint: "跟對方談的數字；沒有手續費的話就是這個", meso: d?.face },
    { key: "fee", label: "手續費", hint: "帳面與實收的差", meso: d?.fee },
  ];
});

const ntd = computed(() => (money.deal ? `${formatNtd(money.deal.ntd)} 元` : DASH));

/** 付整數台幣的話。精確值本來就是整數時沒有建議，那一行就不出現 */
const roundUp = computed(() =>
  money.deal ? roundUpSuggestion(money.deal.ntd, money.rate, money.vip) : null,
);
</script>

<template>
  <div class="page">
    <div class="body">
      <div class="scroller">
      <section class="card">
        <div class="card-head">
          幣值換算
          <div class="spacer"></div>
          <!-- 費率是這一頁唯一的「我是誰」設定，所以擺在標題列而不是欄位之間 -->
          <span class="viplabel">VIP</span>
          <button
            class="switch"
            role="switch"
            :class="{ on: money.vip }"
            :aria-checked="money.vip"
            :title="money.vip ? '手續費 3%' : '手續費 5%'"
            @click="money.vip = !money.vip"
          ></button>
        </div>

        <div class="fields">
          <label class="field">
            <span class="flabel">匯率</span>
            <input
              class="num"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              placeholder="2800"
              :value="money.rateText"
              @input="money.setRate(value($event))"
            />
            <span class="unit">W ／ 台幣</span>
          </label>

          <label class="field">
            <span class="flabel">台幣</span>
            <input
              class="num"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              placeholder="0"
              :value="money.ntdText"
              @input="money.setNtd(value($event))"
            />
            <span class="unit">元</span>
          </label>

          <label class="field">
            <span class="flabel">楓幣</span>
            <input
              class="num"
              type="text"
              inputmode="decimal"
              spellcheck="false"
              placeholder="0"
              :value="money.mesoWText"
              @input="money.setMesoW(value($event))"
            />
            <span class="unit">W（實際入手）</span>
          </label>
        </div>

        <div class="out">
          <div v-for="r in rows" :key="r.key" class="orow" :title="r.hint">
            <span class="olabel">{{ r.label }}</span>
            <span class="oval">{{ r.meso === undefined ? DASH : formatMeso(r.meso) }}</span>
            <!-- 原始數字是拿來照著打進遊戲的，所以永遠附一份 -->
            <span class="oraw">{{ r.meso === undefined ? "" : formatRaw(r.meso) }}</span>
          </div>

          <div class="orow">
            <span class="olabel">台幣</span>
            <span class="oval">{{ ntd }}</span>
            <span v-if="roundUp" class="oraw">
              付 {{ roundUp.ntd }} 台幣 → 多拿 {{ formatMeso(roundUp.extra) }}
            </span>
          </div>
        </div>
      </section>
      </div>

      <div class="pagebar">
        <div class="spacer"></div>
        <FloatButton :panel="moneyPanel" hint="開一個永遠置頂的小視窗，交易中也看得到換算" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 捲動發生在卡片外的這一層，不是整頁：下面那排按鈕要一直看得到 */
.body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 捲軸走在這段留白上，所以它在卡片外面的右邊 */
  padding-right: 12px;
}
.pagebar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.viplabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dim);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}
.field {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
/* 三個欄位的標籤等寬，輸入框才會對齊成一直行 */
.flabel {
  width: 56px;
  flex: none;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-strong);
}
.num {
  width: 180px;
  flex: none;
  font-variant-numeric: tabular-nums;
  text-align: right;
  /* 框比全域的欄位淡一級：這三欄一直都在，深框會變成三條搶注意力的線 */
  background: transparent;
  border-color: var(--border);
}
.num:hover:not(:focus) {
  background: var(--input-bg);
}
.unit {
  font-size: 14px;
  color: var(--text-dim);
}

/* 結果區：跟輸入區同一張卡，中間一條髮絲線分開——它們是同一筆交易的兩面 */
.out {
  display: flex;
  flex-direction: column;
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
  border-top: 0.5px solid var(--border);
}
.orow {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  padding: var(--sp-2) 0;
}
.olabel {
  width: 76px;
  flex: none;
  font-size: 14px;
  color: var(--text-dim);
}
.oval {
  width: 180px;
  flex: none;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.oraw {
  font-size: 13px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>
