"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteTask } from "./actions";

export function TaskActionMenu({
  taskId,
  taskTitle,
  currentPage,
  hasSubmission,
}: {
  taskId: string;
  taskTitle: string;
  currentPage: number;
  hasSubmission: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block", zIndex: open ? 60 : 1 }}>
      <button
        type="button"
        aria-label={`Action ${taskTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Action"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          border: 0,
          borderRadius: 8,
          background: "transparent",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1,
          color: "#475467",
          userSelect: "none",
        }}
      >
        ⋮
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: 34,
            zIndex: 70,
            minWidth: 178,
            padding: 6,
            border: "1px solid #dbe4ef",
            borderRadius: 9,
            background: "white",
            boxShadow: "0 10px 28px #0b1f3a1a",
            textAlign: "left",
          }}
        >
          <Link
            prefetch
            href={`/tasks?tab=list&page=${currentPage}&edit=${taskId}#edit-task`}
            onClick={() => setOpen(false)}
            role="menuitem"
            style={{ display: "block", padding: "8px 10px", borderRadius: 7, fontWeight: 700, fontSize: 12 }}
          >
            Edit task
          </Link>

          {hasSubmission ? (
            <span className="muted small" style={{ display: "block", padding: "2px 10px 6px" }}>
              Submission ada · employee terkunci
            </span>
          ) : null}

          <form action={deleteTask}>
            <input type="hidden" name="task_id" value={taskId} />
            <button
              type="submit"
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{
                width: "100%",
                border: 0,
                background: "transparent",
                color: "#b42318",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 7,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Hapus task
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
