<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { themePref, setTheme, type ThemePref } from "../theme";

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
  if ((e.target as HTMLElement | null)?.closest("button, .popover")) return;
  void appWin.startDragging();
}
function onTitlebarDblClick(e: MouseEvent) {
  if ((e.target as HTMLElement | null)?.closest("button, .popover")) return;
  void appWin.toggleMaximize();
}

// ── 設定（標題列最左那顆齒輪）──
const settingsOpen = ref(false);
const settingsEl = ref<HTMLElement | null>(null);
function onDocPointerDown(e: PointerEvent) {
  if (!settingsOpen.value) return;
  if (!settingsEl.value?.contains(e.target as Node)) settingsOpen.value = false;
}

const THEMES: { id: ThemePref; label: string; title: string }[] = [
  { id: "light", label: "淺色", title: "固定淺色" },
  { id: "dark", label: "深色", title: "固定深色" },
  { id: "system", label: "自動", title: "跟隨系統" },
];

let unlisten: (() => void) | null = null;
onMounted(async () => {
  await syncMaximized();
  unlisten = await appWin.onResized(syncMaximized);
  document.addEventListener("pointerdown", onDocPointerDown);
});
onUnmounted(() => {
  unlisten?.();
  document.removeEventListener("pointerdown", onDocPointerDown);
});
</script>

<template>
  <div class="titlebar" @mousedown="onTitlebarDown" @dblclick="onTitlebarDblClick">
    <div class="settings" ref="settingsEl">
      <button class="gear" :class="{ on: settingsOpen }" title="設定" @click="settingsOpen = !settingsOpen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      <div v-if="settingsOpen" class="popover">
        <div class="pop-arrow"></div>
        <div class="pop-title">外觀</div>
        <div class="seg themeseg">
          <button
            v-for="t in THEMES"
            :key="t.id"
            :class="{ on: themePref === t.id }"
            :title="t.title"
            @click="setTheme(t.id)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </div>

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

/* 設定：標題列最左一顆齒輪，外觀等全域設定都收在它底下的浮層裡 */
.settings {
  position: relative;
  flex: none;
}
.gear {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  border-radius: var(--radius-pill);
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

.popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 60;
  width: 240px;
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--popover);
  border-radius: var(--radius-lg);
  corner-shape: superellipse(1.5);
  box-shadow: var(--shadow-pop);
  backdrop-filter: blur(28px) saturate(1.8);
  animation: pop-in 0.14s ease-out;
}
@keyframes pop-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
.pop-arrow {
  position: absolute;
  top: -5px;
  left: 12px;
  width: 12px;
  height: 12px;
  background: inherit;
  transform: rotate(45deg);
  border-radius: 2px;
}
.pop-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-faint);
  letter-spacing: 0.04em;
}
.themeseg {
  width: 100%;
}
.themeseg > button {
  flex: 1;
  padding: 0 6px;
}

.win-controls {
  display: flex;
  gap: 2px;
}
.wbtn {
  width: 42px;
  height: 30px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  border-radius: var(--radius-pill);
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
