import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Auth/Login";
import Layout from "@/components/Layout";
import Projects from "@/pages/Projects";
import Dependencies from "@/pages/Projects/Dependencies";
import CopilotPage from "@/pages/Projects/Copilot";
import TasksPage from "@/pages/Tasks";

// 临时占位组件
const Dashboard = () => <div className="text-zinc-600">仪表盘内容开发中...</div>;
const Profile = () => <div className="text-zinc-600">个人中心内容开发中...</div>;

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id/dependencies" element={<Dependencies />} />
          <Route path="projects/:id/copilot" element={<CopilotPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
