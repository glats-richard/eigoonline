export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError, query } from "../../../../lib/db";
import { getCollection } from "astro:content";

function json(resBody: any, status = 200) {
  return new Response(JSON.stringify(resBody), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Minimal RFC4180 CSV parser (supports quoted fields with commas/newlines)
function parseCsv(text: string): { headers: string[]; records: Record<string, string>[] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // ignore trailing empty row
    if (row.length === 1 && row[0] === "" && rows.length === 0) return;
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
      // handle CRLF
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

  const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
  const records: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const vals = rows[r];
    if (!vals || !vals.length) continue;
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      rec[key] = String(vals[c] ?? "");
    }
    // skip blank ids
    if (!String(rec.id ?? "").trim()) continue;
    records.push(rec);
  }
  return { headers, records };
}

function splitLines(s: string): string[] {
  return String(s ?? "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNum(v: string): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async ({ request }) => {
  if (dbEnvError) return json({ ok: false, error: dbEnvError }, 500);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, error: "file is required" }, 400);
  const csvText = await file.text();

  const { records } = parseCsv(csvText);
  if (!records.length) return json({ ok: false, error: "No records" }, 400);

  const schools = await getCollection("schools");
  const allowed = new Set(schools.map((s) => s.id));

  const errors: string[] = [];
  let updated = 0;

  for (const r of records) {
    const id = String(r.id ?? "").trim();
    if (!allowed.has(id)) {
      errors.push(`Unknown id: ${id}`);
      continue;
    }

    const data: Record<string, any> = {
      name: r.name?.trim() || undefined,
      officialUrl: r.officialUrl?.trim() || undefined,
      logoUrl: r.logoUrl?.trim() || null,
      planUrl: r.planUrl?.trim() || null,
      bannerHref: r.bannerHref?.trim() || null,
      bannerImage: r.bannerImage?.trim() || null,
      bannerAlt: r.bannerAlt?.trim() || null,
      priceText: r.priceText?.trim() || null,
      trialText: r.trialText?.trim() || null,
      trialDetailText: r.trialDetailText?.trim() || null,
      benefitText: r.benefitText?.trim() || null,
      hoursText: r.hoursText?.trim() || null,
      rating: parseNum(r.rating),
      teacherQuality: parseNum(r.teacherQuality),
      materialQuality: parseNum(r.materialQuality),
      connectionQuality: parseNum(r.connectionQuality),
      campaignText: r.campaignText?.trim() || null,
      campaignEndsAt: r.campaignEndsAt?.trim() || null,
      campaignBullets: splitLines(r.campaignBullets ?? ""),
      summary: r.summary?.trim() || null,
      editorialComments: splitLines(r.editorialComments ?? ""),
      features: splitLines(r.features ?? ""),
      points: splitLines(r.points ?? ""),
      recommendedFor: splitLines(r.recommendedFor ?? ""),
      uniquenessTitle: r.uniquenessTitle?.trim() || null,
      uniquenessBullets: splitLines(r.uniquenessBullets ?? ""),
      tagsSectionTitle: r.tagsSectionTitle?.trim() || null,
      tagsSectionSubtitle: r.tagsSectionSubtitle?.trim() || null,
      recommendedTagsTitle: r.recommendedTagsTitle?.trim() || null,
      featureTagsTitle: r.featureTagsTitle?.trim() || null,
      keyFactsSectionTitle: r.keyFactsSectionTitle?.trim() || null,
      keyFactsSectionSubtitle: r.keyFactsSectionSubtitle?.trim() || null,
      basicDataSectionTitle: r.basicDataSectionTitle?.trim() || null,
      methodologySectionTitle: r.methodologySectionTitle?.trim() || null,
      methodologySectionSubtitle: r.methodologySectionSubtitle?.trim() || null,
      featureSectionTitle: r.featureSectionTitle?.trim() || null,
      reviewsSectionTitle: r.reviewsSectionTitle?.trim() || null,
      reviewsSectionSubtitle: r.reviewsSectionSubtitle?.trim() || null,
    };

    try {
      await query(
        `
        insert into school_overrides (school_id, data, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (school_id)
        do update set data = excluded.data, updated_at = now()
        `,
        [id, JSON.stringify(data)],
      );
      updated += 1;
    } catch (e: any) {
      errors.push(`${id}: ${e?.message ?? String(e)}`);
    }
  }

  return json({ ok: true, updated, errors });
};

