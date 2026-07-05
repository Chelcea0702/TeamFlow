import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Nav from "./components/Nav";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Projects from "./pages/Projects";
import ProjectBoard from "./pages/ProjectBoard";
import RCAList from "./pages/RCAList";
import RCADetail from "./pages/RCADetail";
import Dashboard from "./pages/Dashboard";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      {user && <Nav />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Protected><Projects /></Protected>} />
        <Route path="/projects/:projectId" element={<Protected><ProjectBoard /></Protected>} />
        <Route path="/projects/:projectId/rca" element={<Protected><RCAList /></Protected>} />
        <Route path="/projects/:projectId/rca/:rcaId" element={<Protected><RCADetail /></Protected>} />
        <Route path="/projects/:projectId/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
