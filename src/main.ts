import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles.css";
import App from "./App.vue";
import FloatApp from "./FloatApp.vue";
import FloatProgress from "./FloatProgress.vue";
import { initTheme } from "./theme";

// 三個進入點共用同一份前端，靠 query 分辨：主視窗、輪燒面板、角色進度面板
const view = new URLSearchParams(location.search).get("view");

const root =
  view === "float" ? FloatApp : view === "float-progress" ? FloatProgress : App;

if (view) {
  // 面板永遠深色：它蓋在遊戲畫面上，淺色會變成一塊刺眼的白，
  // 所以刻意不跟主視窗的外觀設定連動
  document.documentElement.dataset.theme = "dark";
} else {
  initTheme();
}

createApp(root).use(createPinia()).mount("#app");
