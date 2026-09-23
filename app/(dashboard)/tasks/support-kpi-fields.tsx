"use client";

import { useMemo, useState } from "react";

type Employee = { id: string; full_name: string };
type Kpi = { id: string; employee_id: string; kpi_code: string; kpi_description: string; achievement: number | null };
type Tupoksi = { id: string; employee_id: string; tupoksi_code: string; tupoksi_description: string };

export function TaskIdentityFields({
  employees,
  kpis,
  tupoksi,
  defaultEmployeeId,
  defaultKpiId,
  defaultTupoksiId,
  defaultTitle = "",
  defaultDescription = "",
  lockIdentity = false,
}: {
  employees: Employee[];
  kpis: Kpi[];
  tupoksi: Tupoksi[];
  defaultEmployeeId?: string;
  defaultKpiId?: string;
  defaultTupoksiId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  lockIdentity?: boolean;
}) {
  const firstEmployeeId = defaultEmployeeId || employees[0]?.id || "";
  const [employeeId, setEmployeeId] = useState(firstEmployeeId);
  const [kpiId, setKpiId] = useState(defaultKpiId || "");
  const [tupoksiId, setTupoksiId] = useState(defaultTupoksiId || "");
  const filteredKpis = useMemo(() => kpis.filter((item) => item.employee_id === employeeId), [employeeId, kpis]);
  const filteredTupoksi = useMemo(() => tupoksi.filter((item) => item.employee_id === employeeId), [employeeId, tupoksi]);
  const selectedEmployee = employees.find((item) => item.id === employeeId);

  return (
    <>
      <div className="form-row">
        <div className="field">
          <label>Judul task</label>
          <input name="title" required maxLength={160} defaultValue={defaultTitle} />
        </div>
        <div className="field">
          <label>Assign ke</label>
          {lockIdentity ? (
            <>
              <input value={selectedEmployee?.full_name || "-"} readOnly disabled />
              <input type="hidden" name="assigned_to" value={employeeId} />
            </>
          ) : (
            <select name="assigned_to" required value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setKpiId(""); setTupoksiId(""); }}>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
            </select>
          )}
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
        <small className="muted">{lockIdentity ? "Employee terkunci karena task sudah memiliki submission. Support KPI tetap dapat diubah sesuai KPI milik employee tersebut." : "Hanya KPI aktif milik pegawai yang dipilih yang dapat dipakai."}</small>
      </div>
      <div className="field">
        <label>Support Tupoksi</label>
        <select name="support_tupoksi_id" required value={tupoksiId} onChange={(event) => setTupoksiId(event.target.value)}>
          <option value="" disabled>Pilih Tupoksi yang didukung task ini</option>
          {filteredTupoksi.map((item) => (
            <option key={item.id} value={item.id}>{item.tupoksi_code} · {item.tupoksi_description}</option>
          ))}
        </select>
        <small className="muted">Hanya Tupoksi yang menjadi tanggung jawab pegawai terpilih yang ditampilkan.</small>
      </div>
    </>
  );
}
