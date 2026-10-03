import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // `identity.html` signs in against go-core's dev server (see src/identity/main.ts); /api reaches it from here.
  server: { proxy: { "/api": "http://127.0.0.1:8090" } },
  build: {
    // The manifest lets scripts/check-consumer.mjs follow what each page can reach.
    manifest: true,
    rollupOptions: { input: { index: "index.html", prebuilt: "prebuilt.html", app: "app.html", "app-lite": "app-lite.html", identity: "identity.html" } },
  },
});
