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
 * 兩個 webview 是同時載入的，這一聲可能比主視窗的監聽器還早到，所以問到有人回應為止。
 *
 * ★判斷「有人回應」而不是「有資料」：一隻角色都沒開的時候回來的本來就是空清單，
 * 拿長度當條件會變成永遠問下去。
 */
const answered = ref(false);

function keepAskingUntilAnswered() {
  progressPanel.sayHello();
  hello = window.setInterval(() => {
    if (answered.value) {
      if (hello !== null) clearInterval(hello);
      hello = null;
      return;
    }
    progressPanel.sayHello();
  }, 1000);
}

onMounted(async () => {
  stopData = await progressPanel.onData((r) => {
    rows.value = r;
    answered.value = true;
  });
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
      <p v-if="!rows.length" class="hint">在主頁的設定裡選要顯示的角色</p>
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
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層。
   ★整塊的尺寸都是 em，而字級綁在視窗寬度上（360px 寬＝16px 字），
   所以拖大拖小是整體等比縮放，不是版面重排。 */
.float {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  user-select: none;
  font-size: calc(100vw / 360 * 16);
}
.bg {
  position: absolute;
  inset: 0;
  background: var(--bg-1);
  border: 1px solid var(--window-edge);
  border-radius: 0.9em;
  corner-shape: superellipse(1.5);
}
.hint {
  font-size: 0.8em;
  color: var(--text-dim);
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9);
  padding: 0.3em 0.2em;
}

.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.4em 0.7em;
}
.row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
}
/* 角色圖是去背 PNG，底下不鋪色 */
.portrait {
  width: 2.9em;
  height: 2.9em;
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
  /* 角色圖是去背的，底色一淡就少了襯底——描一圈暗影讓它自己浮出來 */
  filter: drop-shadow(0 0 0.12em rgba(0, 0, 0, 0.9));
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.06em;
}
/* 底色可以淡到 0，所以字得自己站得住：描一圈暗影，疊在任何遊戲畫面上都讀得到 */
.name {
  font-size: 0.95em;
  font-weight: 700;
  color: var(--text);
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: 0.75em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
.today {
  font-size: 1.2em;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
</style>
