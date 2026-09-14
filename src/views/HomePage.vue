<script setup lang="ts">
import { nextTick, ref } from "vue";
import { progressPanel } from "../float";
import { useRosterStore } from "../stores/roster";

/**
 * 主頁：一張大卡片裝著上下兩張小卡——上面是自己、下面是拿來比較的那隻。
 * 資料與更新排程都在 roster store，這一頁只負責顯示與輸入。
 */
const roster = useRosterStore();

/** 正在改名字的那一格；其他時候名字是純文字，不是一個輸入框 */
const editing = ref<string | null>(null);
/** 透明度拉桿只在滑鼠停在那顆按鈕上時出現 */
const opacityOpen = ref(false);
/** 設定模式：平常這一頁只是看數字，按了設定才會出現增刪與顯示開關 */
const editMode = ref(false);

async function beginEdit(id: string) {
  editing.value = id;
  await nextTick();
  const el = document.querySelector<HTMLInputElement>(`[data-slot="${id}"] input.who`);
  el?.focus();
  el?.select();
}

function commitName(id: string, value: string) {
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
      <!-- 外面一張大卡片，裡面上下兩張小卡：兩隻角色是拿來對照的，所以收在同一張卡裡，
           但各自要有自己的邊界，不然兩段資料會糊成一片 -->
      <section class="card outer">
        <div v-for="s in roster.slots" :key="s.id" class="inner" :data-slot="s.id">
          <!-- 角色圖是去背 PNG，框裡不上底色 -->
          <div class="portrait">
            <img v-if="s.info?.imageUrl" :src="s.info.imageUrl" :alt="s.name" />
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
              <circle cx="12" cy="8.5" r="3.6" />
              <path d="M4.8 20c0-3.4 3.2-5.4 7.2-5.4s7.2 2 7.2 5.4" stroke-linecap="round" />
            </svg>
          </div>

          <div class="detail">
            <div class="head">
              <!-- 直接就是角色名：這一列是誰，看名字就好，不必再標「主角色／對照角色」 -->
              <input
                v-if="editMode && (editing === s.id || !s.name)"
                class="who"
                type="text"
                :value="s.name"
                placeholder="角色名稱"
                spellcheck="false"
                @keydown.enter="commitName(s.id, ($event.target as HTMLInputElement).value)"
                @blur="commitName(s.id, ($event.target as HTMLInputElement).value)"
              />
              <button
                v-else
                class="who-text"
                :disabled="!editMode"
                :title="editMode ? '點一下改角色' : ''"
                @click="beginEdit(s.id)"
              >
                {{ s.name || "未設定" }}
              </button>

              <span v-if="s.info?.world" class="badge world" title="伺服器">
                {{ s.info.world }}
              </span>
              <div class="spacer"></div>
              <!-- 打開才會出現在浮動視窗上。資料本來就會自己更新，所以這裡不放更新鈕 -->
              <button
                v-if="editMode"
                class="switch"
                role="switch"
                :class="{ on: s.shown }"
                :aria-checked="s.shown"
                :disabled="!s.name"
                :title="s.shown ? '會顯示在浮動視窗上' : '打開後才會顯示在浮動視窗上'"
                @click="roster.setShown(s.id, !s.shown)"
              ></button>
              <button
                v-if="editMode"
                class="plain x"
                title="移除這張卡片"
                @click="roster.removeSlot(s.id)"
              >
                <svg viewBox="0 0 12 12" width="11" height="11">
                  <path d="M3 3 9 9M9 3 3 9" fill="none" stroke="currentColor" stroke-width="1.4"
                        stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <div class="stats">
              <div class="stat">
                <span class="slabel">等級</span>
                <span class="sval">{{ s.info?.level ?? "—" }}</span>
              </div>
              <div class="stat">
                <span class="slabel">經驗</span>
                <span class="sval">
                  {{ s.info ? `${s.info.expPercent.toFixed(2)}%` : "—" }}
                </span>
              </div>
              <div class="stat" title="今天 00:00 到現在總共練了多少（一級算 100%）">
                <span class="slabel">今天練了</span>
                <span class="sval gain">{{ delta(s.growth?.today) }}</span>
              </div>
            </div>

            <div class="bar">
              <i :style="{ width: (s.info?.expPercent ?? 0) + '%' }"></i>
            </div>

            <p v-if="s.error" class="note err">{{ s.error }}</p>
            <p v-else-if="!s.name" class="note">填入角色名稱後每 10 分鐘自動更新</p>
          </div>
        </div>

      </section>

      <div class="pagebar">
        <button v-if="editMode" @click="roster.addSlot()">＋ 新增角色</button>
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
                max="100"
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

        <!-- 設定模式：進去才能增刪角色、改名字、選要不要上浮動視窗 -->
        <button
          class="gear"
          :class="{ primary: editMode }"
          :title="editMode ? '完成設定' : '設定角色'"
          @click="editMode = !editMode"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="editMode">
              <path d="M5 12.5 10 17.5 19 7" />
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </template>
          </svg>
        </button>
      </div>
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
/* 捲動發生在卡片裡，不是整頁：下面那排按鈕要一直看得到 */
.body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.pagebar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

/* 拉桿掛在按鈕底下，滑鼠從按鈕滑到拉桿上不能斷，所以兩者共用同一個 hover 容器 */
.floatctl {
  position: relative;
}
.opacity-wrap {
  position: absolute;
  bottom: 100%;
  right: 0;
  z-index: 30;
  padding-bottom: 6px;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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
  /* 左緣跟下面的「等級／經驗」對齊，不要因為它是按鈕就多一段內距 */
  padding: 0 8px 0 0;
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
/* 伺服器是標籤不是句子：做成徽章。空心＋紫色——填色的話它會跟旁邊的
   控制項搶注意力，而紫色在這一頁沒有別的用途，不會跟狀態色混淆。 */
.gear {
  width: 40px;
  padding: 0;
  flex: none;
}
.who-text:disabled {
  opacity: 1;
  cursor: default;
}
.x {
  width: 26px;
  height: 26px;
  padding: 0;
  flex: none;
}
.world {
  font-size: 13px;
  font-weight: 600;
  color: var(--purple);
  background: transparent;
  border: 1px solid var(--purple);
  padding: 0 7px;
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
