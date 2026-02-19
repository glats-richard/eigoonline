export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError, query } from "../../../lib/db";

function redirect303(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (dbEnvError) {
    return new Response(dbEnvError, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const form = await request.formData();
  const idRaw = String(form.get("id") ?? "").trim();
  const returnToRaw = String(form.get("returnTo") ?? "").trim();
  const responseRaw = String(form.get("improvement_points_response") ?? "").trim();

  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) return new Response("Invalid id", { status: 400 });

  const responseText = responseRaw.length ? responseRaw : null;
  if (!responseText) return new Response("improvement_points_response is required", { status: 400 });
  if (responseText.length > 800) return new Response("improvement_points_response must be 800 characters or less", { status: 400 });

  // Only allow same-origin relative redirects.
  const returnTo = returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/tracker/reviews";

  try {
    // One-time write: only set if no response exists yet AND the review actually has improvement_points.
    const res = await query(
      `
      update reviews
      set improvement_points_response = $1,
          improvement_points_responded_at = now()
      where
        id = $2
        and improvement_points is not null
        and improvement_points_response is null
      `,
      [responseText, id],
    );

    if ((res.rowCount ?? 0) <= 0) {
      return new Response("Already responded or no improvement_points", {
        status: 409,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  } catch (e: any) {
    return new Response(e?.message ?? String(e), { status: 500 });
  }

  return redirect303(returnTo);
};

