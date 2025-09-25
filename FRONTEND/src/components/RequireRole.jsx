import { Navigate, useLocation } from "react-router-dom";
import { getRole } from "../api/auth"; //Solo ingreso con rol

//muestra todos los roles
export default function RequireRole({ allow = [], children }) {
  const location = useLocation();
  const me = JSON.parse(localStorage.getItem("me") || "null");
  const role = getRole(me);

  if (!role || (allow.length && !allow.includes(role))) {
    return <Navigate to="/dashboard" replace state={{ from: location }} />;
  }
  return children;
}
