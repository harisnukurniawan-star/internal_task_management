"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { COMPLEXITY_OPTIONS, QUALITY_OPTIONS } from "@/lib/scoring";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const ALLOWED_DECISIONS = new Set(["approved", "revision", "rejected"]);
const ALLOWED_COMPLEXITIES = new Set<string>(COMPLEXITY_OPTIONS.map((item) => item.value));
const ALLOWED_QUALITIES = new Set<string>(QUALITY_OPTIONS.map((item) => item.value));
const ALLOWED_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;

function jump(path: string, type: "ok" | "error" | "warning", message: string): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
  throw new Error("Redirect failed");
}

export async function createTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("/dashboard", "error", "Akses Supervisor diperlukan.");

  const periodId = String(formData.get("period_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const complexity = String(formData.get("complexity") || "administrasi").trim();
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!periodId || !assignedTo || title.length < 3) {
    jump("/tasks", "error", "Periode, pegawai, dan judul task wajib diisi.");
  }
  if (!ALLOWED_PRIORITIES.has(priority)) jump("/tasks", "error", "Priority tidak valid.");
  if (!ALLOWED_COMPLEXITIES.has(complexity)) jump("/tasks", "error", "Kompleksitas tidak valid.");

  const [periodResult, employeeResult] = await Promise.all([
    supabase.from("weekly_periods").select("id,status").eq("id", periodId).maybeSingle(),
    supabase.from("employees").select("id").eq("id", assignedTo).eq("active", true).maybeSingle(),
  ]);
  if (!periodResult.data || periodResult.data.status === "closed") {
    jump("/tasks", "error", "Periode tidak aktif atau sudah ditutup.");
  }
  if (!employeeResult.data) jump("/tasks", "error", "Pegawai tidak aktif atau tidak ditemukan.");

  let dueAt: string | null = null;
  if (dueDate) {
    const parsed = new Date(`${dueDate}T23:59:59+07:00`);
    if (Number.isNaN(parsed.getTime())) jump("/tasks", "error", "Tanggal jatuh tempo tidak valid.");
    dueAt = parsed.toISOString();
  }

  const { error } = await supabase.from("tasks").insert({
    period_id: periodId,
    assigned_to: assignedTo,
    assigned_by: profile.id,
    title,
    description,
    priority,
    complexity,
    due_at: dueAt,
  });
  if (error) jump("/tasks", "error", "Task gagal disimpan.");

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  jump("/tasks", "ok", "Task berhasil di-assign.");
}

export async function submitClaim(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "employee") jump("/dashboard", "error", "Akses Employee diperlukan.");

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("active", true)
    .maybeSingle();
  if (!employee) jump("/my-tasks", "error", "Profil employee belum ditautkan.");

  const taskId = String(formData.get("task_id") || "").trim();
  const summary = String(formData.get("realization_summary") || "").trim();
  const fileValue = formData.get("evidence");
  const evidence = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

  if (!taskId || summary.length < 3) {
    jump("/my-tasks", "error", "Realisasi wajib diisi.");
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id,status,assigned_to")
    .eq("id", taskId)
    .maybeSingle();
  if (!task || task.assigned_to !== employee.id) {
    jump("/my-tasks", "error", "Task tidak ditemukan atau bukan milik Anda.");
  }
  if (!["assigned", "in_progress", "revision"].includes(task.status)) {
    jump("/my-tasks", "error", "Task ini sedang menunggu review atau sudah ditutup.");
  }

  if (evidence) {
    if (evidence.size > MAX_EVIDENCE_BYTES) {
      jump("/my-tasks", "error", "Evidence maksimal 3 MB.");
    }
    if (!ALLOWED_EVIDENCE_TYPES.has(evidence.type)) {
      jump("/my-tasks", "error", "Evidence hanya PDF, JPG, PNG, atau WebP.");
    }
  }

  const { data: oldClaims } = await supabase
    .from("task_claims")
    .select("version")
    .eq("task_id", taskId)
    .order("version", { ascending: false })
    .limit(1);
  const version = (oldClaims?.[0]?.version || 0) + 1;

  const { data: claim, error: claimError } = await supabase
    .from("task_claims")
    .insert({
      task_id: taskId,
      employee_id: employee.id,
      realization_summary: summary,
      completion_percent: evidence ? 100 : 0,
      version,
    })
    .select("id")
    .single();
  if (claimError || !claim) jump("/my-tasks", "error", "Realisasi gagal disimpan.");

  let warning = "";
  if (evidence) {
    const safe = evidence.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${employee.id}/${claim.id}/${crypto.randomUUID()}-${safe}`;
    const upload = await supabase.storage.from("task-evidence").upload(path, evidence, {
      contentType: evidence.type,
      upsert: false,
    });

    if (upload.error) {
      warning = "Realisasi tersimpan, tetapi evidence gagal diunggah. Completion akan bernilai 0 sampai evidence tersedia.";
    } else {
      const meta = await supabase.from("evidence_files").insert({
        claim_id: claim.id,
        file_name: evidence.name,
        file_size: evidence.size,
        mime_type: evidence.type,
        storage_path: path,
      });
      if (meta.error) {
        await supabase.storage.from("task-evidence").remove([path]);
        warning = "Realisasi tersimpan, tetapi metadata evidence gagal disimpan. Completion akan bernilai 0.";
      }
    }
  }

  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");

  if (warning) jump("/my-tasks", "warning", warning);
  jump("/my-tasks", "ok", `Realisasi versi ${version} berhasil dikirim.`);
}

export async function evaluateClaim(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("/dashboard", "error", "Akses Supervisor diperlukan.");

  const claimId = String(formData.get("claim_id") || "").trim();
  const decision = String(formData.get("decision") || "").trim();
  const quality = String(formData.get("quality") || "").trim();
  const feedback = String(formData.get("feedback") || "").trim() || null;

  if (!claimId || !ALLOWED_DECISIONS.has(decision)) {
    jump("/reviews", "error", "Submission atau keputusan tidak valid.");
  }
  if (!ALLOWED_QUALITIES.has(quality)) {
    jump("/reviews", "error", "Penilaian Quality tidak valid.");
  }

  const { data: claim } = await supabase
    .from("task_claims")
    .select("id,task_id")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) jump("/reviews", "error", "Submission tidak ditemukan.");

  const { data: latestClaims } = await supabase
    .from("task_claims")
    .select("id")
    .eq("task_id", claim.task_id)
    .order("version", { ascending: false })
    .limit(1);
  if (latestClaims?.[0]?.id !== claimId) {
    jump("/reviews", "error", "Submission ini bukan versi terbaru.");
  }

  const { data: evaluation, error } = await supabase.from("task_evaluations").upsert(
    {
      claim_id: claimId,
      evaluator_id: profile.id,
      decision,
      quality,
      feedback,
      evaluated_at: new Date().toISOString(),
    },
    { onConflict: "claim_id" },
  ).select("score,complexity_score,timeliness_score,quality_score,completion_score").single();
  if (error || !evaluation) jump("/reviews", "error", "Evaluasi gagal disimpan.");

  revalidatePath("/reviews");
  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  jump("/reviews", "ok", `Evaluasi berhasil disimpan. Skor aktivitas ${Number(evaluation.score).toFixed(2)}.`);
}
