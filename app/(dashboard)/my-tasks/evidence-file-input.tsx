"use client";

import { useRef, useState } from "react";
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES } from "@/lib/evidence";

const ACCEPTED_EVIDENCE = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

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

  const hasError = Boolean(message);

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

      {hasError ? <small style={{ color: "var(--red)" }}>{message}</small> : null}

      {selectedFiles.length > 0 ? (
        <div
          style={{
            marginTop: 4,
            border: "1px solid var(--line)",
            borderRadius: 8,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            style={{
              padding: "6px 8px",
              background: "var(--blue-soft)",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 10, color: "var(--navy2)" }}>
              File sementara ({selectedFiles.length}/{MAX_EVIDENCE_FILES})
            </strong>
            <span className="muted" style={{ fontSize: 9 }}>Belum terupload</span>
          </div>

          <div style={{ display: "grid" }}>
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px minmax(0,1fr) auto auto",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 8px",
                  borderBottom: index < selectedFiles.length - 1 ? "1px solid var(--line)" : "0",
                }}
              >
                <span className="badge" style={{ width: 20, height: 20, padding: 0, justifyContent: "center", fontSize: 9 }}>
                  {index + 1}
                </span>
                <span
                  title={file.name}
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 10,
                    color: "var(--text)",
                  }}
                >
                  {file.name}
                </span>
                <span className="muted" style={{ fontSize: 9, whiteSpace: "nowrap" }}>{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Hapus ${file.name}`}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--red)",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 4px",
                  }}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>

          <div
            className="muted"
            style={{
              padding: "5px 8px",
              fontSize: 9,
              lineHeight: 1.25,
              background: "#fafbfc",
              borderTop: "1px solid var(--line)",
            }}
          >
            Pilihan baru akan <strong>ditambahkan</strong>, bukan mengganti file sebelumnya. File baru tersimpan / terupload setelah <strong>Submit Realisasi</strong>.
          </div>
        </div>
      ) : (
        <small className="muted">
          Wajib diisi · maks. 3 file · masing-masing maks. 3 MB · PDF/JPG/PNG/WebP/Word/Excel.
        </small>
      )}
    </>
  );
}
