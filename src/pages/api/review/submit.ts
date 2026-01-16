---
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
  // Check if rating is between 1 and 5, and is a multiple of 0.5
  if (rating < 1 || rating > 5) return false;
  const rounded = Math.round(rating * 2) / 2;
  return Math.abs(rating - rounded) < 0.01;
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
  const age = String(formData.get("age") ?? "").trim().slice(0, 20) || null;

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
    return new Response(JSON.stringify({ ok: false, error: "All ratings must be between 1 and 5 in 0.5 increments" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate body
  if (body.length < 10 || body.length > 2000) {
    return new Response(JSON.stringify({ ok: false, error: "Body must be between 10 and 2000 characters" }), {
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
      "insert into reviews (school_id, status, overall_rating, teacher_quality, material_quality, connection_quality, body, age, ip, ip_hash, ip_version, user_agent, referrer) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
      [schoolId, "pending", overallRating, teacherQuality, materialQuality, connectionQuality, body, age, ip, ipHash, ipVer, userAgent, referrer],
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
