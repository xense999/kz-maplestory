<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

defineProps<{ title: string }>();

const appWin = getCurrentWindow();
const maximized = defineModel<boolean>("maximized", { default: false });

const syncMaximized = async () => {
  maximized.value = await appWin.isMaximized();
};

// 拖曳不走 data-tauri-drag-region，直接自己呼叫 startDragging：
// 那個屬性要靠 runtime 去比對事件目標，視窗設定一改（無邊框＋透明）就不好查
// 為什麼失效；明著呼叫的話行為看得見、也擋得掉視窗鈕。
function onTitlebarDown(e: MouseEvent) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement | null)?.closest("button")) return;
  void appWin.startDragging();
}
function onTitlebarDblClick(e: MouseEvent) {
  if ((e.target as HTMLElement | null)?.closest("button")) return;
  void appWin.toggleMaximize();
}

let unlisten: (() => void) | null = null;
onMounted(async () => {
  await syncMaximized();
  unlisten = await appWin.onResized(syncMaximized);
});
onUnmounted(() => unlisten?.());
</script>

<template>
  <div class="titlebar" @mousedown="onTitlebarDown" @dblclick="onTitlebarDblClick">
    <span class="tb-brand">{{ title }}</span>
    <div class="tb-spacer"></div>

    <div class="win-controls">
      <button class="wbtn" @click="appWin.minimize()" title="最小化">
        <svg class="wico" viewBox="0 0 10 10"><rect x="1.5" y="4.7" width="7" height="0.8" rx="0.4" /></svg>
      </button>
      <button class="wbtn" @click="appWin.toggleMaximize()" title="最大化">
        <svg class="wico" viewBox="0 0 10 10">
          <rect x="1.8" y="1.8" width="6.4" height="6.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="0.9" />
        </svg>
      </button>
      <button class="wbtn close" @click="appWin.close()" title="關閉">
        <svg class="wico" viewBox="0 0 10 10">
          <path d="M2.4 2.4 7.6 7.6M7.6 2.4 2.4 7.6" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 齒輪浮層是掛在標題列裡往下開的，而側欄／內容區在 DOM 上排在後面：
   同層級時後畫的會蓋掉先畫的，所以標題列整條要自己抬到上面來。 */
.titlebar {
  position: relative;
  z-index: 20;
  height: 44px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 var(--sp-4);
  background: var(--bg-1);
  border-bottom: 0.5px solid var(--border);
  backdrop-filter: blur(24px) saturate(1.8);
  user-select: none;
}
.tb-brand {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
}
.tb-spacer {
  flex: 1;
  height: 100%;
}

.win-controls {
  display: flex;
  gap: 2px;
}
.wbtn {
  border: none;
  width: 42px;
  height: 30px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  border-radius: var(--radius-xs);
  color: var(--text-dim);
}
.wbtn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--text);
}
.wbtn.close:hover:not(:disabled) {
  background: var(--danger);
  color: #fff;
}
.wico {
  width: 11px;
  height: 11px;
  fill: currentColor;
  display: block;
}
</style>
