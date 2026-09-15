<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";

defineProps<{ title: string; settingsOpen: boolean }>();
const emit = defineEmits<{ toggleSettings: [] }>();

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
    <button
      class="gear"
      :class="{ on: settingsOpen }"
      :title="settingsOpen ? '回到功能頁' : '設定'"
      @click="emit('toggleSettings')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>

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
  padding: 0 8px;
  background: var(--bg-1);
  border-bottom: 0.5px solid var(--border);
  backdrop-filter: blur(24px) saturate(1.8);
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

/* 設定：標題列最左一顆齒輪，按下去整個內容區換成設定頁（不是浮層） */
.gear {
  border: none;
  width: 32px;
  height: 32px;
  padding: 0;
  flex: none;
  background: transparent;
  box-shadow: none;
  border-radius: var(--radius-xs);
  color: var(--text-dim);
}
.gear:hover:not(:disabled) {
  background: var(--hover);
  color: var(--text);
}
.gear.on {
  background: var(--accent-soft);
  color: var(--accent);
}
.gear svg {
  width: 18px;
  height: 18px;
  display: block;
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
