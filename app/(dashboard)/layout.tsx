import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireProfile();
  const supervisor = profile.role === "supervisor" || profile.role === "admin";

  let validationCount = 0;
  let assignmentCount = 0;

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
    </AppShell>
  );
}
