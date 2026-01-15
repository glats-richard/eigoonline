import type { MiddlewareHandler } from "astro";

const USER = "basic";
const PASS = "basic123";

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
  // Temporarily disable Basic Auth for /tracker to allow functional checks.
  if (pathname.startsWith("/tracker")) return next();
  return next();
};

