export const prerender = false;

import type { APIRoute } from "astro";
import crypto from "node:crypto";
import { dbEnvError, query } from "../../../lib/db";

type SchoolLike = {
  officialUrl?: string | null;
  planUrl?: string | null;
  bannerHref?: string | null;
};

function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function ipVersion(ip: string | null): 4 | 6 | null {
  if (!ip) return null;
  if (ip.includes(":")) return 6;
  if (ip.includes(".")) return 4;
  return null;
}

function firstForwardedIp(v: string | null): string | null {
  if (!v) return null;
  const first = v.split(",")[0]?.trim();
  return first || null;
}

function randomId(): string {
  // Node 18+ supports randomUUID(); fall back for older runtimes.
  try {
    // @ts-expect-error runtime check
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return crypto.randomBytes(16).toString("hex");
}

function basenameNoExt(p: string) {
  const s = String(p);
  const base = s.split("/").pop() ?? s;
  return base.replace(/\.[^.]+$/, "");
}

function safeParseUrl(v: string | null): URL | null {
  if (!v) return null;
  try {
    return new URL(v);
  } catch {
    return null;
  }
}

function allowedHostsByOfferId(): Map<string, Set<string>> {
  // Build allowlist from content collection files at build-time (eager).
  const files = import.meta.glob<SchoolLike>("../../../content/schools/*.json", { eager: true });
  const map = new Map<string, Set<string>>();

  for (const [path, mod] of Object.entries(files)) {
    const offerId = basenameNoExt(path);
    const s = new Set<string>();
    const data: any = (mod as any).default ?? mod;
    const urls = [data?.officialUrl, data?.planUrl, data?.bannerHref].filter(Boolean) as string[];
    for (const u of urls) {
      const parsed = safeParseUrl(u);
      if (parsed) s.add(parsed.hostname);
    }
    if (s.size) map.set(offerId, s);
  }
  return map;
}

const HOSTS_BY_OFFER = allowedHostsByOfferId();

function badRequest(message: string) {
  return new Response(message, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function serverError(message: string) {
  return new Response(message, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export const GET: APIRoute = async ({ request, url }) => {
  if (dbEnvError) return serverError(dbEnvError);

  const offerId = String(url.searchParams.get("offer_id") ?? "").trim();
  if (!offerId) return badRequest("offer_id is required");

  const toRaw = String(url.searchParams.get("to") ?? "").trim();
  if (!toRaw) return badRequest("to is required");

  let toUrl: URL;
  try {
    toUrl = new URL(toRaw);
  } catch {
    return badRequest("Invalid to URL");
  }

  if (toUrl.protocol !== "https:") return badRequest("to must be https");

  const allowed = HOSTS_BY_OFFER.get(offerId);
  if (!allowed || !allowed.has(toUrl.hostname)) return badRequest("to host is not allowed for this offer_id");

  const h = request.headers;
  const referrer = h.get("referer");
  const userAgent = h.get("user-agent");

  const cfConnectingIp = h.get("cf-connecting-ip");
  const xForwardedFor = h.get("x-forwarded-for");
  const ip =
    cfConnectingIp ??
    firstForwardedIp(xForwardedFor) ??
    firstForwardedIp(h.get("x-real-ip")) ??
    null;
  const ipHash = ip ? sha256Hex(ip) : null;
  const ipVer = ipVersion(ip);

  const clickId = randomId();

  // Persist click record (best-effort).
  try {
    await query(
      "insert into clicks (offer_id, click_id, url, referrer, user_agent, ip, ip_hash, ip_version) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [offerId, clickId, toUrl.toString(), referrer, userAgent, ip, ipHash, ipVer],
    );
  } catch (e: any) {
    return serverError(e?.message ?? String(e));
  }

  // Append click_id for partner-side persistence.
  toUrl.searchParams.set("click_id", clickId);

  return new Response(null, {
    status: 302,
    headers: {
      Location: toUrl.toString(),
      "cache-control": "no-store",
    },
  });
};

