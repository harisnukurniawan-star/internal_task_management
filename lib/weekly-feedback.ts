import type { createClient } from "@/lib/supabase/server";

type Database = Awaited<ReturnType<typeof createClient>>;
const WIB_OFFSET = 7 * 60 * 60 * 1000;

export const SELF_FEEDBACK_QUESTIONS = [
  { key: "performance", label: "Performance", statement: "Saya merasa puas dengan pencapaian pekerjaan saya minggu ini." },
  { key: "contribution", label: "Contribution", statement: "Saya merasa pekerjaan saya minggu ini memberikan manfaat nyata bagi tim." },
  { key: "collaboration", label: "Collaboration", statement: "Saya merasa telah memberikan dukungan yang berarti bagi rekan kerja minggu ini." },
] as const;

export function weeklyFeedbackCandidates(now = new Date()): string[] {
  const local = new Date(now.getTime() + WIB_OFFSET);
  const weekday = local.getUTCDay() || 7; // Monday=1 … Sunday=7
  local.setUTCDate(local.getUTCDate() - (weekday - 1));
  const currentMonday = local.toISOString().slice(0, 10);
  local.setUTCDate(local.getUTCDate() - 7);
  const previousMonday = local.toISOString().slice(0, 10);

  // Carryover is considered first on Monday–Wednesday; the current week's
  // self-assessment is available Wednesday–Friday after a task submission.
  if (weekday === 1 || weekday === 2) return [previousMonday];
  if (weekday === 3) return [previousMonday, currentMonday];
  if (weekday === 4 || weekday === 5) return [currentMonday];
  return [];
}

export function weekRangeUTC(monday: string) {
  const start = Date.parse(monday + "T00:00:00Z") - WIB_OFFSET;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function getPendingWeeklyFeedback(
  supabase: Database, employeeId: string, now = new Date(),
): Promise<string | null> {
  const candidates = weeklyFeedbackCandidates(now);
  if (candidates.length === 0) return null;

  const { data: filled, error: feedbackError } = await supabase.from("weekly_feedback")
    .select("week_start").eq("employee_id", employeeId).in("week_start", candidates);
  if (feedbackError) throw feedbackError;
  const completed = new Set((filled ?? []).map((row) => String(row.week_start)));

  for (const monday of candidates) {
    if (completed.has(monday)) continue;
    const { start, end } = weekRangeUTC(monday);
    const { data: claims, error: claimsError } = await supabase.from("task_claims")
      .select("id").eq("employee_id", employeeId)
      .gte("submitted_at", start).lt("submitted_at", end).limit(1);
    if (claimsError) throw claimsError;
    if (claims?.length) return monday;
  }
  return null;
}
