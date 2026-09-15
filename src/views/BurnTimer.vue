<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import TimerCard from "../components/TimerCard.vue";
import { useBurnStore, type TimerId } from "../stores/burn";
import { ringing } from "../alarm";
import { hotkeyFromEvent } from "../hotkey";
import { burnPanel } from "../float";
import FloatButton from "../components/FloatButton.vue";

const store = useBurnStore();

/** 正在錄按鍵的那張卡；同時只會有一張 */
const recording = ref<TimerId | null>(null);
/** 設定模式：只用來改兩顆技能的基本時間 */
const editMode = ref(false);

/** 進設定＝要動技能的基本時間，那兩個先歸零再讓人改（出租不動，見 store 的說明） */
function toggleEdit() {
  if (!editMode.value) store.resetEditable();
  editMode.value = !editMode.value;
}

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
</script>

<template>
  <div class="page">
    <div class="body">
      <div class="scroller">
        <!-- 出租是這一頁的主軸（客戶的錢），佔滿一整列 -->
        <TimerCard
          id="rental"
          :editing="editMode"
          :recording="recording === 'rental'"
          @record="onRecord"
        />

        <div class="pair">
          <TimerCard
            id="reincarnation"
            compact
            :editing="editMode"
            :recording="recording === 'reincarnation'"
            @record="onRecord"
          />
          <TimerCard
            id="burning"
            compact
            :editing="editMode"
            :recording="recording === 'burning'"
            @record="onRecord"
          />
        </div>

        <!-- 加持是同一個模板生出來的，要幾張就開幾張 -->
        <div v-if="store.blessings.length" class="pair">
          <TimerCard
            v-for="b in store.blessings"
            :key="b.id"
            :id="b.id"
            compact
            :editing="editMode"
            :recording="recording === b.id"
            @record="onRecord"
          />
        </div>
      </div>

      <div class="pagebar">
        <button v-if="ringing" class="primary" @click="store.acknowledge()">停止提醒</button>
        <button @click="store.addBlessing()">＋ 新增加持</button>
        <div class="spacer"></div>
        <FloatButton :panel="burnPanel" hint="開一個永遠置頂的小視窗，遊戲中也看得到倒數" />

        <!-- 設定模式：兩顆技能的基本時間平常不該被誤觸，收在這裡面 -->
        <button
          class="gear"
          :class="{ primary: editMode }"
          :title="editMode ? '完成' : '設定基本時間'"
          @click="toggleEdit()"
        >
          {{ editMode ? "完成" : "設定" }}
        </button>
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
/* 跟主頁同一個骨架：body 不捲，捲的是裡面那層，最底下那排按鈕固定看得到 */
.body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  /* 捲軸走在這段留白上，所以它在卡片外面的右邊 */
  padding-right: 12px;
}
.pagebar {
  flex: none;
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
