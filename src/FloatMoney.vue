<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { formatMeso } from "./money";
import { moneyPanel, type MoneySnap } from "./float";

const appWin = getCurrentWindow();
const snap = ref<MoneySnap>({ ntd: "", mesoW: "", rate: "", face: null });
const opacity = ref(0.5);

let hello: number | null = null;
let stopData: (() => void) | null = null;
let stopOpacity: (() => void) | null = null;

/** 兩個 webview 同時載入，這一聲可能比主視窗的監聽器還早到，所以問到有人回應為止 */
const answered = ref(false);

function keepAskingUntilAnswered() {
  moneyPanel.sayHello();
  hello = window.setInterval(() => {
    if (answered.value) {
      if (hello !== null) clearInterval(hello);
      hello = null;
      return;
    }
    moneyPanel.sayHello();
  }, 1000);
}

onMounted(async () => {
  stopData = await moneyPanel.onData((d) => {
    snap.value = d;
    answered.value = true;
  });
  stopOpacity = await moneyPanel.onOpacity((v) => (opacity.value = v));
  keepAskingUntilAnswered();
});
onUnmounted(() => {
  stopData?.();
  stopOpacity?.();
  if (hello !== null) clearInterval(hello);
});

function onDown(e: MouseEvent) {
  if (e.button !== 0) return;
  void appWin.startDragging();
}
</script>

<template>
  <div class="float" @mousedown="onDown" title="拖曳可移動；開關與透明度在幣值換算頁的「浮動視窗」按鈕">
    <!-- 透明度只吃這一層底：整塊調的話字會跟著淡，蓋在遊戲上就看不清了 -->
    <div class="bg" :style="{ opacity }"></div>

    <div class="rows">
      <div class="row">
        <span class="label">匯率</span>
        <span class="val">{{ snap.rate || "—" }}</span>
        <span class="unit">W／元</span>
      </div>
      <div class="row">
        <span class="label">台幣</span>
        <span class="val">{{ snap.ntd || "—" }}</span>
        <span class="unit">元</span>
      </div>
      <div class="row">
        <span class="label">實收</span>
        <span class="val">{{ snap.mesoW || "—" }}</span>
        <span class="unit">W</span>
      </div>
      <p class="face">帳面 {{ snap.face === null ? "—" : formatMeso(snap.face) }}</p>
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
  user-select: none;
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

.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3em;
  padding: 0.5em 0.9em;
}
.row {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
/* 底色可以淡到 0，所以字得自己站得住：描一圈暗影，疊在任何遊戲畫面上都讀得到 */
.label,
.val,
.unit,
.face {
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
.label {
  width: 2.6em;
  flex: none;
  font-size: 0.8em;
  color: var(--text-dim);
}
.val {
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
.unit {
  width: 3.4em;
  flex: none;
  font-size: 0.75em;
  color: var(--text-dim);
}
.face {
  font-size: 0.75em;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  text-align: right;
  padding-right: 3.9em;
}
</style>
