import { useEffect, useState } from "react";
// OJO: asegura que la ruta apunte a tu archivo real.
// Si tu archivo es src/services/auth.js usa "../services/auth"
import { me as getMe, updateMe, changePassword } from "../api/auth";

const EDITABLE_BY_ROLE = {
  ADMIN: ["first_name", "last_name", "email", "username"],
  STAFF: ["first_name", "last_name", "email"],
  RESIDENT: ["first_name", "last_name", "email"],
};

const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

export default function Me() {
  const cached = JSON.parse(localStorage.getItem("me") || "null");

  // ⬇️ renombrado para evitar confusiones
  const [profile, setProfile] = useState(cached);
  const role = profile?.role || "RESIDENT";

  const [form, setForm] = useState({
    username: profile?.username || "",
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email: profile?.email || "",
  });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // ⬇️ usa el alias importado
        const fresh = await getMe();
        setProfile(fresh);
        setForm({
          username: fresh.username || "",
          first_name: fresh.first_name || "",
          last_name: fresh.last_name || "",
          email: fresh.email || "",
        });
        localStorage.setItem("me", JSON.stringify(fresh));
      } catch (e) {
        setMsg(e.message || "No se pudo cargar el perfil");
      }
    })();
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const allowed = EDITABLE_BY_ROLE[role] || [];
      const payload = pick(form, allowed);
      const updated = await updateMe(payload);
      setProfile(updated);
      localStorage.setItem("me", JSON.stringify(updated));
      setMsg("Datos actualizados ✅");
    } catch (e) {
      setMsg(e.message || "No se pudo actualizar");
    } finally {
      setLoading(false);
    }
  }

  async function onChangePwd(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      await changePassword(pwd);
      setPwd({ current_password: "", new_password: "" });
      setMsg("Contraseña actualizada ✅");
    } catch (e) {
      setMsg(e.message || "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3>Mi Perfil {role ? `(${role})` : ""}</h3>
      {msg && <p className="info">{msg}</p>}

      <form className="au-form" onSubmit={onSave} style={{ marginBottom: 24 }}>
        <div className="au-form__grid">
          {EDITABLE_BY_ROLE[role]?.includes("username") && (
            <>
              <label>Usuario</label>
              <input
                className="au-input"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </>
          )}

          <label>Nombres</label>
          <input
            className="au-input"
            value={form.first_name}
            onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
            disabled={!EDITABLE_BY_ROLE[role]?.includes("first_name")}
          />

          <label>Apellidos</label>
          <input
            className="au-input"
            value={form.last_name}
            onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
            disabled={!EDITABLE_BY_ROLE[role]?.includes("last_name")}
          />

          <label>Email</label>
          <input
            className="au-input"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            disabled={!EDITABLE_BY_ROLE[role]?.includes("email")}
          />
        </div>

        <button className="au-button" type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <form className="au-form" onSubmit={onChangePwd}>
        <h4>Cambiar contraseña</h4>
        <label>Contraseña actual</label>
        <input
          className="au-input"
          type="password"
          value={pwd.current_password}
          onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))}
          required
        />
        <label>Nueva contraseña</label>
        <input
          className="au-input"
          type="password"
          value={pwd.new_password}
          onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))}
          required
        />
        <button className="au-button" type="submit" disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </button>
      </form>
    </div>
  );
}
