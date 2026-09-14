<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { apiKey } from "../apikey";
import {
  fetchCharacter,
  names,
  setName,
  REFRESH_MS,
  type CharacterInfo,
} from "../character";

/**
 * 主頁：一張大卡片裝著上下兩個角色欄位——上面是自己、下面是拿來比較的那隻。
 * 資料每 10 分鐘更新一次，還沒接上來源之前顯示的是空欄位。
 */
const SLOTS = [
  { id: "main", label: "主角色" },
  { id: "rival", label: "對照角色" },
];

const info = ref<Record<string, CharacterInfo | null>>({ main: null, rival: null });
const errors = ref<Record<string, string>>({});
const loading = ref<Record<string, boolean>>({});
/** 上一次更新的時刻，畫面上寫「幾分鐘前」用的 */
const lastAt = ref<Record<string, number>>({});
const now = ref(Date.now());

async function refresh(slot: string) {
  const name = names.value[slot];
  if (!name) {
    errors.value = { ...errors.value, [slot]: "" };
    return;
  }
  if (!apiKey.value) {
    errors.value = { ...errors.value, [slot]: "設定頁還沒填 API 金鑰" };
    return;
  }
  loading.value = { ...loading.value, [slot]: true };
  try {
    const got = await fetchCharacter(name, apiKey.value);
    info.value = { ...info.value, [slot]: got };
    lastAt.value = { ...lastAt.value, [slot]: got.fetchedAt };
    errors.value = { ...errors.value, [slot]: "" };
  } catch (e) {
    errors.value = { ...errors.value, [slot]: String(e instanceof Error ? e.message : e) };
  } finally {
    loading.value = { ...loading.value, [slot]: false };
  }
}

function refreshAll() {
  for (const s of SLOTS) void refresh(s.id);
}

let timer: number | null = null;
let tick: number | null = null;

onMounted(() => {
  refreshAll();
  timer = window.setInterval(refreshAll, REFRESH_MS);
  // 「幾分鐘前」要會自己往前走，不然看起來像卡住了
  tick = window.setInterval(() => (now.value = Date.now()), 30_000);
});
onUnmounted(() => {
  if (timer !== null) clearInterval(timer);
  if (tick !== null) clearInterval(tick);
});

function ago(slot: string) {
  const at = lastAt.value[slot];
  if (!at) return "尚未更新";
  const m = Math.floor((now.value - at) / 60_000);
  return m <= 0 ? "剛剛更新" : `${m} 分鐘前更新`;
}

function fmt(n?: number) {
  return n === undefined ? "—" : n.toLocaleString("zh-TW");
}
</script>

<template>
  <div class="page">
    <div class="body">
      <section class="card outer">
        <div v-for="(s, i) in SLOTS" :key="s.id" class="inner" :class="{ sep: i > 0 }">
          <!-- 左：角色圖。沒資料時是一個空的框，版面不會因為抓到沒抓到而跳動 -->
          <div class="portrait">
            <img v-if="info[s.id]?.imageUrl" :src="info[s.id]!.imageUrl" :alt="s.label" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.8 20c0-3.4 3.2-5.4 7.2-5.4s7.2 2 7.2 5.4" stroke-linecap="round" />
            </svg>
          </div>

          <div class="detail">
            <div class="head">
              <span class="slot-label">{{ s.label }}</span>
              <input
                class="who"
                type="text"
                :value="names[s.id] ?? ''"
                placeholder="角色名稱"
                spellcheck="false"
                @change="setName(s.id, ($event.target as HTMLInputElement).value)"
              />
              <span v-if="info[s.id]?.job" class="job">{{ info[s.id]!.job }}</span>
              <div class="spacer"></div>
              <span class="when">{{ loading[s.id] ? "更新中…" : ago(s.id) }}</span>
              <button class="sm" :disabled="loading[s.id]" @click="refresh(s.id)">更新</button>
            </div>

            <div class="stats">
              <div class="stat">
                <span class="slabel">等級</span>
                <span class="sval">{{ info[s.id] ? info[s.id]!.level : "—" }}</span>
              </div>
              <div class="stat">
                <span class="slabel">經驗</span>
                <span class="sval">
                  {{ info[s.id] ? `${info[s.id]!.expPercent.toFixed(2)}%` : "—" }}
                </span>
              </div>
              <div class="stat grow">
                <span class="slabel">累積經驗值</span>
                <span class="sval small">{{ fmt(info[s.id]?.exp) }}</span>
              </div>
            </div>

            <div class="bar">
              <i :style="{ width: (info[s.id]?.expPercent ?? 0) + '%' }"></i>
            </div>

            <p v-if="errors[s.id]" class="note err">{{ errors[s.id] }}</p>
            <p v-else-if="!names[s.id]" class="note">填入角色名稱後每 10 分鐘自動更新</p>
          </div>
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
}

/* 一張大卡片裝兩個角色，中間一條線分開——兩隻是拿來對照的，不該是兩張各自獨立的卡 */
.outer {
  display: flex;
  flex-direction: column;
}
.inner {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-4);
}
.inner.sep {
  border-top: 1px solid var(--border);
}

.portrait {
  width: 96px;
  height: 96px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  color: var(--text-faint);
}
.portrait img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
.portrait svg {
  width: 40px;
  height: 40px;
}

.detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.slot-label {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-strong);
  flex: none;
}
.who {
  width: 160px;
  height: 30px;
  font-size: 15px;
}
.job {
  font-size: 14px;
  color: var(--text-faint);
}
.when {
  font-size: 13px;
  color: var(--text-faint);
  white-space: nowrap;
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
}
.sval.small {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-dim);
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
  transition: width 0.3s ease;
}

.note {
  font-size: 13px;
  color: var(--text-faint);
}
.note.err {
  color: var(--danger);
}
</style>
