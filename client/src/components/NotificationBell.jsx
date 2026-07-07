import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Polls every 15s for new in-app notifications. A short delay between an
// event happening and it appearing here is a documented, accepted tradeoff
// (see design decisions: Notifications / Section 3.3), not a bug.
export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  async function load() {
    try {
      const data = await api.get("/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silently ignore transient polling failures.
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    load();
  }

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button className="linklike" onClick={() => setOpen((o) => !o)}>
        🔔{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </button>
      {open && (
        <div className="notif-panel">
          <div style={{ padding: "8px 14px", display: "flex", justifyContent: "space-between" }}>
            <strong style={{ fontSize: "0.85rem" }}>Notifications</strong>
            <button className="linklike" style={{ fontSize: "0.75rem" }} onClick={markAllRead}>Mark all read</button>
          </div>
          {notifications.length === 0 && <div className="notif-item">No notifications yet.</div>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.read_at ? "" : "unread"}`}
              onClick={() => markRead(n.id)}
            >
              <div>{n.title}</div>
              <div style={{ color: "var(--text-muted)" }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

