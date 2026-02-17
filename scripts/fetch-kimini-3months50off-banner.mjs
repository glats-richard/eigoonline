import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE_URL =
  "https://kimini.online/other/campaign/20260217_freetrial30/img/PageHeader.jpg";

const OUT_DIR = path.join(process.cwd(), "public", "banners");
const OUT_1X = path.join(OUT_DIR, "kimini-3months50off-329.webp");
const OUT_2X = path.join(OUT_DIR, "kimini-3months50off-658.webp");

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
  const img = sharp(buf);

  await img.clone().resize({ width: 329 }).webp({ quality: 82 }).toFile(OUT_1X);
  await img.clone().resize({ width: 658 }).webp({ quality: 82 }).toFile(OUT_2X);

  // eslint-disable-next-line no-console
  console.log(`Saved: ${path.relative(process.cwd(), OUT_1X)}`);
  // eslint-disable-next-line no-console
  console.log(`Saved: ${path.relative(process.cwd(), OUT_2X)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

