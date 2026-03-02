/**
 * Localhost DNS workaround.
 *
 * Some environments (incl. sandboxed CI) may not resolve "localhost" properly,
 * causing getaddrinfo ENOTFOUND localhost during build tooling.
 *
 * This patch maps "localhost" -> "127.0.0.1" for dns.promises.lookup().
 * It is only intended to be used via NODE_OPTIONS=--require for build scripts.
 */

const dns = require("node:dns");

try {
  const p = dns.promises;
  if (p && typeof p.lookup === "function") {
    const orig = p.lookup.bind(p);
    p.lookup = (hostname, options) => {
      const h = hostname === "localhost" ? "127.0.0.1" : hostname;
      return orig(h, options);
    };
  }
} catch {
  // ignore
}

