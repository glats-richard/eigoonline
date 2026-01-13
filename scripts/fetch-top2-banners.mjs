import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("public/banners");
const BASE = "https://search-online-eikaiwa.com";

const map = {
  // schoolId -> companyId
  bizmate: "27",
  nativecamp: "70",
  dmm: "39",
  berlitz: "51",
  ecc: "71",
  kimini: "30",
  clouty: "62",
  rarejob: "50",
};

function extFromContentType(ct) {
  const v = (ct || "").toLowerCase().split(";")[0].trim();
  if (v === "image/png") return "png";
  if (v === "image/jpeg") return "jpg";
  if (v === "image/webp") return "webp";
  return "bin";
}

async function fetchBinary(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type");
  return { buf, ct };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const [schoolId, companyId] of Object.entries(map)) {
    const url = `${BASE}/file/company/${companyId}/cpbanner_${companyId}`;
    const { buf, ct } = await fetchBinary(url);
    const ext = extFromContentType(ct);
    const filename = `company-${companyId}.${ext}`;
    await writeFile(path.join(OUT_DIR, filename), buf);
    // eslint-disable-next-line no-console
    console.log(`[banner] ${schoolId} <- ${filename} (${ct || "unknown"})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

