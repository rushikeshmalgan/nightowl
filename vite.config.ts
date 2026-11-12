import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspPlugin } from './vite/csp';

export default defineConfig(({ mode }) => ({
  plugins: [
    cspPlugin({ supabaseUrl: loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL || undefined }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'NightOwl Reader',
        short_name: 'NightOwl',
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
            options: { cacheName: 'nightowl-pdf-assets', cacheableResponse: { statuses: [0, 200] } },
          },
          {
            // Streamed ambient audio: once heard, it plays offline.
            urlPattern: ({ url }) => /\.(mp3|aac)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nightowl-audio',
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
    testTimeout: 20000,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    // Tests run in local mode, whatever is in .env: no live Supabase calls.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
  },
}));
