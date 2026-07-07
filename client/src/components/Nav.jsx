import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import NotificationBell from "./NotificationBell";

export default function Nav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Available on every page once logged in, except the projects home page
  // itself (there's nowhere further back to go from there).
  const showBack = location.pathname !== "/";

  return (
    <div className="topnav">
      {showBack && (
        <button
          type="button"
          className="linklike"
          onClick={() => navigate(-1)}
          title="Go back"
          style={{ marginRight: 10 }}
        >
          ← Back
        </button>
      )}
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

