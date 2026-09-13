import { createApp } from "vue";
import { createPinia } from "pinia";
import "./styles.css";
import App from "./App.vue";
import { initTheme } from "./theme";

initTheme();

createApp(App).use(createPinia()).mount("#app");
