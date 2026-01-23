export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError } from "../../../../lib/db";
import { getSchoolsMerged } from "../../../../lib/schools";

function toCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // RFC4180-ish escaping
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function joinLines(xs: unknown): string {
  if (!Array.isArray(xs)) return "";
  return xs.map((x) => String(x ?? "").trim()).filter(Boolean).join("\n");
}

export const GET: APIRoute = async () => {
  if (dbEnvError) {
    return new Response(`DB is not configured: ${dbEnvError}\n`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const schools = await getSchoolsMerged();
  const rows = schools
    .map((s) => {
      const d: any = s.data as any;
      return {
        id: s.id,
        name: d.name ?? "",
        officialUrl: d.officialUrl ?? "",
        logoUrl: d.logoUrl ?? "",
        planUrl: d.planUrl ?? "",
        bannerHref: d.bannerHref ?? "",
        bannerImage: d.bannerImage ?? "",
        bannerAlt: d.bannerAlt ?? "",

        priceText: d.priceText ?? "",
        trialText: d.trialText ?? "",
        trialDetailText: d.trialDetailText ?? "",
        benefitText: d.benefitText ?? "",
        hoursText: d.hoursText ?? "",

        campaignText: d.campaignText ?? "",
        campaignEndsAt: d.campaignEndsAt ?? "",
        campaignBullets: joinLines(d.campaignBullets),

        summary: d.summary ?? "",
        heroDescription: d.heroDescription ?? "",
        heroImageUrl: d.heroImageUrl ?? "",
        heroImageAlt: d.heroImageAlt ?? "",
        prSectionTitle: d.prSectionTitle ?? "",
        prSections: Array.isArray(d.prSections) && d.prSections.length ? JSON.stringify(d.prSections) : "",
        introSectionTitle: d.introSectionTitle ?? "",
        introPlacement: d.introPlacement ?? "",
        introSections: Array.isArray(d.introSections) && d.introSections.length ? JSON.stringify(d.introSections) : "",
        editorialComments: joinLines(d.editorialComments),
        features: joinLines(d.features),
        points: joinLines(d.points),
        recommendedFor: joinLines(d.recommendedFor),
        uniquenessTitle: d.uniquenessTitle ?? "",
        uniquenessBullets: joinLines(d.uniquenessBullets),
        tagsSectionTitle: d.tagsSectionTitle ?? "",
        tagsSectionSubtitle: d.tagsSectionSubtitle ?? "",
        recommendedTagsTitle: d.recommendedTagsTitle ?? "",
        featureTagsTitle: d.featureTagsTitle ?? "",
        keyFactsSectionTitle: d.keyFactsSectionTitle ?? "",
        keyFactsSectionSubtitle: d.keyFactsSectionSubtitle ?? "",
        basicDataSectionTitle: d.basicDataSectionTitle ?? "",
        methodologySectionTitle: d.methodologySectionTitle ?? "",
        methodologySectionSubtitle: d.methodologySectionSubtitle ?? "",
        featureSectionTitle: d.featureSectionTitle ?? "",
        reviewsSectionTitle: d.reviewsSectionTitle ?? "",
        reviewsSectionSubtitle: d.reviewsSectionSubtitle ?? "",
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ja"));

  const headers = Object.keys(rows[0] ?? { id: "" });
  const csvBody = headers.map(toCell).join(",") + "\n" + rows.map((r) => headers.map((h) => toCell((r as any)[h])).join(",")).join("\n") + "\n";
  // Add UTF-8 BOM to make Excel happy with Japanese.
  const csv = "\ufeff" + csvBody;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="schools.csv"',
      "cache-control": "no-store",
    },
  });
};

