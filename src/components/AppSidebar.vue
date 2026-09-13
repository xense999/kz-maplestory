<script setup lang="ts">
import { NAV } from "../nav";

const active = defineModel<string>({ required: true });
</script>

<template>
  <nav class="sidebar">
    <div class="sb-title">功能</div>
    <button
      v-for="n in NAV"
      :key="n.id"
      class="sbitem"
      :class="{ on: active === n.id }"
      :title="n.hint"
      @click="active = n.id"
    >
      <svg class="sbico" viewBox="0 0 16 16" fill="none" stroke="currentColor"
           stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <path v-for="(d, i) in n.icon" :key="i" :d="d" />
      </svg>
      <span class="sblabel">{{ n.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* macOS 側欄：半透明底、無邊框，選中的那列是一塊填色圓角，不是整條反白 */
.sidebar {
  width: 188px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sp-2) 10px var(--sp-3);
  background: var(--sidebar);
  border-right: 0.5px solid var(--border);
  backdrop-filter: blur(24px) saturate(1.8);
  overflow-y: auto;
}
.sb-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-faint);
  letter-spacing: 0.04em;
  padding: 0 8px;
  height: 30px;
  display: flex;
  align-items: center;
}
.sbitem {
  height: 34px;
  width: 100%;
  gap: 9px;
  padding: 0 8px;
  justify-content: flex-start;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-dim);
  background: transparent;
  box-shadow: none;
  /* 同心圓角：側欄內距 10 起算，列的圓角收到 --radius 這一級 */
  border-radius: var(--radius);
}
.sbitem:hover:not(.on) {
  background: var(--hover);
  color: var(--text);
}
.sbitem.on {
  color: var(--text);
  font-weight: 600;
  background: var(--select);
}
.sbico {
  width: 17px;
  height: 17px;
  flex: none;
  opacity: 0.66;
}
.sbitem:hover .sbico,
.sbitem.on .sbico {
  opacity: 1;
}
.sblabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
