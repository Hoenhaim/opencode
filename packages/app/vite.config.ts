import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import desktopPlugin from "./vite.js"
import { serviceWorker } from "./vite.pwa"

export default defineConfig({
  plugins: [desktopPlugin, serviceWorker(fileURLToPath(new URL("./dist", import.meta.url)))] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    assetsDir: "_assets",
    target: "esnext",
    sourcemap: true,
  },
})
