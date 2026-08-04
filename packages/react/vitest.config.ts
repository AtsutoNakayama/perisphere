import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      // CI の test ジョブは build を事前実行しないため（uow-h-code-generation-plan.md 参照）、
      // dist ではなくワークスペースのソースを直接解決する。
      "@perisphere/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
    },
  },
});
