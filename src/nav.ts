import type { Component } from "vue";
import HomePage from "./views/HomePage.vue";
import BurnTimer from "./views/BurnTimer.vue";

/**
 * 導覽列＝這張表。要加一個新功能頁只動這裡：
 * 寫一支 views/*.vue，再往 NAV 加一列（id / 標題 / 提示 / component）。
 * id 只在這張表與 localStorage 裡出現，其他地方不該寫死。
 */
export interface NavItem {
  id: string;
  label: string;
  hint: string;
  view: Component;
}

export const NAV: NavItem[] = [
  {
    id: "home",
    label: "主頁",
    hint: "角色的等級與經驗進度",
    view: HomePage,
  },
  {
    id: "burn",
    label: "輪燒計時器",
    hint: "輪迴與燃燒的場次計時",
    view: BurnTimer,
  },
];
