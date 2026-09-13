<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onTimersSync, sayHello, type TimerSnap } from "./float";

const appWin = getCurrentWindow();
const snaps = ref<TimerSnap[]>([]);
const now = ref(Date.now());

let tick: number | null = null;
let stopSync: (() => void) | null = null;

onMounted(async () => {
  stopSync = await onTimersSync((s) => (snaps.value = s));
  sayHello();
  tick = window.setInterval(() => (now.value = Date.now()), 250);
});
onUnmounted(() => {
  stopSync?.();
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
  <div class="float" @mousedown="onDown">
    <div class="bar">
      <span class="title">久世管理器</span>
      <div class="spacer"></div>
      <button class="close" title="收起浮動視窗" @click="appWin.hide()">
        <svg viewBox="0 0 10 10" width="9" height="9">
          <path d="M2.4 2.4 7.6 7.6M7.6 2.4 2.4 7.6" fill="none" stroke="currentColor"
                stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="rows">
      <div v-for="s in snaps" :key="s.id" class="row" :class="state(s)">
        <span class="label">{{ s.label.replace("計時器", "") }}</span>
        <span class="time">{{ clock(s) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，所以底色壓深一點、字給滿——不追求跟主視窗一樣的層次感 */
.float {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-1);
  border: 1px solid var(--window-edge);
  border-radius: var(--radius-lg);
  corner-shape: superellipse(1.5);
  user-select: none;
  overflow: hidden;
}
/* 標題自成一條，跟下面的讀數區分開：底色與文字色都換掉，
   不然縮到這個尺寸時整塊看起來只是一團字 */
.bar {
  flex: none;
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 6px 0 10px;
  background: var(--bg-2);
  border-bottom: 0.5px solid var(--border);
}
.title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--accent);
}
/* 三行平均吃掉剩下的高度，行距就不必手調 */
.rows {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 10px;
}
.spacer {
  flex: 1;
}
.close {
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  color: var(--text-dim);
  border-radius: var(--radius-pill);
}
.close:hover {
  background: var(--danger);
  color: #fff;
}

.row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  font-size: 13px;
  color: var(--text-dim);
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
