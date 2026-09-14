<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import TimerCard from "../components/TimerCard.vue";
import { useBurnStore, type TimerId } from "../stores/burn";
import { ringing } from "../alarm";
import { hotkeyFromEvent } from "../hotkey";
import { burnPanel } from "../float";

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

onMounted(() => window.addEventListener("keydown", onKeyDown, true));
onUnmounted(() => window.removeEventListener("keydown", onKeyDown, true));

/** 透明度拉桿只在滑鼠停在「浮動視窗」那顆按鈕上時出現 */
const opacityOpen = ref(false);
</script>

<template>
  <div class="page">
    <div class="body">
      <!-- 出租是這一頁的主軸（客戶的錢），佔滿一整列；兩顆技能是它底下的操作 -->
      <TimerCard id="rental" :recording="recording === 'rental'" @record="onRecord">
        <template #head>
          <button v-if="ringing" class="primary" @click="store.acknowledge()">停止提醒</button>
          <div
            class="floatctl"
            @mouseenter="opacityOpen = true"
            @mouseleave="opacityOpen = false"
          >
            <button
              :class="{ primary: burnPanel.open.value }"
              :title="
                burnPanel.open.value ? '關閉浮動視窗' : '開一個永遠置頂的小視窗，遊戲中也看得到倒數'
              "
              @click="burnPanel.toggle()"
            >
              浮動視窗
            </button>

            <div v-if="opacityOpen" class="opacity-wrap">
              <div class="opacity">
                <span class="olabel">透明度</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  :value="Math.round(burnPanel.opacity.value * 100)"
                  aria-label="透明度"
                  @input="
                    burnPanel.setOpacity(Number(($event.target as HTMLInputElement).value) / 100)
                  "
                />
                <span class="oval">{{ Math.round(burnPanel.opacity.value * 100) }}%</span>
              </div>
            </div>
          </div>
        </template>
      </TimerCard>

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
/* 透明度拉桿掛在按鈕底下，滑鼠從按鈕滑到拉桿上不能斷，所以兩者共用同一個 hover 容器 */
.floatctl {
  position: relative;
}
/* 外層貼著按鈕底緣（top:100%），視覺間距用 padding 撐——中間留真空的話，
   滑鼠往下移的瞬間就會離開 hover 區，拉桿在碰到之前就收起來了 */
.opacity-wrap {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 30;
  padding-top: 6px;
}
.opacity {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 8px 12px;
  background: var(--popover);
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  backdrop-filter: blur(28px) saturate(1.8);
}
.opacity input[type="range"] {
  width: 116px;
}
.olabel {
  font-size: 14px;
  color: var(--text-dim);
  white-space: nowrap;
}
.oval {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  width: 40px;
  text-align: right;
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
</style>
