<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { setTheme, themePref, type ThemePref } from "../theme";

const AUTHOR_DISCORD = "xense999";
const GITHUB_URL = "https://github.com/xense999";
const SUPPORT_URL = "https://portaly.cc/xense999/support";
const RELEASES_URL = "https://github.com/xense999/kz-maplestory/releases/latest";

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "light", label: "淺色" },
  { id: "dark", label: "深色" },
];

const version = ref("");
const showAbout = ref(false);
const discordCopied = ref(false);

// ── 更新 ──
// 一顆按鈕兩段：先「檢查更新」；查到新版後變成「更新到 vX」，再點一次才下載安裝。
interface AppUpdate {
  current: string;
  latest: string;
  has_update: boolean;
  url: string;
  exe_url: string;
  notes: string;
}

type UpdateState = "idle" | "checking" | "available" | "latest" | "downloading" | "failed";

const updateState = ref<UpdateState>("idle");
const updateInfo = ref<AppUpdate | null>(null);
const updatePct = ref(0);
const updateError = ref("");

const updateLabel = computed(() => {
  switch (updateState.value) {
    case "checking":
      return "檢查中…";
    case "available":
      return `更新到 v${updateInfo.value?.latest}`;
    case "downloading":
      return updatePct.value > 0 ? `更新中 ${updatePct.value}%` : "更新中…";
    case "latest":
      return "已是最新版";
    case "failed":
      return "重試";
    default:
      return "檢查更新";
  }
});

async function onUpdateClick() {
  if (updateState.value === "checking" || updateState.value === "downloading") return;
  updateError.value = "";

  if (updateState.value === "available" && updateInfo.value) {
    const info = updateInfo.value;
    // 沒有裸 exe 的版本（或非 Windows）就退回下載頁，讓使用者自己裝
    if (!info.exe_url) {
      await openUrl(info.url || RELEASES_URL);
      return;
    }
    updateState.value = "downloading";
    updatePct.value = 0;
    try {
      await invoke("update_app_inplace", { url: info.exe_url });
    } catch (e) {
      updateState.value = "failed";
      updateError.value = String(e);
    }
    return;
  }

  updateState.value = "checking";
  try {
    const info = await invoke<AppUpdate>("check_app_update");
    updateInfo.value = info;
    updateState.value = info.has_update ? "available" : "latest";
  } catch (e) {
    updateState.value = "failed";
    updateError.value = String(e);
  }
}

let stopProgress: (() => void) | null = null;

onMounted(async () => {
  version.value = await getVersion();
  stopProgress = await listen<[number, number]>("update-progress", (e) => {
    const [done, total] = e.payload;
    updatePct.value = total > 0 ? Math.floor((done * 100) / total) : 0;
  });
});
onUnmounted(() => stopProgress?.());

async function copyDiscord() {
  try {
    await navigator.clipboard.writeText(AUTHOR_DISCORD);
    discordCopied.value = true;
    setTimeout(() => (discordCopied.value = false), 1600);
  } catch (e) {
    console.error(e);
  }
}
</script>

