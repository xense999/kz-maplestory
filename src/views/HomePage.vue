<script setup lang="ts">
import { nextTick, ref } from "vue";
import { progressPanel } from "../float";
import { slotList, useRosterStore, type SlotId } from "../stores/roster";

/**
 * 主頁：一張大卡片裝著上下兩張小卡——上面是自己、下面是拿來比較的那隻。
 * 資料與更新排程都在 roster store，這一頁只負責顯示與輸入。
 */
const roster = useRosterStore();

/** 正在改名字的那一格；其他時候名字是純文字，不是一個輸入框 */
const editing = ref<SlotId | null>(null);
/** 透明度拉桿只在滑鼠停在那顆按鈕上時出現 */
const opacityOpen = ref(false);

async function beginEdit(id: SlotId) {
  editing.value = id;
  await nextTick();
  const el = document.querySelector<HTMLInputElement>(`[data-slot="${id}"] input.who`);
  el?.focus();
  el?.select();
}

function commitName(id: SlotId, value: string) {
  editing.value = null;
  void roster.setName(id, value);
}

/** 成長量：沒資料是破折號，有就帶正負號 */
function delta(v?: number | null) {
  if (v === undefined || v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
</script>

<template>
  <div class="page">
    <div class="body">
      <div class="pagebar">
        <div class="spacer"></div>
        <div class="floatctl" @mouseenter="opacityOpen = true" @mouseleave="opacityOpen = false">
          <button
            :class="{ primary: progressPanel.open.value }"
            :title="
              progressPanel.open.value
                ? '關閉浮動視窗'
                : '開一個永遠置頂的小視窗，遊戲中也看得到進度'
            "
            @click="progressPanel.toggle()"
          >
            浮動視窗
          </button>

          <div v-if="opacityOpen" class="opacity-wrap">
            <div class="opacity">
              <span class="olabel">透明度</span>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                :value="Math.round(progressPanel.opacity.value * 100)"
                aria-label="透明度"
                @input="
                  progressPanel.setOpacity(Number(($event.target as HTMLInputElement).value) / 100)
                "
              />
              <span class="oval">{{ Math.round(progressPanel.opacity.value * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 外面一張大卡片，裡面上下兩張小卡：兩隻角色是拿來對照的，所以收在同一張卡裡，
           但各自要有自己的邊界，不然兩段資料會糊成一片 -->
      <section class="card outer">
        <div v-for="s in slotList" :key="s.id" class="inner" :data-slot="s.id">
          <!-- 角色圖是去背 PNG，框裡不上底色 -->
          <div class="portrait">
            <img
              v-if="roster.slots[s.id].info?.imageUrl"
              :src="roster.slots[s.id].info!.imageUrl"
              :alt="s.label"
            />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.8 20c0-3.4 3.2-5.4 7.2-5.4s7.2 2 7.2 5.4" stroke-linecap="round" />
            </svg>
          </div>

          <div class="detail">
            <div class="head">
              <!-- 直接就是角色名：這一列是誰，看名字就好，不必再標「主角色／對照角色」 -->
              <input
                v-if="editing === s.id || !roster.slots[s.id].name"
                class="who"
                type="text"
                :value="roster.slots[s.id].name"
                placeholder="角色名稱"
                spellcheck="false"
                @keydown.enter="commitName(s.id, ($event.target as HTMLInputElement).value)"
                @blur="commitName(s.id, ($event.target as HTMLInputElement).value)"
              />
              <button v-else class="who-text" title="點一下改角色" @click="beginEdit(s.id)">
                {{ roster.slots[s.id].name }}
              </button>

              <span v-if="roster.slots[s.id].info?.world" class="world">
                {{ roster.slots[s.id].info!.world }}
              </span>
              <div class="spacer"></div>
              <button
                class="sm"
                :disabled="roster.slots[s.id].loading || !roster.slots[s.id].name"
                @click="roster.refresh(s.id)"
              >
                更新
              </button>
            </div>

            <div class="stats">
              <div class="stat">
                <span class="slabel">等級</span>
                <span class="sval">{{ roster.slots[s.id].info?.level ?? "—" }}</span>
              </div>
              <div class="stat">
                <span class="slabel">經驗</span>
                <span class="sval">
                  {{
                    roster.slots[s.id].info
                      ? `${roster.slots[s.id].info!.expPercent.toFixed(2)}%`
                      : "—"
                  }}
                </span>
              </div>
              <div class="stat" title="今天 00:00 到現在總共練了多少（一級算 100%）">
                <span class="slabel">今天練了</span>
                <span class="sval gain">{{ delta(roster.slots[s.id].growth?.today) }}</span>
              </div>
              <div class="stat" title="這次打開程式到現在練了多少（關掉程式就重新算）">
                <span class="slabel">本次開機</span>
                <span class="sval gain small">
                  {{ delta(roster.slots[s.id].growth?.session) }}
                </span>
              </div>
            </div>

            <div class="bar">
              <i :style="{ width: (roster.slots[s.id].info?.expPercent ?? 0) + '%' }"></i>
            </div>

            <p v-if="roster.slots[s.id].error" class="note err">{{ roster.slots[s.id].error }}</p>
            <p v-else-if="!roster.slots[s.id].name" class="note">
              填入角色名稱後每 10 分鐘自動更新
            </p>
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
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.pagebar {
  display: flex;
  align-items: center;
}

/* 拉桿掛在按鈕底下，滑鼠從按鈕滑到拉桿上不能斷，所以兩者共用同一個 hover 容器 */
.floatctl {
  position: relative;
}
.opacity-wrap {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 30;
  padding-top: 6px;
}
.opacity {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 8px 12px;
  background: var(--popover);
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  backdrop-filter: blur(28px) saturate(1.8);
}
.opacity input[type="range"] {
  width: 116px;
}
.olabel {
  font-size: 14px;
  color: var(--text-dim);
  white-space: nowrap;
}
.oval {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  width: 40px;
  text-align: right;
}

.outer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3);
}
.inner {
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-4);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.portrait {
  width: 96px;
  height: 96px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
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
.who {
  width: 180px;
  height: 32px;
  font-size: 16px;
}
/* 已經設定好的名字：看起來是文字，不是欄位 */
.who-text {
  height: 32px;
  padding: 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-strong);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
}
.who-text:hover:not(:disabled) {
  background: var(--hover);
}
.world {
  font-size: 14px;
  color: var(--text-faint);
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
.slabel {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-faint);
}
.gain {
  color: var(--text-dim);
}
.sval {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.sval.small {
  font-size: 20px;
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
