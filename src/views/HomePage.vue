<script setup lang="ts">
/**
 * 主頁：角色狀態。
 *
 * 兩張卡＝兩個角色欄位，之後接上遊戲的角色資料（等級、經驗）後兩邊可以對照，
 * 也是日後那個「練等進度」浮動視窗的資料來源。現在還沒有資料來源，
 * 所以先把版面與空狀態立起來——欄位長什麼樣，接資料時才知道要塞什麼。
 */
interface Slot {
  id: string;
  label: string;
  hint: string;
}

const SLOTS: Slot[] = [
  { id: "main", label: "主角色", hint: "你自己的練等進度" },
  { id: "rival", label: "對照角色", hint: "拿來比較的另一隻" },
];
</script>

<template>
  <div class="page">
    <div class="body">
      <article v-for="s in SLOTS" :key="s.id" class="card slot">
        <div class="head">
          <span class="name">{{ s.label }}</span>
          <span class="hint">{{ s.hint }}</span>
          <div class="spacer"></div>
          <button disabled title="等資料來源接上之後才會開放">選擇角色</button>
        </div>

        <div class="stats">
          <div class="stat">
            <span class="slabel">等級</span>
            <span class="sval">—</span>
          </div>
          <div class="stat">
            <span class="slabel">經驗</span>
            <span class="sval">—</span>
          </div>
          <div class="stat grow">
            <span class="slabel">本次上線增加</span>
            <span class="sval">—</span>
          </div>
        </div>

        <div class="bar"><i style="width: 0%"></i></div>
        <p class="pending">尚未連接資料來源</p>
      </article>
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

.slot {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
}
.head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}
.name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
  flex: none;
}
.hint {
  font-size: 14px;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats {
  display: flex;
  align-items: baseline;
  gap: var(--sp-6);
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.stat.grow {
  flex: 1;
}
.slabel {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-faint);
}
.sval {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--text-faint);
}

.bar {
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wash-strong);
  overflow: hidden;
}
.bar > i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}
.pending {
  font-size: 14px;
  color: var(--text-faint);
}
</style>
