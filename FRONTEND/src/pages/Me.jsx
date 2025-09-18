import { useEffect, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import styles from "./Me.module.css";

export default function Me() {
  const [me, setMe] = useState(null);
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/signin");
  };

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return navigate("/signin");
    api.get("/api/me/")
      .then(res => setMe(res.data))
      .catch(() => navigate("/signin"));
  }, [navigate]);

  return (
    <div className="container">
      <div className={styles.header}>
        <h1>Mi perfil</h1>
        <Button onClick={logout} variant="ghost">Cerrar sesión</Button>
      </div>

      <div className={styles.grid}>
        <Card title="Información">
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(me, null, 2)}</pre>
        </Card>
      </div>
    </div>
  );
}
