<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { formatMeso } from "./money";
import { moneyPanel, type MoneyInput, type MoneySnap } from "./float";

const appWin = getCurrentWindow();
const opacity = ref(0.5);
const face = ref<number | null>(null);

/**
 * 欄位的文字自己留一份，但那不是另一份狀態：主視窗才是唯一的來源，這裡只是它的回音。
 * 之所以不直接綁快照，是因為正在打字的那一欄不能被回來的快照覆寫——
 * 打到一半被蓋掉的話游標會跳回去。
 */
const text = ref<Record<MoneyInput["field"], string>>({ ntd: "", mesoW: "", rate: "" });
const focused = ref<MoneyInput["field"] | null>(null);

let stopData: (() => void) | null = null;
let stopOpacity: (() => void) | null = null;

function apply(snap: MoneySnap) {
  face.value = snap.face;
  const incoming: Record<MoneyInput["field"], string> = {
    ntd: snap.ntd,
    mesoW: snap.mesoW,
    rate: snap.rate,
  };
  for (const field of ["ntd", "mesoW", "rate"] as const) {
    if (field !== focused.value) text.value[field] = incoming[field];
  }
}

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
  void appWin.startDragging();
}
</script>

<template>
  <div class="float">
    <!-- 透明度只吃這一層底：整塊調的話字會跟著淡，蓋在遊戲上就看不清了 -->
    <div class="bg" :style="{ opacity }"></div>

    <!-- 只有這一條能拖：整塊都吃拖曳的話，點下面的欄位就變成搬視窗了 -->
    <div class="grip" title="拖曳可移動" @mousedown="onDown">
      <i></i>
    </div>

    <div class="rows">
      <label class="row">
        <span class="label">匯率</span>
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
        <span class="unit">W／元</span>
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

      <label class="row">
        <span class="label">實收</span>
        <input
          type="text"
          inputmode="decimal"
          spellcheck="false"
          placeholder="0"
          :value="text.mesoW"
          @focus="focused = 'mesoW'"
          @blur="focused = null"
          @input="edit('mesoW', $event)"
        />
        <span class="unit">W</span>
      </label>

      <p class="face">帳面 {{ face === null ? "—" : formatMeso(face) }}</p>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層。
   ★整塊的尺寸都是 em，而字級綁在視窗寬度上（320px 寬＝16px 字），
   所以拖大拖小是整體等比縮放，不是版面重排。 */
.float {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: calc(100vw / 320 * 16);
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
  height: 1.1em;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
}
.grip:active {
  cursor: grabbing;
}
/* 一條短橫線就夠了：它只要看起來像「這裡可以抓」 */
.grip i {
  width: 2.2em;
  height: 0.18em;
  border-radius: 0.09em;
  background: var(--text-faint);
}

.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3em;
  padding: 0.2em 0.9em 0.5em;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
/* 底色可以淡到 0，所以字得自己站得住：描一圈暗影，疊在任何遊戲畫面上都讀得到 */
.label,
.unit,
.face {
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
.label {
  width: 2.6em;
  flex: none;
  font-size: 0.8em;
  color: var(--text-dim);
  user-select: none;
}
/* 欄位跟著視窗縮放，所以尺寸一律是 em，不能吃全域那套固定 px */
.row input {
  flex: 1;
  min-width: 0;
  height: 1.7em;
  padding: 0 0.5em;
  font-size: 1.05em;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-align: right;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: 0.35em;
}
.row input:focus {
  border-color: var(--accent);
  box-shadow: none;
}
.unit {
  width: 3.4em;
  flex: none;
  font-size: 0.75em;
  color: var(--text-dim);
  user-select: none;
}
.face {
  font-size: 0.75em;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding-right: 3.9em;
  user-select: none;
}
</style>
