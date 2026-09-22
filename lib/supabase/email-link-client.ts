import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://hkjnihdesbzlxxzjqpat.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LAThhHmdwRyNHL9JLgiTAw_25RrvsyW";

/**
 * Client khusus untuk REQUEST email link (activation/recovery).
 *
 * Flow utama aplikasi tetap menggunakan @supabase/ssr + PKCE. Untuk email
 * activation/recovery kita sengaja memakai implicit flow karena link harus bisa
 * dibuka dari browser/perangkat lain dan tidak boleh bergantung pada PKCE code
 * verifier yang tersimpan di browser yang mengirim request.
 *
 * Client ini tidak menyimpan session. Session baru dibentuk setelah user klik
 * email link, di /auth/confirm, menggunakan browser SSR client.
 */
export function createEmailLinkClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return createSupabaseClient(url, publishableKey, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
