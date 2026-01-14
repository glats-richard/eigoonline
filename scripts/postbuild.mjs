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

// If an adapter outputs static assets under dist/client, mirror them to dist/
// so static hosting setups that expect dist/index.html keep working.
const clientDir = path.join(distDir, "client");
if (fs.existsSync(clientDir) && fs.statSync(clientDir).isDirectory()) {
  const entries = fs.readdirSync(clientDir, { withFileTypes: true });
  for (const ent of entries) {
    const srcPath = path.join(clientDir, ent.name);
    const destPath = path.join(distDir, ent.name);
    // Avoid overwriting the server bundle if present (should not exist under client, but be safe).
    if (ent.name === "server") continue;
    fs.cpSync(srcPath, destPath, { recursive: true });
  }
  console.log("[postbuild] mirrored dist/client/* to dist/* for static hosts");
}

