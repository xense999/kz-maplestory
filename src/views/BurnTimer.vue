<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import TimerCard from "../components/TimerCard.vue";
import { SPECS, useBurnStore, type TimerId } from "../stores/burn";
import { ringing, stopAlarm, testBeep } from "../alarm";
import { hotkeyFromEvent } from "../hotkey";
import { openFloatWindow } from "../float";

const store = useBurnStore();

/** 正在錄按鍵的那張卡；同時只會有一張 */
const recording = ref<TimerId | null>(null);

function onRecord(id: TimerId) {
  recording.value = recording.value === id ? null : id;
}

// 錄製時整個視窗的鍵盤都要先攔下來，不然 F5 之類會被 WebView 自己吃掉
function onKeyDown(e: KeyboardEvent) {
  if (recording.value === null) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    recording.value = null;
    return;
  }
  const hk = hotkeyFromEvent(e);
  if (!hk) return;
  void store.setHotkey(recording.value, hk);
  recording.value = null;
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
  void store.init();
});
onUnmounted(() => window.removeEventListener("keydown", onKeyDown, true));

const dueCount = computed(
  () => SPECS.filter((s) => (store.remaining(s.id) ?? 1) <= 0).length,
);
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <span class="toolbar-title">輪燒計時器</span>
      <span v-if="dueCount" class="badge over">{{ dueCount }} 個到期</span>
      <div class="spacer"></div>
      <button v-if="ringing" class="primary" @click="stopAlarm()">停止提醒</button>
      <button class="plain" title="開一個永遠置頂的小視窗，遊戲中也看得到倒數" @click="openFloatWindow()">
        浮動視窗
      </button>
      <button class="plain" title="試聽提醒音" @click="testBeep()">試聽</button>
    </header>

    <div class="body">
      <!-- 出租是這一頁的主軸（客戶的錢），佔滿一整列；兩顆技能是它底下的操作 -->
      <TimerCard id="rental" :recording="recording === 'rental'" @record="onRecord" />

      <div class="pair">
        <TimerCard
          id="reincarnation"
          compact
          :recording="recording === 'reincarnation'"
          @record="onRecord"
        />
        <TimerCard id="burning" compact :recording="recording === 'burning'" @record="onRecord" />
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
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}
/* 視窗窄到兩欄各自塞不下按鍵那一組時，就疊回一欄 */
@media (max-width: 980px) {
  .pair {
    grid-template-columns: 1fr;
  }
}
.badge.over {
  color: var(--danger);
  background: hsl(3 100% 59% / 0.14);
  font-weight: 600;
}
</style>
