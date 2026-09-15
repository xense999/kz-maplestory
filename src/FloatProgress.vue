<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { progressPanel, type CharacterSnap } from "./float";

const appWin = getCurrentWindow();
const rows = ref<CharacterSnap[]>([]);
const opacity = ref(0.5);
/** 文字描邊：底色調很淡時，沒有描邊會吃到遊戲背景 */
const outline = ref(false);

let stopData: (() => void) | null = null;
let stopLook: (() => void) | null = null;

onMounted(async () => {
  stopData = await progressPanel.connect((r) => (rows.value = r));
  stopLook = await progressPanel.onLook((look) => {
    opacity.value = look.opacity;
    outline.value = look.outline;
  });
});
onUnmounted(() => {
  stopData?.();
  stopLook?.();
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
  return `${v < 0 ? "" : "+"}${v.toFixed(2)}%`;
}
</script>

<template>
  <!-- 沒有標題列也沒有關閉鈕：開關只在主視窗那顆按鈕上，所以整塊都是拖曳區 -->
  <div class="float" :class="{ outline }" @mousedown="onDown" title="拖曳可移動；開關與透明度在主頁的「浮動視窗」按鈕">
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
          <!-- 疊在遊戲上時，一條長條比百分比數字更快讀得懂「快滿了沒」 -->
          <div class="bar"><i :style="{ width: (r.expPercent ?? 0) + '%' }"></i></div>
        </div>
        <span class="today">{{ gain(r.today) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層。
   ★整塊的尺寸都是 em，而字級綁在視窗寬度上（392px 寬＝16px 字），
   所以拖大拖小是整體等比縮放，不是版面重排。 */
.float {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: calc(100vw / 392 * 16);
}
/* 描邊：底色調很淡時字會吃到遊戲背景，開起來就讀得回來。
   加在整塊上而不是逐個元素，之後新增的文字自動吃得到 */
.float.outline {
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
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
  padding: 0.3em 0.2em;
}

.rows {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.55em 0.8em;
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
/* 底色可以淡到 0，所以要讀得清楚就得把底拉高一點——字本身不加陰影 */
.name {
  font-size: 0.95em;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  font-size: 0.75em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
/* 底色可以淡到 0，所以軌道要自己夠深，填色才看得出來停在哪 */
.bar {
  height: 0.3em;
  margin-top: 0.18em;
  border-radius: 0.15em;
  background: rgba(0, 0, 0, 0.55);
  box-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9);
  overflow: hidden;
}
.bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.3s ease;
}

.today {
  font-size: 1.2em;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
