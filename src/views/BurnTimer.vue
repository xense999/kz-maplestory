<script setup lang="ts">
import { computed, ref } from "vue";
import { useBurnStore, type Session } from "../stores/burn";

const store = useBurnStore();

const PRESETS = [30, 60, 90];
const name = ref("");
const minutes = ref(30);
const customOpen = ref(false);

function submit() {
  if (minutes.value <= 0) return;
  store.add(name.value, minutes.value);
  name.value = "";
}

/** mm:ss（超過一小時給 h:mm:ss）；超時的絕對值另外由 late 標出來 */
function clock(ms: number) {
  const t = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function state(s: Session): "paused" | "expired" | "soon" | "running" {
  if (s.endAt === null) return "paused";
  const left = store.remaining(s);
  if (left <= 0) return "expired";
  if (left <= 60_000) return "soon";
  return "running";
}

/** 已跑掉的比例，用來畫進度條；超時就滿格 */
function progress(s: Session) {
  const left = Math.max(0, store.remaining(s));
  return Math.min(1, Math.max(0, 1 - left / s.totalMs));
}

const running = computed(() => store.sessions.length);
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <span class="toolbar-title">輪燒計時器</span>
      <span v-if="running" class="badge">{{ running }} 場進行中</span>
      <span v-if="store.expiredCount" class="badge over">{{ store.expiredCount }} 場已到期</span>
      <div class="spacer"></div>
    </header>

    <!-- 開場：客戶名字＋時長。時長是常用三檔的膠囊，要別的數字才展開自訂輸入 -->
    <form class="newbar" @submit.prevent="submit">
      <input v-model="name" class="who" type="text" placeholder="客戶名稱（可留白）" />
      <div class="seg">
        <button
          v-for="p in PRESETS"
          :key="p"
          type="button"
          :class="{ on: !customOpen && minutes === p }"
          @click="((minutes = p), (customOpen = false))"
        >
          {{ p }} 分
        </button>
        <button type="button" :class="{ on: customOpen }" @click="customOpen = true">自訂</button>
      </div>
      <input
        v-if="customOpen"
        v-model.number="minutes"
        class="mins"
        type="number"
        min="1"
        max="600"
        aria-label="分鐘"
      />
      <button class="primary" type="submit">開始計時</button>
    </form>

    <div class="body">
      <div v-if="!store.ordered.length" class="empty">還沒有進行中的場次</div>

      <div v-else class="grid">
        <article
          v-for="s in store.ordered"
          :key="s.id"
          class="card sess"
          :class="state(s)"
        >
          <div class="row">
            <span class="who-name">{{ s.name }}</span>
            <span class="tag">{{ Math.round(s.totalMs / 60000) }} 分</span>
            <div class="spacer"></div>
            <button class="plain x" title="移除這一場" @click="store.remove(s)">
              <svg viewBox="0 0 12 12" width="12" height="12">
                <path d="M3 3 9 9M9 3 3 9" fill="none" stroke="currentColor" stroke-width="1.3"
                      stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="time">
            <span class="digits">{{ clock(store.remaining(s)) }}</span>
            <span v-if="state(s) === 'expired'" class="late">已超時</span>
            <span v-else-if="state(s) === 'paused'" class="late paused-tag">已暫停</span>
          </div>

          <div class="bar"><i :style="{ width: progress(s) * 100 + '%' }"></i></div>

          <div class="row acts">
            <button @click="store.togglePause(s)">{{ s.endAt === null ? "繼續" : "暫停" }}</button>
            <button @click="store.extend(s, 10)">＋10 分</button>
            <button @click="store.extend(s, 30)">＋30 分</button>
          </div>
        </article>
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

.newbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 0.5px solid var(--border);
}
.who {
  width: 220px;
}
/* 到期數是唯一需要一眼看到的壞消息，給它 danger 的淡底 */
.badge.over {
  color: var(--danger);
  background: hsl(3 100% 59% / 0.14);
  font-weight: 600;
}
.mins {
  width: 84px;
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(272px, 1fr));
  gap: var(--sp-3);
}

.sess {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-width: 0;
}
.who-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag {
  font-size: 13px;
  color: var(--text-faint);
}
.x {
  width: 26px;
  height: 26px;
  padding: 0;
  flex: none;
}

/* 倒數本身是這張卡的主角：等寬數字、大一級，其餘都退成灰 */
.time {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.digits {
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.late {
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
}
.paused-tag {
  color: var(--text-faint);
}

.bar {
  height: 5px;
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

.acts button {
  height: 30px;
  padding: 0 12px;
  font-size: 15px;
}

/* 狀態只改「該提醒的那一點」，不整張換皮：快到期＝橘字，超時＝紅字＋紅邊 */
.sess.soon .digits,
.sess.soon .bar > i {
  color: var(--warn);
  background: var(--warn);
}
.sess.soon .digits {
  background: none;
}
.sess.expired {
  box-shadow: 0 0 0 1.5px var(--danger), var(--shadow-1);
}
.sess.expired .digits {
  color: var(--danger);
}
.sess.expired .bar > i {
  background: var(--danger);
}
.sess.paused {
  opacity: 0.62;
}
</style>
