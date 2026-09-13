import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// 埠固定 1440：這台機器上還有別的 dev server 佔著 1420 與 1430
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
