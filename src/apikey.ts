import { ref } from "vue";

/**
 * 玩家自己的遊戲 API 金鑰（主頁的角色資料要用）。
 *
 * 存在瀏覽器儲存區，跟其他設定一樣是明文——這是本機工具，金鑰只離開過你自己的
 * 電腦一次（送去官方 API）。不要把它跟別人共用的機器混在一起用。
 */
const KEY = "kz-maplestory:api-key";

function load() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export const apiKey = ref(load());

export function setApiKey(v: string) {
  apiKey.value = v.trim();
  try {
    if (apiKey.value) localStorage.setItem(KEY, apiKey.value);
    else localStorage.removeItem(KEY);
  } catch {
    /* 存不了就只在這次執行有效 */
  }
}
