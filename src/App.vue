<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppTitlebar from "./components/AppTitlebar.vue";
import AppNavbar from "./components/AppNavbar.vue";
import SettingsPage from "./views/SettingsPage.vue";
import { NAV } from "./nav";
import { useBurnStore } from "./stores/burn";
import { useRosterStore } from "./stores/roster";

const TAB_KEY = "kz-maplestory:tab";

// 這兩件事都不屬於某一頁：熱鍵要接回上次的設定，角色資料要餵給浮動視窗，
// 綁在頁面的生命週期上的話，停在別頁時它們就沒有在運作
onMounted(() => {
  void useBurnStore().init();
  void useRosterStore().init();
});

const maximized = ref(false);
const showSettings = ref(false);
const active = ref(NAV[0].id);
try {
  const saved = localStorage.getItem(TAB_KEY);
  if (saved && NAV.some((n) => n.id === saved)) active.value = saved;
} catch {
  /* 讀不到就開第一頁 */
}

/* 設定是「另一個畫面」不是浮層，所以跟功能頁走同一個位置；
   KeepAlive 一起包住兩邊，切去設定再切回來時功能頁不必重建。 */
const activeView = computed(() =>
  showSettings.value ? SettingsPage : (NAV.find((n) => n.id === active.value)?.view ?? NAV[0].view),
);

function onTab(id: string) {
  showSettings.value = false;
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
    <AppTitlebar
      title="久世管理器"
      v-model:maximized="maximized"
      :settings-open="showSettings"
      @toggle-settings="showSettings = !showSettings"
    />

    <!-- 設定是離開功能頁的一個獨立畫面，分頁列留著只會讓人以為它是第 N 個分頁 -->
    <AppNavbar v-if="!showSettings" v-model="active" @update:model-value="onTab" />

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
  position: relative;
  /* 視窗圓角半徑對外公開：蓋滿整個視窗的遮罩要照這個收角，
     不然圓角外的透明區會被填成方的 */
  --win-radius: var(--radius-window);
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
  border-radius: var(--radius-window);
  corner-shape: superellipse(1.5);
  overflow: hidden;
}
.app.maxed {
  --win-radius: 0px;
  border-radius: 0;
}

/* 外緣線畫在最上面一層而不是 .app 自己身上：標題列與內容區有自己的底色，
   會把 .app 的 inset 陰影蓋掉。pointer-events 關掉，不然它會吃掉整頁的點擊。
   邊線用 border 不用 inset box-shadow——超橢圓角上 0.5px 的 inset 陰影會被
   抗鋸齒稀釋掉，四個轉角處看起來就是斷的。高光留在 border 內側再疊一層。 */
.app::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 100;
  pointer-events: none;
  border: 1px solid var(--window-edge);
  border-radius: inherit;
  corner-shape: inherit;
  box-shadow: inset 0 1px 0 var(--window-highlight);
}
/* 最大化時四邊貼著螢幕，再描邊只會多一條沒有意義的線 */
.app.maxed::after {
  display: none;
}

.content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
