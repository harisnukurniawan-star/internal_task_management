"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Option = { value: string; label: string };
export function SemesterPicker({ selected, options }: { selected: string; options: Option[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="fb-semester-picker">
      <span>Periode feedback</span>
      <select
        aria-label="Pilih semester feedback"
        value={selected}
        disabled={pending}
        onChange={(event) => {
          const semester = event.target.value;
          startTransition(() => router.push("/weekly-feedback?tab=calibration&semester=" + encodeURIComponent(semester)));
        }}
      >
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
