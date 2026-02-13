import { defineCollection, z } from 'astro:content';

const introMedia = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('image'),
		src: z.string(),
		alt: z.string().nullable().optional(),
		width: z.number().int().positive().nullable().optional(),
		height: z.number().int().positive().nullable().optional(),
	}),
	z.object({
		type: z.literal('iframe'),
		src: z.string(),
		width: z.number().int().positive().nullable().optional(),
		height: z.number().int().positive().nullable().optional(),
	}),
]);

const prMedia = z.object({
	src: z.string(),
	alt: z.string().nullable().optional(),
	width: z.number().int().positive().nullable().optional(),
	height: z.number().int().positive().nullable().optional(),
});

const prYoutube = z.object({
	youtube: z.string(),
	title: z.string().nullable().optional(),
});

const schools = defineCollection({
	type: 'data',
	schema: z.object({
		name: z.string(),
		/** Monthly price text (e.g. "7,425円"). */
		priceText: z.string().nullable().optional(),
		/** Free trial text (e.g. "7日間", "1回"). */
		trialText: z.string().nullable().optional(),
		/** Benefit/promo text shown in list (e.g. "初月50%OFF"). */
		benefitText: z.string().nullable().optional(),
		/** Lesson hours text (e.g. "24時間", "朝5時〜深夜25時"). */
		hoursText: z.string().nullable().optional(),
		/** Optional hero paragraph shown under the title on detail pages. */
		heroDescription: z.string().nullable().optional(),
		/** Optional hero image shown above heroDescription. */
		heroImageUrl: z.string().nullable().optional(),
		heroImageAlt: z.string().nullable().optional(),
		/** PR blocks shown under hero (icon + title, then 2-col text/image). */
		prSectionTitle: z.string().nullable().optional(),
		prSections: z
			.array(
				z.object({
					iconText: z.string().nullable().optional(),
					iconUrl: z.string().nullable().optional(),
					title: z.string(),
					body: z.string(),
					image: z.union([prMedia, prYoutube]).nullable().optional(),
					reverse: z.boolean().optional(),
				}),
			)
			.default([]),
		/** Intro blocks shown on detail pages (image/embed + heading + body). */
		introSectionTitle: z.string().nullable().optional(),
		/** Where to show introSections: as a section (default) or in hero description. */
		introPlacement: z.enum(['section', 'hero']).nullable().optional(),
		introSections: z
			.array(
				z.object({
					title: z.string(),
					body: z.string(),
					wideMedia: introMedia.nullable().optional(),
					sideMedia: introMedia.nullable().optional(),
					reverse: z.boolean().optional(),
				}),
			)
			.default([]),
		/** Teacher quality score 0-5 in 0.5 steps (for the small table). */
		teacherQuality: z
			.number()
			.min(0)
			.max(5)
			.nullable()
			.optional()
			.refine((v) => v === null || Math.round(v * 2) / 2 === v, {
				message: 'teacherQuality must be in 0.5 increments',
			}),
		/** Material quality score 0-5 in 0.5 steps (for the compare table). */
		materialQuality: z
			.number()
			.min(0)
			.max(5)
			.nullable()
			.optional()
			.refine((v) => v === null || Math.round(v * 2) / 2 === v, {
				message: 'materialQuality must be in 0.5 increments',
			}),
		/** Connection quality score 0-5 in 0.5 steps (for the compare table). */
		connectionQuality: z
			.number()
			.min(0)
			.max(5)
			.nullable()
			.optional()
			.refine((v) => v === null || Math.round(v * 2) / 2 === v, {
				message: 'connectionQuality must be in 0.5 increments',
			}),
		/** Free-trial detail text shown in the small table. */
		trialDetailText: z.string().nullable().optional(),
		/** Plan & price link (separate from officialUrl). */
		planUrl: z.string().url().nullable().optional(),
		/** Banner image shown in the long section (local path like "/banners/xxx.jpg"). */
		bannerImage: z.string().nullable().optional(),
		bannerAlt: z.string().nullable().optional(),
		bannerHref: z.string().url().nullable().optional(),
		/** Editorial comments bullets for the long section. */
		editorialComments: z.array(z.string()).default([]),
		/** Campaign end date (YYYY-MM-DD or ISO). Used for countdown (client-side). */
		campaignEndsAt: z.string().nullable().optional(),
		/** Campaign bullets (preferred over parsing campaignText). */
		campaignBullets: z.array(z.string()).default([]),
		/** Uniqueness title for detail pages. */
		uniquenessTitle: z.string().nullable().optional(),
		/** Uniqueness bullets (what makes it different). */
		uniquenessBullets: z.array(z.string()).default([]),
		/** Primary sources (official/LP/PR) backing the claims. */
		primarySources: z
			.array(
				z.object({
					label: z.string(),
					url: z.string().url(),
					type: z.enum(['official', 'lp', 'pr']),
				}),
			)
			.default([]),
		/** Strong points for compare table. */
		points: z.array(z.string()).default([]),
		/** Recommended-for bullets. */
		recommendedFor: z.array(z.string()).default([]),
		/** Optional per-section title/subtitle overrides for detail pages. */
		tagsSectionTitle: z.string().nullable().optional(),
		tagsSectionSubtitle: z.string().nullable().optional(),
		recommendedTagsTitle: z.string().nullable().optional(),
		featureTagsTitle: z.string().nullable().optional(),
		keyFactsSectionTitle: z.string().nullable().optional(),
		keyFactsSectionSubtitle: z.string().nullable().optional(),
		basicDataSectionTitle: z.string().nullable().optional(),
		methodologySectionTitle: z.string().nullable().optional(),
		methodologySectionSubtitle: z.string().nullable().optional(),
		methodology: z.array(z.string()).default([]),
		featureSectionTitle: z.string().nullable().optional(),
		reviewsSectionTitle: z.string().nullable().optional(),
		reviewsSectionSubtitle: z.string().nullable().optional(),
		rating: z.number().min(0).max(5).nullable().optional(),
		features: z.array(z.string()).default([]),
		// Allow absolute URLs or local public paths like "/logos/company-27.png"
		logoUrl: z.string().nullable().optional(),
		officialUrl: z.string().url(),
		campaignText: z.string().nullable().optional(),
		summary: z.string(),
		source: z.object({
			url: z.string().url().nullable().optional(),
			note: z.string().optional(),
		}),
	}),
});

