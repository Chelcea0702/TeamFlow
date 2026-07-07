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

  async function login(email, password, expectedIsManager) {
    const data = await api.post("/auth/login", { email, password });
    // The role checkbox on the login form is validated against the
    // account's actual role after authenticating, since the account's role
    // (is_admin) lives in the database, not in the login form. This catches
    // someone picking the wrong role for their account rather than silently
    // logging them in as the wrong type.
    if (typeof expectedIsManager === "boolean" && !!data.user.is_admin !== expectedIsManager) {
      api.clearToken();
      const wanted = expectedIsManager ? "Manager" : "User";
      throw new Error(`This account is not registered as a ${wanted}. Please select the correct role.`);
    }
    api.setToken(data.token);
    setUser(data.user);
  }

  async function register(name, email, password, isManager) {
    const data = await api.post("/auth/register", { name, email, password, isManager });
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

