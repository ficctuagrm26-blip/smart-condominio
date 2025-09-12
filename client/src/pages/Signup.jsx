import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import styles from "./Signup.module.css";

export default function Signup() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      return setError("Las contraseñas no coinciden");
    }

    try {
      await api.post("/api/auth/register/", {
        username: form.username,
        email: form.email || undefined,  // opcional
        password: form.password,
      });
      // registrado OK → ir a login
      navigate("/signin");
    } catch (err) {
      // intenta mostrar error del backend si viene
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : "No se pudo registrar";
      setError(msg);
    }
  };

  return (
    <div className="center">
      <div className={styles.wrap}>
        <Card title="Crear cuenta" subtitle="Regístrate para continuar">
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={onSubmit}>
            <Input label="Usuario" name="username" placeholder="tu.usuario" value={form.username} onChange={onChange} required />
            <Input label="Email (opcional)" name="email" type="email" placeholder="tucorreo@dominio.com" value={form.email} onChange={onChange} />
            <Input label="Contraseña" name="password" type="password" placeholder="••••••••" value={form.password} onChange={onChange} required />
            <Input label="Confirmar contraseña" name="confirm" type="password" placeholder="••••••••" value={form.confirm} onChange={onChange} required />
            <div className={styles.actions}>
              <Button type="submit">Crear cuenta</Button>
              <Link to="/signin"><Button type="button" variant="ghost">Ya tengo cuenta</Button></Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
