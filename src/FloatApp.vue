<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onFloatOpacity, onTimersSync, sayHello, type TimerSnap } from "./float";

const appWin = getCurrentWindow();
const snaps = ref<TimerSnap[]>([]);
const now = ref(Date.now());
const opacity = ref(1);

let tick: number | null = null;
let stopSync: (() => void) | null = null;
let stopOpacity: (() => void) | null = null;

onMounted(async () => {
  stopSync = await onTimersSync((s) => (snaps.value = s));
  stopOpacity = await onFloatOpacity((v) => (opacity.value = v));
  sayHello();
  tick = window.setInterval(() => (now.value = Date.now()), 250);
});
onUnmounted(() => {
  stopSync?.();
  stopOpacity?.();
  if (tick !== null) clearInterval(tick);
});

function onDown(e: MouseEvent) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement | null)?.closest("button")) return;
  void appWin.startDragging();
}

function clock(s: TimerSnap) {
  const ms = s.endAt === null ? s.durationMs : s.endAt - now.value;
  // 到期停在 00:00，不往上加
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function state(s: TimerSnap) {
  if (s.endAt === null) return "idle";
  const left = s.endAt - now.value;
  if (left <= 0) return "due";
  if (left <= 30_000) return "soon";
  return "running";
}
</script>

<template>
  <!-- 沒有標題列也沒有關閉鈕：開關一律在主視窗那顆「浮動視窗」按鈕上，
       所以整塊都是拖曳區 -->
  <div
    class="float"
    @mousedown="onDown"
    title="拖曳可移動；開關與透明度在主視窗的「浮動視窗」按鈕"
  >
    <!-- 透明度只吃這一層底：整塊調 opacity 的話字會跟著淡，蓋在遊戲上就看不清了 -->
    <div class="bg" :style="{ opacity }"></div>

    <div class="rows">
      <div v-for="s in snaps" :key="s.id" class="row" :class="state(s)">
        <span class="label">{{ s.label.replace("計時器", "") }}</span>
        <span class="time">{{ clock(s) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層：
   .bg 負責底色與邊框（透明度只調它），字永遠 100% 不透明 */
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
/* 三行平均吃掉剩下的高度，行距就不必手調 */
.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 4px 12px;
}

.row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}
.time {
  margin-left: auto;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.row.idle .time {
  color: var(--text-faint);
}
.row.soon .time {
  color: var(--warn);
}
.row.due .time {
  color: var(--danger);
}
</style>
