import * as cheerio from "cheerio";

const TARGETS = [
  { id: "kimini", names: ["kimini英会話", "kimini"] },
  { id: "rarejob", names: ["レアジョブ", "レアジョブ英会話"] },
  { id: "bizmate", names: ["ビズメイツ", "Bizmates", "Bizmate"] },
  { id: "nativecamp", names: ["ネイティブキャンプ", "NativeCamp"] },
  { id: "dmm", names: ["DMM英会話", "DMM"] },
  { id: "berlitz", names: ["ベルリッツ", "Berlitz"] },
  { id: "ecc", names: ["ECCオンライン", "ECCオンラインレッスン", "ECC"] },
  { id: "clouty", names: ["クラウティ", "Cloudt", "Clouty"] },
];

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function absUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function pickMinYen(text) {
  // Picks the smallest "x,xxx円" value found in the string.
  const nums = [];
  // Ignore negative/discount expressions like "－1,000円" or "-1,000円".
  const re = /(^|[^0-9\-－−])([0-9]{1,3}(?:,[0-9]{3})*)\s*円/g;
  let m;
  while ((m = re.exec(String(text ?? "")))) {
    const n = Number(m[2].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) nums.push(n);
  }
  if (!nums.length) return null;
  // Avoid picking obviously-not-a-price values (e.g. coupon/discount) by flooring to >= 1000
  const filtered = nums.filter((n) => n >= 1000);
  return Math.min(...(filtered.length ? filtered : nums));
}

async function fetchHtml(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractRowsFromTable($, table) {
  const rows = {};
  table.find("tr").each((_, tr) => {
    const th = norm($(tr).find("th").first().text());
    const td = $(tr).find("td").first().text().replace(/\s+/g, " ").trim();
    if (!th) return;
    rows[th] = td;
  });
  return rows;
}

function looksLikeBasicInfoTableText(text) {
  const t = norm(text);
  return t.includes("料金プラン") && t.includes("無料体験") && (t.includes("受講できる時間帯") || t.includes("受講時間帯") || t.includes("受講できる時間"));
}

function findServiceHeading($, target) {
  const want = target.names.map(norm).filter(Boolean);
  /** @type {import("cheerio").Cheerio<import("domhandler").Element> | null} */
  let foundRanked = null;
  /** @type {import("cheerio").Cheerio<import("domhandler").Element> | null} */
  let foundAny = null;
  $("h2,h3,h4").each((_, h) => {
    const t = norm($(h).text());
    if (!t) return;
    for (const w of want) {
      if (t.includes(w)) {
        // Prefer numbered ranking headings like "6. ビズメイツ"
        if (/^\d+\.\s/.test($(h).text().trim())) {
          foundRanked = $(h);
          return false;
        }
        if (!foundAny) foundAny = $(h);
        break;
      }
    }
  });
  return foundRanked ?? foundAny;
}

function extractBasicInfoFromTopPage(html, target) {
  const $ = cheerio.load(html);
  const h = findServiceHeading($, target);
  if (!h) return null;

  // Search within the block until the next heading (siblings),
  // but include nested tables inside wrapper elements.
  const block = h.nextUntil("h2,h3,h4");
  const tables = block.find("table").add(block.filter("table"));
  for (let i = 0; i < tables.length; i++) {
    const tbl = tables.eq(i);
    const txt = tbl.text();
    if (!looksLikeBasicInfoTableText(txt)) continue;
    return extractRowsFromTable($, tbl);
  }

  return null;
}

async function main() {
  const topUrl = "https://www.miyamanavi.net/";
  const topHtml = await fetchHtml(topUrl);

  const out = {
    source: topUrl,
    extractedAt: new Date().toISOString(),
    services: {},
  };

  for (const t of TARGETS) {
    try {
      const rows = extractBasicInfoFromTopPage(topHtml, t);
      if (!rows) {
        out.services[t.id] = { ok: false, error: "basic info table not found on top page" };
        continue;
      }
      const pricePlan = rows["料金プラン"] ?? rows["料金（最低料金）"] ?? null;
      const freeTrial = rows["無料体験レッスン"] ?? rows["無料体験"] ?? null;
      const hours = rows["受講できる時間帯"] ?? rows["受講時間帯"] ?? null;
      out.services[t.id] = {
        ok: true,
        url: topUrl,
        pricePlan,
        priceMinYen: pickMinYen(pricePlan),
        freeTrial,
        hours,
        rawKeys: Object.keys(rows),
      };
    } catch (e) {
      out.services[t.id] = { ok: false, error: e?.message ?? String(e) };
    }
  }

  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

