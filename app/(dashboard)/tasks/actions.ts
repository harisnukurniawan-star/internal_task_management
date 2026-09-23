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

async function validateTaskInputs(
  supabase: any,
  assignedTo: string,
  supportKpiId: string,
  supportTupoksiId: string,
  priority: string,
  complexity: string,
) {
  if (!ALLOWED_PRIORITIES.has(priority)) jump("error", "Priority tidak valid.");
  if (!ALLOWED_COMPLEXITIES.has(complexity)) jump("error", "Kompleksitas tidak valid.");
  if (!supportKpiId) jump("error", "Support KPI wajib dipilih.");
  if (!supportTupoksiId) jump("error", "Support Tupoksi wajib dipilih.");

  const [employeeResult, kpiResult, tupoksiResult] = await Promise.all([
    supabase.from("employees").select("id").eq("id", assignedTo).eq("active", true).maybeSingle(),
    supabase.from("employee_kpis").select("id,employee_id").eq("id", supportKpiId).eq("employee_id", assignedTo).eq("active", true).maybeSingle(),
    supabase.from("employee_tupoksi").select("id,employee_id").eq("id", supportTupoksiId).eq("employee_id", assignedTo).eq("active", true).maybeSingle(),
  ]);
  if (!employeeResult.data) jump("error", "Pegawai tidak aktif atau tidak ditemukan.");
  if (!kpiResult.data) jump("error", "Support KPI tidak sesuai dengan pegawai yang dipilih.");
  if (!tupoksiResult.data) jump("error", "Support Tupoksi tidak sesuai dengan pegawai yang dipilih.");
}

async function ensureOpenPeriod(supabase: any, periodId: string) {
  const { data: period } = await supabase.from("weekly_periods").select("id,status").eq("id", periodId).maybeSingle();
  if (!period || period.status === "closed") jump("error", "Task hanya dapat diubah selama periode/minggu masih aktif.");
}

function parseDueDate(dueDate: string) {
  if (!dueDate) return null;
  const parsed = new Date(`${dueDate}T23:59:59+07:00`);
  if (Number.isNaN(parsed.getTime())) jump("error", "Tanggal jatuh tempo tidak valid.");
  return parsed.toISOString();
}

function refreshTaskPages() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/reviews");
  revalidatePath("/leaderboard");
}

export async function createTaskWithKpi(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("error", "Akses Supervisor atau Admin diperlukan.");

  const periodId = String(formData.get("period_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const supportKpiId = String(formData.get("support_kpi_id") || "").trim();
  const supportTupoksiId = String(formData.get("support_tupoksi_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const complexity = String(formData.get("complexity") || "administrasi").trim();
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!periodId || !assignedTo || title.length < 3) jump("error", "Periode, pegawai, dan judul task wajib diisi.");
  await validateTaskInputs(supabase, assignedTo, supportKpiId, supportTupoksiId, priority, complexity);
  await ensureOpenPeriod(supabase, periodId);

  const { error } = await supabase.from("tasks").insert({
    period_id: periodId,
    assigned_to: assignedTo,
    assigned_by: profile.id,
    support_kpi_id: supportKpiId,
    support_tupoksi_id: supportTupoksiId,
    title,
    description,
    priority,
    complexity,
    due_at: parseDueDate(dueDate),
  });
  if (error) jump("error", "Task gagal disimpan.");

  refreshTaskPages();
  jump("ok", "Task berhasil di-assign.");
}

export async function updateTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("error", "Akses Supervisor atau Admin diperlukan.");

  const taskId = String(formData.get("task_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const supportKpiId = String(formData.get("support_kpi_id") || "").trim();
  const supportTupoksiId = String(formData.get("support_tupoksi_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const complexity = String(formData.get("complexity") || "administrasi").trim();
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!taskId || !assignedTo || title.length < 3) jump("error", "Pegawai dan judul task wajib diisi.");
  await validateTaskInputs(supabase, assignedTo, supportKpiId, supportTupoksiId, priority, complexity);

  const [taskResult, claimResult] = await Promise.all([
    supabase.from("tasks").select("id,status,period_id,assigned_to,support_kpi_id,support_tupoksi_id").eq("id", taskId).maybeSingle(),
    supabase.from("task_claims").select("id").eq("task_id", taskId).limit(1),
  ]);
  const task = taskResult.data;
  if (!task) jump("error", "Task tidak ditemukan.");
  await ensureOpenPeriod(supabase, task.period_id);

  const hasSubmission = (claimResult.data?.length ?? 0) > 0;
  if (hasSubmission && assignedTo !== task.assigned_to) {
    jump("error", "Task sudah memiliki submission. Employee tidak dapat dipindah, tetapi Support KPI, Support Tupoksi, dan atribut task lainnya masih dapat diedit.");
  }

  const { error } = await supabase.from("tasks").update({
    assigned_to: assignedTo,
    support_kpi_id: supportKpiId,
    support_tupoksi_id: supportTupoksiId,
    title,
    description,
    priority,
    complexity,
    due_at: parseDueDate(dueDate),
  }).eq("id", taskId);
  if (error) jump("error", "Perubahan task gagal disimpan.");

  refreshTaskPages();
  jump("ok", hasSubmission ? "Task berhasil diperbarui. Employee tetap mengikuti submission yang sudah ada; Support KPI dan Support Tupoksi dapat diperbarui." : "Task berhasil diperbarui.");
}

export async function deleteTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("error", "Akses Supervisor atau Admin diperlukan.");

  const taskId = String(formData.get("task_id") || "").trim();
  if (!taskId) jump("error", "Task tidak valid.");

  const { data: task } = await supabase.from("tasks").select("id,period_id,title").eq("id", taskId).maybeSingle();
  if (!task) jump("error", "Task tidak ditemukan.");
  await ensureOpenPeriod(supabase, task.period_id);

  const { data: claims } = await supabase.from("task_claims").select("id").eq("task_id", taskId);
  const claimIds = (claims ?? []).map((item: any) => item.id);
  let storagePaths: string[] = [];
  if (claimIds.length > 0) {
    const { data: evidenceRows } = await supabase.from("evidence_files").select("storage_path").in("claim_id", claimIds);
    storagePaths = (evidenceRows ?? []).map((item: any) => item.storage_path).filter(Boolean);
  }

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) jump("error", "Task gagal dihapus.");

  if (storagePaths.length > 0) {
    await supabase.storage.from("task-evidence").remove(storagePaths);
  }

  refreshTaskPages();
  jump("ok", "Task berhasil dihapus dari minggu berjalan.");
}
