import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_URL =
  "https://kimini.online/blog/wp-content/uploads/2026/01/side_640x1080_20260127_freetrial30.jpg";

const OUT_DIR = path.join(process.cwd(), "public", "banners");
const OUT_FILE = path.join(OUT_DIR, "kimini-freetrial30.webp");

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const res = await fetch(SOURCE_URL, {
    headers: {
      // Some hosts block the default Node user-agent.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());

  // Convert to WebP (keep original size/aspect).
  await sharp(buf)
    .webp({ quality: 84 })
    .toFile(OUT_FILE);

  // eslint-disable-next-line no-console
  console.log(`Saved: ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

