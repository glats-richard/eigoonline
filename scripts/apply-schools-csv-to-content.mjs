import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCHOOLS_DIR = path.resolve(ROOT, "src/content/schools");

function splitLines(s) {
  return String(s ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function stripLeadingBullet(v) {
  return String(v ?? "")
    .replace(/^[\s\u3000]+/, "")
    .replace(/^(?:[・•\-–—*]\s*)+/, "")
    .trim();
}

function looksLikeJsonValue(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  // Common corruption from spreadsheet exports: JSON array/object text in a single cell.
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) return true;
  // Heuristic: PR section JSON often contains these keys.
  if (s.includes('"iconText"') || s.includes('"title"') || s.includes('"body"') || s.includes('"image"')) return true;
  return false;
}

function parseBulletsFromCell(s) {
  if (looksLikeJsonValue(String(s ?? ""))) return [];
  return splitLines(s)
    .map(stripLeadingBullet)
    .filter(Boolean);
}

// Minimal RFC4180 CSV parser (supports quoted fields with commas/newlines)
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM

  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") {
        pushField();
        pushRow();
        i += 2;
        continue;
      }
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  pushField();
  if (row.length) pushRow();

  const normalizeHeader = (h) => String(h ?? "").replace(/^\uFEFF/, "").trim();
  const findHeaderIndex = () => {
    const limit = Math.min(rows.length, 20);
    for (let r = 0; r < limit; r++) {
      const hs = (rows[r] ?? []).map(normalizeHeader).map((x) => x.toLowerCase());
      const set = new Set(hs.filter(Boolean));
      if (set.has("id") && (set.has("name") || set.has("officialurl"))) return r;
    }
    return 0;
  };

  const headerIdx = findHeaderIndex();
  const headers = (rows[headerIdx] ?? []).map(normalizeHeader);

  const records = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const vals = rows[r];
    if (!vals || !vals.length) continue;
    const rec = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      rec[key] = String(vals[c] ?? "");
    }
    if (!String(rec.id ?? "").trim()) continue;
    records.push(rec);
  }
  return { headers, records };
}

function normalizePrSections(prSections) {
  if (!Array.isArray(prSections)) return prSections;
  for (const it of prSections) {
    const img = it && typeof it === "object" ? it.image : null;
    if (!img || typeof img !== "object") continue;
    const src = String(img.src ?? "").trim();
    if (!src) continue;
    const m = src.match(/^\/pr\/([a-z0-9_-]+)og-(\d+)\.webp$/i);
    if (m) img.src = `/pr/${m[1]}/og-${m[2]}.webp`;
  }
  return prSections;
}

function parseJsonArrayOrEmpty(v, label) {
  const s = String(v ?? "").trim();
  if (!s) return [];
  let parsed;
  try {
    parsed = JSON.parse(s);
  } catch (e) {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array`);
  if (label === "prSections") normalizePrSections(parsed);
  return parsed;
}

function shouldSkipPlaceholder(v) {
  const s = String(v ?? "").trim();
  if (!s) return true;
  if (s.includes("〇〇")) return true;
  return false;
}

async function readSchoolJson(id) {
  const fp = path.join(SCHOOLS_DIR, `${id}.json`);
  const raw = await fs.readFile(fp, "utf8");
  return { fp, data: JSON.parse(raw) };
}

async function writeSchoolJson(fp, data) {
  await fs.writeFile(fp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((x) => x && !x.startsWith("-"));
  if (!csvPath) {
    console.error(
      "Usage: node scripts/apply-schools-csv-to-content.mjs <path-to-csv> [--only-editorial-comments] [--fill-empty-only]",
    );
    process.exit(1);
  }

  const onlyEditorial = args.includes("--only-editorial-comments");
  const fillEmptyOnly = args.includes("--fill-empty-only");

  const csvText = await fs.readFile(csvPath, "utf8");
  const { records } = parseCsv(csvText);

  const applied = [];
  const skipped = [];
  const errors = [];

  for (const r of records) {
    const id = String(r.id ?? "").trim();
    try {
      const { fp, data } = await readSchoolJson(id);

      if (!onlyEditorial) {
        // Safety-first: apply PR fields only (spreadsheet exports can contain corrupted values).
        if (!shouldSkipPlaceholder(r.prSectionTitle)) {
          data.prSectionTitle = String(r.prSectionTitle).trim();
        }

        const prSections = parseJsonArrayOrEmpty(r.prSections ?? "", "prSections");
        if (Array.isArray(prSections) && prSections.length) {
          data.prSections = prSections;
        }
      }

      const editorialComments = parseBulletsFromCell(r.editorialComments ?? "");
      if (editorialComments.length) {
        const current = Array.isArray(data.editorialComments) ? data.editorialComments : [];
        if (!fillEmptyOnly || current.length === 0) {
          data.editorialComments = editorialComments;
        }
      }

      await writeSchoolJson(fp, data);
      applied.push(id);
    } catch (e) {
      // If the school JSON doesn't exist in repo, skip.
      if (String(e?.code ?? "") === "ENOENT") {
        skipped.push(id);
      } else {
        errors.push({ id, error: e?.message ?? String(e) });
      }
    }
  }

  console.log(`[apply-schools-csv] applied=${applied.length} skipped=${skipped.length} errors=${errors.length}`);
  if (errors.length) {
    for (const x of errors.slice(0, 20)) console.warn(`[apply-schools-csv] ${x.id}: ${x.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

