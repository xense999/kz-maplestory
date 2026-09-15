<script setup lang="ts">
import { computed, ref } from "vue";
import { moneyPanel } from "../float";
import FloatButton from "../components/FloatButton.vue";
import { formatMeso, formatNtd, mesoTextInWords } from "../money";
import { useMoneyStore } from "../stores/money";

/**
 * 幣值換算：用台幣跟其他玩家買楓幣時，手續費會讓實際入手的比談好的少。
 * 算式與寫法都在 money 模組，這一頁只負責欄位與版面。
 */
const money = useMoneyStore();

/** 設定模式：VIP 是「我是誰」的設定，不是每筆交易要動的東西，所以收在設定裡 */
const editMode = ref(false);

function value(e: Event) {
  return (e.target as HTMLInputElement).value;
}

/** 算不出來的時候整塊顯示破折號，而不是 0 —— 0 會被當成「這筆交易真的是零」 */
const DASH = "—";

const rows = computed(() => {
  const d = money.deal;
  return [
    { key: "face", label: "交易楓幣", hint: "跟對方談的數字；沒有手續費的話就是這個", meso: d?.face },
    { key: "net", label: "實收楓幣", hint: "手續費扣完，實際入手", meso: d?.net },
  ];
});

/** 楓幣欄旁邊的換算：打「2660」不好一眼看出那是多少，換成談價的級距比較有感 */
const mesoInWords = computed(() => mesoTextInWords(money.mesoText));

/**
 * 這一欄是算出來的嗎——是的話字變琥珀色，跟浮動面板同一條規則。
 * 打楓幣時台幣是算出來的，反過來也一樣；算不出來時兩欄都不變色，
 * 不然空欄位會看起來像已經有結果了。
 */
function derived(field: "ntd" | "meso") {
  return money.deal !== null && money.anchor !== field;
}

/** 實際要掏出來的錢 */
const ntd = computed(() => (money.deal ? formatNtd(money.deal.ntd) : DASH));
</script>

