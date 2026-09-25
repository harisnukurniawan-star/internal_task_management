import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function getCurrentPeriod(client?: ServerSupabaseClient) {
  const supabase = client ?? await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("weekly_periods")
    .select("id,label,week_start,week_end,status")
    .lte("week_start", today)
    .gte("week_end", today)
    .maybeSingle();
  return data;
}

export async function getEmployeeForProfile(profileId: string, client?: ServerSupabaseClient) {
  const supabase = client ?? await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id,profile_id,full_name,active,display_order")
    .eq("profile_id", profileId)
    .maybeSingle();
  return data;
}
