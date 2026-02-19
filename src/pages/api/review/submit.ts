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

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
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

function readRecaptchaSiteKey() {
  return process.env.RECAPTCHA_SITE_KEY ?? (import.meta as any).env?.RECAPTCHA_SITE_KEY ?? undefined;
}

function readRecaptchaMinScore() {
  const raw = process.env.RECAPTCHA_MIN_SCORE ?? (import.meta as any).env?.RECAPTCHA_MIN_SCORE ?? "0.5";
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

function wantsHtml(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const mode = request.headers.get("sec-fetch-mode") ?? "";
  return accept.includes("text/html") || mode === "navigate";
}

function isAllowedRecaptchaHost(hostname: string | undefined | null): boolean {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  if (process.env.NODE_ENV !== "production" && (h === "localhost" || h === "127.0.0.1")) return true;
  // Allow eigoonline.com and subdomains by default.
  return h === "eigoonline.com" || h.endsWith(".eigoonline.com");
}

type RecaptchaResult =
  | { ok: true; score: number }
  | { ok: false; status: number; error: string }
  | { skipped: true };

async function verifyRecaptchaV3(opts: { token: string; action: string; ip: string | null }): Promise<RecaptchaResult> {
  const secret = readRecaptchaSecret();
  const siteKey = readRecaptchaSiteKey();
  // Require both site+secret keys to be configured.
  // If only one side is set, skip verification to avoid blocking submissions.
  // if (!secret || !siteKey) {
  //   return { skipped: true as const };
  // }

  // Create override to disable reCAPTCHA
  // Create override to disable reCAPTCHA
  return { skipped: true as const };

  /*
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
  */
}

export const POST: APIRoute = async ({ request, redirect }) => {
  console.log("[review/submit] POST received");
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
  const priceRatingRaw = formData.get("price_rating");
  const satisfactionRatingRaw = formData.get("satisfaction_rating");
  const body = String(formData.get("body") ?? "").trim();
  const sourceContext = String(formData.get("source_context") ?? "").trim();
  const improvementPointsRaw = String(formData.get("improvement_points") ?? "").trim();
  const courseName = String(formData.get("course_name") ?? "").trim().slice(0, 120) || null;
  const materialUnit = String(formData.get("material_unit") ?? "").trim().slice(0, 60) || null;
  const lessonFrequency = String(formData.get("lesson_frequency") ?? "").trim().slice(0, 20) || null;
  const lessonTimeBand = String(formData.get("lesson_time_band") ?? "").trim().slice(0, 20) || null;
  const email = String(formData.get("email") ?? "").trim().slice(0, 255) || null;
  const birthYear = toInt(formData.get("birth_year"));
  const birthMonth = toInt(formData.get("birth_month"));
  const durationMonths = toInt(formData.get("duration_months"));
  const recaptchaToken = String(formData.get("recaptcha_token") ?? "").trim();
  const recaptchaAction = String(formData.get("recaptcha_action") ?? "").trim() || "review_submit";
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 50) || null;

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
  const priceRating = toFiniteNumber(priceRatingRaw);
  const satisfactionRating = toFiniteNumber(satisfactionRatingRaw);

  if (
    !validateRating(overallRating) ||
    !validateRating(teacherQuality) ||
    !validateRating(materialQuality) ||
    !validateRating(connectionQuality) ||
    !validateRating(priceRating) ||
    !validateRating(satisfactionRating)
  ) {
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

  // Validate nickname
  if (!nickname) {
    return new Response(JSON.stringify({ ok: false, error: "nickname is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate birth year/month (privacy: no day)
  const currentYear = new Date().getFullYear();
  if (birthYear === null || birthMonth === null) {
    return new Response(JSON.stringify({ ok: false, error: "birth_year and birth_month are required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (birthYear < 1900 || birthYear > currentYear) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid birth_year" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (birthMonth < 1 || birthMonth > 12) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid birth_month" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Validate continuation period (approx. months)
  if (durationMonths === null) {
    return new Response(JSON.stringify({ ok: false, error: "duration_months is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (durationMonths < 1 || durationMonths > 240) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid duration_months" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Get request metadata
  const h = request.headers;
  const referrer = h.get("referer");
  const userAgent = h.get("user-agent");

  const improvementPoints = improvementPointsRaw.length ? improvementPointsRaw : null;

  if (improvementPoints && improvementPoints.length > 500) {
    return new Response(JSON.stringify({ ok: false, error: "improvement_points must be 500 characters or less" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

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
    if (wantsHtml(request)) {
      const q = new URLSearchParams();
      q.set("error", "recaptcha");
      q.set("school_id", schoolId);
      return redirect(`/review/submit?${q.toString()}`, 303);
    }
    return new Response(JSON.stringify({ ok: false, error: recaptchaRes.error }), {
      status: recaptchaRes.status,
      headers: { "content-type": "application/json" },
    });
  }

  // Rate limiting: 同一IPで1時間あたり10件まで
  const RATE_LIMIT_PER_HOUR = 10;
  try {
    const rateLimitResult = await query<{ count: number }>(
      "select count(*)::bigint as count from reviews where ip_hash = $1 and created_at > now() - interval '1 hour'",
      [ipHash],
    );
    const recentCount = rateLimitResult.rows?.[0]?.count ?? 0;
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
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
      "insert into reviews (school_id, status, duration_months, overall_rating, teacher_quality, material_quality, connection_quality, price_rating, satisfaction_rating, body, improvement_points, course_name, material_unit, lesson_frequency, lesson_time_band, birth_year, birth_month, email, ip, ip_hash, ip_version, user_agent, referrer, nickname) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)",
      [
        schoolId,
        "pending",
        durationMonths,
        overallRating,
        teacherQuality,
        materialQuality,
        connectionQuality,
        priceRating,
        satisfactionRating,
        body,
        improvementPoints,
        courseName,
        materialUnit,
        lessonFrequency,
        lessonTimeBand,
        birthYear,
        birthMonth,
        email,
        ip,
        ipHash,
        ipVer,
        userAgent,
        referrer,
        nickname,
      ],
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Webhook: フォーム内容を外部URLに転送（失敗しても本処理は成功とする）
  const webhookUrl =
    process.env.REVIEW_WEBHOOK_URL ??
    "https://primary-production-03be5.up.railway.app/webhook/eo-comment";
  const webhookPayload: Record<string, string> = {
    source: "eigoonline",
    submitted_at: new Date().toISOString(),
    school_id: schoolId,
    overall_rating: String(overallRating),
    teacher_quality: String(teacherQuality),
    material_quality: String(materialQuality),
    connection_quality: String(connectionQuality),
    price_rating: String(priceRating),
    satisfaction_rating: String(satisfactionRating),
    body,
    improvement_points: improvementPoints ?? "",
    course_name: courseName ?? "",
    material_unit: materialUnit ?? "",
    lesson_frequency: lessonFrequency ?? "",
    lesson_time_band: lessonTimeBand ?? "",
    nickname: nickname ?? "",
    duration_months: String(durationMonths),
    birth_year: String(birthYear),
    birth_month: String(birthMonth),
    email: email ?? "",
    referrer: referrer ?? "",
    user_agent: userAgent ?? "",
  };
  const webhookBody = new URLSearchParams(
    Object.entries(webhookPayload).filter(([, v]) => v != null && v !== ""),
  ).toString();
  const webhookGetUrl = `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}${webhookBody}`;

  // webhook: 1回目 await、2回目 fire-and-forget で二重送信（届く確率を上げる）
  const webhookOpts = {
    method: "GET" as const,
    headers: {
      "User-Agent": "Eigoonline-Review-Webhook/1.0",
    },
  };
  console.log("[review/submit] insert ok, calling webhook", webhookGetUrl);
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    try {
      const webhookRes = await fetch(webhookGetUrl, { ...webhookOpts, signal: ac.signal });
      if (!webhookRes.ok) {
        console.warn("[review/submit] webhook non-2xx", webhookRes.status, await webhookRes.text().catch(() => ""));
      } else {
        console.log("[review/submit] webhook ok", webhookRes.status);
      }
    } finally {
      clearTimeout(t);
    }
  } catch (e: any) {
    console.warn("[review/submit] webhook failed:", e?.message ?? String(e));
  }
  // 2回目: レスポンス返却後も試行（プラットフォームによってはこちらだけ届く場合あり）
  fetch(webhookGetUrl, webhookOpts).catch((e: any) =>
    console.warn("[review/submit] webhook retry failed:", e?.message ?? String(e)),
  );

  return redirect("/review/submit?submitted=true", 303);
};
