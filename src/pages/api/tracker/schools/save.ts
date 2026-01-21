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

function toArrayFromTextarea(v: unknown): string[] | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return [];
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toNumberOrNull(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function parsePrimarySources(lines: string[] | undefined): { label: string; url: string; type: "official" | "lp" | "pr" }[] | undefined {
  if (!lines) return undefined;
  const out: { label: string; url: string; type: "official" | "lp" | "pr" }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let type: "official" | "lp" | "pr" = "official";
    let rest = line;
    const m = rest.match(/^\[(official|lp|pr)\]\s*(.+)$/i);
    if (m) {
      type = m[1].toLowerCase() as any;
      rest = m[2].trim();
    }
    // url is assumed to be the last token that starts with http(s)
    const parts = rest.split(/\s+/);
    const urlIdx = parts.findIndex((p) => /^https?:\/\//i.test(p));
    const url = urlIdx >= 0 ? parts.slice(urlIdx).join(" ") : "";
    const label = urlIdx >= 0 ? parts.slice(0, urlIdx).join(" ").trim() : rest;
    if (!label || !url) continue;
    out.push({ type, label, url });
  }
  return out;
}

export const POST: APIRoute = async ({ request }) => {
  if (dbEnvError) return json({ ok: false, error: dbEnvError }, 500);

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const schoolId = String(body?.schoolId ?? "").trim();
  const patch = body?.patch ?? null;
  if (!schoolId) return json({ ok: false, error: "schoolId is required" }, 400);
  if (!patch || typeof patch !== "object") return json({ ok: false, error: "patch is required" }, 400);

  // Validate schoolId exists in content collection
  const schools = await getCollection("schools");
  const exists = schools.some((s) => s.id === schoolId);
  if (!exists) return json({ ok: false, error: "Invalid schoolId" }, 400);

  const campaignBullets = toArrayFromTextarea(patch.campaignBullets);
  const features = toArrayFromTextarea(patch.features);
  const points = toArrayFromTextarea(patch.points);
  const recommendedFor = toArrayFromTextarea(patch.recommendedFor);
  const uniquenessBullets = toArrayFromTextarea(patch.uniquenessBullets);
  const primarySourcesLines = toArrayFromTextarea(patch.primarySources);

  const data: Record<string, any> = {
    name: toStringOrNull(patch.name),
    officialUrl: toStringOrNull(patch.officialUrl),
    planUrl: toStringOrNull(patch.planUrl),
    bannerHref: toStringOrNull(patch.bannerHref),
    bannerImage: toStringOrNull(patch.bannerImage),
    bannerAlt: toStringOrNull(patch.bannerAlt),
    priceText: toStringOrNull(patch.priceText),
    trialText: toStringOrNull(patch.trialText),
    benefitText: toStringOrNull(patch.benefitText),
    hoursText: toStringOrNull(patch.hoursText),
    rating: toNumberOrNull(patch.rating),
    teacherQuality: toNumberOrNull(patch.teacherQuality),
    materialQuality: toNumberOrNull(patch.materialQuality),
    connectionQuality: toNumberOrNull(patch.connectionQuality),
    campaignText: toStringOrNull(patch.campaignText),
    campaignEndsAt: toStringOrNull(patch.campaignEndsAt),
    campaignBullets,
    summary: toStringOrNull(patch.summary),
    features,
    points,
    recommendedFor,
    uniquenessTitle: toStringOrNull(patch.uniquenessTitle),
    uniquenessBullets,
    primarySources: parsePrimarySources(primarySourcesLines),
    source: {
      url: toStringOrNull(patch.sourceUrl),
      note: toStringOrNull(patch.sourceNote) ?? undefined,
    },
  };

  // Remove undefined keys so "not provided" doesn't overwrite.
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }
  // Clean nested source
  if (data.source) {
    if (!data.source.url) delete data.source;
    else {
      if (data.source.note == null) delete data.source.note;
    }
  }

  try {
    await query(
      `
      insert into school_overrides (school_id, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (school_id)
      do update set data = excluded.data, updated_at = now()
      `,
      [schoolId, JSON.stringify(data)],
    );
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }

  return json({ ok: true });
};

