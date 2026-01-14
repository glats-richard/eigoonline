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
  if (!pathname.startsWith("/tracker")) return next();

  const auth = context.request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("basic ")) return unauthorized();

  let decoded = "";
  try {
    const b64 = auth.slice(6).trim();
    decoded = Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return unauthorized();
  }

  const [user, pass] = decoded.split(":");
  if (!timingSafeEqual(user ?? "", USER) || !timingSafeEqual(pass ?? "", PASS)) return unauthorized();

  return next();
};

