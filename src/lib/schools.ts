import { getCollection } from "astro:content";
import { dbEnvError, query } from "./db";

type OverrideRow = { school_id: string; data: any };

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function looksLikeJsonArrayString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return s.startsWith("[") && s.endsWith("]");
}

function safeJsonParse(v: string): any {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function looksLikePlaceholderText(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  // Common placeholders coming from tracker/CSV (e.g. "〇〇円から", "○○円から").
  if (s.includes("〇〇") || s.includes("○○")) return true;
  return false;
}

function sanitizeMergedSchool(base: any, merged: any) {
  // Fix common tracker CSV import mistakes:
  // Some cells contain JSON text (e.g. `["a","b"]` or `[{...}]`) which gets stored
  // as a single string inside arrays like `features: ["[...]"]`.
  // If that happens, fall back to base content (so the editor shows clean text).
  const out: any = merged;

  const normalizeStringArrayField = (key: string) => {
    const v = out?.[key];
    if (Array.isArray(v) && v.length === 1 && looksLikeJsonArrayString(v[0])) {
      const parsed = safeJsonParse(v[0]);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        out[key] = parsed.map((x) => String(x));
        return;
      }
      // Corrupted/incorrect JSON in that cell: prefer base value.
      out[key] = Array.isArray(base?.[key]) ? base[key] : [];
      return;
    }
    if (typeof v === "string" && looksLikeJsonArrayString(v)) {
      // Unexpected type from overrides: prefer base.
      out[key] = Array.isArray(base?.[key]) ? base[key] : [];
    }
  };

  const normalizeStringField = (key: string) => {
    const v = out?.[key];
    if (typeof v === "string" && looksLikeJsonArrayString(v)) {
      out[key] = typeof base?.[key] === "string" || base?.[key] === null ? base?.[key] ?? null : null;
    }
  };

  const normalizeNullableStringField = (key: string) => {
    const v = out?.[key];
    if (typeof v === "string" && (looksLikeJsonArrayString(v) || looksLikePlaceholderText(v))) {
      out[key] = typeof base?.[key] === "string" || base?.[key] === null ? base?.[key] ?? null : null;
    }
  };

  // List fields shown as bullet lists / tag lists.
  for (const key of ["editorialComments", "features", "points", "recommendedFor"]) {
    normalizeStringArrayField(key);
  }

  // Price text sometimes gets imported as placeholders like "〇〇円から".
  normalizeNullableStringField("priceText");

  // Intro fields.
  normalizeStringField("introSectionTitle");

  const ip = out?.introPlacement;
  if (ip != null && ip !== "hero" && ip !== "section") {
    out.introPlacement = base?.introPlacement ?? null;
  }

  const introSections = out?.introSections;
  if (Array.isArray(introSections) && introSections.length === 1 && looksLikeJsonArrayString(introSections[0])) {
    const parsed = safeJsonParse(introSections[0]);
    if (Array.isArray(parsed) && parsed.every((x) => isPlainObject(x) && typeof x.title === "string" && typeof x.body === "string")) {
      out.introSections = parsed;
    } else {
      out.introSections = Array.isArray(base?.introSections) ? base.introSections : [];
    }
  } else if (typeof introSections === "string" && looksLikeJsonArrayString(introSections)) {
    // Unexpected type from overrides: prefer base.
    out.introSections = Array.isArray(base?.introSections) ? base.introSections : [];
  }

  return out;
}

function mergeShallow(base: any, override: any) {
  if (!isPlainObject(base) || !isPlainObject(override)) return { ...(base ?? {}), ...(override ?? {}) };
  const out: any = { ...base };
  // These fields must not be overridden via tracker (derived from user reviews).
  const NO_OVERRIDE_KEYS = new Set(["rating", "teacherQuality", "materialQuality", "connectionQuality", "prSections", "officialUrl", "bannerHref"]);
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    if (NO_OVERRIDE_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export async function getSchoolOverridesMap(): Promise<Map<string, any>> {
  if (dbEnvError) return new Map();
  try {
    const r = await query<OverrideRow>("select school_id, data from school_overrides", []);
    const m = new Map<string, any>();
    for (const row of r.rows ?? []) {
      if (row?.school_id) m.set(String(row.school_id), row.data ?? {});
    }
    return m;
  } catch {
    // If table isn't created yet, ignore.
    return new Map();
  }
}

import fs from 'node:fs/promises';
import path from 'node:path';

// Helper to read school data from filesystem at runtime (for SSR updates)
async function getSchoolsFromFs() {
  try {
    const schoolsDir = path.join(process.cwd(), 'src/content/schools');
    const files = await fs.readdir(schoolsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const schools = await Promise.all(jsonFiles.map(async (file) => {
      const id = file.replace('.json', '');
      const content = await fs.readFile(path.join(schoolsDir, file), 'utf-8');
      const data = JSON.parse(content);

      return {
        id,
        slug: id,
        body: '',
        collection: 'schools',
        data: data
      };
    }));

    return schools;
  } catch (e) {
    console.warn('Failed to read schools from FS:', e);
    return [];
  }
}

export async function getSchoolsMerged() {
  let schools;

  // In production (SSR), read from file system to pick up runtime changes
  // In dev, use getCollection for better DX (reloading etc)
  if (import.meta.env.PROD) {
    schools = await getSchoolsFromFs();
    if (!schools || schools.length === 0) {
      console.warn('Fallback to getCollection in PROD (FS read returned empty)');
      schools = await getCollection("schools");
    }
  } else {
    schools = await getCollection("schools");
  }

  const overrides = await getSchoolOverridesMap();
  return schools.map((s) => {
    const o = overrides.get(s.id) ?? null;
    if (!o) return s;
    // Merge root keys shallowly; nested `source` also shallow merge.
    const merged = sanitizeMergedSchool(s.data, mergeShallow(s.data, o));
    if (o.source && s.data.source) merged.source = mergeShallow(s.data.source, o.source);
    return { ...s, data: merged };
  });
}

export async function getSchoolMergedById(schoolId: string) {
  const schools = await getSchoolsMerged();
  return schools.find((s) => s.id === schoolId) ?? null;
}

