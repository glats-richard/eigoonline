// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
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