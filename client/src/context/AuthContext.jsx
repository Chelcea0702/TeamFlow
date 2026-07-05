import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("teamflow_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => api.clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    api.setToken(data.token);
    setUser(data.user);
  }

  async function register(name, email, password) {
    const data = await api.post("/auth/register", { name, email, password });
    api.setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    api.clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
