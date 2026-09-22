import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_SUPABASE_URL = "https://hkjnihdesbzlxxzjqpat.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LAThhHmdwRyNHL9JLgiTAw_25RrvsyW";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return createBrowserClient(url, publishableKey);
}
