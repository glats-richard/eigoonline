import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCHOOLS_DIR = path.join(ROOT, "src", "content", "schools");
const OUT_PATH = path.join(ROOT, "exports", "schools.csv");

function toCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // RFC4180-ish CSV escaping
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function joinLines(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.filter(Boolean).map(String).join("\n");
}

function sourcesToLines(arr) {
  if (!Array.isArray(arr)) return "";
  return arr
    .map((x) => {
      if (!x) return "";
      const label = x.label ? String(x.label) : "";
      const url = x.url ? String(x.url) : "";
      const type = x.type ? String(x.type) : "";
      return [type && `[${type}]`, label, url].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join("\n");
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const files = (await fs.readdir(SCHOOLS_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "ja"));

  const rows = [];

  for (const f of files) {
    const id = f.replace(/\.json$/, "");
    const data = await readJson(path.join(SCHOOLS_DIR, f));
    rows.push({
      id,
      name: data.name ?? "",
      officialUrl: data.officialUrl ?? "",
      planUrl: data.planUrl ?? "",
      bannerHref: data.bannerHref ?? "",
      bannerImage: data.bannerImage ?? "",
      bannerAlt: data.bannerAlt ?? "",

      priceText: data.priceText ?? "",
      trialText: data.trialText ?? "",
      benefitText: data.benefitText ?? "",
      hoursText: data.hoursText ?? "",

      rating: data.rating ?? "",
      teacherQuality: data.teacherQuality ?? "",
      materialQuality: data.materialQuality ?? "",
      connectionQuality: data.connectionQuality ?? "",

      campaignText: data.campaignText ?? "",
      campaignEndsAt: data.campaignEndsAt ?? "",
      campaignBullets: joinLines(data.campaignBullets),

      summary: data.summary ?? "",
      features: joinLines(data.features),
      points: joinLines(data.points),
      recommendedFor: joinLines(data.recommendedFor),
      uniquenessTitle: data.uniquenessTitle ?? "",
      uniquenessBullets: joinLines(data.uniquenessBullets),
      primarySources: sourcesToLines(data.primarySources),

      sourceUrl: data.source?.url ?? "",
      sourceNote: data.source?.note ?? "",
    });
  }

  const headers = Object.keys(rows[0] ?? {});
  const csv =
    headers.map(toCell).join(",") +
    "\n" +
    rows.map((r) => headers.map((h) => toCell(r[h])).join(",")).join("\n") +
    "\n";

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, csv, "utf8");
  process.stdout.write(`wrote ${OUT_PATH} (${rows.length} rows)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

