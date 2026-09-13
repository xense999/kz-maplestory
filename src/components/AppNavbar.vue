<script setup lang="ts">
import { NAV } from "../nav";

const active = defineModel<string>({ required: true });

defineProps<{ settingsOpen: boolean }>();
const emit = defineEmits<{ toggleSettings: [] }>();
</script>

<template>
  <div class="navbar">
    <nav class="navtabs">
      <button
        v-for="n in NAV"
        :key="n.id"
        class="navtab"
        :class="{ on: active === n.id }"
        :title="n.hint"
        @click="active = n.id"
      >
        {{ n.label }}
      </button>
    </nav>

    <div class="spacer"></div>

    <!-- 設定跟功能頁是同一層的東西（都是「現在看的是哪一頁」），所以放同一排，
         只是靠右擺，跟左邊那組分開 -->
    <button
      class="navtab"
      :class="{ on: settingsOpen }"
      title="設定"
      @click="emit('toggleSettings')"
    >
      設定
    </button>
  </div>
</template>

<style scoped>
.navbar {
  height: 60px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 0 var(--sp-4);
  background: var(--bg-0);
  border-bottom: 0.5px solid var(--border);
}
/* 分頁彼此是平行關係，不是一個值的幾個檔位，所以不共用 segmented 軌道：
   各自獨立的膠囊、彼此留空隙，選中的那顆才浮起來。 */
.navtabs {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.navtabs::-webkit-scrollbar {
  display: none;
}
/* 沒選到的分頁也要有自己的框：只有選中那顆有框的話，其他分頁看起來像純文字。
   線用得比控制項淡一級——分頁不是要人去按的按鈕，是「你在哪一頁」的指示。 */
.navtab {
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  height: 38px;
  gap: 8px;
  padding: 0 18px;
  flex: none;
  font-weight: 600;
  color: var(--text-dim);
  background: transparent;
  box-shadow: none;
}
.navtab:hover:not(.on) {
  background: var(--hover);
  color: var(--text);
}
.navtab.on {
  color: var(--text);
  background: var(--bg-1);
  border-color: var(--accent);
}
</style>
