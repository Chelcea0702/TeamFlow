import React from "react";

export default function TaskCard({ task, onClick, onDragStart }) {
  return (
    <div
      className="task-card"
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      onClick={() => onClick(task)}
    >
      <div>{task.title}</div>
      <div className="meta">
        <span className={`badge priority-${task.priority}`}>{task.priority}</span>
        <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : "No due date"}</span>
      </div>
    </div>
  );
}

