import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const SECTION_LABELS = {
  timeline: "Timeline",
  contributing_factors: "Contributing Factors",
  corrective_actions: "Corrective Actions",
  preventive_measures: "Preventive Measures",
};

export default function RCADetail() {
  const { projectId, rcaId } = useParams();
  const { user } = useAuth();
  const [rca, setRca] = useState(null);
  const [sections, setSections] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [members, setMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [error, setError] = useState(null);
  const [substituteFor, setSubstituteFor] = useState(null);
  const [substituteWith, setSubstituteWith] = useState("");
  const [withdrawComment, setWithdrawComment] = useState("");

  async function load() {
    const data = await api.get(`/projects/${projectId}/rca/${rcaId}`);
    setRca(data.rca);
    setSections(data.sections);
    setReviewers(data.reviewers);
    setReviews(data.reviews);
    const c = await api.get(`/comments/rca/${rcaId}`);
    setComments(c.comments);
  }

  useEffect(() => {
    load();
    api.get(`/projects/${projectId}/members`).then((d) => setMembers(d.members));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rcaId]);

  async function saveSection(type, content) {
    await api.patch(`/projects/${projectId}/rca/${rcaId}/sections/${type}`, { content });
    load();
  }

  async function submit() {
    setError(null);
    try {
      await api.post(`/projects/${projectId}/rca/${rcaId}/submit`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function decide(decision) {
    setError(null);
    if (!reviewComment.trim()) {
      setError("A comment is required with your decision.");
      return;
    }
    try {
      await api.post(`/projects/${projectId}/rca/${rcaId}/reviews`, { decision, comment: reviewComment });
      setReviewComment("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function close(finalStatus) {
    setError(null);
    try {
      await api.post(`/projects/${projectId}/rca/${rcaId}/close`, { finalStatus });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function substitute() {
    if (!substituteWith) return;
    await api.post(`/projects/${projectId}/rca/${rcaId}/reviewers/${substituteFor}/substitute`, { newReviewerId: substituteWith });
    setSubstituteFor(null);
    setSubstituteWith("");
    load();
  }

  async function withdraw() {
    if (!withdrawComment.trim()) {
      setError("A comment explaining the withdrawal is required.");
      return;
    }
    await api.post(`/projects/${projectId}/rca/${rcaId}/withdraw`, { comment: withdrawComment });
    setWithdrawComment("");
    load();
  }

  async function addComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await api.post(`/comments/rca/${rcaId}`, { body: newComment });
    setNewComment("");
    load();
  }

  if (!rca) return <div className="container">Loading...</div>;

  const myReviewerSlot = reviewers.find((r) => r.reviewer_id === user.id && r.status === "pending");
  const allDecided = reviewers.length > 0 && reviewers.every((r) => r.status !== "pending");
  const pendingReviewers = reviewers.filter((r) => r.status === "pending");

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{rca.title}</h2>
        <Link to={`/projects/${projectId}/rca`} className="btn secondary">Back to RCAs</Link>
      </div>
      <p>Severity: <strong>{rca.severity}</strong> · Status: <strong>{rca.status}</strong></p>
      {error && <div className="error-text">{error}</div>}

      {rca.status === "draft" && (
        <div className="card">
          <p>This RCA is still a draft. Fill in the sections below, then submit for review.</p>
          <button className="btn" onClick={submit}>Submit for review</button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sections</h3>
        {sections.map((s) => (
          <div className="field" key={s.type}>
            <label>{SECTION_LABELS[s.type]}</label>
            <textarea
              rows={3}
              defaultValue={s.content}
              disabled={rca.status !== "draft" && rca.status !== "in_review"}
              onBlur={(e) => e.target.value !== s.content && saveSection(s.type, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Reviewers</h3>
        <table>
          <thead><tr><th>Reviewer</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {reviewers.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "pending" && (
                    <button className="btn secondary" onClick={() => setSubstituteFor(r.reviewer_id)}>Substitute</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {substituteFor && (
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <select value={substituteWith} onChange={(e) => setSubstituteWith(e.target.value)}>
              <option value="">Select replacement reviewer...</option>
              {members.filter((m) => !reviewers.some((r) => r.reviewer_id === m.id)).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button className="btn" onClick={substitute}>Confirm substitution</button>
            <button className="btn secondary" onClick={() => setSubstituteFor(null)}>Cancel</button>
          </div>
        )}

        {reviews.length > 0 && (
          <>
            <h4>Decisions recorded</h4>
            {reviews.map((rv) => (
              <div key={rv.id} className="comment">
                <div className="author">{rv.name} — {rv.decision}</div>
                <div>{rv.comment}</div>
              </div>
            ))}
          </>
        )}

        {rca.status === "in_review" && myReviewerSlot && (
          <div style={{ marginTop: 14 }}>
            <h4>Your decision</h4>
            <textarea
              rows={2}
              placeholder="Mandatory comment explaining your decision..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => decide("approved")}>Approve</button>
              <button className="btn danger" onClick={() => decide("rejected")}>Reject</button>
            </div>
          </div>
        )}

        {rca.status === "in_review" && (
          <div style={{ marginTop: 14 }}>
            <h4>Close investigation</h4>
            {!allDecided && (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Waiting on: {pendingReviewers.map((r) => r.name).join(", ")}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" disabled={!allDecided} onClick={() => close("approved")}>Close as approved</button>
              <button className="btn danger" disabled={!allDecided} onClick={() => close("rejected")}>Close as rejected</button>
            </div>

            <h4 style={{ marginTop: 16 }}>Withdraw instead</h4>
            <textarea rows={2} placeholder="Reason for withdrawal (required)..." value={withdrawComment} onChange={(e) => setWithdrawComment(e.target.value)} />
            <button className="btn secondary" style={{ marginTop: 8 }} onClick={withdraw}>Withdraw RCA</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Comments</h3>
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <div className="author">{c.author_name} <span className="time">{new Date(c.created_at).toLocaleString()}</span></div>
            <div>{c.body}</div>
          </div>
        ))}
        <form onSubmit={addComment} style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment..." />
          <button className="btn" type="submit">Post</button>
        </form>
      </div>
    </div>
  );
}
