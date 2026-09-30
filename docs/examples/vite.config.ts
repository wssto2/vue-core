import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Vue's compiler and Tailwind v4's Vite plugin: the library ships no build setup of its own.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
});
