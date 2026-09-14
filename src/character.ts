import { ref } from "vue";

/**
 * 角色資料。
 *
 * ★資料來源還沒接上：`fetchCharacter` 目前是空的，等官方 API 的端點與回傳格式
 * 確定之後只要改那一支，UI 這邊不用動。型別先定下來，是為了讓畫面知道自己要
 * 顯示哪些欄位。
 */
export interface CharacterInfo {
  name: string;
  /** 職業（有的話顯示在名字旁邊） */
  job?: string;
  level: number;
  /** 這一級已經賺到的比例，0~100 */
  expPercent: number;
  /** 累積經驗值，顯示用的原始數字 */
  exp?: number;
  /** 角色圖網址 */
  imageUrl?: string;
  /** 這筆資料抓下來的時刻 */
  fetchedAt: number;
}

/** 每 10 分鐘更新一次 */
export const REFRESH_MS = 10 * 60_000;

/** 兩張卡各記一個角色名（設定好之後就固定抓這隻） */
const NAMES_KEY = "kz-maplestory:character-names";

export const names = ref<Record<string, string>>(loadNames());

function loadNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function setName(slot: string, name: string) {
  names.value = { ...names.value, [slot]: name.trim() };
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names.value));
  } catch {
    /* 存不了就只在這次執行有效 */
  }
}

export async function fetchCharacter(_name: string, _apiKey: string): Promise<CharacterInfo> {
  throw new Error("尚未接上官方 API");
}
