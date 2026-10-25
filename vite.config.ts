import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/favicon.svg', 'brand/apple-touch-icon.png'],
      manifest: {
        name: 'Classe A Barbearia',
        short_name: 'Classe A',
        description: 'Agende corte e barba na Classe A Barbearia.',
        lang: 'pt-BR',
        theme_color: '#050505',
        background_color: '#050505',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
            if (id.includes('firestore')) return 'firebase-firestore';
            if (id.includes('auth')) return 'firebase-auth';
            if (id.includes('functions')) return 'firebase-functions';
            return 'firebase-core';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-')) return 'motion';
        },
      },
    },
  },
  // Pre-bundle everything up front: lazy routes otherwise trigger slow re-optimisation reloads in dev.
  optimizeDeps: {
    include: [
      'react', 'react-dom/client', 'react-router', 'framer-motion', 'zustand', 'zustand/middleware',
      '@tanstack/react-query', 'react-hook-form', '@hookform/resolvers/zod', 'zod', 'react-imask',
      '@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-switch', '@radix-ui/react-toast',
      'lucide-react', 'clsx', 'tailwind-merge', 'date-fns', 'date-fns/locale', 'date-fns-tz',
      'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage', 'firebase/app-check',
      'react-markdown', 'remark-gfm', 'qrcode',
    ],
  },
  server: { port: 5173 },
});
