import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // "User" and "Manager" are mutually exclusive, so checking one clears the other.
  function selectRole(manager) {
    setIsManager(manager);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password, isManager);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container form-narrow card">
      <h2>Log in to TeamFlow</h2>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <div className="field">
          <label>Log in as</label>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: "normal" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={!isManager} onChange={() => selectRole(false)} />
              User
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: "normal" }}>
              <input type="checkbox" style={{ width: "auto" }} checked={isManager} onChange={() => selectRole(true)} />
              Manager
            </label>
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      </form>
      <p style={{ marginTop: 12, fontSize: "0.85rem" }}>
        No account? <Link to="/register">Register</Link>
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        Demo users (after seeding): alice@teamflow.dev (Manager) / bob@teamflow.dev (User) /
        cara@teamflow.dev (User), password: password123
      </p>
    </div>
  );
}

