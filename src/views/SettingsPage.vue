<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { disable as disableAutostart, enable as enableAutostart, isEnabled } from "@tauri-apps/plugin-autostart";
import { setTheme, themePref, type ThemePref } from "../theme";
import { setVolume, testBeep, volume } from "../alarm";
import { apiKey, setApiKey } from "../apikey";

const AUTHOR_DISCORD = "xense999";
const GITHUB_URL = "https://github.com/xense999";
const SUPPORT_URL = "https://portaly.cc/xense999/support";
const RELEASES_URL = "https://github.com/xense999/kz-maplestory/releases/latest";

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "light", label: "淺色" },
  { id: "dark", label: "深色" },
];

/** 金鑰預設遮起來：這東西會被截圖、也會被旁邊的人看到 */
const revealKey = ref(false);
/** 「怎麼拿到金鑰」的說明，點問號才展開 */
const keyHelp = ref(false);

/** 台版角色資訊 API 的頁面。從這裡登入、建立應用程式、拿金鑰 */
const NEXON_OPENAPI = "https://openapi.nexon.com/game/maplestorytw/?id=49";

/** 開機自動啟動。狀態的真實來源是系統本身，所以開頁時去問它，不自己記一份 */
const autostart = ref(false);
const autostartBusy = ref(false);

async function toggleAutostart() {
  if (autostartBusy.value) return;
  autostartBusy.value = true;
  try {
    if (autostart.value) await disableAutostart();
    else await enableAutostart();
    autostart.value = await isEnabled();
  } catch (e) {
    console.error(e);
  } finally {
    autostartBusy.value = false;
  }
}

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
  autostart.value = await isEnabled().catch(() => false);
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
      <!-- 一張卡＝一件事：左邊寫這是什麼，右邊放控制項 -->
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

      <section class="card">
        <div class="row">
          <span class="row-title">開機時啟動</span>
          <button
            class="switch"
            role="switch"
            :class="{ on: autostart }"
            :aria-checked="autostart"
            :disabled="autostartBusy"
            :title="autostart ? '登入 Windows 後會自動開啟' : '開啟後，登入 Windows 就會自動啟動'"
            @click="toggleAutostart()"
          ></button>
        </div>
      </section>

      <section class="card">
        <div class="row">
          <span class="row-title">
            API 金鑰
            <button class="info" title="怎麼取得金鑰" @click="keyHelp = !keyHelp">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                <circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.8" />
                <path d="M12 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                <circle cx="12" cy="7.75" r="1.05" fill="currentColor" />
              </svg>
            </button>
          </span>
          <div class="keyfield">
            <input
              type="text"
              :class="{ masked: !revealKey }"
              :value="apiKey"
              placeholder="貼上你自己的 API 金鑰"
              spellcheck="false"
              autocomplete="off"
              @input="setApiKey(($event.target as HTMLInputElement).value)"
            />
            <button
              class="eye"
              :title="revealKey ? '隱藏金鑰' : '顯示金鑰'"
              @click="revealKey = !revealKey"
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="3.1" />
                <path v-if="!revealKey" d="M4 20 20 4" />
              </svg>
            </button>
          </div>
        </div>

      </section>

      <section class="card">
        <div class="row">
          <span class="row-title">通報音效</span>
          <div class="ctrl">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="Math.round(volume * 100)"
              aria-label="音量"
              @input="setVolume(Number(($event.target as HTMLInputElement).value) / 100)"
            />
            <span class="ctrl-val">{{ Math.round(volume * 100) }}%</span>
            <button @click="testBeep()">測試</button>
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

    <!-- 金鑰說明：跟「關於」同一種內視窗，不是攤在設定列底下的一段字 -->
    <div v-if="keyHelp" class="about-overlay" @click.self="keyHelp = false">
      <div class="about-window wide">
        <div class="about-titlebar">
          <span class="about-title">如何取得 API 金鑰</span>
          <button class="about-close" title="關閉" @click="keyHelp = false">
            <svg viewBox="0 0 12 12" width="11" height="11">
              <path d="M3 3 9 9M9 3 3 9" fill="none" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="about-body">
          <div class="about-card">
            <span class="about-card-label">步驟</span>
            <ol class="steps">
              <li>進入網站，從上方 My Page 進入 Register Application。</li>
              <li>讀完上述兩組資料（滑到最下方打勾）。</li>
              <li>選擇遊戲 MapleStory Taiwan。</li>
              <li>選擇屬性 Development phase。</li>
              <li>命名這個服務的名稱（隨意打）。</li>
              <li>創立後從左方 Application List 進入，點選剛剛命名的 Service name。</li>
              <li>上方的 API key details 就是你的 API 金鑰。</li>
            </ol>
            <p class="note">一組金鑰可以一直用，不必每次重新申請。</p>
          </div>

          <div class="about-card">
            <span class="about-card-label">申請頁面</span>
            <button class="btn-update" @click="openUrl(NEXON_OPENAPI)">在瀏覽器開啟</button>
          </div>
        </div>
      </div>
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-strong);
}
.info {
  width: 22px;
  height: 22px;
  padding: 0;
  flex: none;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: var(--radius-pill);
}
.info:hover:not(:disabled) {
  color: var(--text);
  background: var(--hover);
}

/* 這一列的控制項字重跟左邊的標題對齊，整列讀起來才是一件事 */
.row button {
  font-weight: 600;
}
.ctrl {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}
.ctrl input[type="range"] {
  width: 160px;
}
.ctrl-val {
  width: 44px;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
  text-align: right;
}

/* 眼睛長在輸入格裡面的右緣，不是旁邊另一顆按鈕 */
.keyfield {
  position: relative;
  width: 340px;
}
.keyfield input {
  width: 100%;
  height: 32px;
  padding-right: 40px;
  font-size: 16px;
  font-family: inherit;
  letter-spacing: 0.02em;
}
/* ★遮罩不用 type=password：那種欄位瀏覽器會自己塞東西進去（顯示密碼鈕、
   密碼管理員圖示、另一套畫圓點的字型），於是遮起來與看得到的樣子對不齊。
   這裡永遠是一般文字欄位，只是把字換成圓點。 */
.keyfield input.masked {
  -webkit-text-security: disc;
}
.eye {
  position: absolute;
  top: 50%;
  right: 3px;
  transform: translateY(-50%);
  width: 30px;
  height: 26px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-faint);
  border-radius: var(--radius-xs);
}
.eye:hover:not(:disabled) {
  color: var(--text);
  background: var(--hover);
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
/* 說明比「關於」長得多，給它寬一點，步驟才不會每一條都折行 */
.about-window.wide {
  width: 520px;
}
.steps {
  margin: 0;
  padding-left: 1.3em;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-dim);
}
.note {
  font-size: 13px;
  color: var(--text-faint);
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
  color: var(--text-strong);
}
.version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.btn-update {
  align-self: flex-start;
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
