<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { formatMeso, mesoTextInWords } from "./money";
import { moneyPanel, type MoneyInput, type MoneySnap } from "./float";

const appWin = getCurrentWindow();
const opacity = ref(0.5);
const face = ref<number | null>(null);
const net = ref<number | null>(null);

/**
 * 欄位的文字自己留一份，但那不是另一份狀態：主視窗才是唯一的來源，這裡只是它的回音。
 * 之所以不直接綁快照，是因為正在打字的那一欄不能被回來的快照覆寫——
 * 打到一半被蓋掉的話游標會跳回去。
 */
const text = ref<Record<MoneyInput["field"], string>>({ ntd: "", meso: "", rate: "" });
const focused = ref<MoneyInput["field"] | null>(null);

let stopData: (() => void) | null = null;
let stopOpacity: (() => void) | null = null;

function apply(snap: MoneySnap) {
  face.value = snap.face;
  net.value = snap.net;
  const incoming: Record<MoneyInput["field"], string> = {
    ntd: snap.ntd,
    meso: snap.meso,
    rate: snap.rate,
  };
  for (const field of ["ntd", "meso", "rate"] as const) {
    if (field !== focused.value) text.value[field] = incoming[field];
  }
}

/** 實收欄打的是 W，但談價講的是幾億幾萬——同一個數字的另一種講法，附在欄位下面 */
const netInWords = computed(() => mesoTextInWords(text.value.meso));

function edit(field: MoneyInput["field"], e: Event) {
  const value = (e.target as HTMLInputElement).value;
  text.value[field] = value;
  moneyPanel.sendInput({ field, value });
}

onMounted(async () => {
  stopData = await moneyPanel.connect(apply);
  stopOpacity = await moneyPanel.onOpacity((v) => (opacity.value = v));
});
onUnmounted(() => {
  stopData?.();
  stopOpacity?.();
});

function onDown(e: MouseEvent) {
  if (e.button !== 0) return;
  // 欄位以外的地方都能拖。只留頂端那一條的話抓不到——它太細，
  // 而這個視窗大部分面積都不是欄位。欄位本身要留給打字與選字。
  if ((e.target as HTMLElement).closest("input")) return;
  void appWin.startDragging();
}
</script>

<template>
  <div class="float" @mousedown="onDown">
    <!-- 透明度只吃這一層底：整塊調的話字會跟著淡，蓋在遊戲上就看不清了 -->
    <div class="bg" :style="{ opacity }"></div>

    <!-- 看得見的拖曳提示。真正吃拖曳的是欄位以外的整塊，這裡只是告訴人可以抓 -->
    <div class="grip" title="拖曳可移動">
      <i></i>
    </div>

    <div class="rows">
      <label class="row">
        <span class="label">幣值</span>
        <input
          type="text"
          inputmode="decimal"
          spellcheck="false"
          placeholder="2800"
          :value="text.rate"
          @focus="focused = 'rate'"
          @blur="focused = null"
          @input="edit('rate', $event)"
        />
        <span class="unit">萬</span>
      </label>

      <label class="row">
        <span class="label">楓幣</span>
        <input
          type="text"
          inputmode="decimal"
          spellcheck="false"
          placeholder="0"
          :value="text.meso"
          @focus="focused = 'meso'"
          @blur="focused = null"
          @input="edit('meso', $event)"
        />
        <!-- 一長串零看不出是多少，換個講法接在欄位右邊 -->
        <span class="echo">{{ netInWords }}</span>
      </label>

      <label class="row">
        <span class="label">台幣</span>
        <input
          type="text"
          inputmode="decimal"
          spellcheck="false"
          placeholder="0"
          :value="text.ntd"
          @focus="focused = 'ntd'"
          @blur="focused = null"
          @input="edit('ntd', $event)"
        />
        <span class="unit">元</span>
      </label>

      <!-- 算出來的兩個數字：整行淡下去，一眼分得出哪些可改、哪些是結果 -->
      <div class="row muted">
        <span class="label">交易</span>
        <span class="derived">{{ face === null ? "—" : formatMeso(face) }}</span>
        <span class="unit"></span>
      </div>

      <div class="row muted">
        <span class="label">實收</span>
        <span class="derived">{{ net === null ? "—" : formatMeso(net) }}</span>
        <span class="unit"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層。
   ★整塊的尺寸都是 em，而字級綁在視窗寬度上（360px 寬＝19px 字），
   所以拖大拖小是整體等比縮放，不是版面重排。 */
.float {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  user-select: none;
  font-size: calc(100vw / 360 * 19);
}
.bg {
  position: absolute;
  inset: 0;
  background: var(--bg-1);
  border: 1px solid var(--window-edge);
  border-radius: 0.9em;
  corner-shape: superellipse(1.5);
}

.grip {
  position: relative;
  height: 1.4em;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}
.grip:active {
  cursor: grabbing;
}
/* 一條短橫線就夠了：它只要看起來像「這裡可以抓」 */
.grip i {
  width: 2.4em;
  height: 0.2em;
  border-radius: 0.1em;
  background: var(--text-faint);
}

.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 1em 0.5em;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 0.6em;
  height: 1.95em;
}
/* 底色可以淡到 0，所以字得自己站得住：描一圈暗影，疊在任何遊戲畫面上都讀得到 */
.label,
.unit,
.derived,
.row input {
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
.label {
  width: 2.5em;
  flex: none;
  font-size: 0.82em;
  color: var(--text-dim);
}
/* 數字靠右對齊成一直行，單位在外面：三個數字才比得起來 */
.row input,
.derived {
  flex: 1;
  min-width: 0;
  font-size: 1.05em;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 欄位平常看不出是欄位——碰到才浮出底色。疊在遊戲上，三個框會比數字還搶眼 */
.row input {
  height: 1.6em;
  padding: 0 0.4em;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.35em;
  user-select: text;
}
.row input:hover:not(:focus) {
  background: var(--wash-strong);
}
.row input:focus {
  background: var(--input-bg);
  border-color: var(--accent);
  box-shadow: none;
}
.unit {
  width: 1.5em;
  flex: none;
  font-size: 0.82em;
  color: var(--text-dim);
}
/* 同一個數字換個講法。是附註不是第二個數字，所以比欄位淡 */
.echo {
  width: 4.6em;
  flex: none;
  font-size: 0.82em;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
/* 交易楓幣那一行：位置跟上面三行一樣，只是整行退到背景 */
.row.muted {
  height: 1.5em;
}
.row.muted .label,
.row.muted .derived {
  font-size: 0.82em;
  font-weight: 600;
  color: var(--text-dim);
}
.row.muted .derived {
  /* 對齊上面三個欄位的文字，而不是欄位的框 */
  padding-right: 0.4em;
}
</style>
