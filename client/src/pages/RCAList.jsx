import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

const SEVERITIES = ["low", "medium", "high", "critical"];

export default function RCAList() {
  const { projectId } = useParams();
  const [rcas, setRcas] = useState([]);
  const [members, setMembers] = useState([]);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [reviewerIds, setReviewerIds] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    const data = await api.get(`/projects/${projectId}/rca`);
    setRcas(data.rcas);
  }

  useEffect(() => {
    load();
    api.get(`/projects/${projectId}/members`).then((d) => setMembers(d.members));
  }, [projectId]);

  function toggleReviewer(id) {
    setReviewerIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function createRca(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/projects/${projectId}/rca`, { title, severity, reviewerIds });
      setTitle("");
      setReviewerIds([]);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Root Cause Analyses</h2>
        <Link to={`/projects/${projectId}`} className="btn secondary">Back to board</Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Open a new RCA</h3>
        <form onSubmit={createRca}>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Reviewers (at least one required)</label>
            {members.map((m) => (
              <label key={m.id} style={{ display: "block", fontWeight: "normal" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", marginRight: 6 }}
                  checked={reviewerIds.includes(m.id)}
                  onChange={() => toggleReviewer(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit">Create RCA</button>
        </form>
      </div>

      {rcas.map((r) => (
        <div className="card" key={r.id}>
          <Link to={`/projects/${projectId}/rca/${r.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{r.title}</Link>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Severity: {r.severity} · Status: {r.status}
          </div>
        </div>
      ))}
      {rcas.length === 0 && <p>No RCAs yet.</p>}
    </div>
  );
}
