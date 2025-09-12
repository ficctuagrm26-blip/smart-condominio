import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const token = localStorage.getItem("access");
  console.log("Token en RequireAuth:", token); // debug
  return token ? children : <Navigate to="/signin" />;
}

