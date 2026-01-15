export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError, query } from "../../../lib/db";

const ALLOWED = new Set(["pending", "check", "approved", "rejected"]);

function redirect303(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}

export const POST: APIRoute = async ({ request, url }) => {
  if (dbEnvError) {
    return new Response(dbEnvError, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const form = await request.formData();
  const idRaw = String(form.get("id") ?? "").trim();
  const statusRaw = String(form.get("status") ?? "").trim();
  const returnToRaw = String(form.get("returnTo") ?? "").trim();

  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return new Response("Invalid id", { status: 400 });
  if (!ALLOWED.has(statusRaw)) return new Response("Invalid status", { status: 400 });

  await query("update conversions set status = $1 where id = $2", [statusRaw, id]);

  // Only allow same-origin relative redirects.
  const returnTo =
    returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/tracker";

  // Preserve query params for pagination/date filters when returning to /tracker.
  return redirect303(returnTo);
};

