import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import desktopPlugin from "./vite.js"

export default defineConfig({
  plugins: [
    desktopPlugin,
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        inlineWorkboxRuntime: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        globPatterns: [
          "index.html",
          "site.webmanifest",
          "favicon*",
          "apple-touch-icon*",
          "web-app-manifest*",
          "assets/index-*.{js,css}",
          "assets/session-*.js",
          "assets/IBMPlexMono-Text-*.woff2",
          "assets/Inter.ttf",
          "assets/JetBrainsMonoNerdFontMono-Regular.woff2",
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "opencode-assets",
              cacheableResponse: {
                statuses: [200],
              },
              expiration: {
                maxEntries: 1000,
              },
            },
          },
        ],
      },
    }),
  ] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
})
