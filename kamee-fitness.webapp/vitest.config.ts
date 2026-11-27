import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "app/admin/(panel)/coaching-conversations/actions.test.ts",
      "app/admin/(panel)/coaches/actions.test.ts",
    ],
  },
});
