export const prerender = false;

import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { dbEnvError, query } from "../../../lib/db";
import { getCollection } from "astro:content";

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function ipVersion(ip: string | null): number | null {
  if (!ip) return null;
  return ip.includes(":") ? 6 : 4;
}

function firstForwardedIp(xff: string | null): string | null {
  if (!xff) return null;
  const first = xff.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function toFiniteNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function validateRating(rating: number | null): boolean {
  if (rating === null) return false;
  // Check if rating is an integer between 1 and 5
  if (rating < 1 || rating > 5) return false;
  return Math.floor(rating) === rating;
}

function readRecaptchaSecret() {
  return process.env.RECAPTCHA_SECRET_KEY ?? (import.meta as any).env?.RECAPTCHA_SECRET_KEY ?? undefined;
}

function readRecaptchaMinScore() {
  const raw = process.env.RECAPTCHA_MIN_SCORE ?? (import.meta as any).env?.RECAPTCHA_MIN_SCORE ?? "0.5";
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

function isAllowedRecaptchaHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  if (process.env.NODE_ENV !== "production" && (h === "localhost" || h === "127.0.0.1")) return true;
  // Allow eigoonline.com and subdomains by default.
  return h === "eigoonline.com" || h.endsWith(".eigoonline.com");
}

async function verifyRecaptchaV3(opts: { token: string; action: string; ip: string | null }) {
  const secret = readRecaptchaSecret();
  if (!secret) {
    return { skipped: true as const };
  }

  const minScore = readRecaptchaMinScore();
  if (!opts.token) {
    return { ok: false as const, status: 400, error: "Missing reCAPTCHA token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", opts.token);
  if (opts.ip) body.set("remoteip", opts.ip);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4000);

  let data: any = null;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: ac.signal,
    });
    data = await res.json();
  } catch (e: any) {
    clearTimeout(t);
    return { ok: false as const, status: 502, error: "reCAPTCHA verification failed" };
  } finally {
    clearTimeout(t);
  }

  if (!data || data.success !== true) {
    return { ok: false as const, status: 403, error: "reCAPTCHA failed" };
  }

  // v3 fields: score, action, hostname
  if (data.action && String(data.action) !== opts.action) {
    return { ok: false as const, status: 403, error: "reCAPTCHA action mismatch" };
  }

  if (!isAllowedRecaptchaHost(data.hostname)) {
    return { ok: false as const, status: 403, error: "reCAPTCHA hostname mismatch" };
  }

  const score = typeof data.score === "number" ? data.score : Number(data.score ?? NaN);
  if (!Number.isFinite(score) || score < minScore) {
    return { ok: false as const, status: 403, error: "reCAPTCHA score too low" };
  }

  return { ok: true as const, score };
}

export const POST: APIRoute = async ({ request, redirect }) => {
  if (dbEnvError) {
    return new Response(JSON.stringify({ ok: false, error: dbEnvError }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const formData = await request.formData();
  const schoolId = String(formData.get("school_id") ?? "").trim();
  const overallRatingRaw = formData.get("overall_rating");
  const teacherQualityRaw = formData.get("teacher_quality");
  const materialQualityRaw = formData.get("material_quality");
  const connectionQualityRaw = formData.get("connection_quality");
  const body = String(formData.get("body") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().slice(0, 255) || null;
  const age = String(formData.get("age") ?? "").trim().slice(0, 20) || null;
  const recaptchaToken = String(formData.get("recaptcha_token") ?? "").trim();
  const recaptchaAction = String(formData.get("recaptcha_action") ?? "").trim() || "review_submit";

  // Validate school_id exists
  if (!schoolId) {
    return new Response(JSON.stringify({ ok: false, error: "school_id is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const schools = await getCollection("schools");
    const schoolExists = schools.some((s) => s.id === schoolId);
    if (!schoolExists) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid school_id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: "Failed to validate school_id" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate ratings
  const overallRating = toFiniteNumber(overallRatingRaw);
  const teacherQuality = toFiniteNumber(teacherQualityRaw);
  const materialQuality = toFiniteNumber(materialQualityRaw);
  const connectionQuality = toFiniteNumber(connectionQualityRaw);

  if (!validateRating(overallRating) || !validateRating(teacherQuality) || !validateRating(materialQuality) || !validateRating(connectionQuality)) {
    return new Response(JSON.stringify({ ok: false, error: "All ratings must be integers between 1 and 5" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate email
  if (!email) {
    return new Response(JSON.stringify({ ok: false, error: "email is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid email format" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate body
  if (body.length < 10 || body.length > 300) {
    return new Response(JSON.stringify({ ok: false, error: "Body must be between 10 and 300 characters" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Get request metadata
  const h = request.headers;
  const referrer = h.get("referer");
  const userAgent = h.get("user-agent");

  const cfConnectingIp = h.get("cf-connecting-ip");
  const xForwardedFor = h.get("x-forwarded-for");
  const ip = cfConnectingIp ?? firstForwardedIp(xForwardedFor) ?? firstForwardedIp(h.get("x-real-ip")) ?? null;
  const ipHash = ip ? sha256Hex(ip) : null;
  const ipVer = ipVersion(ip);

  // reCAPTCHA v3 verification (fraud prevention)
  const recaptchaRes = await verifyRecaptchaV3({ token: recaptchaToken, action: recaptchaAction, ip });
  if ("skipped" in recaptchaRes && recaptchaRes.skipped) {
    // If not configured, allow submission (best-effort).
  } else if ("ok" in recaptchaRes && !recaptchaRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: recaptchaRes.error }), {
      status: recaptchaRes.status,
      headers: { "content-type": "application/json" },
    });
  }

  // Rate limiting: Check if same IP submitted more than 3 reviews in the last hour
  try {
    const rateLimitResult = await query<{ count: number }>(
      "select count(*)::bigint as count from reviews where ip_hash = $1 and created_at > now() - interval '1 hour'",
      [ipHash],
    );
    const recentCount = rateLimitResult.rows?.[0]?.count ?? 0;
    if (recentCount >= 3) {
      return new Response(JSON.stringify({ ok: false, error: "Too many submissions. Please try again later." }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
  } catch (e: any) {
    // If rate limit check fails, continue (best-effort)
  }

  // Insert review
  try {
    await query(
      "insert into reviews (school_id, status, overall_rating, teacher_quality, material_quality, connection_quality, body, age, email, ip, ip_hash, ip_version, user_agent, referrer) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
      [schoolId, "pending", overallRating, teacherQuality, materialQuality, connectionQuality, body, age, email, ip, ipHash, ipVer, userAgent, referrer],
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Redirect to success page
  return redirect("/review/submit?submitted=true", 303);
};
