import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // "User" and "Manager" are mutually exclusive, so checking one clears the other.
  // Manager maps to the account's admin flag; User is a regular account.
  // Project-level roles (owner/contributor/viewer) are assigned separately
  // per project once the account exists.
  function selectRole(manager) {
    setIsManager(manager);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(name, email, password, isManager);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container form-narrow card">
      <button type="button" className="linklike" onClick={() => navigate(-1)} title="Go back" style={{ marginBottom: 10 }}>
        ← Back
      </button>

      <h2>Create your TeamFlow account</h2>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>

        <div className="field">
          <label>Register as</label>
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
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
            Managers have admin access across all projects. Users are regular accounts and
            are assigned a role (owner/contributor/viewer) per project.
          </p>
        </div>

        {error && <div className="error-text">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Creating..." : "Create account"}</button>
      </form>
      <p style={{ marginTop: 12, fontSize: "0.85rem" }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

