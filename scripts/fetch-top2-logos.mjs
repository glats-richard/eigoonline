import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PAGE_URL = "https://search-online-eikaiwa.com/ranking/top2";
const OUT_DIR = path.resolve("public/logos");
const SCHOOLS_DIR = path.resolve("src/content/schools");

function extFromContentType(ct) {
  const v = (ct || "").toLowerCase().split(";")[0].trim();
  if (v === "image/png") return "png";
  if (v === "image/jpeg") return "jpg";
  if (v === "image/webp") return "webp";
  if (v === "image/svg+xml") return "svg";
  if (v === "image/gif") return "gif";
  return "bin";
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type");
  return { buf, ct };
}

function extractCompanyImages(html) {
  // Capture any of logo_ / c1_img_ / mainimg_pc_ assets.
  const re = /\/file\/company\/(\d+)\/(logo_\d+|c1_img_\d+|mainimg_pc_\d+)/g;
  const hits = [...html.matchAll(re)].map((m) => ({
    companyId: m[1],
    asset: m[2],
  }));

  const byCompany = new Map();
  for (const h of hits) {
    const prev = byCompany.get(h.companyId);
    // Prefer: logo_ > c1_img_ > mainimg_pc_
    const score = h.asset.startsWith("logo_") ? 3 : h.asset.startsWith("c1_img_") ? 2 : 1;
    if (!prev || score > prev.score) {
      byCompany.set(h.companyId, { score, path: `/file/company/${h.companyId}/${h.asset}` });
    }
  }
  return [...byCompany.entries()].map(([companyId, v]) => ({
    companyId,
    url: `https://search-online-eikaiwa.com${v.path}`,
  }));
}

function extractNameToCompanyId(html) {
  // Try to map the "contents1" list items: service name + company image.
  // This is intentionally tolerant (DOTALL).
  const re = /contents1__name">([^<]+)<[\s\S]*?src="\/file\/company\/(\d+)\/c1_img_\2"/g;
  const map = new Map();
  for (const m of html.matchAll(re)) {
    const name = m[1].trim();
    const companyId = m[2];
    if (!map.has(name)) map.set(name, companyId);
  }
  return map;
}

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const html = await fetchText(PAGE_URL);
  const companyImages = extractCompanyImages(html);
  const nameToCompanyId = extractNameToCompanyId(html);

  const downloaded = [];
  for (const { companyId, url } of companyImages) {
    const { buf, ct } = await fetchBinary(url);
    const ext = extFromContentType(ct);
    const filename = `company-${companyId}.${ext}`;
    const outPath = path.join(OUT_DIR, filename);
    await writeFile(outPath, buf);
    downloaded.push({ companyId, url, contentType: ct, filename, publicPath: `/logos/${filename}` });
    // eslint-disable-next-line no-console
    console.log(`[logo] saved ${filename} (${ct || "unknown"})`);
  }

  // Update our school content to use local logos when possible.
  // Match by name (exact or includes).
  const files = (await (await import("node:fs/promises")).readdir(SCHOOLS_DIR)).filter((f) =>
    f.endsWith(".json")
  );

  for (const f of files) {
    const fp = path.join(SCHOOLS_DIR, f);
    const data = await readJson(fp);
    const name = String(data.name || "");

    // Find a company id by exact match first, then includes match.
    let companyId = nameToCompanyId.get(name);
    if (!companyId) {
      for (const [n, id] of nameToCompanyId.entries()) {
        if (name.includes(n) || n.includes(name)) {
          companyId = id;
          break;
        }
      }
    }
    if (!companyId) continue;

    const saved = downloaded.find((d) => d.companyId === companyId);
    if (!saved) continue;

    data.logoUrl = saved.publicPath;
    await writeFile(fp, JSON.stringify(data, null, 2));
    // eslint-disable-next-line no-console
    console.log(`[schools] updated ${f}: logoUrl=${saved.publicPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

