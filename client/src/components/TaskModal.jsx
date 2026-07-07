import React, { useEffect, useState } from "react";
import { api } from "../api";

const STATUSES = ["backlog", "in_progress", "in_review", "done"];

export default function TaskModal({ projectId, taskId, members, onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [relations, setRelations] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [warning, setWarning] = useState(null);
  const [error, setError] = useState(null);
  const [otherTasks, setOtherTasks] = useState([]);
  const [relatedTaskId, setRelatedTaskId] = useState("");

  async function load() {
    const data = await api.get(`/projects/${projectId}/tasks/${taskId}`);
    setTask(data.task);
    setRelations(data.relations);
    const c = await api.get(`/comments/task/${taskId}`);
    setComments(c.comments);
    const a = await api.get(`/attachments/task/${taskId}`);
    setAttachments(a.attachments);
    const all = await api.get(`/projects/${projectId}/tasks`);
    setOtherTasks(all.tasks.filter((t) => t.id !== taskId));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function updateField(fields) {
    setError(null);
    try {
      const data = await api.patch(`/projects/${projectId}/tasks/${taskId}`, fields);
      setTask(data.task);
      setWarning(data.dependencyWarning);
      onChanged && onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await api.post(`/comments/task/${taskId}`, { body: newComment });
    setNewComment("");
    load();
  }

  async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await api.postForm(`/attachments/task/${taskId}`, form);
    load();
  }

  async function addRelation(type) {
    if (!relatedTaskId) return;
    await api.post(`/projects/${projectId}/tasks/${taskId}/relations`, { relatedTaskId, type });
    load();
  }

  if (!task) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <input
            style={{ fontSize: "1.1rem", fontWeight: 600, border: "none", background: "transparent", padding: 0 }}
            defaultValue={task.title}
            onBlur={(e) => e.target.value !== task.title && updateField({ title: e.target.value })}
          />
          <button className="linklike" onClick={onClose}>✕</button>
        </div>

        {warning && (
          <div className="warning-box">
            {warning.message}
            <ul>
              {warning.blockers.map((b) => (
                <li key={b.id}>{b.title} ({b.status})</li>
              ))}
            </ul>
          </div>
        )}
        {error && <div className="error-text">{error}</div>}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Status</label>
            <select value={task.status} onChange={(e) => updateField({ status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Priority</label>
            <select value={task.priority} onChange={(e) => updateField({ priority: e.target.value })}>
              {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Assignee</label>
            <select value={task.assignee_id || ""} onChange={(e) => updateField({ assigneeId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Due date</label>
            <input type="date" value={task.due_date ? task.due_date.slice(0, 10) : ""} onChange={(e) => updateField({ dueDate: e.target.value || null })} />
          </div>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            rows={3}
            defaultValue={task.description || ""}
            onBlur={(e) => e.target.value !== task.description && updateField({ description: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Dependencies</label>
          {relations.length === 0 && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>None yet.</p>}
          <ul>
            {relations.map((r) => (
              <li key={r.id} style={{ fontSize: "0.85rem" }}>
                {r.type === "blocked_by" ? "Blocked by" : "Blocks"}: {r.related_title} ({r.related_status})
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 6 }}>
            <select value={relatedTaskId} onChange={(e) => setRelatedTaskId(e.target.value)}>
              <option value="">Select a task...</option>
              {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button className="btn secondary" type="button" onClick={() => addRelation("blocked_by")}>Blocked by</button>
            <button className="btn secondary" type="button" onClick={() => addRelation("blocks")}>Blocks</button>
          </div>
        </div>

        <div className="field">
          <label>Attachments</label>
          {attachments.map((a) => (
            <div key={a.id} style={{ fontSize: "0.85rem" }}>
              <a href={`${api.baseUrl}/attachments/download/${a.id}`}>{a.file_name}</a>
              {" "}<span style={{ color: "var(--text-muted)" }}>({Math.round(a.size_bytes / 1024)} KB, {a.uploaded_by_name})</span>
            </div>
          ))}
          <input type="file" onChange={uploadFile} style={{ marginTop: 6 }} />
        </div>

        <div className="field">
          <label>Comments</label>
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <div className="author">{c.author_name} <span className="time">{new Date(c.created_at).toLocaleString()}</span></div>
              <div>{c.body}</div>
            </div>
          ))}
          <form onSubmit={addComment} style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              placeholder="Add a comment... use @email to mention someone"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button className="btn" type="submit">Post</button>
          </form>
        </div>
      </div>
    </div>
  );
}

