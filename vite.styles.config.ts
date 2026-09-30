import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// dist/styles.css: Tailwind base, the design tokens, variants, fonts and (from V3 on)
// the utilities the components use. Runs after the JS build, so it must not empty dist/.
export default defineConfig({
  plugins: [tailwindcss()],
  base: "./", // url() of fonts relative to styles.css, wherever the package is installed
  build: {
    target: "es2020",
    emptyOutDir: false,
    rollupOptions: {
      input: { styles: "src/styles/index.css" },
      output: {
        // The stylesheet keeps a stable name; the fonts it references stay hashed in assets/.
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith(".css")) ? "[name][extname]" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
