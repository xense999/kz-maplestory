<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { SPECS, useBurnStore, type TimerId } from "../stores/burn";
import { ringing, stopAlarm, testBeep } from "../alarm";
import { accelFromEvent, accelLabel } from "../hotkey";

const store = useBurnStore();

/** 正在錄快捷鍵的那張卡；null＝沒有人在錄 */
const recording = ref<TimerId | null>(null);

function beginRecord(id: TimerId) {
  recording.value = recording.value === id ? null : id;
}

// 錄製時整個視窗的鍵盤都要攔下來，不然按 F5 之類會先被 WebView 吃掉
function onKeyDown(e: KeyboardEvent) {
  if (recording.value === null) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    recording.value = null;
    return;
  }
  const accel = accelFromEvent(e);
  if (!accel) return;
  void store.setHotkey(recording.value, accel);
  recording.value = null;
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
  void store.initHotkeys();
});
onUnmounted(() => window.removeEventListener("keydown", onKeyDown, true));

function clock(ms: number) {
  const t = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function state(id: TimerId): "idle" | "running" | "soon" | "due" {
  const left = store.remaining(id);
  if (left === null) return "idle";
  if (left <= 0) return "due";
  if (left <= 30_000) return "soon";
  return "running";
}

/** 已跑掉的比例；到期後滿格 */
function progress(id: TimerId) {
  const left = store.remaining(id);
  if (left === null) return 0;
  return Math.min(1, Math.max(0, 1 - left / store.spec(id).durationMs));
}

function label(id: TimerId) {
  const left = store.remaining(id);
  if (left === null) return clock(store.spec(id).durationMs);
  return clock(left);
}
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <span class="toolbar-title">輪燒計時器</span>
      <div class="spacer"></div>
      <button v-if="ringing" class="primary" @click="stopAlarm()">停止提醒</button>
      <button class="plain" title="試聽提醒音" @click="testBeep()">試聽</button>
    </header>

    <div class="body">
      <article v-for="s in SPECS" :key="s.id" class="card timer" :class="state(s.id)">
        <div class="head">
          <span class="name">{{ s.label }}</span>
          <span class="hint">{{ s.hint }}</span>
          <div class="spacer"></div>

          <!-- 快捷鍵：錄製→顯示鍵名→開關。開關預設關，因為註冊下去那顆鍵遊戲就收不到了 -->
          <div class="hk">
            <button
              class="keycap"
              :class="{ rec: recording === s.id }"
              :title="recording === s.id ? '按下要用的鍵（Esc 取消）' : '點一下改快捷鍵'"
              @click="beginRecord(s.id)"
            >
              {{ recording === s.id ? "按下按鍵…" : accelLabel(store.timers[s.id].hotkey) }}
            </button>
            <label class="onoff" :title="store.timers[s.id].hotkeyOn ? '這顆鍵目前被本程式接走，遊戲收不到' : '啟用後這顆鍵會從遊戲手上接走'">
              <input
                class="switch"
                type="checkbox"
                :checked="store.timers[s.id].hotkeyOn"
                @change="store.setHotkeyEnabled(s.id, ($event.target as HTMLInputElement).checked)"
              />
              <span>啟用</span>
            </label>
          </div>
        </div>

        <div class="main">
          <div class="digits">{{ label(s.id) }}</div>
          <div class="tail">
            <span v-if="state(s.id) === 'due'" class="due-tag">時間到，該放了</span>
            <span v-else-if="state(s.id) === 'idle'" class="idle-tag">尚未起算</span>
            <div class="acts">
              <button class="primary" @click="store.start(s.id)">
                {{ state(s.id) === "idle" ? "開始" : "重新計時" }}
              </button>
              <button :disabled="state(s.id) === 'idle'" @click="store.reset(s.id)">歸零</button>
            </div>
          </div>
        </div>

        <div class="bar"><i :style="{ width: progress(s.id) * 100 + '%' }"></i></div>

        <p v-if="store.timers[s.id].error" class="err">{{ store.timers[s.id].error }}</p>
      </article>
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
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.timer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}
.head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.name {
  font-size: 18px;
  font-weight: 700;
}
.hint {
  font-size: 14px;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hk {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: none;
}
/* 鍵帽：看得出來是「一顆鍵」，錄製中換成強調色好認 */
.keycap {
  height: 30px;
  min-width: 76px;
  padding: 0 12px;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-sm);
}
.keycap.rec {
  color: var(--text-on-accent);
  background: var(--accent);
  box-shadow: var(--ring);
}
.onoff {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  color: var(--text-dim);
  cursor: pointer;
}

.main {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-4);
}
/* 倒數是這張卡唯一的主角，其他都退成灰 */
.digits {
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.tail {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding-bottom: 4px;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: var(--sp-2);
}
.due-tag {
  font-size: 15px;
  font-weight: 600;
  color: var(--danger);
}
.idle-tag {
  font-size: 15px;
  color: var(--text-faint);
}

.bar {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wash-strong);
  overflow: hidden;
}
.bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.25s linear;
}

/* 狀態只改該提醒的那一點，不整張換皮 */
.timer.idle .digits {
  color: var(--text-faint);
}
.timer.soon .digits {
  color: var(--warn);
}
.timer.soon .bar > i {
  background: var(--warn);
}
.timer.due {
  box-shadow: 0 0 0 1.5px var(--danger), var(--shadow-1);
}
.timer.due .digits {
  color: var(--danger);
}
.timer.due .bar > i {
  background: var(--danger);
}

.err {
  font-size: 14px;
  color: var(--danger);
}
</style>
