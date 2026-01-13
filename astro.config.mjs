// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://eigoonline.com',
  integrations: [sitemap()],
  // Astro 5.4+ adds host allowlist checks (preview/dev).
  // Allow custom domain + Railway host headers to avoid "Blocked request".
  // You can tighten this later to an explicit array allowlist.
  server: {
    allowedHosts: true
  },
  vite: {
    plugins: [tailwindcss()],
    // Allow Railway + custom domain host headers for preview server
    preview: {
      // NOTE: Railway + custom domains can present varying Host headers.
      // Setting `true` disables host checking for preview to avoid "Blocked request".
      // If you want to lock this down later, replace with an explicit allowlist.
      allowedHosts: true
    },
    // (Optional) keep dev server consistent if accessed via custom host
    server: {
      allowedHosts: ['eigoonline.com', '.up.railway.app']
    }
  }
});