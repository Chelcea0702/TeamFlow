import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";

const STATUSES = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "in_review", label: "In Review" },
  { key: "done", label: "Done" },
];

export default function ProjectBoard() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isManager = !!user?.is_admin;
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("kanban");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [openTaskId, setOpenTaskId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("contributor");
  const [inviteError, setInviteError] = useState(null);

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterAssignee) params.set("assignee", filterAssignee);
    if (search) params.set("q", search);
    const data = await api.get(`/projects/${projectId}/tasks?${params.toString()}`);
    setTasks(data.tasks);
  }, [projectId, filterStatus, filterAssignee, search]);

  const loadMembers = useCallback(() => {
    api.get(`/projects/${projectId}/members`).then((d) => setMembers(d.members));
  }, [projectId]);

  useEffect(() => {
    api.get(`/projects/${projectId}`).then((d) => {
      setProject(d.project);
      // View preference comes back on the project list endpoint; fall back to kanban.
    });
    loadMembers();
  }, [projectId, loadMembers]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function setViewAndPersist(v) {
    setView(v);
    try {
      await api.patch(`/projects/${projectId}/view-preference`, { viewPref: v });
    } catch {
      // Non-critical if this fails; the local view still switches.
    }
  }

  async function createTask(e) {
    e.preventDefault();
    if (!isManager || !newTitle.trim()) return;
    await api.post(`/projects/${projectId}/tasks`, { title: newTitle });
    setNewTitle("");
    loadTasks();
  }

  async function inviteMember(e) {
    e.preventDefault();
    setInviteError(null);
    if (!inviteEmail.trim()) return;
    try {
      await api.post(`/projects/${projectId}/members`, { email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      loadMembers();
    } catch (err) {
      setInviteError(err.message);
    }
  }

  async function onDrop(e, status) {
    const taskId = e.dataTransfer.getData("text/task-id");
    if (!taskId) return;
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, { status });
      loadTasks();
    } catch (err) {
      alert(err.message);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterAssignee) params.set("assignee", filterAssignee);
    if (search) params.set("q", search);
    const token = localStorage.getItem("teamflow_token");
    fetch(`${api.baseUrl}/projects/${projectId}/export/tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "tasks-export.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s.key] = tasks.filter((t) => t.status === s.key);
    return acc;
  }, {});

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{project?.name || "Project"}</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to={`/projects/${projectId}/rca`} className="btn secondary">RCAs</Link>
          <Link to={`/projects/${projectId}/dashboard`} className="btn secondary">Dashboard</Link>
        </div>
      </div>

      <div className="view-switch">
        {["kanban", "calendar", "list"].map((v) => (
          <button key={v} className={view === v ? "active" : ""} onClick={() => setViewAndPersist(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          {isManager && (
            <form onSubmit={createTask} style={{ display: "flex", gap: 6, flex: 2, minWidth: 220 }}>
              <input placeholder="New task title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <button className="btn" type="submit">Add</button>
            </form>
          )}
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">All assignees</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 160 }} />
          <button className="btn secondary" onClick={exportCsv} type="button">Export CSV</button>
        </div>
      </div>

      {isManager && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Add a member</h3>
          <form onSubmit={inviteMember} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input
              placeholder="user@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ minWidth: 200 }}
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ maxWidth: 160 }}>
              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
              <option value="owner">Owner (manager)</option>
            </select>
            <button className="btn" type="submit">Add to project</button>
          </form>
          {inviteError && <div className="error-text">{inviteError}</div>}
        </div>
      )}

      {view === "kanban" && (
        <div className="kanban">
          {STATUSES.map((s) => (
            <div key={s.key} className="kanban-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, s.key)}>
              <h3>{s.label} ({grouped[s.key].length})</h3>
              {grouped[s.key].map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onClick={(task) => setOpenTaskId(task.id)}
                  onDragStart={(e, task) => e.dataTransfer.setData("text/task-id", task.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {view === "list" && (
        <table>
          <thead>
            <tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} onClick={() => setOpenTaskId(t.id)} style={{ cursor: "pointer" }}>
                <td>{t.title}</td>
                <td>{t.status}</td>
                <td><span className={`badge priority-${t.priority}`}>{t.priority}</span></td>
                <td>{members.find((m) => m.id === t.assignee_id)?.name || "—"}</td>
                <td>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {view === "calendar" && <CalendarView tasks={tasks} onOpen={setOpenTaskId} />}

      {openTaskId && (
        <TaskModal
          projectId={projectId}
          taskId={openTaskId}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onChanged={loadTasks}
        />
      )}
    </div>
  );
}

function CalendarView({ tasks, onOpen }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function tasksForDay(day) {
    if (!day) return [];
    const dateStr = new Date(year, month, day).toISOString().slice(0, 10);
    return tasks.filter((t) => t.due_date && t.due_date.slice(0, 10) === dateStr);
  }

  return (
    <div>
      <h3>{firstDay.toLocaleString("default", { month: "long", year: "numeric" })}</h3>
      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>{d}</div>
        ))}
        {cells.map((day, i) => (
          <div className="calendar-cell" key={i}>
            {day && <div className="day-num">{day}</div>}
            {tasksForDay(day).map((t) => (
              <div key={t.id} className="calendar-task" onClick={() => onOpen(t.id)}>{t.title}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
