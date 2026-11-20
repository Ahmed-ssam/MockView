import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Returns null when Supabase env vars are missing so pages can show a clear message. */
export function getSupabase(): SupabaseClient | null {
  if (!authConfigured) return null;
  client ??= createClient(url!, key!);
  return client;
}
