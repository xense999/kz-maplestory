<script setup lang="ts">
import { nextTick, ref } from "vue";
import { progressPanel } from "../float";
import FloatButton from "../components/FloatButton.vue";
import { useRosterStore } from "../stores/roster";

/**
 * 主頁：一張大卡片裝著一排角色小卡，用來比誰練得快。
 * 資料與更新排程都在 roster store，這一頁只負責顯示與輸入。
 */
const roster = useRosterStore();

/** 正在改名字的那一格；其他時候名字是純文字，不是一個輸入框 */
const editing = ref<string | null>(null);
/** 設定模式：只用來刪卡片。其他事（改名字、開關顯示、新增）平常就能做 */
const editMode = ref(false);

/** 拖曳排序：拿著的是哪一張、現在懸在哪一張上面 */
const dragId = ref<string | null>(null);
const overId = ref<string | null>(null);

function onDrop(id: string) {
  if (editMode.value && dragId.value) roster.moveSlot(dragId.value, id);
  dragId.value = null;
  overId.value = null;
}

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

/** 成長量：沒資料是破折號。0 也帶正號——那是「今天目前為止練了 0」，不是缺資料 */
function delta(v?: number | null) {
  if (v === undefined || v === null) return "—";
  return `${v < 0 ? "" : "+"}${v.toFixed(2)}%`;
}
</script>

<template>
  <div class="page">
    <div class="body">
      <!-- 捲動的是這一層而不是卡片本身：捲軸落在卡片右邊的留白上，不會壓在內容上 -->
      <div class="scroller">
        <!-- 外面一張大卡片，裡面每隻角色一張小卡：它們是拿來對照的，所以收在同一張卡裡，
             但各自要有自己的邊界，不然兩段資料會糊成一片 -->
        <section class="card outer">
        <div
          v-for="s in roster.slots"
          :key="s.id"
          class="inner"
          :class="{ over: overId === s.id && dragId !== s.id, dragging: dragId === s.id }"
          :data-slot="s.id"
          @dragover.prevent="editMode && (overId = s.id)"
          @dragleave="overId === s.id && (overId = null)"
          @drop.prevent="onDrop(s.id)"
        >
          <!-- 排序把手只在設定模式出現：平常這一頁是看數字的，不該一碰就被搬動。
               只有把手可以拖——整張卡都能拖的話，卡片裡的欄位就選不了字。 -->
          <div
            v-if="editMode"
            class="grip"
            draggable="true"
            title="拖曳可以調整順序"
            @dragstart="dragId = s.id"
            @dragend="((dragId = null), (overId = null))"
          >
            <svg viewBox="0 0 12 20" width="10" height="16" fill="currentColor">
              <circle cx="4" cy="5" r="1.3" />
              <circle cx="8" cy="5" r="1.3" />
              <circle cx="4" cy="10" r="1.3" />
              <circle cx="8" cy="10" r="1.3" />
              <circle cx="4" cy="15" r="1.3" />
              <circle cx="8" cy="15" r="1.3" />
            </svg>
          </div>

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
                v-if="editing === s.id || !s.name"
                class="who"
                type="text"
                :value="s.name"
                placeholder="角色名稱"
                spellcheck="false"
                @keydown.enter="commitName(s.id, ($event.target as HTMLInputElement).value)"
                @blur="commitName(s.id, ($event.target as HTMLInputElement).value)"
              />
              <button v-else class="who-text" title="點一下改角色" @click="beginEdit(s.id)">
                {{ s.name }}
              </button>

              <span v-if="s.info?.world" class="badge world" title="伺服器">
                {{ s.info.world }}
              </span>
              <div class="spacer"></div>
              <!-- 打開才會出現在浮動視窗上。資料本來就會自己更新，所以這裡不放更新鈕 -->
              <button
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
          </div>
        </div>

        </section>
      </div>

      <div class="pagebar">
        <button @click="roster.addSlot()">＋ 新增角色</button>
        <div class="spacer"></div>
        <FloatButton
          :panel="progressPanel"
          hint="開一個永遠置頂的小視窗，遊戲中也看得到進度"
        />

        <!-- 設定模式只管刪除：其餘（改名字、新增、顯示開關）平常就能做 -->
        <button
          class="gear"
          :class="{ primary: editMode }"
          :title="editMode ? '完成' : '刪除角色卡片'"
          @click="editMode = !editMode"
        >
          {{ editMode ? "完成" : "設定" }}
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
/* 捲動發生在卡片外的這一層，不是整頁：下面那排按鈕要一直看得到 */
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
  /* 跟上面那層一樣留 12px：那段留白是給捲軸的，沒有的話按鈕的右邊界
     會比卡片多凸出 12px */
  padding-right: 12px;
}

.scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 捲軸走在這段留白上，所以它在卡片外面的右邊 */
  padding-right: 12px;
}
.outer {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3);
}
.inner {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
/* 拖曳中：被拿起來的那張淡掉，目標那張在上緣標一條線 */
.inner.dragging {
  opacity: 0.4;
}
.inner.over {
  border-top-color: var(--accent);
  box-shadow: inset 0 2px 0 var(--accent);
}
/* 把手平常很淡，滑到卡片上才明顯——它不是這張卡的重點 */
.grip {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  align-self: stretch;
  color: var(--text-faint);
  opacity: 0.35;
  cursor: grab;
}
.inner:hover .grip {
  opacity: 1;
}
.grip:active {
  cursor: grabbing;
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
.gear {
  flex: none;
}
.x {
  width: 26px;
  height: 26px;
  padding: 0;
  flex: none;
}
/* 伺服器是標籤不是句子：空心徽章。填色的話會跟旁邊的控制項搶注意力。 */
.world {
  font-size: 13px;
  font-weight: 600;
  color: var(--good);
  background: transparent;
  border: 1px solid var(--good);
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

.note.err {
  font-size: 13px;
  color: var(--danger);
}
</style>
