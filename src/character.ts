import { invoke } from "@tauri-apps/api/core";

/**
 * 角色資料。實際的請求在後端（見 src-tauri/src/maple.rs）——官方 API 不給
 * 跨來源標頭，webview 直接打會被擋。
 */
export interface CharacterInfo {
  name: string;
  /** 職業（有的話顯示在名字旁邊） */
  job?: string;
  world?: string;
  level: number;
  /** 這一級已經賺到的比例，0~100 */
  expPercent: number;
  /** 累積經驗值，顯示用的原始數字 */
  exp?: number;
  /** 角色圖網址 */
  imageUrl?: string;
  /** 官方標示的資料基準日 */
  asOf?: string;
  /** 這筆資料抓下來的時刻 */
  fetchedAt: number;
}

/** 後端回來的形狀（欄位名沿用 Rust 那邊的 snake_case） */
interface RawCharacter {
  name: string;
  job?: string;
  world?: string;
  level: number;
  exp_percent: number;
  exp?: number;
  image_url?: string;
  as_of?: string;
  fetched_at: number;
}

/** 每 10 分鐘更新一次 */
export const REFRESH_MS = 10 * 60_000;

/** 成長量（等值百分比：一級算 100） */
export interface Progress {
  today: number;
  session: number;
}

interface RawProgress {
  today: number;
  session: number;
  today_base_at: number | null;
  session_base_at: number | null;
}

/** 本機時區今天 00:00。日界是本機的事，後端不處理時區，由這裡算好給它 */
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 記一筆並拿回成長量 */
export async function recordProgress(
  slot: string,
  level: number,
  expPercent: number,
): Promise<Progress> {
  const r = await invoke<RawProgress>("record_progress", {
    slot,
    level,
    expPercent,
    dayStart: startOfToday(),
  });
  return { today: r.today, session: r.session };
}

/** 不寫入，只讀出目前的成長量（畫面重建時用） */
export async function readProgress(slot: string): Promise<Progress> {
  const r = await invoke<RawProgress>("progress_summary", {
    slot,
    dayStart: startOfToday(),
  });
  return { today: r.today, session: r.session };
}

export async function fetchCharacter(name: string, apiKey: string): Promise<CharacterInfo> {
  const r = await invoke<RawCharacter>("fetch_character", { name, apiKey });
  return {
    name: r.name,
    job: r.job,
    world: r.world,
    level: r.level,
    expPercent: r.exp_percent,
    exp: r.exp,
    imageUrl: r.image_url,
    asOf: r.as_of,
    fetchedAt: r.fetched_at,
  };
}
