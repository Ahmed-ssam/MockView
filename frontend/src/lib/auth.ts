import { isLocalMode } from "./localMode";
import { getSupabase } from "./supabase";

/** Current access token, or null when signed out / auth is not configured.
 *  In local mode there are no accounts; the backend ignores the token, so a fixed placeholder is returned. */
export async function getAccessToken(): Promise<string | null> {
  if (await isLocalMode()) return "local";
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
