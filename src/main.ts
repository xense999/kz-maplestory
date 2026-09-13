import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles.css";
import App from "./App.vue";
import FloatApp from "./FloatApp.vue";
import { initTheme } from "./theme";

// 浮動視窗是同一份前端、不同進入點（index.html?view=float）
const isFloat = new URLSearchParams(location.search).get("view") === "float";

if (isFloat) {
  // 浮動視窗永遠深色：它蓋在遊戲畫面上，淺色會變成一塊刺眼的白，
  // 所以刻意不跟主視窗的外觀設定連動
  document.documentElement.dataset.theme = "dark";
} else {
  initTheme();
}

createApp(isFloat ? FloatApp : App)
  .use(createPinia())
  .mount("#app");
