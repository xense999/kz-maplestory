<script setup lang="ts">
import { ref } from "vue";
import { useBurnStore, type TimerId } from "../stores/burn";

const props = defineProps<{
  id: TimerId;
  /** 這張卡正在錄按鍵 */
  recording: boolean;
  /** 併排時字級收一級，不然兩欄放不下 */
  compact?: boolean;
}>();

const emit = defineEmits<{ record: [TimerId] }>();

const store = useBurnStore();

const customOpen = ref(false);
const customH = ref(1);
const customM = ref(0);
const customEl = ref<HTMLElement | null>(null);

/** 到期就停在 00:00：往上加的秒數只會讓人分不清「還剩」跟「超過」 */
function clock(ms: number) {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 時長檔位的短標籤：30 分 / 1 小時 / 1 小時 30 分 */
function span(ms: number) {
  const total = Math.round(ms / 60_000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} 分`;
  return m ? `${h} 小時 ${m} 分` : `${h} 小時`;
}

function state(): "idle" | "running" | "soon" | "due" {
  const left = store.remaining(props.id);
  if (left === null) return "idle";
  if (left <= 0) return "due";
  if (left <= 30_000) return "soon";
  return "running";
}

/** 已跑掉的比例；到期後滿格 */
function progress() {
  const left = store.remaining(props.id);
  if (left === null) return 0;
  return Math.min(1, Math.max(0, 1 - left / store.timers[props.id].runMs));
}

function display() {
  const left = store.remaining(props.id);
  return clock(left === null ? store.timers[props.id].durationMs : left);
}

/** 自訂＝目前時長不在任何一檔上 */
function isCustom() {
  return !store.spec(props.id).presets?.includes(store.timers[props.id].durationMs);
}

/** 沒有「套用」按鈕：焦點離開這一區（點別的地方、按 Enter）就收下並收起 */
function commitCustom() {
  const raw = (Number(customH.value) || 0) * 3_600_000 + (Number(customM.value) || 0) * 60_000;
  if (raw > 0) {
    // 對齊 15 分鐘是 store 的規則（存檔讀回來時也要對齊），這裡只把結果寫回欄位
    store.setDuration(props.id, raw);
    const ms = store.timers[props.id].durationMs;
    customH.value = Math.floor(ms / 3_600_000);
    customM.value = (ms % 3_600_000) / 60_000;
  }
  customOpen.value = false;
}

/** 焦點還在這一區裡面（小時→分鐘）就不算離開 */
function onCustomFocusOut(e: FocusEvent) {
  const next = e.relatedTarget as Node | null;
  if (next && customEl.value?.contains(next)) return;
  commitCustom();
}
</script>

<template>
  <article class="card timer" :class="[state(), { compact }]">
    <div class="head">
      <span class="name">{{ store.spec(id).label }}</span>
      <span v-if="store.spec(id).hint" class="hint">{{ store.spec(id).hint }}</span>
      <div class="spacer"></div>
      <!-- 這張卡片自己沒有的東西（浮動視窗、試聽…）由外面塞進來 -->
      <slot name="head" />

      <!-- 按鍵：只監聽不攔截，所以可以直接掛在放技能的那顆鍵上 -->
      <div v-if="store.spec(id).hotkeyable" class="hk">
        <button
          class="keycap"
          :class="{ rec: recording, unset: !store.timers[id].hotkey }"
          :title="
            recording
              ? '按下要監聽的鍵（Esc 取消）'
              : store.timers[id].hotkey
                ? '點一下改按鍵，按右鍵清除'
                : '點一下設定按鍵'
          "
          @click="emit('record', id)"
          @contextmenu.prevent="store.clearHotkey(id)"
        >
          {{ recording ? "按下按鍵…" : (store.timers[id].hotkey?.label ?? "設定按鍵") }}
        </button>
        <button
          class="switch"
          role="switch"
          :class="{ on: store.timers[id].hotkeyOn }"
          :aria-checked="store.timers[id].hotkeyOn"
          :disabled="!store.timers[id].hotkey"
          :title="store.timers[id].hotkeyOn ? '監聽中：按這顆鍵就會起算' : '開啟後按這顆鍵就會起算'"
          @click="store.setHotkeyEnabled(id, !store.timers[id].hotkeyOn)"
        ></button>
      </div>
    </div>

    <!-- 時長可選的卡片（出租輪迴）才有這一列 -->
    <div v-if="store.spec(id).presets" class="spans">
      <div class="chips">
        <button
          v-for="p in store.spec(id).presets"
          :key="p"
          class="chip"
          :class="{ on: !customOpen && !isCustom() && store.timers[id].durationMs === p }"
          @click="((customOpen = false), store.setDuration(id, p))"
        >
          {{ span(p) }}
        </button>
        <button class="chip" :class="{ on: isCustom() || customOpen }" @click="customOpen = true">
          自訂
        </button>
      </div>

      <div v-if="customOpen" ref="customEl" class="custom" @focusout="onCustomFocusOut">
        <input
          v-model.number="customH"
          type="number"
          min="0"
          max="24"
          aria-label="小時"
          @keydown.enter="commitCustom()"
        />
        <span class="unit">小時</span>
        <input
          v-model.number="customM"
          type="number"
          min="0"
          max="45"
          step="15"
          aria-label="分鐘"
          @keydown.enter="commitCustom()"
        />
        <span class="unit">分</span>
      </div>
      <span v-else-if="isCustom()" class="custom-now">
        目前：{{ span(store.timers[id].durationMs) }}
      </span>
    </div>

    <div class="main">
      <div class="digits">{{ display() }}</div>
      <div class="tail">
        <span v-if="state() === 'due'" class="due-tag">時間到</span>
        <span v-else-if="state() === 'idle'" class="idle-tag">尚未起算</span>
        <div class="acts">
          <button class="primary" @click="store.start(id)">
            {{ state() === "idle" ? "開始" : "重新計時" }}
          </button>
          <button :disabled="state() === 'idle'" @click="store.reset(id)">歸零</button>
        </div>
      </div>
    </div>

    <div class="bar"><i :style="{ width: progress() * 100 + '%' }"></i></div>

    <p v-if="store.timers[id].error" class="err">{{ store.timers[id].error }}</p>
  </article>
</template>

<style scoped>
.timer {
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
  flex: none;
}
.hint {
  font-size: 14px;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 併排時橫向空間不夠，說明文字讓位給按鍵那一組 */
.timer.compact .hint {
  display: none;
}

.hk {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
/* 開關是「另一件事」（設哪顆鍵 vs 要不要聽），所以和鍵帽那組之間多留一段 */
.hk .switch {
  margin-left: var(--sp-2);
}
/* 鍵帽＝這張卡上唯一需要「一眼看到是可設定的欄位」的東西，所以給它一圈實線；
   四邊等粗、不加陰影，框本身就夠說明它是個欄位了 */
.keycap {
  height: 32px;
  min-width: 96px;
  padding: 0 14px;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--bg-1);
  border: 1px solid var(--control-border);
  border-radius: var(--radius-sm);
  box-shadow: none;
}
.keycap:hover:not(:disabled) {
  border-color: var(--accent);
}
.keycap.unset {
  color: var(--text-dim);
  font-weight: 500;
  border-style: dashed;
}
.keycap.rec {
  color: var(--text-on-accent);
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: var(--ring);
}
.spans {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}
/* 時長是「幾個平行的選擇」而不是一個值的幾個檔位，所以不共用 segmented 軌道：
   各自獨立的圓角矩形，選中的那顆才填強調色 */
.chips {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.chip {
  height: 32px;
  padding: 0 14px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-dim);
  background: var(--bg-1);
  border: 1px solid var(--control-border);
  border-radius: var(--radius);
  box-shadow: none;
}
.chip:hover:not(.on) {
  color: var(--text);
  background: var(--bg-2);
}
.chip.on {
  color: var(--text-on-accent);
  font-weight: 600;
  background: var(--accent);
  border-color: var(--accent);
}
.chip.on:hover {
  background: var(--accent);
}
.custom {
  display: flex;
  align-items: center;
  gap: 6px;
}
.custom input {
  width: 72px;
}
.unit {
  font-size: 15px;
  color: var(--text-dim);
}
.custom-now {
  font-size: 15px;
  color: var(--text-dim);
}

.main {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-4);
}
/* 倒數是這張卡唯一的主角，其他都退成灰 */
.digits {
  font-size: 60px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.timer.compact .digits {
  font-size: 46px;
}
.tail {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding-bottom: 4px;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: var(--sp-2);
}
.timer.compact .acts button {
  height: 30px;
  padding: 0 12px;
  font-size: 15px;
}
.due-tag {
  font-size: 15px;
  font-weight: 600;
  color: var(--danger);
}
.idle-tag {
  font-size: 15px;
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
  transition: width 0.25s linear;
}

/* 狀態只改該提醒的那一點，不整張換皮 */
.timer.idle .digits {
  color: var(--text-faint);
}
.timer.soon .digits {
  color: var(--warn);
}
.timer.soon .bar > i {
  background: var(--warn);
}
.timer.due {
  border-color: var(--danger);
}
.timer.due .digits {
  color: var(--danger);
}
.timer.due .bar > i {
  background: var(--danger);
}

.err {
  font-size: 14px;
  color: var(--danger);
}
</style>
