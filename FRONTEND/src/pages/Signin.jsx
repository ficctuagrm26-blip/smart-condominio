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
      // 1. Login → obtener tokens
      const { data } = await api.post("/api/auth/token/", form);
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);

      // 2. Obtener perfil del usuario (incluye role)
      const meRes = await api.get("/api/me/");
      localStorage.setItem("me", JSON.stringify(meRes.data));

      // 3. Redirigir al dashboard
      navigate("/dashboard");
      } catch {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="center">
      <div className={styles.wrap}>
        <Card title="Inicia Sesión" subtitle="Bienvenido a Smart Condominiun">
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={onSubmit}>
            <Input
              label="Usuario"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={onChange}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={onChange}
              required
            />
            <div className={styles.actions}>
              <Button type="submit">Iniciar sesión</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
