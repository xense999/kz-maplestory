import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles.css";
import App from "./App.vue";
import FloatApp from "./FloatApp.vue";
import FloatProgress from "./FloatProgress.vue";
import FloatMoney from "./FloatMoney.vue";
import { initTheme } from "./theme";

// 四個進入點共用同一份前端，靠 query 分辨：主視窗與三個浮動面板
const view = new URLSearchParams(location.search).get("view");

const PANELS: Record<string, typeof App> = {
  float: FloatApp,
  "float-progress": FloatProgress,
  "float-money": FloatMoney,
};

const root = (view && PANELS[view]) || App;

if (view) {
  // 面板永遠深色：它蓋在遊戲畫面上，淺色會變成一塊刺眼的白，
  // 所以刻意不跟主視窗的外觀設定連動
  document.documentElement.dataset.theme = "dark";
} else {
  initTheme();
}

// 桌面程式不該跳出瀏覽器的右鍵選單（重新整理、檢視原始碼那一套）。
// 但輸入框要留著——右鍵貼上是那裡唯一的貼上方式（金鑰欄位的提示就是叫人貼上）。
// 元件自己的 contextmenu handler 照常運作，這裡只擋預設選單。
document.addEventListener("contextmenu", (e) => {
  const el = e.target as HTMLElement | null;
  if (el?.closest("input, textarea")) return;
  e.preventDefault();
});

createApp(root).use(createPinia()).mount("#app");
