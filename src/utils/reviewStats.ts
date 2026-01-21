export type ReviewLike = { rating: number };

export type ReviewStats = {
  count: number;
  avg: number | null;
};

export type DetailedReviewStats = {
  count: number;
  overallAvg: number | null;
  teacherQualityAvg: number | null;
  materialQualityAvg: number | null;
  connectionQualityAvg: number | null;
  priceRatingAvg: number | null;
  satisfactionRatingAvg: number | null;
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

export type DBReviewRow = {
  overall_rating: number | null;
  teacher_quality: number | null;
  material_quality: number | null;
  connection_quality: number | null;
  price_rating?: number | null;
  satisfaction_rating?: number | null;
};

export function getDetailedReviewStatsFromDB(reviews: DBReviewRow[]): DetailedReviewStats {
  const coreValid = reviews.filter(
    (r) =>
      typeof r.overall_rating === "number" &&
      Number.isFinite(r.overall_rating) &&
      typeof r.teacher_quality === "number" &&
      Number.isFinite(r.teacher_quality) &&
      typeof r.material_quality === "number" &&
      Number.isFinite(r.material_quality) &&
      typeof r.connection_quality === "number" &&
      Number.isFinite(r.connection_quality),
  );

  const count = coreValid.length;

  const avgFor = (xs: number[]) => {
    if (!xs.length) return null;
    return Math.round(((xs.reduce((a, b) => a + b, 0) / xs.length) as number) * 10) / 10;
  };

  const overallAvg = count ? avgFor(coreValid.map((r) => r.overall_rating as number)) : null;
  const teacherQualityAvg = count ? avgFor(coreValid.map((r) => r.teacher_quality as number)) : null;
  const materialQualityAvg = count ? avgFor(coreValid.map((r) => r.material_quality as number)) : null;
  const connectionQualityAvg = count ? avgFor(coreValid.map((r) => r.connection_quality as number)) : null;

  const priceValid = reviews
    .map((r) => r.price_rating)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const satisfactionValid = reviews
    .map((r) => r.satisfaction_rating)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const priceRatingAvg = avgFor(priceValid);
  const satisfactionRatingAvg = avgFor(satisfactionValid);

  return {
    count,
    overallAvg,
    teacherQualityAvg,
    materialQualityAvg,
    connectionQualityAvg,
    priceRatingAvg,
    satisfactionRatingAvg,
  };
}

