// src/components/security/KPI.jsx
export default function KPI({ label, value }) {
  return (
    <div className="kpi">
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
    </div>
  );
}
