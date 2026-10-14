import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { DEFAULT_SETTINGS as D } from './src/lib/defaults.ts'
import { buildCalendar } from './src/lib/ics.ts'
import { buildMilestones, parseISO } from './src/lib/time.ts'

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  plugins: [
    react(),
    {
      // iPhone Takvim aboneliği için sabit özel gün dosyası
      name: 'ozel-gunler-ics',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'ozel-gunler.ics',
          source: buildCalendar(D.a, D.b, buildMilestones(parseISO(D.start))),
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Birlikte',
        short_name: 'Birlikte',
        description: 'Birlikte geçen günlerimiz ve anılarımız.',
        lang: 'tr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#170c22',
        theme_color: '#170c22',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { environment: 'node' },
})
