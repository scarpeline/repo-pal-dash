import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
      },
      manifest: {
        name: 'IAProgramador',
        short_name: 'IAP',
        description: 'Editor de código online com inteligência artificial integrada.',
        theme_color: '#22c55e',
        icons: [
          {
            src: 'https://storage.googleapis.com/gpt-engineer-file-uploads/W0BBV8Ucd5X8aOF533hC26sQDeM2/social-images/social-1775339955350-ChatGPT_Image_3_de_abr._de_2026,_00_01_23.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any'
          },
          {
            src: 'https://storage.googleapis.com/gpt-engineer-file-uploads/W0BBV8Ucd5X8aOF533hC26sQDeM2/social-images/social-1775339955350-ChatGPT_Image_3_de_abr._de_2026,_00_01_23.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'maskable'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
