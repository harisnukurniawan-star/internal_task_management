"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { getPendingWeeklyFeedback } from "@/lib/weekly-feedback";

export async function submitWeeklySelfFeedback(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "employee") redirect("/dashboard");

  const requestedWeek = String(formData.get("week_start") || "").trim();
  const scores = ["performance", "contribution", "collaboration"]
    .map((key) => String(formData.get(key) ?? "").trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) || !scores.every((v) => /^[1-5]$/.test(v))) {
    redirect("/weekly-feedback?error=invalid");
  }

  const { data: employee, error: employeeError } = await supabase.from("employees")
    .select("id").eq("profile_id", profile.id).eq("active", true).maybeSingle();
  if (employeeError || !employee) redirect("/weekly-feedback?error=employee");

  let pending: string | null;
  try {
    pending = await getPendingWeeklyFeedback(supabase, employee.id);
  } catch {
    redirect("/weekly-feedback?error=load");
  }
  if (pending !== requestedWeek) redirect("/weekly-feedback?error=period");

  const { error } = await supabase.from("weekly_feedback").insert({
    employee_id: employee.id,
    week_start: requestedWeek,
    performance: Number(scores[0]),
    contribution: Number(scores[1]),
    collaboration: Number(scores[2]),
  });

  if (error) {
    // A concurrent tab may have submitted this same week already.
    const { data: recorded } = await supabase.from("weekly_feedback")
      .select("id").eq("employee_id", employee.id).eq("week_start", requestedWeek).maybeSingle();
    if (!recorded) redirect("/weekly-feedback?error=save");
  }

  revalidatePath("/", "layout");
  revalidatePath("/weekly-feedback");
  redirect("/weekly-feedback?saved=1");
}
