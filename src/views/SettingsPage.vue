<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { setTheme, themePref, type ThemePref } from "../theme";

const THEMES: { id: ThemePref; label: string; hint: string }[] = [
  { id: "light", label: "淺色", hint: "固定淺色" },
  { id: "dark", label: "深色", hint: "固定深色" },
  { id: "system", label: "自動", hint: "跟隨 Windows 的設定" },
];

const version = ref("");
onMounted(async () => {
  version.value = await getVersion();
});
</script>

<template>
  <div class="page">
    <div class="body">
      <section class="card block">
        <h2 class="btitle">外觀</h2>
        <div class="row">
          <div class="rlabel">
            <span class="rname">主題</span>
            <span class="rhint">浮動視窗不受這裡影響，它固定深色</span>
          </div>
          <div class="seg">
            <button
              v-for="t in THEMES"
              :key="t.id"
              :class="{ on: themePref === t.id }"
              :title="t.hint"
              @click="setTheme(t.id)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
      </section>

      <section class="card block">
        <h2 class="btitle">關於</h2>
        <div class="row">
          <div class="rlabel">
            <span class="rname">久世管理器</span>
            <span class="rhint">楓之谷輪燒計時工具</span>
          </div>
          <span class="ver">v{{ version }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.block {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.btitle {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  min-height: 34px;
}
.rlabel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.rname {
  font-size: 16px;
  font-weight: 600;
}
.rhint {
  font-size: 14px;
  color: var(--text-faint);
}
.ver {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}
</style>
