export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError, query } from "../../../lib/db";

const ALLOWED = new Set(["pending", "approved", "rejected"]);

function redirect303(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  if (dbEnvError) {
    return new Response(dbEnvError, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const form = await request.formData();
  const idRaw = String(form.get("id") ?? "").trim();
  const statusRaw = String(form.get("status") ?? "").trim();
  const returnToRaw = String(form.get("returnTo") ?? "").trim();
  const hasReviewComment = form.has("review_comment");
  const hasFeaturedRank = form.has("featured_rank");
  const reviewComment = hasReviewComment ? String(form.get("review_comment") ?? "").trim() || null : null;
  const featuredRankRaw = hasFeaturedRank ? String(form.get("featured_rank") ?? "").trim() : "";

  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return new Response("Invalid id", { status: 400 });
  if (!ALLOWED.has(statusRaw)) return new Response("Invalid status", { status: 400 });

  const featuredRank =
    featuredRankRaw === ""
      ? null
      : (() => {
          const n = Number(featuredRankRaw);
          if (!Number.isFinite(n)) return NaN;
          return Math.floor(n);
        })();
  if (hasFeaturedRank && featuredRank !== null && (!Number.isFinite(featuredRank) || featuredRank < 1 || featuredRank > 5)) {
    return new Response("Invalid featured_rank", { status: 400 });
  }

  try {
    // Update only fields that were included in the form.
    const sets: string[] = ["status = $1"];
    const params: any[] = [statusRaw];
    let idx = 2;
    if (hasReviewComment) {
      sets.push(`review_comment = $${idx}`);
      params.push(reviewComment);
      idx++;
    }
    if (hasFeaturedRank) {
      sets.push(`featured_rank = $${idx}`);
      params.push(featuredRank);
      idx++;
    }
    params.push(id);
    await query(`update reviews set ${sets.join(", ")} where id = $${idx}`, params);
  } catch (e: any) {
    // If featured slot conflicts (unique index), return a human-friendly error.
    const msg = String(e?.message ?? e);
    if (msg.toLowerCase().includes("reviews_featured_slot_unique") || msg.toLowerCase().includes("duplicate key")) {
      return new Response("その表示枠は既に他のレビューで使用されています（同一サービス内）", {
        status: 409,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(e?.message ?? String(e), { status: 500 });
  }

  // Only allow same-origin relative redirects.
  const returnTo = returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/tracker/reviews";

  return redirect303(returnTo);
};
