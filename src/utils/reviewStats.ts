export type ReviewLike = { rating: number };

export type ReviewStats = {
  count: number;
  avg: number | null;
};

export function getReviewStats(items: ReviewLike[] | null | undefined): ReviewStats {
  const list = (items ?? []).filter((x) => typeof x.rating === "number" && Number.isFinite(x.rating));
  const count = list.length;
  if (!count) return { count: 0, avg: null };

  const sum = list.reduce((acc, x) => acc + x.rating, 0);
  const avg = sum / count;
  // Keep 1-decimal precision for display consistency.
  const rounded = Math.round(avg * 10) / 10;

  return { count, avg: rounded };
}