<template>
  <div class="page">
    <div class="body">
      <div class="scroller">
        <!-- 買與賣各自一張大卡。最左邊那張只寫標題的小卡是用來分辨的——
             兩張卡的欄位長得很像，光看數字分不出在算哪一邊 -->
        <section class="card outer">
          <div class="split">
            <div class="inner title">買幣</div>

            <div class="inner">
              <div class="rows fields">
                <label class="row">
                  <span class="rlabel">幣值</span>
                  <input
                    class="rval"
                    type="text"
                    inputmode="decimal"
                    spellcheck="false"
                    placeholder="2800"
                    :value="money.rateText"
                    @input="money.setRate(value($event))"
                  />
                  <span class="rnote unit">萬</span>
                </label>

                <label class="row">
                  <span class="rlabel">楓幣</span>
                  <input
                    class="rval"
                    :class="{ derived: derived('meso') }"
                    type="text"
                    inputmode="decimal"
                    spellcheck="false"
                    placeholder="0"
                    :value="money.mesoText"
                    @input="money.setMeso(value($event))"
                  />
                  <!-- 同一個數字換成談價會用到的級距，打完就在旁邊 -->
                  <span class="rnote">{{ mesoInWords }}</span>
                </label>

                <label class="row">
                  <span class="rlabel">台幣</span>
                  <input
                    class="rval"
                    :class="{ derived: derived('ntd') }"
                    type="text"
                    inputmode="decimal"
                    spellcheck="false"
                    placeholder="0"
                    :value="money.ntdText"
                    @input="money.setNtd(value($event))"
                  />
                  <span class="rnote unit">元</span>
                </label>
              </div>
            </div>

            <div class="inner">
              <div class="rows">
                <div v-for="r in rows" :key="r.key" class="row" :title="r.hint">
                  <span class="rlabel">{{ r.label }}</span>
                  <span class="rval">{{ r.meso === undefined ? DASH : formatMeso(r.meso) }}</span>
                </div>

                <div class="row">
                  <span class="rlabel">實際花費</span>
                  <span class="rval">{{ money.deal ? `${ntd} 元` : DASH }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 賣幣不牽涉手續費：價格照轉出去的量談，費用是對方吃的。
             所以這張卡沒有 VIP、沒有取整，就是兩格互算 -->
        <section class="card outer">
          <div class="split sell">
            <div class="inner title">賣幣</div>

            <div class="inner">
              <div class="rows sellrows">
                <label class="row">
                  <span class="rlabel">楓幣</span>
                  <input
                    class="rval"
                    :class="{ derived: money.sellAnchor === 'ntd' }"
                    type="text"
                    inputmode="decimal"
                    spellcheck="false"
                    placeholder="0"
                    :value="money.sellMesoText"
                    @input="money.setSellMeso(value($event))"
                  />
                </label>

                <label class="row">
                  <span class="rlabel">台幣</span>
                  <input
                    class="rval"
                    :class="{ derived: money.sellAnchor === 'meso' }"
                    type="text"
                    inputmode="decimal"
                    spellcheck="false"
                    placeholder="0"
                    :value="money.sellNtdText"
                    @input="money.setSellNtd(value($event))"
                  />
                  <span class="rnote unit">元</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="pagebar">
        <div class="spacer"></div>
        <FloatButton :panel="moneyPanel" hint="開一個永遠置頂的小視窗，交易中也看得到換算" />

        <!-- VIP 短期內不會變，平常不該被誤觸，收在設定鈕上方的小浮層裡 -->
        <div class="gearctl">
          <div v-if="editMode" class="pop">
            <span class="poplabel">VIP</span>
            <button
              class="switch"
              role="switch"
              :class="{ on: money.vip }"
              :aria-checked="money.vip"
              @click="money.vip = !money.vip"
            ></button>
            <span class="popnote">手續費 {{ money.vip ? "3%" : "5%" }}</span>
          </div>

          <button
            class="gear"
            :class="{ primary: editMode }"
            :title="editMode ? '完成' : '設定是不是 VIP'"
            @click="editMode = !editMode"
          >
            {{ editMode ? "完成" : "設定" }}
          </button>
        </div>
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
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.pagebar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* 外卡只負責標題與外框，內容全在兩張小卡裡 */
.outer {
  padding: var(--sp-3);
}
/* 兩張小卡等寬，且 stretch 成一樣高——一邊比另一邊矮會看起來像沒寫完 */
.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-3);
  align-items: stretch;
}
/* 視窗窄到兩欄各自塞不下時就疊成上下 */
@media (max-width: 900px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }
}
.inner {
  display: flex;
  flex-direction: column;
  padding: var(--sp-4);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.gear {
  flex: none;
}
/* 浮層貼著按鈕上緣，跟浮動視窗那顆的透明度拉桿同一套長相 */
.gearctl {
  position: relative;
  flex: none;
}
.pop {
  position: absolute;
  bottom: 100%;
  right: 0;
  z-index: 30;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 8px 12px;
  background: var(--popover);
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  backdrop-filter: blur(28px) saturate(1.8);
  white-space: nowrap;
}
.poplabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}
.popnote {
  font-size: 14px;
  color: var(--text-dim);
}

/* 兩張卡的內容用同一組規則：列高、欄寬、字級都一致，左右才對得起來 */
.rows {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-3);
}
/* 賣幣只有兩格，左右並排比上下疊更配它的高度 */
.sellrows {
  flex-direction: row;
  align-items: center;
  gap: var(--sp-5);
}
.sellrows .row {
  flex: 1;
  min-width: 0;
}
.sellrows .rval {
  flex: 1;
  width: auto;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 34px;
}
.rlabel {
  width: 64px;
  flex: none;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-dim);
}
/* 左卡的標籤只有兩三個字，跟右卡共用一個寬度的話欄位前面會空一大段。
   兩張卡的列高與字級仍然一致，只有這一欄各自貼合自己的標籤。 */
.fields .rlabel {
  width: 36px;
}
.rval {
  width: 190px;
  flex: none;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
/* 單位、原始數字、級距換算都是附註：同一個字級、同一個淡度 */
.rnote {
  font-size: 14px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 單位比其他附註重要一點：它說明左邊那個數字在講什麼 */
.unit {
  flex: none;
  color: var(--text-dim);
}

/* 琥珀色只標左卡那兩個互相換算的欄位：哪一欄是算出來的。
   右卡整張都是結果，全部上色等於沒標。 */
.rval.derived {
  color: var(--warn);
}

/* 輸入欄要跟右邊的唯讀數字長得一樣高、一樣重，只是多一個可以點進去的框 */
input.rval {
  height: 34px;
  padding: 0 12px;
  /* 框比全域的欄位淡一級：這三欄一直都在，深框會變成三條搶注意力的線 */
  background: transparent;
  border-color: var(--border);
}
input.rval:hover:not(:focus) {
  background: var(--input-bg);
}
</style>
