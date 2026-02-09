import { mkdir, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT_DIR = path.resolve(ROOT, "public/pr");

function uniq(xs) {
  return [...new Set(xs.filter(Boolean))];
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // Be a polite, generic UA; some CDNs block default fetch UA.
      "user-agent": "eigoonline-bot/1.0 (+https://eigoonline.com)",
      "accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch HTML ${url}: ${res.status}`);
  return await res.text();
}

function resolveUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractOgImages(html, pageUrl) {
  const out = [];

  const getAttr = (tag, name) => {
    const re = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i");
    const m = tag.match(re);
    return m ? m[2] : null;
  };

  // Parse all <meta ...> tags, attribute-order independent.
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const prop = (getAttr(tag, "property") || "").toLowerCase();
    const name = (getAttr(tag, "name") || "").toLowerCase();
    const content = getAttr(tag, "content");
    if (!content) continue;

    if (prop === "og:image" || prop === "og:image:secure_url") {
      out.push(resolveUrl(pageUrl, content));
      continue;
    }
    if (name === "twitter:image") {
      out.push(resolveUrl(pageUrl, content));
      continue;
    }
  }

  // fallback: <link rel="image_src" href="...">
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (getAttr(tag, "rel") || "").toLowerCase();
    const href = getAttr(tag, "href");
    if (rel === "image_src" && href) out.push(resolveUrl(pageUrl, href));
  }

  return uniq(out);
}

function extractInlineImageCandidates(html, pageUrl) {
  const out = [];

  // <img src="...">
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=(['"])([^'"]+)\1[^>]*>/gi)) {
    out.push(resolveUrl(pageUrl, m[2]));
  }

  // <source srcset="a 1x, b 2x"> (take first URL)
  for (const m of html.matchAll(/<source\b[^>]*\bsrcset=(['"])([^'"]+)\1[^>]*>/gi)) {
    const raw = String(m[2] || "");
    const first = raw.split(",")[0]?.trim().split(/\s+/)[0];
    if (first) out.push(resolveUrl(pageUrl, first));
  }

  const isImageUrl = (u) => /\.(png|jpe?g|webp)(\?|#|$)/i.test(String(u || ""));
  const isProbablyNoise = (u) => /header-nav|sprite|icon|favicon/i.test(String(u || ""));

  return uniq(out).filter(isImageUrl).filter((u) => !isProbablyNoise(u));
}

async function fetchBinary(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "eigoonline-bot/1.0 (+https://eigoonline.com)",
      "accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
  return { buf, ct };
}

function isProbablySvg(url, ct) {
  if (ct === "image/svg+xml") return true;
  return /\.svg(\?|#|$)/i.test(url);
}

async function writeWebp(outPath, inputBuf) {
  await sharp(inputBuf)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(outPath);
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function generateForService(service) {
  const outDir = path.join(OUT_DIR, service.schoolId);
  await ensureDir(outDir);

  const ogCandidates = [];
  for (const pageUrl of service.pages) {
    try {
      const html = await fetchText(pageUrl);
      ogCandidates.push(...extractOgImages(html, pageUrl));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[pr:og] ${service.schoolId}: failed to inspect ${pageUrl}: ${e?.message ?? e}`);
    }
  }

  let candidates = uniq(ogCandidates);
  if (!candidates.length) {
    // Some sites do not set og:image. Fall back to inline images.
    const inline = [];
    for (const pageUrl of service.pages) {
      try {
        const html = await fetchText(pageUrl);
        inline.push(...extractInlineImageCandidates(html, pageUrl));
      } catch {
        // ignore
      }
    }
    candidates = uniq(inline);
  }

  if (!candidates.length) {
    // eslint-disable-next-line no-console
    console.warn(`[pr:og] ${service.schoolId}: no image candidates found`);
    return [];
  }

  const saved = [];
  let idx = 0;
  for (const url of candidates) {
    if (saved.length >= service.maxImages) break;
    try {
      const { buf, ct } = await fetchBinary(url);
      if (isProbablySvg(url, ct)) continue;
      idx += 1;
      const outName = `og-${idx}.webp`;
      const outPath = path.join(outDir, outName);
      await writeWebp(outPath, buf);
      saved.push(`/pr/${service.schoolId}/${outName}`);
      // eslint-disable-next-line no-console
      console.log(`[pr:og] ${service.schoolId}: ${url} -> ${outName}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[pr:og] ${service.schoolId}: failed ${url}: ${e?.message ?? e}`);
    }
  }

  // Write a tiny manifest for debugging (optional).
  try {
    const metaPath = path.join(outDir, "og-manifest.json");
    const body = {
      schoolId: service.schoolId,
      pages: service.pages,
      saved,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(metaPath, JSON.stringify(body, null, 2));
  } catch {
    // ignore
  }

  return saved;
}

async function main() {
  if (!fs.existsSync(path.resolve(ROOT, "public"))) {
    console.error("[fetch-pr-images] public/ not found");
    process.exit(1);
  }
  await ensureDir(OUT_DIR);

  const services = [
    {
      schoolId: "kimini",
      pages: ["https://kimini.online/", "https://kimini.online/price/"],
      maxImages: 2,
    },
    {
      schoolId: "dmm",
      pages: ["https://eikaiwa.dmm.com/", "https://eikaiwa.dmm.com/guide/advantage/"],
      maxImages: 2,
    },
    {
      schoolId: "nativecamp",
      pages: ["https://nativecamp.net/", "https://nativecamp.net/usage/price"],
      maxImages: 2,
    },
    {
      schoolId: "bizmate",
      pages: ["https://www.bizmates.jp/", "https://www.bizmates.jp/price/"],
      maxImages: 2,
    },
    {
      schoolId: "berlitz",
      pages: ["https://www.berlitz.com/ja-jp/languages/english/online", "https://www.berlitz.com/ja-jp/adults/pricing"],
      maxImages: 2,
    },
    {
      schoolId: "ecc",
      pages: ["https://online.ecc.co.jp/", "https://online.ecc.co.jp/price/"],
      maxImages: 2,
    },
    {
      schoolId: "clouty",
      pages: ["https://www.cloudt.jp/", "https://www.cloudt.jp/about/strength/"],
      maxImages: 2,
    },
    {
      schoolId: "rarejob",
      pages: ["https://www.rarejob.com/", "https://www.rarejob.com/experiences/trial/"],
      maxImages: 2,
    },
    {
      schoolId: "globalcrown",
      pages: ["https://www.global-crown.com/", "https://www.global-crown.com/get_start"],
      maxImages: 2,
    },
  ];

  for (const s of services) {
    await generateForService(s);
  }
}

main().catch((e) => {
  console.error("[fetch-pr-images] failed", e);
  process.exit(1);
});

