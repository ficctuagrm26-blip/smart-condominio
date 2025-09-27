import { useEffect, useState } from "react";
import "../styles/staff.css"; // asegura estilos compartidos (.inp, .btn, etc.)

export default function StaffForm({
  initial = null,
  roles = [],
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role_code: "STAFF",
    staff_kind: "",
    is_active: true,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        username: initial.username || "",
        email: initial.email || "",
        first_name: initial.first_name || "",
        last_name: initial.last_name || "",
        password: "", // nunca precargar
        role_code: initial.role || "STAFF",
        staff_kind: initial.staff_kind || "",
        is_active: initial.is_active ?? true,
      });
    }
  }, [initial]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="sf-form" noValidate>
      {/* Encabezado opcional (accesible) */}
      <h4 className="sr-only">{initial ? "Editar personal" : "Crear personal"}</h4>

      <div className="sf-grid">
        <div className="sf-field">
          <label className="lbl" htmlFor="sf-username">Usuario</label>
          <input
            id="sf-username"
            className="inp"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            required
            autoComplete="username"
            placeholder="jdoe"
            disabled={!!initial} /* normalmente no se cambia */
          />
          {!!initial && <p className="hint">El usuario no se puede editar.</p>}
        </div>

        <div className="sf-field">
          <label className="lbl" htmlFor="sf-email">Email</label>
          <input
            id="sf-email"
            className="inp"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            autoComplete="email"
            placeholder="correo@dominio.com"
          />
        </div>

        <div className="sf-field">
          <label className="lbl" htmlFor="sf-first">Nombre</label>
          <input
            id="sf-first"
            className="inp"
            value={form.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            placeholder="Juan"
            autoComplete="given-name"
          />
        </div>

        <div className="sf-field">
          <label className="lbl" htmlFor="sf-last">Apellido</label>
          <input
            id="sf-last"
            className="inp"
            value={form.last_name}
            onChange={(e) => update("last_name", e.target.value)}
            placeholder="Pérez"
            autoComplete="family-name"
          />
        </div>

        {/* Password: requerido al crear, opcional al editar */}
        {!initial ? (
          <div className="sf-field">
            <label className="lbl" htmlFor="sf-pass">Contraseña</label>
            <input
              id="sf-pass"
              className="inp"
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
        ) : (
          <div className="sf-field">
            <label className="lbl" htmlFor="sf-pass-new">Nueva contraseña (opcional)</label>
            <input
              id="sf-pass-new"
              className="inp"
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
              placeholder="Dejar vacío para no cambiar"
            />
            <p className="hint">Si la dejas vacía, no se modifica.</p>
          </div>
        )}

        <div className="sf-field">
          <label className="lbl" htmlFor="sf-role">Sub-rol (base STAFF)</label>
          <select
            id="sf-role"
            className="inp"
            value={form.role_code}
            onChange={(e) => update("role_code", e.target.value)}
          >
            {(roles?.length ? roles : [{ id: 0, code: "STAFF", name: "Personal (básico)" }]).map((r) => (
              <option key={r.id ?? r.code} value={r.code}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </div>

        <div className="sf-field">
          <label className="lbl" htmlFor="sf-kind">Especialidad / staff_kind</label>
          <input
            id="sf-kind"
            className="inp"
            value={form.staff_kind}
            onChange={(e) => update("staff_kind", e.target.value)}
            placeholder="Ej. Limpieza nocturna"
          />
        </div>

        <div className="sf-field sf-field--inline">
          <label className="lbl" htmlFor="sf-active">Activo</label>
          <label className="switch">
            <input
              id="sf-active"
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => update("is_active", e.target.checked)}
            />
            <span className="slider" aria-hidden="true"></span>
          </label>
        </div>
      </div>

      <div className="sf-actions">
        <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Guardando..." : (initial ? "Guardar cambios" : "Crear personal")}
        </button>
      </div>
    </form>
  );
}
