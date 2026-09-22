"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { COMPLEXITY_OPTIONS } from "@/lib/scoring";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const ALLOWED_COMPLEXITIES = new Set<string>(COMPLEXITY_OPTIONS.map((item) => item.value));

function jump(type: "ok" | "error", message: string): never {
  redirect(`/tasks?${type}=${encodeURIComponent(message)}`);
}

export async function updateTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) {
    jump("error", "Akses Supervisor atau Admin diperlukan.");
  }

  const taskId = String(formData.get("task_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const complexity = String(formData.get("complexity") || "administrasi").trim();
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!taskId || !assignedTo || title.length < 3) {
    jump("error", "Pegawai dan judul task wajib diisi.");
  }
  if (!ALLOWED_PRIORITIES.has(priority)) jump("error", "Priority tidak valid.");
  if (!ALLOWED_COMPLEXITIES.has(complexity)) jump("error", "Kompleksitas tidak valid.");

  const [taskResult, employeeResult, claimResult] = await Promise.all([
    supabase.from("tasks").select("id,status,period_id").eq("id", taskId).maybeSingle(),
    supabase.from("employees").select("id").eq("id", assignedTo).eq("active", true).maybeSingle(),
    supabase.from("task_claims").select("id").eq("task_id", taskId).limit(1),
  ]);

  if (!taskResult.data) jump("error", "Task tidak ditemukan.");
  if (!employeeResult.data) jump("error", "Pegawai tidak aktif atau tidak ditemukan.");
  if ((claimResult.data?.length ?? 0) > 0) {
    jump("error", "Task sudah memiliki submission/evidence sehingga tidak dapat diedit.");
  }
  if (!["assigned", "in_progress"].includes(taskResult.data.status)) {
    jump("error", "Task dengan status ini sudah tidak dapat diedit.");
  }

  let dueAt: string | null = null;
  if (dueDate) {
    const parsed = new Date(`${dueDate}T23:59:59+07:00`);
    if (Number.isNaN(parsed.getTime())) jump("error", "Tanggal jatuh tempo tidak valid.");
    dueAt = parsed.toISOString();
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      assigned_to: assignedTo,
      title,
      description,
      priority,
      complexity,
      due_at: dueAt,
    })
    .eq("id", taskId);

  if (error) jump("error", "Perubahan task gagal disimpan.");

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/leaderboard");
  jump("ok", "Task berhasil diperbarui.");
}
