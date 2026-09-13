import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// 埠固定 1440：1420 是另一個 AI 在用、1430 是 kz-wz，三邊不能互相踩
export default defineConfig(async () => ({
  plugins: [vue()],

  clearScreen: false,
  server: {
    port: 1440,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1441 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
