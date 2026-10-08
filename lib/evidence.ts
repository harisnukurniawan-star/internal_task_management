export const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;

const EVIDENCE_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function getEvidenceContentType(file: { name: string; type: string }): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expectedType = EVIDENCE_MIME_TYPES[extension];
  if (!expectedType) return null;
  const declaredType = file.type.toLowerCase();
  // Some browsers do not identify Office files; preserve a canonical storage MIME type.
  if (!declaredType || declaredType === "application/octet-stream" || declaredType === expectedType) {
    return expectedType;
  }
  return null;
}
