import {fileURLToPath} from "node:url";
import {config} from "dotenv";
import {defineConfig} from "vitest/config";

config({path: ".env.local", quiet: true});

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      "server-only": src("./src/test/server-only.ts"),
    },
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  }
});