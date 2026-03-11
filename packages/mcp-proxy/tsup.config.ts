import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/proxy.ts"],
  format: ["esm"],
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
