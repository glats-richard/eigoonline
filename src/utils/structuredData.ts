type DateInput = string | null | undefined;

function normalizeDateToIso(dateLike: DateInput): string | null {
  const s = String(dateLike ?? "").trim();
  if (!s) return null;
  // YYYY-MM-DD -> keep as date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toAbsoluteUrl(url: string, siteUrl: URL): string {
  try {
    return new URL(url, siteUrl).toString();
  } catch {
    return String(url);
  }
}

export type BuildBlogPostingJsonLdInput = {
  /** Canonical URL of the article page. */
  canonicalUrl: string;
  title: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  /** Eye-catch image. Can be absolute URL or public path. */
  imageUrl?: string | null;
  /** Author display name. */
  authorName?: string | null;
  /** Meta description (optional). */
  description?: string | null;
  /** Base site URL (e.g. new URL(Astro.site) or Astro.url.origin). */
  siteUrl: URL;
};

/**
 * Build BlogPosting JSON-LD for an article page.
 * - Publisher is tied to Layout's Organization: `${origin}#organization`
 * - mainEntityOfPage is tied to Layout's WebPage: `${canonical}#webpage`
 */
export function buildBlogPostingJsonLd(input: BuildBlogPostingJsonLdInput) {
  const origin = input.siteUrl.toString().replace(/\/$/, "");
  const canonical = input.canonicalUrl;

  const published = normalizeDateToIso(input.publishedAt);
  const updated = normalizeDateToIso(input.updatedAt);
  const imageAbs = input.imageUrl ? toAbsoluteUrl(input.imageUrl, input.siteUrl) : null;
  const authorName = String(input.authorName ?? "").trim() || "eigoonline編集部";
  const description = String(input.description ?? "").trim() || undefined;

  const obj: any = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${canonical}#blogposting`,
    headline: input.title,
    name: input.title,
    url: canonical,
    inLanguage: "ja-JP",
    mainEntityOfPage: { "@id": `${canonical}#webpage` },
    publisher: { "@id": `${origin}#organization` },
    author: { "@type": "Person", name: authorName },
  };

  if (description) obj.description = description;
  if (imageAbs) obj.image = [{ "@type": "ImageObject", url: imageAbs }];
  if (published) obj.datePublished = published;
  if (updated) obj.dateModified = updated;

  return obj;
}

