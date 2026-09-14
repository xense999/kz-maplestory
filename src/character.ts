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

/** 練了多少（等值百分比：一級算 100） */
export interface Growth {
  today: number;
  span: number;
  today_base: string | null;
}

export interface History {
  days: { date: string; level: number; exp_percent: number }[];
  growth: Growth;
}

/** 本機時區的 YYYY-MM-DD */
function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 今天往前數 n 天（含今天）的日期字串 */
function recentDates(n: number) {
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(ymd(d));
  }
  return out;
}

/**
 * 跟官方要這隻角色近幾天的每日快照，順便拿回算好的成長量。
 *
 * ★歷史由官方提供而不是自己記帳：記帳只在程式開著時才有資料，而且換角色時
 * 很容易把兩隻的數字混在一起減。
 */
/**
 * ★天數壓在 2（今天與昨天）：算「今天練了多少」只需要昨天那一筆，而官方對請求數
 * 有限制——一次抓七天、幾隻角色就是十幾個請求，會被回 "Please try again later"。
 * 之後要做趨勢圖再把天數加回來，並且改成一天只抓一次。
 */
export async function fetchHistory(
  name: string,
  apiKey: string,
  latestLevel: number,
  latestExp: number,
  days = 2,
): Promise<History> {
  return invoke<History>("fetch_history", {
    name,
    apiKey,
    dates: recentDates(days),
    today: ymd(new Date()),
    latestLevel,
    latestExp,
  });
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
