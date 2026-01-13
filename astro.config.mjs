// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Allow Railway + custom domain host headers for preview server
    preview: {
      allowedHosts: ['eigoonline.com', '.up.railway.app']
    },
    // (Optional) keep dev server consistent if accessed via custom host
    server: {
      allowedHosts: ['eigoonline.com', '.up.railway.app']
    }
  }
});