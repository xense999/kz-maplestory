/**
 * 到期提醒音。
 * 不放音檔：WebAudio 現場合成，省掉打包資源、也不會因為檔案路徑在 release 版走鐘。
 * 玩家在遊戲裡背對著這個視窗，所以聲音是「兩短聲一組、每 1.2 秒一組」，
 * 不是單一長音——斷續的聲音在遊戲音效底下比較容易被辨認出來。
 *
 * ★會一直響到有人處理為止。出租那張卡是客戶的錢，自動停掉等於允許漏接。
 */

import { ref } from "vue";

const BEEP_GAP_MS = 1_200;

/** 響鈴中（UI 要據此顯示「停止提醒」） */
export const ringing = ref(false);

const VOLUME_KEY = "kz-maplestory:alarm-volume";
/** 這一聲的峰值增益。0.5 已經相當響，所以音量 100% 就對到這個值。 */
const PEAK = 0.5;

function loadVolume() {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

/** 提醒音量（0~1） */
export const volume = ref(loadVolume());

export function setVolume(v: number) {
  volume.value = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume.value));
  } catch {
    /* 存不了就只在這次執行有效 */
  }
}

let ctx: AudioContext | null = null;
let timer: number | null = null;

function audio() {
  if (!ctx) ctx = new AudioContext();
  // 沒有使用者手勢時 WebView 會把 context 停在 suspended，播出來會是無聲
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 一聲：880Hz 方波三角混一點，短促、收尾淡出避免爆音 */
function beep(at: number, len = 0.14) {
  const a = audio();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, at);
  // 靜音時直接不發聲：exponentialRamp 到 0 會炸掉（它不接受 0）
  const peak = PEAK * volume.value;
  if (peak <= 0.0002) return;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain).connect(a.destination);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

function pair() {
  const t = audio().currentTime;
  beep(t + 0.02);
  beep(t + 0.24);
}

/** 開始響，直到 stopAlarm。已經在響的時候再呼叫不會疊成兩層聲音 */
export function startAlarm() {
  if (timer !== null) return;
  ringing.value = true;
  pair();
  timer = window.setInterval(pair, BEEP_GAP_MS);
}

export function stopAlarm() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  ringing.value = false;
}

/** 試聽一次，只響一組（設定頁的「測試」用） */
export function testBeep() {
  pair();
}
