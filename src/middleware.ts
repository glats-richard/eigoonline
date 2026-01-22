import type { MiddlewareHandler } from "astro";

const ADMIN_USER = process.env.TRACKER_BASIC_USER ?? "";
const ADMIN_PASS = process.env.TRACKER_BASIC_PASS ?? "";
const EDITOR_USER = process.env.TRACKER_EDITOR_USER ?? "";
const EDITOR_PASS = process.env.TRACKER_EDITOR_PASS ?? "";

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="tracker", charset="UTF-8"',
    },
  });
}

function forbidden() {
  return new Response("Forbidden", { status: 403 });
}

function timingSafeEqual(a: string, b: string) {
  // Basic constant-time-ish compare (length + char scan)
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function parseBasicAuthHeader(authHeader: string | null): { user: string; pass: string } | null {
  if (!authHeader?.startsWith("Basic ")) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) return null;
  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { pathname } = context.url;

  // Protect tracker UI + tracker admin APIs with Basic Auth.
  // Keep public tracking endpoints accessible (e.g. /api/track/conversion).
  const needsAuth = pathname.startsWith("/tracker") || pathname.startsWith("/api/tracker");
  if (!needsAuth) return next();

  // In production, require credentials to be configured.
  // In non-production environments, allow access if not configured.
  const hasAnyCreds = (ADMIN_USER && ADMIN_PASS) || (EDITOR_USER && EDITOR_PASS);
  if (!hasAnyCreds) {
    if (process.env.NODE_ENV !== "production") return next();
    return new Response("Tracker auth is not configured", { status: 500 });
  }
  if (process.env.NODE_ENV === "production" && (!ADMIN_USER || !ADMIN_PASS)) {
    return new Response("Tracker admin auth is not configured", { status: 500 });
  }

  const creds = parseBasicAuthHeader(context.request.headers.get("authorization"));
  if (!creds) return unauthorized();

  const isAdmin =
    ADMIN_USER &&
    ADMIN_PASS &&
    timingSafeEqual(creds.user, ADMIN_USER) &&
    timingSafeEqual(creds.pass, ADMIN_PASS);
  if (isAdmin) return next();

  const isEditor =
    EDITOR_USER &&
    EDITOR_PASS &&
    timingSafeEqual(creds.user, EDITOR_USER) &&
    timingSafeEqual(creds.pass, EDITOR_PASS);

  if (!isEditor) return unauthorized();

  // Editor can only access content editor UI + its APIs.
  const editorAllowed =
    pathname === "/tracker/content" ||
    pathname === "/tracker/content/" ||
    pathname.startsWith("/api/tracker/schools");

  if (!editorAllowed) return forbidden();

  return next();
};

