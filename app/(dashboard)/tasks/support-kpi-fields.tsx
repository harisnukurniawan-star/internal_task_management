"use client";

import { useMemo, useState } from "react";

type Employee = { id: string; full_name: string };
type Kpi = { id: string; employee_id: string; kpi_code: string; kpi_description: string; achievement: number | null };

export function TaskIdentityFields({
  employees,
  kpis,
  defaultEmployeeId,
  defaultKpiId,
  defaultTitle = "",
  defaultDescription = "",
}: {
  employees: Employee[];
  kpis: Kpi[];
  defaultEmployeeId?: string;
  defaultKpiId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
}) {
  const firstEmployeeId = defaultEmployeeId || employees[0]?.id || "";
  const [employeeId, setEmployeeId] = useState(firstEmployeeId);
  const [kpiId, setKpiId] = useState(defaultKpiId || "");
  const filteredKpis = useMemo(() => kpis.filter((item) => item.employee_id === employeeId), [employeeId, kpis]);

  return (
    <>
      <div className="form-row">
        <div className="field">
          <label>Judul task</label>
          <input name="title" required maxLength={160} defaultValue={defaultTitle} />
        </div>
        <div className="field">
          <label>Assign ke</label>
          <select name="assigned_to" required value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setKpiId(""); }}>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Deskripsi</label>
        <textarea name="description" maxLength={1200} defaultValue={defaultDescription} />
      </div>
      <div className="field">
        <label>Support KPI</label>
        <select name="support_kpi_id" required value={kpiId} onChange={(event) => setKpiId(event.target.value)}>
          <option value="" disabled>Pilih KPI yang didukung task ini</option>
          {filteredKpis.map((item) => (
            <option key={item.id} value={item.id}>{item.kpi_code} · {item.kpi_description}{item.achievement != null ? ` · ${item.achievement}%` : ""}</option>
          ))}
        </select>
        <small className="muted">Hanya KPI aktif milik pegawai yang dipilih yang dapat dipakai.</small>
      </div>
    </>
  );
}
