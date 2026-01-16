---
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
  const reviewComment = String(form.get("review_comment") ?? "").trim() || null;

  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return new Response("Invalid id", { status: 400 });
  if (!ALLOWED.has(statusRaw)) return new Response("Invalid status", { status: 400 });

  try {
    if (reviewComment) {
      await query("update reviews set status = $1, review_comment = $2 where id = $3", [statusRaw, reviewComment, id]);
    } else {
      await query("update reviews set status = $1 where id = $2", [statusRaw, id]);
    }
  } catch (e: any) {
    return new Response(e?.message ?? String(e), { status: 500 });
  }

  // Only allow same-origin relative redirects.
  const returnTo = returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/tracker/reviews";

  return redirect303(returnTo);
};
