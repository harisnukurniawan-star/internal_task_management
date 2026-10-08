"use client";

import { useRef, useState } from "react";
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES } from "@/lib/evidence";

const ACCEPTED_EVIDENCE = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

function fileKind(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return { icon: "🖼", label: ext.toUpperCase() };
  if (["xls", "xlsx"].includes(ext)) return { icon: "▦", label: ext.toUpperCase() };
  if (["doc", "docx"].includes(ext)) return { icon: "▤", label: ext.toUpperCase() };
  if (ext === "pdf") return { icon: "PDF", label: "PDF" };
  return { icon: "📄", label: ext.toUpperCase() || "FILE" };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EvidenceFileInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  function syncInputFiles(files: File[]) {
    const input = inputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.currentTarget.files ?? []);
    if (incomingFiles.length === 0) return;

    const oversized = incomingFiles.find((file) => file.size > MAX_EVIDENCE_BYTES);
    if (oversized) {
      setMessage(`File "${oversized.name}" melebihi batas 3 MB.`);
      syncInputFiles(selectedFiles);
      return;
    }

    const combinedFiles = [...selectedFiles, ...incomingFiles];
    if (combinedFiles.length > MAX_EVIDENCE_FILES) {
      setMessage(`Maksimal ${MAX_EVIDENCE_FILES} file. File yang sudah dipilih tetap dipertahankan.`);
      syncInputFiles(selectedFiles);
      return;
    }

    setSelectedFiles(combinedFiles);
    setMessage("");
    requestAnimationFrame(() => syncInputFiles(combinedFiles));
  }

  function removeFile(index: number) {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    setSelectedFiles(nextFiles);
    setMessage("");
    syncInputFiles(nextFiles);
  }

  return (
    <>
      <input
        ref={inputRef}
        name="evidence"
        type="file"
        accept={ACCEPTED_EVIDENCE}
        multiple
        required={selectedFiles.length === 0}
        onChange={handleChange}
      />

      {message ? <small style={{ color: "var(--red)" }}>{message}</small> : null}

      {selectedFiles.length > 0 ? (
        <div
          aria-label="File evidence sementara"
          style={{
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flexWrap: "nowrap",
          }}
        >
          <span className="muted" style={{ fontSize: 9, whiteSpace: "nowrap" }}>
            Sementara {selectedFiles.length}/{MAX_EVIDENCE_FILES}:
          </span>

          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              minWidth: 0,
              overflowX: "auto",
              padding: "2px 1px",
            }}
          >
            {selectedFiles.map((file, index) => {
              const kind = fileKind(file.name);
              return (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                  title={`${file.name} · ${formatFileSize(file.size)} · belum terupload`}
                  style={{
                    position: "relative",
                    width: 42,
                    height: 42,
                    flex: "0 0 42px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--blue-soft)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--navy2)",
                    fontWeight: 800,
                    fontSize: kind.icon === "PDF" ? 9 : 17,
                    cursor: "default",
                  }}
                >
                  <span aria-hidden>{kind.icon}</span>
                  <span
                    style={{
                      position: "absolute",
                      left: 3,
                      bottom: 2,
                      fontSize: 7,
                      lineHeight: 1,
                      color: "var(--muted)",
                      fontWeight: 700,
                    }}
                  >
                    {kind.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    aria-label={`Hapus ${file.name}`}
                    title={`Hapus ${file.name}`}
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      border: "1px solid #ffd2cc",
                      background: "#fff",
                      color: "var(--red)",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <span className="muted" style={{ fontSize: 8, whiteSpace: "nowrap" }}>
            upload saat Submit
          </span>
        </div>
      ) : (
        <small className="muted">
          Maks. 3 file · masing-masing maks. 3 MB · upload setelah Submit Realisasi.
        </small>
      )}
    </>
  );
}
