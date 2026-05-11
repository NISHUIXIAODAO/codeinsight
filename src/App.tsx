import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Auth/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Projects from "@/pages/Projects";
import Dependencies from "@/pages/Projects/Dependencies";
import CopilotPage from "@/pages/Projects/Copilot";
import TasksPage from "@/pages/Tasks";

function getDefaultHomePath() {
  try {
    const raw = localStorage.getItem("codeinsight:preferences");
    const value = raw ? JSON.parse(raw)?.defaultHome : "dashboard";
    if (value === "projects") return "/projects";
    if (value === "tasks") return "/tasks";
    return "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to={getDefaultHomePath()} replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id/dependencies" element={<Dependencies />} />
          <Route path="projects/:id/copilot" element={<CopilotPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to={getDefaultHomePath()} replace />} />
      </Routes>
    </Router>
  );
}
