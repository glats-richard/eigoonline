import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist");

if (!fs.existsSync(distDir)) {
  console.warn("[postbuild] dist/ not found; skipping sitemap alias.");
  process.exit(0);
}

const candidates = [
  { dir: distDir, label: "dist" },
  { dir: path.join(distDir, "client"), label: "dist/client" }, // adapters place static assets here
];

let wrote = false;
for (const c of candidates) {
  const src = path.join(c.dir, "sitemap-index.xml");
  const dest = path.join(c.dir, "sitemap.xml");
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, dest);
  console.log(`[postbuild] wrote ${c.label}/sitemap.xml (alias to sitemap-index.xml)`);
  wrote = true;
}

if (!wrote) {
  console.warn("[postbuild] sitemap-index.xml not found; skipping sitemap alias.");
}

