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
  priority: string,
  complexity: string,
) {
  if (!ALLOWED_PRIORITIES.has(priority)) jump("error", "Priority tidak valid.");
  if (!ALLOWED_COMPLEXITIES.has(complexity)) jump("error", "Kompleksitas tidak valid.");
  if (!supportKpiId) jump("error", "Support KPI wajib dipilih.");

  const [employeeResult, kpiResult] = await Promise.all([
    supabase.from("employees").select("id").eq("id", assignedTo).eq("active", true).maybeSingle(),
    supabase.from("employee_kpis").select("id,employee_id").eq("id", supportKpiId).eq("employee_id", assignedTo).eq("active", true).maybeSingle(),
  ]);
  if (!employeeResult.data) jump("error", "Pegawai tidak aktif atau tidak ditemukan.");
  if (!kpiResult.data) jump("error", "Support KPI tidak sesuai dengan pegawai yang dipilih.");
}

function parseDueDate(dueDate: string) {
  if (!dueDate) return null;
  const parsed = new Date(`${dueDate}T23:59:59+07:00`);
  if (Number.isNaN(parsed.getTime())) jump("error", "Tanggal jatuh tempo tidak valid.");
  return parsed.toISOString();
}

export async function createTaskWithKpi(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("error", "Akses Supervisor atau Admin diperlukan.");

  const periodId = String(formData.get("period_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const supportKpiId = String(formData.get("support_kpi_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const complexity = String(formData.get("complexity") || "administrasi").trim();
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!periodId || !assignedTo || title.length < 3) jump("error", "Periode, pegawai, dan judul task wajib diisi.");
  await validateTaskInputs(supabase, assignedTo, supportKpiId, priority, complexity);

  const { data: period } = await supabase.from("weekly_periods").select("id,status").eq("id", periodId).maybeSingle();
  if (!period || period.status === "closed") jump("error", "Periode tidak aktif atau sudah ditutup.");

  const { error } = await supabase.from("tasks").insert({
    period_id: periodId,
    assigned_to: assignedTo,
    assigned_by: profile.id,
    support_kpi_id: supportKpiId,
    title,
    description,
    priority,
    complexity,
    due_at: parseDueDate(dueDate),
  });
  if (error) jump("error", "Task gagal disimpan.");

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  jump("ok", "Task berhasil di-assign.");
}

export async function updateTask(formData: FormData) {
  const { supabase, profile } = await requireProfile();
  if (!["admin", "supervisor"].includes(profile.role)) jump("error", "Akses Supervisor atau Admin diperlukan.");

  const taskId = String(formData.get("task_id") || "").trim();
  const assignedTo = String(formData.get("assigned_to") || "").trim();
  const supportKpiId = String(formData.get("support_kpi_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priority = String(formData.get("priority") || "medium").trim();
  const complexity = String(formData.get("complexity") || "administrasi").trim();
  const dueDate = String(formData.get("due_date") || "").trim();

  if (!taskId || !assignedTo || title.length < 3) jump("error", "Pegawai dan judul task wajib diisi.");
  await validateTaskInputs(supabase, assignedTo, supportKpiId, priority, complexity);

  const [taskResult, claimResult] = await Promise.all([
    supabase.from("tasks").select("id,status").eq("id", taskId).maybeSingle(),
    supabase.from("task_claims").select("id").eq("task_id", taskId).limit(1),
  ]);
  if (!taskResult.data) jump("error", "Task tidak ditemukan.");
  if ((claimResult.data?.length ?? 0) > 0) jump("error", "Task sudah memiliki submission/evidence sehingga tidak dapat diedit.");
  if (!["assigned", "in_progress"].includes(taskResult.data.status)) jump("error", "Task dengan status ini sudah tidak dapat diedit.");

  const { error } = await supabase.from("tasks").update({
    assigned_to: assignedTo,
    support_kpi_id: supportKpiId,
    title,
    description,
    priority,
    complexity,
    due_at: parseDueDate(dueDate),
  }).eq("id", taskId);
  if (error) jump("error", "Perubahan task gagal disimpan.");

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/my-week");
  revalidatePath("/leaderboard");
  jump("ok", "Task berhasil diperbarui.");
}
