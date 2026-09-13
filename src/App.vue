<script setup lang="ts">
import { computed, ref } from "vue";
import AppTitlebar from "./components/AppTitlebar.vue";
import AppNavbar from "./components/AppNavbar.vue";
import { NAV } from "./nav";

const TAB_KEY = "kz-maplestory:tab";

const maximized = ref(false);
const active = ref(NAV[0].id);
try {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved && NAV.some((n) => n.id === saved)) active.value = saved;
} catch {
  /* 讀不到就開第一頁 */
}

const activeView = computed(() => NAV.find((n) => n.id === active.value)?.view ?? NAV[0].view);

function onTab(id: string) {
  active.value = id;
  try {
    localStorage.setItem(TAB_KEY, id);
  } catch {
    /* 存不了就只在這次執行有效 */
  }
}
</script>

<template>
  <div class="app" :class="{ maxed: maximized }">
    <AppTitlebar title="久世管理器" v-model:maximized="maximized" />

    <AppNavbar :model-value="active" @update:model-value="onTab" />

    <!-- 分頁切走時把元件留著（計時器不能因為換頁就停），所以用 keep-alive -->
    <main class="content">
      <KeepAlive>
        <component :is="activeView" />
      </KeepAlive>
    </main>
  </div>
</template>

<style scoped>
/* 圓角視窗：Win10 沒有 DWM 圓角，靠 transparent 視窗 + 這裡的 radius 畫。
   corner-shape 把角換成超橢圓（連續曲率），才是 macOS 的角；border-radius 是正圓弧。
   參數走 superellipse(1.5)（指數約 2.8）而不是 squircle（指數 4）——後者太方，
   16px 半徑下幾乎看不出圓角。不支援 corner-shape 的環境會忽略它，退回正圓弧。
   最大化時要收掉，不然螢幕四角會透出桌面。 */
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
  border-radius: var(--radius-window);
  corner-shape: superellipse(1.5);
  overflow: hidden;
}
.app.maxed {
  border-radius: 0;
}

.content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
