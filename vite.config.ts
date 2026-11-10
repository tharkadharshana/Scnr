import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [
    react(),
    tailwindcss(),
    // Installable app plus a cached app shell. Short links (scnr.tharkak.com/<slug>) and /api are never answered from the cache:
    // the worker must see every scan, so navigation fallback is limited to the app's own routes.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/icons/apple-touch-icon.png', 'assets/icons/icon.svg'],
      manifest: {
        name: 'Scnr',
        short_name: 'Scnr',
        description: 'Dynamic QR codes, pages and forms with scan analytics.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#E85D3A',
        background_color: '#FFFFFF',
        icons: [
          { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/assets/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?:$|(?:create|edit|kit|pages|forms|bulk|api-docs|analytics|billing|pricing|settings|admin|login|legal|tools|whats-new)(?:\/|$))/],
        // Precache only the app shell. The other (lazy) chunks are saved the first time a page needs them, so a new visitor on mobile data does not download every page up front.
        globPatterns: ['index.html', '*/index.html', '*/*/index.html', 'manifest.webmanifest', 'assets/index-*.{js,css}'], // shell plus the small prerendered public pages
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: ({ url }) => /^\/assets\/.+\.(js|css)$/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'chunks', expiration: { maxEntries: 80, maxAgeSeconds: 30 * 86400 } } }, // file names carry a content hash, so a cached chunk is never stale
          { urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com', handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    proxy: {
      '^/api/': 'http://localhost:3000' // a plain '/api' key would also catch the /api-docs page
    }
  },
});
