export const prerender = false;

import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { dbEnvError, query } from "../../../lib/db";

type ConversionPayload = {
  offer_id: string;
  status?: string | null;
  reward?: number | null;
  payout?: number | null;
  amount?: number | null;
  commission?: number | null;
  /** Optional: originating page URL on the partner site (client-provided). */
  page_url?: string | null;
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

const ALLOWED_ORIGINS = new Set([
  "https://eigoonline.com",
  "https://www.eigoonline.com",
  "https://br.glats.online",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://eigoonline.com";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function pickHeaders(h: Headers) {
  // Store only an allowlist (never store cookies/auth headers).
  const keys = [
    "origin",
    "referer",
    "user-agent",
    "accept-language",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    // Cloudflare / proxies
    "cf-ray",
    "cf-connecting-ip",
    "cf-ipcountry",
    "x-forwarded-for",
    "x-real-ip",
    "x-railway-request-id",
  ];
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = h.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function firstForwardedIp(v: string | null): string | null {
  if (!v) return null;
  // x-forwarded-for: client, proxy1, proxy2
  const first = v.split(",")[0]?.trim();
  return first || null;
}

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (dbEnvError) {
    return json(500, { ok: false, error: dbEnvError }, corsHeaders(request));
  }

  let payload: ConversionPayload | null = null;
  try {
    payload = (await request.json()) as ConversionPayload;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" }, corsHeaders(request));
  }

  const offerId = (payload?.offer_id ?? "").trim();
  if (!offerId) {
    return json(400, { ok: false, error: "offer_id is required" }, corsHeaders(request));
  }

  const status = payload?.status ?? null;
  const reward = toFiniteNumber(payload?.reward);
  const payout = toFiniteNumber(payload?.payout);
  const amount = toFiniteNumber(payload?.amount);
  const commission = toFiniteNumber(payload?.commission);
  const pageUrl = (payload?.page_url ?? null) && String(payload?.page_url ?? "").slice(0, 2048);

  const h = request.headers;
  const origin = h.get("origin");
  const referrer = h.get("referer");
  const userAgent = h.get("user-agent");
  const acceptLanguage = h.get("accept-language");

  const cfRay = h.get("cf-ray");
  const cfConnectingIp = h.get("cf-connecting-ip");
  const cfIpCountry = h.get("cf-ipcountry");
  const xForwardedFor = h.get("x-forwarded-for");
  const requestId = h.get("x-railway-request-id");

  const ip =
    cfConnectingIp ??
    firstForwardedIp(xForwardedFor) ??
    firstForwardedIp(h.get("x-real-ip")) ??
    null;
  const ipHash = ip ? sha256Hex(ip) : null;

  const requestHeaders = pickHeaders(h);

  try {
    let r;
    try {
      r = await query<{ id: number | string }>(
        `insert into conversions (
          offer_id, status, reward, payout, amount, commission,
          ip, ip_hash, country, user_agent, accept_language, origin, referrer, page_url,
          cf_ray, cf_connecting_ip, cf_ipcountry, x_forwarded_for, request_id, request_headers
        ) values (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20
        ) returning id`,
        [
          offerId,
          status,
          reward,
          payout,
          amount,
          commission,
          ip,
          ipHash,
          cfIpCountry,
          userAgent,
          acceptLanguage,
          origin,
          referrer,
          pageUrl,
          cfRay,
          cfConnectingIp,
          cfIpCountry,
          xForwardedFor,
          requestId,
          requestHeaders,
        ],
      );
    } catch (e: any) {
      // Backward compatibility: if columns don't exist yet, fall back to minimal insert.
      if (e?.code === "42703") {
        r = await query<{ id: number | string }>(
          "insert into conversions (offer_id, status, reward, payout, amount, commission) values ($1, $2, $3, $4, $5, $6) returning id",
          [offerId, status, reward, payout, amount, commission],
        );
      } else {
        throw e;
      }
    }

    return json(
      200,
      { ok: true, id: r.rows?.[0]?.id ?? null },
      corsHeaders(request),
    );
  } catch (e: any) {
    // Common failure: table doesn't exist yet.
    return json(
      500,
      { ok: false, error: e?.message ?? String(e) },
      corsHeaders(request),
    );
  }
};

