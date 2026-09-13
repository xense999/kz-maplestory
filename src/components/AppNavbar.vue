<script setup lang="ts">
import { NAV } from "../nav";
import { themePref, setTheme, type ThemePref } from "../theme";

const active = defineModel<string>({ required: true });

const THEMES: { id: ThemePref; label: string; title: string }[] = [
  { id: "light", label: "淺", title: "淺色" },
  { id: "dark", label: "深", title: "深色" },
  { id: "system", label: "自動", title: "跟隨系統" },
];
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
        <svg class="navico" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path v-for="(d, i) in n.icon" :key="i" :d="d" />
        </svg>
        {{ n.label }}
      </button>
    </nav>

    <div class="spacer"></div>
    <div class="navsep"></div>

    <div class="seg theme">
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
</template>

<style scoped>
.navbar {
  height: 68px;
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
  height: 40px;
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
  box-shadow: var(--shadow-1);
}
.navico {
  width: 17px;
  height: 17px;
  flex: none;
  opacity: 0.66;
}
.navtab:hover .navico {
  opacity: 0.9;
}
.navtab.on .navico {
  opacity: 1;
}
/* 分頁與外觀切換是兩種東西，中間給一條實線分開 */
.navsep {
  width: 1px;
  height: 24px;
  flex: none;
  background: var(--border-strong);
  opacity: 0.5;
}
/* 外觀＝同一個值的三個檔位，這裡才用 segmented 軌道 */
.theme {
  flex: none;
}
.theme button {
  min-width: 44px;
  font-size: 14px;
}
</style>
