import { createClient } from "@supabase/supabase-js";

type Env = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SERVICE_KEY?: string;
};

const env = import.meta.env as unknown as Env;

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey =
  env.SUPABASE_SERVICE_ROLE_KEY ??
  env.SUPABASE_SERVICE_KEY ??
  env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL env var");
}
if (!supabaseKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY env var");
}

/**
 * Server-side Supabase client.
 * NOTE: Use SUPABASE_SERVICE_ROLE_KEY on the server for admin-only dashboards like /tracker.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

