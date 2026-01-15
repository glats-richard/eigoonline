import type { MiddlewareHandler } from "astro";

const USER = process.env.TRACKER_BASIC_USER ?? "";
const PASS = process.env.TRACKER_BASIC_PASS ?? "";

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="tracker", charset="UTF-8"',
    },
  });
}

function timingSafeEqual(a: string, b: string) {
  // Basic constant-time-ish compare (length + char scan)
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;

  // Protect tracker UI + tracker admin APIs with Basic Auth.
  // Keep public tracking endpoints accessible (e.g. /api/track/conversion).
  const needsAuth = pathname.startsWith("/tracker") || pathname.startsWith("/api/tracker");
  if (!needsAuth) return next();

  // In production, require credentials to be configured.
  // In non-production environments, allow access if not configured.
  if (!USER || !PASS) {
    if (process.env.NODE_ENV !== "production") return next();
    return new Response("Tracker auth is not configured", { status: 500 });
  }

  const auth = context.request.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();
  let decoded = "";
  try {
    decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) return unauthorized();
  const u = decoded.slice(0, idx);
  const p = decoded.slice(idx + 1);
  if (!timingSafeEqual(u, USER) || !timingSafeEqual(p, PASS)) return unauthorized();

  return next();
};

