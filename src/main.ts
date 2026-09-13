import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles.css";
import App from "./App.vue";
import FloatApp from "./FloatApp.vue";
import { initTheme } from "./theme";

initTheme();

// 浮動視窗是同一份前端、不同進入點（index.html?view=float）
const isFloat = new URLSearchParams(location.search).get("view") === "float";

createApp(isFloat ? FloatApp : App)
  .use(createPinia())
  .mount("#app");
