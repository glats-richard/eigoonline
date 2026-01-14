import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");
const src = path.join(distDir, "sitemap-index.xml");
const dest = path.join(distDir, "sitemap.xml");

if (!fs.existsSync(distDir)) {
  console.warn("[postbuild] dist/ not found; skipping sitemap alias.");
  process.exit(0);
}

if (!fs.existsSync(src)) {
  console.warn("[postbuild] sitemap-index.xml not found; skipping sitemap alias.");
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log("[postbuild] wrote dist/sitemap.xml (alias to sitemap-index.xml)");

