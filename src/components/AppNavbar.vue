<script setup lang="ts">
import { NAV } from "../nav";

const active = defineModel<string>({ required: true });
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
.navtab {
  border: none;
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
  border: 1px solid var(--border-strong);
}
</style>
