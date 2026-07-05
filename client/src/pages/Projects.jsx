import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.get("/projects");
    setProjects(data.projects);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/projects", { name, description });
      setName("");
      setDescription("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container">
      <h2>Your Projects</h2>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Create a project</h3>
        <form onSubmit={createProject}>
          <div className="field">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit">Create</button>
        </form>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : projects.length === 0 ? (
        <p>No projects yet. Create one above.</p>
      ) : (
        projects.map((p) => (
          <div className="card" key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Link to={`/projects/${p.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{p.name}</Link>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{p.description}</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Link to={`/projects/${p.id}/rca`} className="btn secondary">RCAs</Link>
                <Link to={`/projects/${p.id}/dashboard`} className="btn secondary">Dashboard</Link>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
