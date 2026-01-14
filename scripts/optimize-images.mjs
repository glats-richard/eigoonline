import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.resolve(process.cwd(), "public");

const exts = new Set([".png", ".jpg", ".jpeg"]);
const skipDirs = new Set(["node_modules", ".git", "dist"]);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (skipDirs.has(ent.name)) continue;
      out.push(...walk(p));
    } else if (ent.isFile()) {
      out.push(p);
    }
  }
  return out;
}

function toWebpPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.webp`);
}

async function main() {
  if (!fs.existsSync(publicDir)) {
    console.error("[optimize-images] public/ not found");
    process.exit(1);
  }

  const files = walk(publicDir).filter((p) => exts.has(path.extname(p).toLowerCase()));
  let converted = 0;
  let skipped = 0;

  for (const file of files) {
    const out = toWebpPath(file);
    if (fs.existsSync(out)) {
      skipped++;
      continue;
    }

    // Skip tiny assets where webp isn't beneficial.
    const stat = fs.statSync(file);
    if (stat.size < 8 * 1024) {
      skipped++;
      continue;
    }

    await sharp(file)
      .webp({ quality: 82, effort: 4 })
      .toFile(out);
    converted++;
  }

  console.log(`[optimize-images] converted=${converted} skipped=${skipped} (public/)`);
}

main().catch((err) => {
  console.error("[optimize-images] failed", err);
  process.exit(1);
});

