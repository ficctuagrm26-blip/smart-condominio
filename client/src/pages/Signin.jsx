import { useState } from "react";
import api from "../api";
import { useNavigate, Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import styles from "./Signin.module.css";



export default function Signin() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/api/auth/token/", form);
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      navigate("/me");
    } catch {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="center">
      <div className={styles.wrap}>
        <Card title="Bienvenido" subtitle="Ingresa con tus credenciales">
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={onSubmit}>
            <Input
              label="Usuario"
              name="username"
              placeholder="tu.usuario"
              value={form.username}
              onChange={onChange}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={onChange}
              required
            />
            <div className={styles.actions}>
              <Button type="submit">Iniciar sesión</Button>
              <Link to="/signup">
                <Button type="button" variant="ghost">Crear cuenta</Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
