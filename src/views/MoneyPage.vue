<script setup lang="ts">
import { computed, ref } from "vue";
import { moneyPanel } from "../float";
import FloatButton from "../components/FloatButton.vue";
import { formatMeso, mesoTextInWords, W } from "../money";
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
                  <span class="rlabel">需求楓幣</span>
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
                  <span class="rnote unit">元</span>
                  <!-- 同一個數字換成談價會用到的級距，打完就在旁邊 -->
                  <span class="rnote">{{ mesoInWords }}</span>
                </label>

                <label class="row">
                  <span class="rlabel">約當現金</span>
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

            <div class="inner results">
              <div class="rows">
                <div v-for="r in rows" :key="r.key" class="row" :title="r.hint">
                  <span class="rlabel">{{ r.label }}</span>
                  <span class="rval">{{ r.meso === undefined ? DASH : formatMeso(r.meso) }}</span>
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
              <div class="rows">
                <label class="row">
                  <span class="rlabel">持有楓幣</span>
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
                  <span class="rnote unit">元</span>
                </label>

                <label class="row">
                  <span class="rlabel">約當現金</span>
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

            <!-- 現金不能分割，交易談的是整數，所以這裡是「真的賣得掉的那一筆」 -->
            <div class="inner results">
              <div class="rows">
                <div class="row" title="為了拿到整數現金，實際要轉出去的量">
                  <span class="rlabel">可販售楓幣</span>
                  <span class="rval">
                    {{ money.sellResult ? formatMeso(money.sellResult.meso) : DASH }}
                  </span>
                </div>

                <div class="row" title="賣不掉的零頭留在身上">
                  <span class="rlabel">可獲得現金</span>
                  <span class="rval">
                    {{ money.sellResult ? `${money.sellResult.cash} 元` : DASH }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 幣值與 VIP 都是這一頁的前提，買賣兩張卡都吃它們，
             所以不屬於任何一張，自己一條放在最下面 -->
        <section class="card outer rate">
          <div class="split ratesplit">
            <div class="inner title icon" title="幣值與手續費">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                   stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2.5v19" />
                <path d="M16.5 7.2c0-1.9-2-3.2-4.5-3.2S7.5 5.3 7.5 7.2s1.7 2.9 4.5 3.5
                         c2.8.6 4.5 1.6 4.5 3.6 0 2-2 3.3-4.5 3.3s-4.5-1.3-4.5-3.3" />
              </svg>
            </div>

            <div class="inner">
              <div class="row">
                <span class="rlabel">當前幣值</span>
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
              </div>
            </div>

            <!-- 商城報的是「一億要多少台幣」，跟左邊的幣值是倒數關係，不是換單位 -->
            <div class="inner">
              <div class="row">
                <span class="rlabel">商城幣值</span>
                <input
                  class="rval shopinput"
                  type="text"
                  inputmode="decimal"
                  spellcheck="false"
                  placeholder="5"
                  :value="money.shopRateText"
                  @input="money.shopRateText = value($event)"
                />
                <span class="rnote unit">億</span>
                <span class="sep">|</span>
                <!-- 這張卡要回答的就是這一句：跟商城買，每花一元實際拿多少楓幣 -->
                <span class="rnote shoprate">
                  1 元 ＝
                  {{ money.shopRate === null ? "—" : formatMeso(Math.floor(money.shopRate) * W) }}
                </span>
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
            <span class="viplabel">VIP</span>
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
.pagebar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  /* 跟上面那層一樣留 12px：那段留白是給捲軸的，沒有的話按鈕的右邊界
     會比卡片多凸出 12px */
  padding-right: 12px;
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
.popnote {
  font-size: 14px;
  color: var(--text-dim);
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

/* 外卡只負責標題與外框，內容全在兩張小卡裡 */
.outer {
  padding: var(--sp-4);
}
/* 只有一列，不需要跟上面兩張一樣厚。
   ★內距的覆寫一定要排除 .title，不然標題卡會被撐得比上面兩張寬 */
.rate {
  /* 只有上下變薄：左右要跟上面兩張一樣，不然標題卡會比它們往左凸出去 */
  padding: var(--sp-2) var(--sp-4);
}
.rate .inner:not(.title) {
  padding: var(--sp-2) var(--sp-3);
}
.ratesplit {
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
}
/* 這張卡的標題是一個圖示，不是字：直書對它沒有意義，也不需要字距。
   svg 預設是 inline，會帶基線留白而看起來偏下，改成 block 才真的置中 */
.title.icon {
  writing-mode: horizontal-tb;
  letter-spacing: normal;
  color: var(--text-dim);
}
.title.icon svg {
  display: block;
}
.rate .rnote {
  color: var(--text-dim);
}
.rate .rlabel {
  width: 64px;
}
/* 商城報價通常只有一個位數，欄位不必跟旁邊一樣長。
   ★寫成 input.shopinput：權重要壓過後面的 .rval，不然 190px 會蓋回來 */
input.shopinput {
  width: 72px;
  margin-left: 30px;
}
/* 分隔線：它只是把兩件事分開，不該比任何一邊顯眼 */
.sep {
  flex: none;
  color: var(--text-faint);
  opacity: 0.6;
}
/* 換算結果是算出來的，用跟其他算出來的數字同一個顏色。
   左邊用一條分隔線跟單位隔開 */
.shoprate {
  color: var(--warn);
  font-weight: 600;
}
.viplabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dim);
}
/* 標題那張小卡只吃它自己的寬度（auto），其餘平分。stretch 讓每一欄一樣高，
   一邊比另一邊矮會看起來像沒寫完 */
