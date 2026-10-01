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
  "overlay/index": "src/overlay/index.ts",
  "modal/index": "src/modal/index.ts",
  "page/index": "src/page/index.ts",
  "client/index": "src/client/index.ts",
  "platform/index": "src/platform/index.ts",
  "format/index": "src/format/index.ts",
  "router/index": "src/router/index.ts",
  "app/index": "src/app/index.ts",
  "collection/index": "src/collection/index.ts",
  "resource/index": "src/resource/index.ts",
  "shell/index": "src/shell/index.ts",
  "form/index": "src/form/index.ts",
  "phone/index": "src/phone/index.ts",
};

// Peers and runtime dependencies stay external: the consumer installs one copy of each (a second
// vue-sonner would be a second toast queue).
const externals = [...Object.keys(pkg.peerDependencies), ...Object.keys(pkg.dependencies)];
const external = (id: string) => externals.some((name) => id === name || id.startsWith(`${name}/`));

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
