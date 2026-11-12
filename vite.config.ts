import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Nocturne Reader',
        short_name: 'Nocturne',
        description: 'An offline-first night reading app for PDF, PSD and text documents.',
        theme_color: '#090A0F',
        background_color: '#090A0F',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell, fonts and (later) the PDF worker are available offline.
        globPatterns: ['**/*.{js,css,html,woff2,mjs,png}'],
        // pdf.js data files are large and rarely needed: cache them on first use.
        globIgnores: ['**/pdfjs/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/pdfjs/'),
            handler: 'CacheFirst',
            options: { cacheName: 'nocturne-pdf-assets', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Streamed ambient audio: once heard, it plays offline.
            urlPattern: ({ url }) => /\.(mp3|aac)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nocturne-audio',
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // One jsdom per worker instead of one per file; files stay isolated.
    pool: 'vmThreads',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
  },
});
