import { getCollection } from "astro:content";
import { dbEnvError, query } from "./db";

type OverrideRow = { school_id: string; data: any };

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function mergeShallow(base: any, override: any) {
  if (!isPlainObject(base) || !isPlainObject(override)) return { ...(base ?? {}), ...(override ?? {}) };
  const out: any = { ...base };
  // These fields must not be overridden via tracker (derived from user reviews).
  const NO_OVERRIDE_KEYS = new Set(["rating", "teacherQuality", "materialQuality", "connectionQuality"]);
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

export async function getSchoolsMerged() {
  const schools = await getCollection("schools");
  const overrides = await getSchoolOverridesMap();
  return schools.map((s) => {
    const o = overrides.get(s.id) ?? null;
    if (!o) return s;
    // Merge root keys shallowly; nested `source` also shallow merge.
    const merged = mergeShallow(s.data, o);
    if (o.source && s.data.source) merged.source = mergeShallow(s.data.source, o.source);
    return { ...s, data: merged };
  });
}

export async function getSchoolMergedById(schoolId: string) {
  const schools = await getSchoolsMerged();
  return schools.find((s) => s.id === schoolId) ?? null;
}

