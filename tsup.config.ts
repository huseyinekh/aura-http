import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/error.ts", "src/types.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  splitting: false,
  target: "es2020",
  outDir: "dist",
  platform: "neutral"
});

