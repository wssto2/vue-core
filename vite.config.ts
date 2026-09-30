import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

// One entry per subpath in package.json "exports". A phase that adds a subpath adds its
// entry here: name = path under dist/ (without extension), value = source file.
const entries: Record<string, string> = {
  index: "src/index.ts",
  "icon/index": "src/icon/index.ts",
  "button/index": "src/button/index.ts",
  "controls/index": "src/controls/index.ts",
  "i18n/index": "src/i18n/index.ts",
  "state/index": "src/state/index.ts",
  "content/index": "src/content/index.ts",
  "client/index": "src/client/index.ts",
  "platform/index": "src/platform/index.ts",
};

const peers = Object.keys(pkg.peerDependencies);
const external = (id: string) => peers.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  plugins: [vue()],
  build: {
    target: "es2020",
    lib: { entry: entries, formats: ["es"], fileName: (_format, name) => `${name}.js` },
    rollupOptions: { external },
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});
