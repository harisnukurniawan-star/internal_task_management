"use client";

import { useState } from "react";
import { MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES } from "@/lib/evidence";

const ACCEPTED_EVIDENCE = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx";

export function EvidenceFileInput() {
  const [message, setMessage] = useState("");

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    let nextMessage = "";

    if (files.length > MAX_EVIDENCE_FILES) {
      nextMessage = `Maksimal ${MAX_EVIDENCE_FILES} file dalam satu submission.`;
    } else {
      const oversized = files.find((file) => file.size > MAX_EVIDENCE_BYTES);
      if (oversized) {
        nextMessage = `File "${oversized.name}" melebihi batas 3 MB.`;
      }
    }

    if (nextMessage) {
      event.currentTarget.value = "";
      setMessage(nextMessage);
      return;
    }

    setMessage(files.length > 0 ? `${files.length} file dipilih.` : "");
  }

  return (
    <>
      <input
        name="evidence"
        type="file"
        accept={ACCEPTED_EVIDENCE}
        multiple
        required
        onChange={handleChange}
      />
      <small className={message.startsWith("Maksimal") || message.includes("melebihi") ? "" : "muted"} style={message.startsWith("Maksimal") || message.includes("melebihi") ? { color: "var(--red)" } : undefined}>
        {message || "Wajib diisi · maks. 3 file · masing-masing maks. 3 MB · PDF/JPG/PNG/WebP/Word/Excel."}
      </small>
    </>
  );
}
