import { AppShell } from "@/components/app-shell";
import { WeeklyFeedbackGate } from "@/components/weekly-feedback-gate";
import { requireProfile } from "@/lib/auth";
import { getPendingWeeklyFeedback } from "@/lib/weekly-feedback";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireProfile();
  const supervisor = profile.role === "supervisor" || profile.role === "admin";

  let validationCount = 0;
  let assignmentCount = 0;
  let pendingFeedbackWeek: string | null = null;

  if (supervisor) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted");
    validationCount = count ?? 0;
  } else {
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();

    if (employee) {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", employee.id)
        .eq("status", "assigned");
      assignmentCount = count ?? 0;
      // Query only the employee's own submitted claims and feedback (RLS scoped).
      // The Monday–Wednesday catch-up has priority over Wednesday's new week.
      try {
        pendingFeedbackWeek = await getPendingWeeklyFeedback(supabase, employee.id);
      } catch {
        // Do not lock the entire application on a temporary database failure.
        // The staff feedback page reports retrieval failures explicitly.
      }
    }
  }

  return (
    <AppShell
      role={profile.role}
      name={profile.full_name}
      validationCount={validationCount}
      assignmentCount={assignmentCount}
    >
      {children}
      {!supervisor && pendingFeedbackWeek ? <WeeklyFeedbackGate weekStart={pendingFeedbackWeek} /> : null}
    </AppShell>
  );
}
