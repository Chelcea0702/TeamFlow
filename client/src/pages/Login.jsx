import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
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
        {error && <div className="error-text">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      </form>
      <p style={{ marginTop: 12, fontSize: "0.85rem" }}>
        No account? <Link to="/register">Register</Link>
      </p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        Demo users (after seeding): alice@teamflow.dev / bob@teamflow.dev / cara@teamflow.dev, password: password123
      </p>
    </div>
  );
}
