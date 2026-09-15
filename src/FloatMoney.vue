<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { moneyPanel, type MoneySnap } from "./float";

const appWin = getCurrentWindow();
const opacity = ref(0.5);
/** 文字描邊：底色調很淡時，沒有描邊會吃到遊戲背景 */
const outline = ref(false);

/**
 * 欄位的文字自己留一份，但那不是另一份狀態：主視窗才是唯一的來源，這裡只是它的回音。
 * 之所以不直接綁快照，是因為正在打字的那一欄不能被回來的快照覆寫——
 * 打到一半被蓋掉的話游標會跳回去。
 */
type Field = "ntd" | "meso" | "rate";

const text = ref<Record<Field, string>>({ ntd: "", meso: "", rate: "" });
const focused = ref<Field | null>(null);

const anchor = ref<MoneySnap["anchor"]>("ntd");
const mode = ref<MoneySnap["mode"]>("buy");
const ok = ref(false);

/**
 * 這一欄是算出來的嗎——是的話字變琥珀色。
 * 打楓幣時台幣是算出來的，反過來也一樣；算不出來（幣值還沒填）時兩欄都不變色，
 * 不然空欄位會看起來像已經有結果了。
 */
function derived(field: "ntd" | "meso") {
  return ok.value && anchor.value !== field;
}

/** 最後一份快照。離開欄位時要拿它把正在打字時擋下來的更新補上 */
let last: MoneySnap | null = null;
let stopData: (() => void) | null = null;
let stopLook: (() => void) | null = null;

function apply(snap: MoneySnap) {
  last = snap;
  anchor.value = snap.anchor;
  mode.value = snap.mode;
  ok.value = snap.ok;
  const incoming: Record<Field, string> = {
    ntd: snap.ntd,
    meso: snap.meso,
    rate: snap.rate,
  };
  for (const field of ["ntd", "meso", "rate"] as const) {
    if (field !== focused.value) text.value[field] = incoming[field];
  }
}

/**
 * 打完字離開欄位：把打字期間擋下來的那份快照補套上去。
 * 賣幣時主視窗送的是實際成交的數字，所以這一刻欄位才會從「你打的量」
 * 變成「真的賣得掉的量」。
 */
function blur() {
  focused.value = null;
  if (last) apply(last);
}

function edit(field: Field, e: Event) {
  const value = (e.target as HTMLInputElement).value;
  text.value[field] = value;
  moneyPanel.sendInput({ field, value });
}

/** 買賣切換也走同一條回向通道，狀態一樣是主視窗那一份 */
function setMode(next: MoneySnap["mode"]) {
  mode.value = next;
  moneyPanel.sendInput({ field: "mode", value: next });
}

onMounted(async () => {
  stopData = await moneyPanel.connect(apply);
  stopLook = await moneyPanel.onLook((look) => {
    opacity.value = look.opacity;
    outline.value = look.outline;
  });
});
onUnmounted(() => {
  stopData?.();
  stopLook?.();
});

function onDown(e: MouseEvent) {
  if (e.button !== 0) return;
  // 欄位與按鈕以外的地方都能拖。只留頂端那一條的話抓不到——它太細，
  // 而這個視窗大部分面積都不是欄位。
  // ★按鈕一定要排除：mousedown 一旦開始拖視窗就把後面的 click 吃掉了，
  // 症狀是按鈕要按兩次才有反應。
  if ((e.target as HTMLElement).closest("input, button")) return;
  void appWin.startDragging();
}
</script>