.split {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-3);
  align-items: stretch;
  /* 四張小卡都是兩列，高度自然一致，不必再撐 */
}
/* 視窗窄到各欄塞不下時，標題留在左邊、右邊的內容疊成上下 */
@media (max-width: 900px) {
  .split {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .title {
    grid-row: 1 / -1;
  }
}
.inner {
  display: flex;
  flex-direction: column;
  padding: var(--sp-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
/* 標題直排：兩個字上下疊，小卡就只要一個字寬，橫向全留給數字。
   ★用 grid 置中而不是沿用 .inner 的 flex：直書時 flex 的主軸會跟著轉向，
   column 會變成橫的。
   ★三張標題卡要一樣寬，所以任何針對某一張大卡的 .inner 規則都不能蓋到它。 */
.title,
.rate .title {
  /* 寬度寫死：三張標題卡裝的東西不一樣（兩個字 vs 一個圖示），
     交給內容決定的話彼此會差幾個像素 */
  width: 32px;
  display: grid;
  place-items: center;
  writing-mode: vertical-rl;
  padding: var(--sp-3) 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-strong);
  background: var(--wash);
}
/* 標題那張小卡只吃它自己的寬度（auto），其餘平分。stretch 讓每一欄一樣高，
   一邊比另一邊矮會看起來像沒寫完 */
.split {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--sp-3);
  align-items: stretch;
  /* 四張小卡都是兩列，高度自然一致，不必再撐 */
}
/* 視窗窄到各欄塞不下時，標題留在左邊、右邊的內容疊成上下 */
@media (max-width: 900px) {
  .split {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .title {
    grid-row: 1 / -1;
  }
}
.inner {
  display: flex;
  flex-direction: column;
  padding: var(--sp-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
/* 標題直排：兩個字上下疊，小卡就只要一個字寬，橫向全留給數字。
   ★用 grid 置中而不是沿用 .inner 的 flex：直書時 flex 的主軸會跟著轉向，
   column 會變成橫的。
   ★三張標題卡要一樣寬，所以任何針對某一張大卡的 .inner 規則都不能蓋到它。 */
.title,
.rate .title {
  /* 寬度寫死：三張標題卡裝的東西不一樣（兩個字 vs 一個圖示），
     交給內容決定的話彼此會差幾個像素 */
  width: 32px;
  display: grid;
  place-items: center;
  writing-mode: vertical-rl;
  padding: var(--sp-3) 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-strong);
  background: var(--wash);
}
/* 兩張卡的內容用同一組規則：列高、欄寬、字級都一致，左右才對得起來 */
.rows {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--sp-3);
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
/* 結果那側的標籤到五個字（可販售楓幣），輸入那側四個字。
   共用一個寬度的話，不是短的那邊空一大段，就是長的那邊擠出來。
   列高與字級仍然一致，所以兩側的列還是對齊的。 */
.results .rlabel {
  width: 84px;
}
/* 190px 是想要的寬度，不是硬性的：欄位窄的時候讓它縮，
   不然固定寬度會把內容推出卡片外面 */
.rval {
  width: 190px;
  flex: 0 1 auto;
  min-width: 0;
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
