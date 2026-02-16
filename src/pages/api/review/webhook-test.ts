/**
 * 診断用: サーバーから webhook URL へ届くか確認する。
 * GET /api/review/webhook-test で呼ぶ。
 * 本番で REVIEW_WEBHOOK_TEST_KEY を設定している場合は ?key=xxx が必須。
 */
export const prerender = false;

import type { APIRoute } from "astro";

const WEBHOOK_URL =
  process.env.REVIEW_WEBHOOK_URL ??
  "https://primary-production-03be5.up.railway.app/webhook/eo-comment";

export const GET: APIRoute = async ({ url }) => {
  const testKey = process.env.REVIEW_WEBHOOK_TEST_KEY;
  if (testKey && url.searchParams.get("key") !== testKey) {
    return new Response(JSON.stringify({ ok: false, error: "key required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const qs = new URLSearchParams({
    source: "eigoonline",
    submitted_at: new Date().toISOString(),
    school_id: "test",
    body: "webhook-test",
  }).toString();
  const targetUrl = `${WEBHOOK_URL}${WEBHOOK_URL.includes("?") ? "&" : "?"}${qs}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Eigoonline-Review-Webhook/1.0-test",
      },
      signal: ac.signal,
    });
    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        webhookUrl: targetUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message ?? String(e),
        webhookUrl: targetUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } finally {
    clearTimeout(t);
  }
};
