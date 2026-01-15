export const prerender = false;

import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { dbEnvError, query } from "../../../lib/db";

const STATUS_ALLOWED = new Set(["pending", "check", "approved", "rejected"]);

function riskCommentFromReasons(reasons: string[]) {
  if (!reasons.length) return null;
  const labels = reasons.map((r) => {
    if (r === "ip_rate_1m_high") return "短時間に同一IPからのCVが多い";
    if (r === "missing_referer") return "Refererが無い";
    if (r === "missing_user_agent") return "User-Agentが無い";
    return r;
  });
  return labels.join(" / ");
}

type ConversionPayload = {
  offer_id: string;
  /** Deprecated: kept for backward compatibility; ignored. */
  offer_uuid?: string | null;
  /** Optional: student/user identifier provided by partner (e.g. kimini student_id). */
  student_id?: string | null;
  /** Optional: idempotency key (recommended). Send same value on retries to avoid double counting. */
  event_id?: string | null;
  /** Optional: client timestamp in milliseconds since epoch (recommended). */
  client_ts_ms?: number | string | null;
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

function toFiniteInt(v: unknown): number | null {
  const n = toFiniteNumber(v);
  if (n === null) return null;
  const i = Math.floor(n);
  return Number.isFinite(i) ? i : null;
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

function ipVersion(ip: string | null): 4 | 6 | null {
  if (!ip) return null;
  // IPv6 contains ":"; IPv4 contains "." (best-effort)
  if (ip.includes(":")) return 6;
  if (ip.includes(".")) return 4;
  return null;
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
  // offer_uuid is no longer used; keep accepting but ignore.
  const studentId = (payload?.student_id ?? "").trim().slice(0, 256) || null;
  const studentIdHash = studentId ? sha256Hex(studentId) : null;

  const eventId = (payload?.event_id ?? "").trim().slice(0, 128) || null;
  const clientTsMsRaw = toFiniteInt(payload?.client_ts_ms);
  const nowMs = Date.now();
  // Accept timestamps within a reasonable window (prevents garbage/overflow).
  const clientTsMs =
    clientTsMsRaw != null && clientTsMsRaw > 0 && clientTsMsRaw < nowMs + 24 * 60 * 60 * 1000
      ? clientTsMsRaw
      : null;

  const statusRaw = (payload?.status ?? "pending").trim();
  const requestedStatus = STATUS_ALLOWED.has(statusRaw) ? statusRaw : "pending";
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

  // If the browser sent an Origin header, enforce allowlist strictly.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { ok: false, error: "Origin is not allowed" }, corsHeaders(request));
  }

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
  const ipVer = ipVersion(ip);

  const requestHeaders = pickHeaders(h);

  try {
    // Idempotency: if event_id already exists, treat as same conversion.
    if (eventId) {
      try {
        const existing = await query<{ id: number | string }>(
          "select id from conversions where event_id = $1 limit 1",
          [eventId],
        );
        const existingId = existing.rows?.[0]?.id ?? null;
        if (existingId != null) {
          return json(200, { ok: true, id: existingId, deduped: true }, corsHeaders(request));
        }
      } catch (e: any) {
        // If event_id column doesn't exist yet, we'll fall back to normal insert below.
        if (e?.code !== "42703") throw e;
      }
    }

    const riskReasons: string[] = [];
    if (!referrer) riskReasons.push("missing_referer");
    if (!userAgent) riskReasons.push("missing_user_agent");

    // Best-effort rate heuristic: same IP hashing too many conversions in 1 minute.
    if (ipHash) {
      try {
        const rr = await query<{ count: number }>(
          "select count(*)::bigint as count from conversions where ip_hash = $1 and created_at > now() - interval '1 minute'",
          [ipHash],
        );
        const c = rr.rows?.[0]?.count ?? 0;
        if (c >= 5) riskReasons.push("ip_rate_1m_high");
      } catch (e: any) {
        // If ip_hash column doesn't exist yet, ignore.
        if (e?.code !== "42703") throw e;
      }
    }

    // Only strong signals should force manual review.
    const needsReview = riskReasons.includes("ip_rate_1m_high");

    const risk =
      riskReasons.length > 0
        ? {
            score: riskReasons.length,
            reasons: riskReasons,
            needs_review: needsReview,
            computed_at_ms: nowMs,
          }
        : null;

    // If needs_review, force manual review workflow.
    const reviewComment = riskCommentFromReasons(riskReasons);
    const status = needsReview ? "check" : requestedStatus === "approved" ? "approved" : requestedStatus;

    let r;
    try {
      r = await query<{ id: number | string }>(
        `insert into conversions (
          offer_id, student_id, student_id_hash, event_id, client_ts_ms, risk, review_comment, status, reward, payout, amount, commission,
          ip, ip_hash, ip_version, country, user_agent, accept_language, origin, referrer, page_url,
          cf_ray, cf_connecting_ip, cf_ipcountry, x_forwarded_for, request_id, request_headers
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
          $13,$14,$15,$16,$17,$18,$19,$20,$21,
          $22,$23,$24,$25,$26,$27
        ) ${eventId ? "on conflict (event_id) do nothing" : ""} returning id`,
        [
          offerId,
          studentId,
          studentIdHash,
          eventId,
          clientTsMs,
          risk,
          reviewComment,
          status,
          reward,
          payout,
          amount,
          commission,
          ip,
          ipHash,
          ipVer,
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
      // If ON CONFLICT DO NOTHING fired, fetch existing id (idempotency).
      if (eventId && !(r.rows?.[0]?.id ?? null)) {
        const existing = await query<{ id: number | string }>(
          "select id from conversions where event_id = $1 limit 1",
          [eventId],
        );
        const existingId = existing.rows?.[0]?.id ?? null;
        return json(200, { ok: true, id: existingId, deduped: true }, corsHeaders(request));
      }
    } catch (e: any) {
      // Backward compatibility: if columns don't exist yet, fall back to minimal insert.
      if (e?.code === "42703") {
        r = await query<{ id: number | string }>(
          "insert into conversions (offer_id, status, reward, payout, amount, commission) values ($1, $2, $3, $4, $5, $6) returning id",
          [offerId, status, reward, payout, amount, commission],
        );
      } else if (e?.code === "42P10") {
        // ON CONFLICT requires a unique index/constraint. If not present yet, fall back.
        r = await query<{ id: number | string }>(
          `insert into conversions (
            offer_id, student_id, student_id_hash, event_id, client_ts_ms, risk, review_comment, status, reward, payout, amount, commission,
            ip, ip_hash, ip_version, country, user_agent, accept_language, origin, referrer, page_url,
            cf_ray, cf_connecting_ip, cf_ipcountry, x_forwarded_for, request_id, request_headers
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
            $13,$14,$15,$16,$17,$18,$19,$20,$21,
            $22,$23,$24,$25,$26,$27
          ) returning id`,
          [
            offerId,
            studentId,
            studentIdHash,
            eventId,
            clientTsMs,
            risk,
            reviewComment,
            status,
            reward,
            payout,
            amount,
            commission,
            ip,
            ipHash,
            ipVer,
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

