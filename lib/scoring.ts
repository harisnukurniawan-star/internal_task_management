export const COMPLEXITY_OPTIONS = [
  { value: "administrasi", label: "Administrasi", score: 20 },
  { value: "koordinasi_internal_tim", label: "Koordinasi Internal Tim", score: 40 },
  { value: "koordinasi_tim_lain", label: "Koordinasi dengan Tim Lain", score: 60 },
  { value: "koordinasi_bpo", label: "Koordinasi BPO", score: 80 },
  { value: "koordinasi_kantor_pusat", label: "Koordinasi dengan Kantor Pusat", score: 100 },
] as const;

export const QUALITY_OPTIONS = [
  { value: "sesuai_arahan", label: "Sesuai arahan", score: 100 },
  { value: "koreksi_minor", label: "Koreksi Minor", score: 80 },
  { value: "koreksi_mayor", label: "Koreksi Mayor", score: 60 },
] as const;

export function complexityLabel(value: string | null | undefined) {
  return COMPLEXITY_OPTIONS.find((item) => item.value === value)?.label ?? "-";
}

export function qualityLabel(value: string | null | undefined) {
  return QUALITY_OPTIONS.find((item) => item.value === value)?.label ?? "Belum dinilai";
}

export const TIMELINESS_RULE = "Deadline = 100; setiap 24 jam lebih cepat +5 poin hingga maks. 110; terlambat -5 poin per 24 jam hingga min. 0.";