<template>
  <div class="page">
    <div class="body">
      <!-- 一張卡＝一組設定，卡內一列一件事：左邊寫這是什麼，右邊放控制項 -->
      <section class="card">
        <div class="row">
          <span class="row-title">主題</span>
          <div class="seg">
            <button
              v-for="t in THEMES"
              :key="t.id"
              :class="{ on: themePref === t.id }"
              @click="setTheme(t.id)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <div class="bottom-bar">
      <div class="spacer"></div>
      <button class="icon heart" title="請作者喝杯咖啡" @click="openUrl(SUPPORT_URL)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </button>
      <button class="icon" title="關於" @click="showAbout = true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.7" />
          <path d="M12 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          <circle cx="12" cy="7.75" r="1.05" fill="currentColor" />
        </svg>
      </button>
    </div>

    <!-- 關於：自成一個小視窗（標題列＋內嵌小卡），不是一張攤平的大卡片 -->
    <div v-if="showAbout" class="about-overlay" @click.self="showAbout = false">
      <div class="about-window">
        <div class="about-titlebar">
          <span class="about-title">關於</span>
          <button class="about-close" title="關閉" @click="showAbout = false">
            <svg viewBox="0 0 12 12" width="11" height="11">
              <path d="M3 3 9 9M9 3 3 9" fill="none" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="about-body">
          <div class="about-card">
            <span class="about-card-label">程式版本</span>
            <div class="version-row">
              <span class="about-card-value">{{ version ? `v${version}` : "—" }}</span>
              <button
                class="btn-update"
                :class="{ ready: updateState === 'available' }"
                :disabled="updateState === 'checking' || updateState === 'downloading'"
                @click="onUpdateClick"
              >
                {{ updateLabel }}
              </button>
            </div>
            <p v-if="updateError" class="update-error">{{ updateError }}</p>
          </div>

          <div class="about-card">
            <span class="about-card-label">聯繫作者</span>
            <button class="contact-row" @click="copyDiscord()">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M20.3 4.9A19.8 19.8 0 0 0 15.4 3.4l-.24.5a18.3 18.3 0 0 1 4.34 1.35 16.4 16.4 0 0 0-5-1.58 18 18 0 0 0-3 0 16.4 16.4 0 0 0-5 1.58 18.3 18.3 0 0 1 4.34-1.35l-.24-.5A19.8 19.8 0 0 0 3.7 4.9C1.2 8.6.5 12.2.85 15.8a19.9 19.9 0 0 0 6.06 3.06l.73-1.13a13 13 0 0 1-2.05-.98l.5-.37a14.2 14.2 0 0 0 12.02 0l.5.37a13 13 0 0 1-2.05.98l.73 1.13a19.9 19.9 0 0 0 6.06-3.06c.42-4.17-.71-7.74-2.71-10.9ZM9.1 13.9c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.79 2-1.77 2Zm5.8 0c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Z" />
              </svg>
              <span class="contact-text">
                <span class="contact-name">Discord</span>
                <span class="contact-sub" :class="{ copied: discordCopied }">
                  {{ discordCopied ? "已複製 ✓" : `${AUTHOR_DISCORD} · 點擊複製帳號` }}
                </span>
              </span>
            </button>
            <button class="contact-row" @click="openUrl(GITHUB_URL)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.22-3.37-1.22-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.34 9.34 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
              </svg>
              <span class="contact-text">
                <span class="contact-name">GitHub</span>
                <span class="contact-sub">xense999</span>
              </span>
            </button>
          </div>
        </div>
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
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

/* 設定列：整列固定高、左標題右控制項 */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  min-height: 56px;
  padding: 10px var(--sp-4);
}
.row-title {
  font-size: 16px;
  color: var(--text);
}

.bottom-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--border);
}
.icon {
  width: 44px;
  height: 34px;
  padding: 0;
  flex: none;
  color: var(--text-dim);
}
.icon:hover:not(:disabled) {
  color: var(--text);
}
/* 贊助鍵是這一頁唯一帶感情的東西，hover 才露出紅色 */
.heart:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-soft);
}

/* 遮罩蓋到導覽列上（fixed 而非 absolute），只留標題列——那裡有視窗按鈕，
   蓋掉的話關不了視窗。44px 是標題列高度。 */
.about-overlay {
  position: fixed;
  inset: 44px 0 0 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 10, 18, 0.42);
  backdrop-filter: blur(2px);
  border-radius: 0 0 var(--win-radius, 0px) var(--win-radius, 0px);
  corner-shape: superellipse(1.5);
}
.about-window {
  width: 320px;
  max-width: calc(100% - 32px);
  background: var(--bg-1);
  border: 1px solid var(--control-border);
  border-radius: var(--radius-lg);
  corner-shape: superellipse(1.5);
  overflow: hidden;
}
.about-titlebar {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px 0 var(--sp-4);
  border-bottom: 1px solid var(--border);
}
.about-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dim);
}
.about-close {
  width: 26px;
  height: 26px;
  padding: 0;
  flex: none;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: var(--radius-xs);
}
.about-close:hover:not(:disabled) {
  background: var(--danger-soft);
  color: var(--danger);
}

/* 內嵌小卡：比外框深一階的面，每張上面掛一個小標 */
.about-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--sp-3);
}
.about-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--sp-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.about-card-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-faint);
}
.about-card-value {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.btn-update {
  flex: none;
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-dim);
  background: var(--bg-1);
  border-radius: var(--radius-sm);
}
.btn-update:hover:not(:disabled) {
  color: var(--text);
}
/* 有新版時才升成主要動作，其餘狀態都只是資訊 */
.btn-update.ready {
  color: var(--text-on-accent);
  background: var(--accent);
  border-color: var(--accent);
}
.update-error {
  font-size: 12px;
  line-height: 1.5;
  color: var(--danger);
}

.contact-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  height: 46px;
  padding: 0 8px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-dim);
}
.contact-row:hover:not(:disabled) {
  background: var(--hover);
  color: var(--text);
}
.contact-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
}
.contact-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
.contact-sub {
  font-size: 12px;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.contact-sub.copied {
  color: var(--good);
}
</style>