const rankingCategory = z.enum([
	// Home tabs
	'overall',
	'exam',
	'daily',
	'business',
	// Category pages (/ranking/*)
	'kids',
	'beginner',
	'senior',
	'businessman',
	'lowcost',
	'one-on-one',
	// Student categories
	'student',
	'elementary',
	'junior-high',
	'high-school',
]);

const rankings = defineCollection({
	type: 'data',
	schema: z.object({
		category: rankingCategory,
		title: z.string(),
		description: z.string().optional(),
		/** Ordered list of school IDs (filenames in src/content/schools). */
		items: z.array(z.string().min(1)).min(1),
		source: z.object({
			url: z.string().url().nullable().optional(),
			note: z.string().optional(),
		}),
	}),
});

const categories = defineCollection({
	type: 'data',
	schema: z.object({
		group: z.enum(['level', 'age', 'recommend']),
		title: z.string(),
		href: z.string(),
		image: z.string().nullable().optional(),
	}),
});

const pickups = defineCollection({
	type: 'data',
	schema: z.object({
		label: z.string().default('PR'),
		title: z.string(),
		body: z.string(),
		schoolId: z.string().optional(),
		ctaLabel: z.string().default('公式サイトをチェック'),
		ctaHref: z.string(),
		image: z.string().nullable().optional(),
	}),
});

const articles = defineCollection({
	type: 'data',
	schema: z.object({
		title: z.string(),
		href: z.string(),
		image: z.string().nullable().optional(),
	}),
});

const banners = defineCollection({
	type: 'data',
	schema: z.object({
		placement: z.enum(['sidebar', 'sidebar_top', 'sidebar_mid', 'sidebar_bottom']),
		href: z.string(),
		image: z.string(),
		alt: z.string(),
		label: z.string().optional(),
	}),
});

const reviews = defineCollection({
	type: 'data',
	schema: z.object({
		schoolId: z.string(),
		items: z
			.array(
				z.object({
					age: z.string(),
					nickname: z.string().optional(),
					studyPeriod: z.string().optional(),
					rating: z.number().min(0).max(5),
					body: z.string(),
				}),
			)
			.default([]),
		source: z
			.object({
				url: z.string().url().nullable().optional(),
				note: z.string().optional(),
			})
			.optional(),
	}),
});

export const collections = { schools, rankings, categories, pickups, articles, banners, reviews };

