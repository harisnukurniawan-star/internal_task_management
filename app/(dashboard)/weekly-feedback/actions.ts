"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toScore(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null;
}

export async function calibrateWeeklyFeedback(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["supervisor", "admin"].includes(profile.role)) {
    redirect("/dashboard");
  }
  const id = String(formData.get("id") || "");
  if (!uuidPattern.test(id)) redirect("/weekly-feedback?tab=calibration&error=invalid");
  const status = String(formData.get("status") || "");
  const semester = String(formData.get("semester") || "");
  const semesterParam = /^\d{4}-(1|2)$/.test(semester) ? "&semester=" + semester : "";
  if (status !== "calibrated" && status !== "insufficient") {
    redirect("/weekly-feedback?tab=calibration&entry=" + id + semesterParam + "&error=invalid");
  }
  const performance = toScore(formData.get("performance"));
  const contribution = toScore(formData.get("contribution"));
  const collaboration = toScore(formData.get("collaboration"));
  if (status === "calibrated" && [performance, contribution, collaboration].some((v) => v === null)) {
    redirect("/weekly-feedback?tab=calibration&entry=" + id + semesterParam + "&error=score");
  }
  const note = String(formData.get("note") || "").trim().slice(0, 500);
  const { data: updated, error } = await supabase.from("weekly_feedback").update({
    calibration_status: status,
    calibration_performance: status === "calibrated" ? performance : null,
    calibration_contribution: status === "calibrated" ? contribution : null,
    calibration_collaboration: status === "calibrated" ? collaboration : null,
    calibration_note: note || null,
    calibrated_by: profile.id,
    calibrated_at: new Date().toISOString(),
  }).eq("id", id).select("id").maybeSingle();
  if (error || !updated) redirect("/weekly-feedback?tab=calibration&entry=" + id + semesterParam + "&error=save");
  revalidatePath("/weekly-feedback");
  redirect("/weekly-feedback?tab=calibration&entry=" + id + semesterParam + "&saved=1");
}
