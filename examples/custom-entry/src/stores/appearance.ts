import { defineStore } from "pinia";

export const useAppearanceStore = defineStore("appearance", {
  state: () => ({ compact: false }),
});
