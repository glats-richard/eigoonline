export const prerender = false;

import type { APIRoute } from "astro";
import { dbEnvError, query } from "../../../lib/db";

type ConversionPayload = {
  offer_id: string;
  status?: string | null;
  reward?: number | null;
  payout?: number | null;
  amount?: number | null;
  commission?: number | null;
};

function toFiniteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function json(status: number, body: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export const OPTIONS: APIRoute = async () => {
  // If you need cross-origin conversion calls (external thank-you pages),
  // adjust Access-Control-Allow-Origin to a specific origin list.
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (dbEnvError) {
    return json(500, { ok: false, error: dbEnvError });
  }

  let payload: ConversionPayload | null = null;
  try {
    payload = (await request.json()) as ConversionPayload;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" }, { "access-control-allow-origin": "*" });
  }

  const offerId = (payload?.offer_id ?? "").trim();
  if (!offerId) {
    return json(400, { ok: false, error: "offer_id is required" }, { "access-control-allow-origin": "*" });
  }

  const status = payload?.status ?? null;
  const reward = toFiniteNumber(payload?.reward);
  const payout = toFiniteNumber(payload?.payout);
  const amount = toFiniteNumber(payload?.amount);
  const commission = toFiniteNumber(payload?.commission);

  try {
    const r = await query<{ id: number | string }>(
      "insert into conversions (offer_id, status, reward, payout, amount, commission) values ($1, $2, $3, $4, $5, $6) returning id",
      [offerId, status, reward, payout, amount, commission],
    );

    return json(
      200,
      { ok: true, id: r.rows?.[0]?.id ?? null },
      { "access-control-allow-origin": "*" },
    );
  } catch (e: any) {
    // Common failure: table doesn't exist yet.
    return json(
      500,
      { ok: false, error: e?.message ?? String(e) },
      { "access-control-allow-origin": "*" },
    );
  }
};