<template>
  <div class="float" :class="{ outline }" @mousedown="onDown">
    <!-- 透明度只吃這一層底：整塊調的話字會跟著淡，蓋在遊戲上就看不清了 -->
    <div class="bg" :style="{ opacity }"></div>

    <!-- 看得見的拖曳提示。真正吃拖曳的是欄位以外的整塊，這裡只是告訴人可以抓 -->
    <div class="grip" title="拖曳可移動">
      <i></i>
    </div>

    <div class="body">
      <div class="rows">
        <label class="row">
          <span class="label">幣值</span>
          <input
            type="text"
            inputmode="decimal"
            spellcheck="false"
            placeholder="2800"
            :value="text.rate"
            @focus="focused = 'rate'"
            @blur="blur()"
            @input="edit('rate', $event)"
          />
          <span class="unit">萬</span>
        </label>

        <label class="row">
          <span class="label">楓幣</span>
          <input
            type="text"
            inputmode="decimal"
            spellcheck="false"
            placeholder="0"
            :class="{ derived: derived('meso') }"
            :value="text.meso"
            @focus="focused = 'meso'"
            @blur="blur()"
            @input="edit('meso', $event)"
          />
          <span class="unit">元</span>
        </label>

        <label class="row">
          <span class="label">現金</span>
          <input
            type="text"
            inputmode="decimal"
            spellcheck="false"
            placeholder="0"
            :class="{ derived: derived('ntd') }"
            :value="text.ntd"
            @focus="focused = 'ntd'"
            @blur="blur()"
            @input="edit('ntd', $event)"
          />
          <span class="unit">元</span>
          </label>
        </div>

      <!-- 買／賣在右邊自己一條：三列的內容意思不同，不能只靠數字分辨 -->
      <div class="modes" role="group" aria-label="買幣或賣幣">
        <button :class="{ on: mode === 'buy' }" @click="setMode('buy')">買</button>
        <button :class="{ on: mode === 'sell' }" @click="setMode('sell')">賣</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 這個視窗會蓋在遊戲上面，字要一直看得清楚，所以底與字分成兩層。
   ★整塊的尺寸都是 em，而字級同時綁在視窗的寬與高上、取比較小的那個
   （392×166 是 19px 字的基準）。只綁寬度的話，單獨拉高會讓內容留一大片空白；
   取 min 之後不管怎麼拖都是整體等比縮放，不是版面重排。 */
.float {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  font-size: calc(min(100vw / 392, 100vh / 166) * 19);
}
/* 描邊：底色調很淡時字會吃到遊戲背景，開起來就讀得回來。
   加在整塊上而不是逐個元素，之後新增的文字自動吃得到 */
.float.outline {
  text-shadow: 0 0 0.2em rgba(0, 0, 0, 0.9), 0 0.06em 0.12em rgba(0, 0, 0, 0.85);
}
.bg {
  position: absolute;
  inset: 0;
  background: var(--bg-1);
  border: 1px solid var(--window-edge);
  border-radius: 0.9em;
  corner-shape: superellipse(1.5);
}

.grip {
  position: relative;
  height: 1.4em;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}
.grip:active {
  cursor: grabbing;
}
/* 一條短橫線就夠了：它只要看起來像「這裡可以抓」 */
.grip i {
  width: 2.4em;
  height: 0.2em;
  border-radius: 0.1em;
  background: var(--text-faint);
}

.body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}
.rows {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5em;
  padding: 0.5em 0.6em 0.5em 1em;
}

/* 右邊一條窄欄：買在上、賣在下，選中的填色。三列的意思隨模式而變，
   光看數字分不出來，所以這個狀態必須一直在畫面上 */
.modes {
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35em;
  padding: 0.5em 0.8em 0.5em 0;
}
.modes button {
  width: 2.3em;
  height: 2.1em;
  padding: 0;
  font-size: 1em;
  font-weight: 700;
  color: var(--text-dim);
  background: var(--wash-strong);
  border: none;
  border-radius: 0.4em;
}
.modes button:hover:not(.on) {
  color: var(--text);
}
.modes button.on {
  color: var(--text-on-accent);
  background: var(--accent);
}
.row {
  display: flex;
  align-items: center;
  gap: 0.6em;
  height: 1.95em;
  flex: none;
}
/* 底色可以淡到 0，所以要讀得清楚就得把底拉高一點——字本身不加陰影 */
.label,
.unit,
.row input {
}
.label {
  width: 2.5em;
  flex: none;
  font-size: 0.82em;
  color: var(--text-dim);
}
/* 數字靠右對齊成一直行，單位在外面：三個數字才比得起來 */
.row input {
  flex: 1;
  min-width: 0;
  height: 1.6em;
  padding: 0 0.4em;
  font-size: 1.05em;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
  text-align: right;
  /* 欄位平常看不出是欄位——碰到才浮出底色。疊在遊戲上，三個框會比數字還搶眼 */
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.35em;
}
/* 算出來的那一欄變琥珀色：不必看標籤就知道自己在打的是哪一邊 */
.row input.derived {
  color: var(--warn);
}
.row input:hover:not(:focus) {
  background: var(--wash-strong);
}
.row input:focus {
  background: var(--input-bg);
  border-color: var(--accent);
  box-shadow: none;
}
.unit {
  flex: none;
  font-size: 0.82em;
  color: var(--text-dim);
}
.unit {
  width: 2.4em;
}

</style>
