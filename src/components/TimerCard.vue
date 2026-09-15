<script setup lang="ts">
import { ref, watch } from "vue";
import { useBurnStore, type TimerId } from "../stores/burn";

const props = defineProps<{
  id: TimerId;
  /** 這張卡正在錄按鍵 */
  recording: boolean;
  /** 併排時字級收一級，不然兩欄放不下 */
  compact?: boolean;
  /** 設定模式：技能卡的基本時間才會露出來 */
  editing?: boolean;
}>();

const emit = defineEmits<{ record: [TimerId] }>();

const store = useBurnStore();


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

/**
 * 大數字本身就是欄位。技能卡分成分／秒兩格，出租分成小時／分兩格——
 * 沒有另外一個「自訂」入口，要改就在眼前這個數字上改。
 */
const skillM = ref(0);
const skillS = ref(0);
const rentalH = ref(0);
const rentalM = ref(0);

watch(
  () => [props.editing, store.timers[props.id].durationMs] as const,
  ([on, ms]) => {
    if (on) {
      skillM.value = Math.floor(ms / 60_000);
      skillS.value = Math.round((ms % 60_000) / 1000);
    }
    rentalH.value = Math.floor(ms / 3_600_000);
    rentalM.value = Math.round((ms % 3_600_000) / 60_000);
  },
  { immediate: true },
);

/** 出租按時段賣，對齊 15 分鐘是 store 的規則，這裡只把收下來的結果寫回欄位 */
function commitRentalDuration() {
  const ms = (Number(rentalH.value) || 0) * 3_600_000 + (Number(rentalM.value) || 0) * 60_000;
  if (ms <= 0) return;
  store.setDuration(props.id, ms);
  const snapped = store.timers[props.id].durationMs;
  rentalH.value = Math.floor(snapped / 3_600_000);
  rentalM.value = Math.round((snapped % 3_600_000) / 60_000);
}

function commitSkillDuration() {
  const ms = (Number(skillM.value) || 0) * 60_000 + (Number(skillS.value) || 0) * 1000;
  if (ms <= 0) return;
  store.setDuration(props.id, ms);
}

function startSkillDrag(e: PointerEvent, which: "m" | "s") {
  const input = e.currentTarget as HTMLInputElement;
  const startX = e.clientX;
  const startV = which === "m" ? Number(skillM.value) || 0 : Number(skillS.value) || 0;
  const max = which === "m" ? 120 : 59;
  let live = false;

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    if (!live) {
      if (Math.abs(dx) < 4) return;
      live = true;
      input.blur();
    }
    const next = Math.min(max, Math.max(0, startV + Math.round(dx / 10)));
    if (which === "m") skillM.value = next;
    else skillS.value = next;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (live) commitSkillDuration();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/**
 * 左右拖曳欄位就能加減數字——比點兩下再打字快，尤其出租的值很規律（15 分一格）。
 * 移動不到 4px 當作單純的點擊，打字編輯照舊。
 */
function startRentalDrag(e: PointerEvent, which: "h" | "m") {
  const input = e.currentTarget as HTMLInputElement;
  const startX = e.clientX;
  const startV = which === "h" ? Number(rentalH.value) || 0 : Number(rentalM.value) || 0;
  const step = which === "h" ? 1 : 15;
  const max = which === "h" ? 24 : 45;
  let live = false;

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    if (!live) {
      if (Math.abs(dx) < 4) return;
      live = true;
      input.blur();
    }
    const next = Math.min(max, Math.max(0, startV + Math.round(dx / 14) * step));
    if (which === "h") rentalH.value = next;
    else rentalM.value = next;
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (live) commitRentalDuration();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
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
          :class="{ on: store.timers[id].durationMs === p }"
          @click="store.setDuration(id, p)"
        >
          {{ span(p) }}
        </button>
      </div>

    </div>

    <div class="main">
      <!-- 設定模式：大數字本身就是欄位，改的就是眼前這個時間 -->
      <div v-if="editing && !store.spec(id).presets" class="digits edit">
        <input
          v-model.number="skillM"
          type="number"
          min="0"
          max="120"
          aria-label="分"
          title="可以左右拖曳調整"
          @pointerdown="startSkillDrag($event, 'm')"
          @change="commitSkillDuration()"
          @keydown.enter="commitSkillDuration()"
        />
        <span class="colon">:</span>
        <input
          v-model.number="skillS"
          type="number"
          min="0"
          max="59"
          aria-label="秒"
          title="可以左右拖曳調整"
          @pointerdown="startSkillDrag($event, 's')"
          @change="commitSkillDuration()"
          @keydown.enter="commitSkillDuration()"
        />
      </div>
      <!-- 出租沒有另外的「自訂」入口：還沒起算時，眼前這個數字本身就是欄位 -->
      <div v-else-if="store.spec(id).presets && state() === 'idle'" class="digits edit">
        <input
          v-model.number="rentalH"
          type="number"
          min="0"
          max="24"
          aria-label="小時"
          title="可以左右拖曳調整"
          @pointerdown="startRentalDrag($event, 'h')"
          @change="commitRentalDuration()"
          @keydown.enter="commitRentalDuration()"
        />
        <span class="colon">:</span>
        <input
          v-model.number="rentalM"
          type="number"
          min="0"
          max="45"
          step="15"
          aria-label="分"
          title="可以左右拖曳調整"
          @pointerdown="startRentalDrag($event, 'm')"
          @change="commitRentalDuration()"
          @keydown.enter="commitRentalDuration()"
        />
      </div>
      <div v-else class="digits">{{ display() }}</div>
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
  border: 1px solid var(--btn-border);
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
/* 固定一列不換行：換行等於卡片高度會跳動 */
.spans {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 32px;
}
/* 時長是「幾個平行的選擇」而不是一個值的幾個檔位，所以不共用 segmented 軌道：
   各自獨立的圓角矩形，選中的那顆才填強調色 */
.chips {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.chip {
  height: 32px;
  padding: 0 14px;
  font-size: 15px;
  font-weight: 500;
  color: var(--btn-text);
  background: var(--bg-1);
  border: 1px solid var(--btn-border);
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
/* 欄位長得跟那串數字一樣大，改的時候看得出來改的就是它 */
.digits.edit {
  display: flex;
  align-items: center;
  gap: 4px;
}
.digits.edit input {
  width: 1.9em;
  height: 1.15em;
  padding: 0 0.1em;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  text-align: center;
  font-variant-numeric: tabular-nums;
  cursor: ew-resize;
}
.colon {
  opacity: 0.5;
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
