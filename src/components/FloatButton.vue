<script setup lang="ts">
import { ref } from "vue";
import type { FloatPanelControls } from "../float";

/**
 * 每個有浮動視窗的功能頁，下方那一排都長一樣：一顆開關按鈕，滑鼠停上去才出現透明度拉桿。
 * 三頁共用同一支，位置與行為才不會各自漂走。
 *
 * 只吃面板的開關與透明度——這支不碰資料，所以不需要知道面板送的是什麼型別。
 */
defineProps<{
  panel: FloatPanelControls;
  /** 關著的時候提示這個面板能看到什麼 */
  hint: string;
}>();

/** 拉桿是否展開。跟 panel.open（面板本身開著沒有）是兩回事 */
const opacityOpen = ref(false);
</script>

<template>
  <!-- 拉桿掛在按鈕底下，滑鼠從按鈕滑到拉桿上不能斷，所以兩者共用同一個 hover 容器 -->
  <div class="floatctl" @mouseenter="opacityOpen = true" @mouseleave="opacityOpen = false">
    <button
      :class="{ primary: panel.open.value }"
      :title="panel.open.value ? '關閉浮動視窗' : hint"
      @click="panel.toggle()"
    >
      浮動視窗
    </button>

    <div v-if="opacityOpen" class="opacity-wrap">
      <div class="opacity">
        <span class="olabel">透明度</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          :value="Math.round(panel.opacity.value * 100)"
          aria-label="透明度"
          @input="panel.setOpacity(Number(($event.target as HTMLInputElement).value) / 100)"
        />
        <span class="oval">{{ Math.round(panel.opacity.value * 100) }}%</span>

        <span class="divider"></span>

        <!-- 底色調很淡時字會吃到遊戲背景，描邊是那時候救回可讀性的開關 -->
        <span class="olabel">文字描邊</span>
        <button
          class="switch"
          role="switch"
          :class="{ on: panel.outline.value }"
          :aria-checked="panel.outline.value"
          @click="panel.setOutline(!panel.outline.value)"
        ></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.floatctl {
  position: relative;
}
/* 外層貼著按鈕底緣，視覺間距用 padding 撐——中間留真空的話，
   滑鼠往下移的瞬間就會離開 hover 區，拉桿在碰到之前就收起來了 */
.opacity-wrap {
  position: absolute;
  bottom: 100%;
  right: 0;
  z-index: 30;
  padding-bottom: 6px;
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
.divider {
  width: 1px;
  height: 20px;
  background: var(--border-strong);
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
</style>
