export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError, query } from "../../../../lib/db";

function json(resBody: any, status = 200) {
  return new Response(JSON.stringify(resBody), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const GET: APIRoute = async () => {
  if (dbEnvError) return json({ ok: false, error: dbEnvError }, 500);
  try {
    const r = await query<{ school_id: string; data: any; updated_at: string }>(
      "select school_id, data, updated_at from school_overrides order by updated_at desc",
      [],
    );
    return json({ ok: true, rows: r.rows ?? [] });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
};

