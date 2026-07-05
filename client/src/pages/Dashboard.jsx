import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";

function BarChart(props) {
  const { data, labelKey, valueKey } = props;
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar" style={{ height: `${(d[valueKey] / max) * 100}%` }} title={`${d[labelKey]}: ${d[valueKey]}`}>
          <span className="bar-label">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { projectId } = useParams();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/reports/summary`).then(setSummary);
  }, [projectId]);

  if (!summary) return <div className="container">Loading...</div>;

  const velocityData = summary.velocityTrend.map((v) => ({
    label: new Date(v.week).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: v.completed,
  }));
  const workloadData = summary.workloadPerAssignee.map((w) => ({ label: w.name.split(" ")[0], value: w.open_tasks }));

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Project Dashboard</h2>
        <Link to={`/projects/${projectId}`} className="btn secondary">Back to board</Link>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="stat-value">{summary.completionRate}%</div>
          <div className="stat-label">Completion rate ({summary.doneTasks}/{summary.totalTasks} tasks)</div>
        </div>
        <div className="card">
          <div className="stat-value">{summary.overdueTasks}</div>
          <div className="stat-label">Overdue tasks</div>
        </div>
        <div className="card">
          <div className="stat-value">{summary.projectHealthScore}</div>
          <div className="stat-label">Project health score</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Velocity (tasks completed per week)</h3>
        {velocityData.length > 0 ? (
          <BarChart data={velocityData} labelKey="label" valueKey="value" />
        ) : (
          <p style={{ color: "var(--text-muted)" }}>Not enough completed tasks yet to show a trend.</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Workload per assignee (open tasks)</h3>
        {workloadData.length > 0 ? (
          <BarChart data={workloadData} labelKey="label" valueKey="value" />
        ) : (
          <p style={{ color: "var(--text-muted)" }}>No members yet.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>RCA volume by status</h3>
        <table>
          <thead><tr><th>Status</th><th>Count</th></tr></thead>
          <tbody>
            {summary.rcaVolume.map((r) => (
              <tr key={r.status}><td>{r.status}</td><td>{r.count}</td></tr>
            ))}
            {summary.rcaVolume.length === 0 && <tr><td colSpan={2}>No RCAs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
