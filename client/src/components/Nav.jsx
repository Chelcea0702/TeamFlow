import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";

export default function Nav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="topnav">
      <Link to="/" className="brand" style={{ textDecoration: "none" }}>TeamFlow</Link>
      <nav>
        <span style={{ fontSize: "0.85rem" }}>{user?.name}</span>
        <button className="linklike" onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <NotificationBell />
        <button className="linklike" onClick={logout}>Log out</button>
      </nav>
    </div>
  );
}
