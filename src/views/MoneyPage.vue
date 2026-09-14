<script setup lang="ts">
import { useMoneyStore } from "../stores/money";

/**
 * 幣值換算：用台幣跟其他玩家買楓幣時，手續費會讓實際入手的比談好的少。
 * 算式與寫法都在 money 模組，這一頁只負責欄位與版面。
 */
const money = useMoneyStore();

function value(e: Event) {
  return (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="page">
    <div class="body">
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
      </section>
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
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4);
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
}
.unit {
  font-size: 14px;
  color: var(--text-dim);
}
</style>
