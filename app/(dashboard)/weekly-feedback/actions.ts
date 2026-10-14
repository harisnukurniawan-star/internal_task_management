"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = {
  performance: "calibration_performance",
  contribution: "calibration_contribution",
  collaboration: "calibration_collaboration",
} as const;

export async function saveWeeklyCalibration(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["supervisor", "admin"].includes(profile.role)) redirect("/dashboard");

  const id = String(formData.get("id") || "").trim();
  const dim = String(formData.get("dimension") || "").trim();
  const scoreRaw = String(formData.get("score") ?? "");
  const score = Number(scoreRaw);
  const pageCandidate = Number(formData.get("page") || 1);
  const page = Number.isSafeInteger(pageCandidate) && pageCandidate > 0 && pageCandidate <= 100000
    ? pageCandidate : 1;
  const base = "/weekly-feedback?tab=history&page=" + page;
  const location = base + (UUID_RE.test(id) ? "&entry=" + encodeURIComponent(id) : "");
  if (!UUID_RE.test(id) || !(dim in FIELDS) || !/^[1-5]$/.test(scoreRaw) || !Number.isInteger(score)) {
    redirect(location + "&error=invalid");
  }

  const field = FIELDS[dim as keyof typeof FIELDS];
  const { data: prior, error: readError } = await supabase.from("weekly_feedback")
    .select("id,calibration_status,calibration_performance,calibration_contribution,calibration_collaboration,calibrated_at")
    .eq("id", id).maybeSingle();
  if (readError || !prior) redirect(location + "&error=not_found");

  const values = {
    calibration_performance: prior.calibration_performance as number | null,
    calibration_contribution: prior.calibration_contribution as number | null,
    calibration_collaboration: prior.calibration_collaboration as number | null,
  };
  values[field] = score;
  const complete = Object.values(values).every((value) => value !== null);
  // Only the selected dimension changes; existing supervisor entries are preserved.
  let update = supabase.from("weekly_feedback").update({
    [field]: score,
    calibration_status: complete ? "calibrated" : "pending",
    calibrated_by: profile.id,
    calibrated_at: new Date().toISOString(),
  }).eq("id", id).eq("calibration_status", prior.calibration_status);
  // Optimistic lock: two simultaneous saves cannot silently overwrite a recent save.
  update = prior.calibrated_at === null
    ? update.is("calibrated_at", null)
    : update.eq("calibrated_at", prior.calibrated_at);
  const { data: updated, error } = await update.select("id").maybeSingle();
  if (error || !updated) redirect(location + "&error=conflict");

  revalidatePath("/weekly-feedback");
  redirect(location + "&saved=1");
}
