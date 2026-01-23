import { mkdir } from "node:fs/promises";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUBLIC_DIR = path.resolve(ROOT, "public");
const OUT_DIR = path.resolve(PUBLIC_DIR, "pr");

/**
 * Local-only PR asset builder.
 * - Takes existing images in public/ (logos, banners, etc)
 * - Writes resized WebP assets to public/pr/<schoolId>/
 */
const manifest = [
  {
    schoolId: "kimini",
    assets: [
      { src: "public/kimini_detail_banner.png", out: "hero.webp", width: 1200 },
      { src: "public/banners/company-30.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-30.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "dmm",
    assets: [
      { src: "public/banners/company-39.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-39.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "nativecamp",
    assets: [
      { src: "public/banners/company-70.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-70.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "bizmate",
    assets: [
      { src: "public/banners/company-27.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-27.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "berlitz",
    assets: [
      { src: "public/banners/company-51.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-51.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "ecc",
    assets: [
      { src: "public/banners/company-71.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-71.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "clouty",
    assets: [
      { src: "public/banners/company-62.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-62.webp", out: "logo.webp", width: 600 },
    ],
  },
  {
    schoolId: "rarejob",
    assets: [
      { src: "public/banners/company-50.webp", out: "banner.webp", width: 1200 },
      { src: "public/logos/company-50.webp", out: "logo.webp", width: 600 },
    ],
  },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function readLocal(relPath) {
  const abs = path.resolve(ROOT, relPath);
  return await fs.readFile(abs);
}

async function buildOne({ schoolId, assets }) {
  const outDir = path.join(OUT_DIR, schoolId);
  await ensureDir(outDir);

  for (const a of assets) {
    const input = await readLocal(a.src);
    const outPath = path.join(outDir, a.out);

    await sharp(input)
      .resize({ width: a.width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(outPath);

    // eslint-disable-next-line no-console
    console.log(`[pr] ${schoolId}: ${a.src} -> public/pr/${schoolId}/${a.out}`);
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  for (const entry of manifest) {
    await buildOne(entry);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

