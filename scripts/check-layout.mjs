import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();

function parseArgs(argv) {
  const out = { url: "http://127.0.0.1:4321/", outDir: "artifacts/layout-check" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = String(argv[++i] ?? out.url);
    if (a === "--outDir") out.outDir = String(argv[++i] ?? out.outDir);
  }
  return out;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  const { url, outDir } = parseArgs(process.argv.slice(2));
  const absOutDir = path.resolve(ROOT, outDir);
  await ensureDir(absOutDir);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const viewports = [
    { name: "se-320x568", width: 320, height: 568 },
    { name: "iphone8-375x667", width: 375, height: 667 }, // iPhone SE (2/3 gen) / small Safari-ish
    { name: "iphone12-390x844", width: 390, height: 844 },
  ];

  const failures = [];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector("#ranking", { timeout: 20_000 });

    // Scroll into the tabs section to ensure layout settled.
    await page.locator("#ranking").scrollIntoViewIfNeeded();

    const result = await page.evaluate(() => {
      const el = document.querySelector("#ranking");
      if (!el) return { ok: false, reason: "#ranking not found" };

      const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const rankingOverflow = el.scrollWidth - el.clientWidth;

      // Check each card as well (overflow usually comes from pills/CTA).
      const cards = Array.from(el.querySelectorAll(".rank-card"));
      const cardOverflows = cards
        .map((c, idx) => {
          const ow = (c.scrollWidth ?? 0) - (c.clientWidth ?? 0);
          return { idx, overflow: ow };
        })
        .filter((x) => x.overflow > 1);

      return {
        ok: docOverflow <= 1 && rankingOverflow <= 1 && cardOverflows.length === 0,
        docOverflow,
        rankingOverflow,
        cardOverflows,
      };
    });

    if (!result.ok) {
      const prefix = path.join(absOutDir, vp.name);
      await page.screenshot({ path: `${prefix}-full.png`, fullPage: true });
      await page.locator("#ranking").screenshot({ path: `${prefix}-ranking.png` });
      failures.push({ viewport: vp, result });
    }
  }

  await browser.close();

  if (failures.length) {
    // eslint-disable-next-line no-console
    console.error("[check:layout] FAILED", JSON.stringify(failures, null, 2));
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log("[check:layout] OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

