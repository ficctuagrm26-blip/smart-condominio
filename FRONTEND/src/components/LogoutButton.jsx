// src/components/LogoutButton.jsx
import { useNavigate } from "react-router-dom";

export default function LogoutButton({ className }) {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    navigate("/signin");
  };

  return (
    <button onClick={logout} className={className}>
      Cerrar sesión
    </button>
  );
}
