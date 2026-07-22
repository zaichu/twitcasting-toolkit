import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://twitcasting.tv/"
      }
    },
    globals: true,
    restoreMocks: true
  }
});
