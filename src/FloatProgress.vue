<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { progressPanel, type CharacterSnap } from "./float";

const appWin = getCurrentWindow();
const rows = ref<CharacterSnap[]>([]);
const opacity = ref(0.5);

let hello: number | null = null;
let stopData: (() => void) | null = null;
let stopOpacity: (() => void) | null = null;

/**
 * 兩個 webview 是同時載入的，這一聲可能比主視窗的監聽器還早到，
 * 所以問到有資料為止（跟輪燒面板同一個理由）。
 */
function keepAskingUntilAnswered() {
  progressPanel.sayHello();
  hello = window.setInterval(() => {
    if (rows.value.length) {
      if (hello !== null) clearInterval(hello);
      hello = null;
      return;
    }
    progressPanel.sayHello();
  }, 1000);
}

onMounted(async () => {
  stopData = await progressPanel.onData((r) => (rows.value = r));
  stopOpacity = await progressPanel.onOpacity((v) => (opacity.value = v));
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

function pct(v: number | null) {
  return v === null ? "—" : `${v.toFixed(2)}%`;
}

function gain(v: number | null) {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
</script>

<template>
  <!-- 沒有標題列也沒有關閉鈕：開關只在主視窗那顆按鈕上，所以整塊都是拖曳區 -->
  <div class="float" @mousedown="onDown" title="拖曳可移動；開關與透明度在主頁的「浮動視窗」按鈕">
    <!-- 透明度只吃這一層底：整塊調的話字會跟著淡，蓋在遊戲上就看不清了 -->
    <div class="bg" :style="{ opacity }"></div>

    <div class="rows">
      <div v-for="r in rows" :key="r.slot" class="row">
        <div class="portrait">
          <img v-if="r.imageUrl" :src="r.imageUrl" :alt="r.name" />
        </div>
        <div class="text">
          <span class="name">{{ r.name || "未設定" }}</span>
          <span class="sub">Lv.{{ r.level ?? "—" }} · {{ pct(r.expPercent) }}</span>
        </div>
        <span class="today">{{ gain(r.today) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層 */
.float {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  user-select: none;
}
.bg {
  position: absolute;
  inset: 0;
  background: var(--bg-1);
  border: 1px solid var(--window-edge);
  border-radius: var(--radius-lg);
  corner-shape: superellipse(1.5);
}
.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
}
.row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
/* 角色圖是去背 PNG，底下不鋪色 */
.portrait {
  width: 40px;
  height: 40px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.portrait img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: 12px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.today {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
