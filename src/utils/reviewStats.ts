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
};

export function getDetailedReviewStatsFromDB(reviews: DBReviewRow[]): DetailedReviewStats {
  const validReviews = reviews.filter(
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

  const count = validReviews.length;
  if (!count) {
    return {
      count: 0,
      overallAvg: null,
      teacherQualityAvg: null,
      materialQualityAvg: null,
      connectionQualityAvg: null,
    };
  }

  const overallSum = validReviews.reduce((acc, r) => acc + (r.overall_rating ?? 0), 0);
  const teacherSum = validReviews.reduce((acc, r) => acc + (r.teacher_quality ?? 0), 0);
  const materialSum = validReviews.reduce((acc, r) => acc + (r.material_quality ?? 0), 0);
  const connectionSum = validReviews.reduce((acc, r) => acc + (r.connection_quality ?? 0), 0);

  const overallAvg = Math.round((overallSum / count) * 10) / 10;
  const teacherQualityAvg = Math.round((teacherSum / count) * 10) / 10;
  const materialQualityAvg = Math.round((materialSum / count) * 10) / 10;
  const connectionQualityAvg = Math.round((connectionSum / count) * 10) / 10;

  return {
    count,
    overallAvg,
    teacherQualityAvg,
    materialQualityAvg,
    connectionQualityAvg,
  };
}

